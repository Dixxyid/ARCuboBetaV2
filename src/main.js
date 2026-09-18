import * as THREE from 'three';

import { initUIStore }           from './ui/uiState.js';
import { celestialData }         from './data/celestialData.js';
import { ModelLoader }           from './core/ModelLoader.js';
import { LightingManager }       from './core/Lighting.js';
import { ARStateManager, ARSTATES } from './ar/ARState.js';
import { EighthWallManager }     from './ar/EighthWallManager.js';
import { CoordinateLock }        from './ar/CoordinateLock.js';

// Konfigurasi Image Target 8th Wall dengan metadata geometri kartu
const AR_IMAGE_TARGETS = [
  {
    name: 'earth',
    type: 'PLANAR',
    imagePath: './targets/raw_images/0_earth_card.png',
    properties: {
      originalWidth: 638,
      originalHeight: 1016,
      width: 638,
      height: 1016,
      top: 0,
      left: 0,
      isRotated: false,
      physicalWidthInMeters: 0.1,
    },
  },
  {
    name: 'mars',
    type: 'PLANAR',
    imagePath: './targets/raw_images/1_mars_card.png',
    properties: {
      originalWidth: 638,
      originalHeight: 1016,
      width: 638,
      height: 1016,
      top: 0,
      left: 0,
      isRotated: false,
      physicalWidthInMeters: 0.1,
    },
  },
];

// Helper pencocokan target name yang robust
function resolveCelestial(targetName) {
  if (!targetName) return null;
  const name = String(targetName).toLowerCase();
  if (name.includes('earth')) return celestialData.earth;
  if (name.includes('mars'))  return celestialData.mars;
  return null;
}

// Durasi (ms) marker harus benar-benar hilang sebelum pindah ke WORLD_TRACKING
const MARKER_LOST_TIMEOUT_MS = 2500;

// Durasi (ms) di VALIDATING sebelum minta scan ulang dunia
const RESCAN_TIMEOUT_MS = 5000;

class AppBootstrapper {
  constructor() {
    this.arStateManager   = null;
    this.eighthWallMgr    = null;
    this.coordinateLock   = null;
    this.modelLoader      = null;
    this.lightingMgr      = null;

    // Three.js objects dari XR8 scene
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;

    // State model
    this.currentModelGroup = null;
    this.currentCelestial  = null;

    // Timer untuk state transitions
    this._markerLostTimer  = null;
    this._rescanTimer      = null;
  }

  // ─── Entry Point ────────────────────────────────────────────────────────────

  async start() {
    console.log('[AstroAR] Menginisialisasi aplikasi...');

    // 1. Alpine UI store
    initUIStore();

    // 2. State machine
    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) window.arUI.setTrackingState(newState);
    });

    // 3. Utilities
    this.coordinateLock = new CoordinateLock();
    this.modelLoader    = new ModelLoader();

    // 4. Canvas untuk XR8 (buat manual, diinject ke body)
    const canvas = this._createCanvas();

    // 5. Inisialisasi 8th Wall Manager
    this.eighthWallMgr = new EighthWallManager({
      canvas,
      imageTargets: AR_IMAGE_TARGETS,
      stateManager: this.arStateManager,
      callbacks: {
        onXRSceneReady:  (xrScene) => this._onXRSceneReady(xrScene),
        onSurfaceReady:  ()        => this._onSurfaceReady(),
        onTargetFound:   (detail)  => this._onTargetFound(detail),
        onTargetUpdated: (detail)  => this._onTargetUpdated(detail),
        onTargetLost:    (detail)  => this._onTargetLost(detail),
        onTrackingLost:  ()        => this._onTrackingLost(),
        onRender:        ()        => this._onRender(),
      },
    });

    await this.eighthWallMgr.init();
    await this.eighthWallMgr.start();

    window.arAppBootstrapper = this;
    console.log('[AstroAR] Aplikasi siap!');
  }

  // ─── Canvas Setup ────────────────────────────────────────────────────────────

  _createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id    = 'xr-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '0',
    });
    document.getElementById('canvas-container').appendChild(canvas);
    return canvas;
  }

  // ─── XR Scene Ready ─────────────────────────────────────────────────────────

  _onXRSceneReady({ renderer, scene, camera }) {
    this._scene    = scene;
    this._camera   = camera;
    this._renderer = renderer;

    // Lighting sudah ditambahkan di EighthWallManager, tapi bisa override di sini
    this.lightingMgr = new LightingManager(scene);
    console.log('[AstroAR] XR Scene Three.js siap.');
  }

  // ─── Surface Ready (WORLD_SCAN → MARKER_SCAN) ───────────────────────────────

  _onSurfaceReady() {
    if (window.arUI) window.arUI.setShowRescanNotif(false);
    console.log('[AstroAR] Surface siap. Mulai cari flashcard...');
  }

  // ─── Image Target Found ──────────────────────────────────────────────────────

  async _onTargetFound(detail) {
    // Batalkan timer "marker lost" jika ada
    this._clearMarkerLostTimer();
    this._clearRescanTimer();

    const celestial = resolveCelestial(detail.name);
    if (!celestial) {
      console.warn('[AstroAR] Target tidak dikenali:', detail.name);
      return;
    }

    // Lock coordinate di world space
    this.coordinateLock.lock(detail);
    this.arStateManager.setState(ARSTATES.COORDINATE_LOCKED);

    if (window.arUI) {
      window.arUI.setShowRescanNotif(false);
      window.arUI.setCoordinateLocked(true);
    }

    // Load model jika berbeda atau belum ada
    if (this.currentCelestial?.name !== celestial.name || !this.currentModelGroup) {
      await this._loadModel(celestial, detail);
    } else {
      // Posisikan ulang model yang sudah ada
      this.coordinateLock.applyTo(this.currentModelGroup);
    }
  }

  // ─── Image Target Updated ────────────────────────────────────────────────────

  _onTargetUpdated(detail) {
    // Update pose lock saat marker masih visible
    this.coordinateLock.update(detail);

    if (this.currentModelGroup) {
      this.coordinateLock.applyTo(this.currentModelGroup);
    }
  }

  // ─── Image Target Lost ───────────────────────────────────────────────────────

  _onTargetLost(detail) {
    if (!this.arStateManager.is(ARSTATES.COORDINATE_LOCKED) &&
        !this.arStateManager.is(ARSTATES.WORLD_TRACKING)) return;

    this.arStateManager.setState(ARSTATES.VALIDATING);
    if (window.arUI) window.arUI.setCoordinateLocked(false);

    // Beri jeda sebentar — mungkin marker hanya ter-oklusi sebentar
    this._markerLostTimer = setTimeout(() => {
      this._handleMarkerFullyLost();
    }, MARKER_LOST_TIMEOUT_MS);
  }

  _handleMarkerFullyLost() {
    // Validasi apakah pose masih masuk akal
    if (this._camera && this.coordinateLock.isValid(this._camera.position)) {
      // Pose valid → lanjut ke WORLD_TRACKING, model tetap mengambang
      this.arStateManager.setState(ARSTATES.WORLD_TRACKING);
      console.log('[AstroAR] Marker hilang → WORLD_TRACKING. Model mengambang di world space.');
    } else {
      // Pose tidak valid → minta scan ulang
      this._requestRescan();
    }
  }

  // ─── World Tracking Error ────────────────────────────────────────────────────

  _onTrackingLost() {
    if (window.arUI) window.arUI.setShowRescanNotif(true);
    this._requestRescan();
  }

  _requestRescan() {
    this.arStateManager.setState(ARSTATES.WORLD_SCAN);
    if (window.arUI) window.arUI.setShowRescanNotif(true);
    this.eighthWallMgr.resetToWorldScan();

    // Hapus model sementara saat rescan — data lama tidak valid
    this._clearRescanTimer();
    this._rescanTimer = setTimeout(() => {
      if (this.arStateManager.is(ARSTATES.WORLD_SCAN)) {
        // Masih belum dapat tracking → clear model
        this._disposeCurrentModel();
        if (window.arUI) {
          window.arUI.setSelectedCelestial(null);
          window.arUI.setCoordinateLocked(false);
        }
        this.coordinateLock.clear();
      }
    }, RESCAN_TIMEOUT_MS);

    console.log('[AstroAR] Meminta scan ulang dunia...');
  }

  // ─── Model Loading ───────────────────────────────────────────────────────────

  async _loadModel(celestialInfo, targetDetail) {
    this._disposeCurrentModel();
    if (window.arUI) window.arUI.setLoadingModel(true);

    try {
      const modelPath = celestialInfo.modelPath.replace(/^\/public/, '');
      const model = await this.modelLoader.loadModel(modelPath);
      this.modelLoader.normalizeScale(model, celestialInfo.displaySize ?? 0.15);

      // Double-side rendering agar terlihat dari segala sudut
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.side        = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });

      this.currentModelGroup = new THREE.Group();
      this.currentModelGroup.add(model);
      this._scene.add(this.currentModelGroup);

      // Posisikan di world coordinate sesuai pose target
      this.coordinateLock.applyTo(this.currentModelGroup);

      this.currentCelestial = celestialInfo;
      if (window.arUI) {
        window.arUI.setSelectedCelestial(celestialInfo);
        window.arUI.setLoadingModel(false);
      }

      console.log(`[AstroAR] Model "${celestialInfo.name}" dimuat di world space.`);
    } catch (err) {
      console.error('[AstroAR] Gagal memuat model:', err);
      if (window.arUI) {
        window.arUI.setLoadError('Gagal memuat model 3D. Periksa koneksi dan coba scan ulang.');
      }
    }
  }

  // ─── Lock Coordinate (tombol manual) ────────────────────────────────────────

  lockCoordinate() {
    if (!this.coordinateLock.isLocked) {
      console.warn('[AstroAR] Belum ada pose untuk di-lock.');
      return;
    }
    // Sudah di-lock otomatis saat target found — ini hanya konfirmasi state
    this.arStateManager.setState(ARSTATES.COORDINATE_LOCKED);
    if (window.arUI) window.arUI.setCoordinateLocked(true);
    console.log('[AstroAR] Coordinate di-lock manual.');
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  _onRender() {
    if (this.currentModelGroup && this.currentModelGroup.children.length > 0) {
      // Rotasi pelan model planet pada porosnya (efek visual astronomi)
      this.currentModelGroup.children[0].rotation.y += 0.005;
    }
  }

  _disposeCurrentModel() {
    if (this.currentModelGroup) {
      this.modelLoader.disposeModel(this.currentModelGroup);
      this._scene?.remove(this.currentModelGroup);
      this.currentModelGroup = null;
    }
  }

  _clearMarkerLostTimer() {
    if (this._markerLostTimer) {
      clearTimeout(this._markerLostTimer);
      this._markerLostTimer = null;
    }
  }

  _clearRescanTimer() {
    if (this._rescanTimer) {
      clearTimeout(this._rescanTimer);
      this._rescanTimer = null;
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppBootstrapper();
  app.start().catch(err => {
    console.error('[AstroAR] Fatal error saat boot:', err);
  });
});
