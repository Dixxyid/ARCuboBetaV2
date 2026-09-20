import * as THREE from 'three';

// 8th Wall XR8.Threejs pipeline module mewajibkan THREE tersedia di global window
if (typeof window !== 'undefined') {
  window.THREE = THREE;
}

import { initUIStore }           from './ui/uiState.js';
import { celestialData }         from './data/celestialData.js';
import { ModelLoader }           from './core/ModelLoader.js';
import { LightingManager }       from './core/Lighting.js';
import { GestureManager }        from './core/GestureManager.js';
import { ARStateManager, ARSTATES } from './ar/ARState.js';
import { EighthWallManager }     from './ar/EighthWallManager.js';
import { CoordinateLock }        from './ar/CoordinateLock.js';

// Konfigurasi Image Target 8th Wall dengan metadata geometri kartu
const AR_IMAGE_TARGETS = [
  {
    name: 'earth',
    type: 'PLANAR',
    imagePath: './targets/raw_images/earth_card.png',
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
    imagePath: './targets/raw_images/mars_card.png',
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
    name: 'moon',
    type: 'PLANAR',
    imagePath: './targets/raw_images/moon_card.png',
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
  if (name.includes('earth') || name.includes('bumi')) return celestialData.earth;
  if (name.includes('mars')) return celestialData.mars;
  if (name.includes('moon') || name.includes('bulan')) return celestialData.moon;
  return null;
}

const MARKER_LOST_TIMEOUT_MS = 2500;
const RESCAN_TIMEOUT_MS = 5000;

class AppBootstrapper {
  constructor() {
    this.arStateManager = null;
    this.eighthWallMgr  = null;
    this.coordinateLock = null;
    this.modelLoader    = null;
    this.lightingMgr    = null;
    this.gestureManager = null;

    // Three.js objects dari XR8 scene
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;
    this._canvas   = null;

    // Two-Tier Scene Graph Hierarchy
    // Tier 1: anchorGroup (mengatur world position/anchor fisik di ruangan)
    this.anchorGroup = null;
    // Tier 2: visualGroup (mengatur rotasi sentuhan & zoom skala pengguna)
    this.visualGroup = null;
    this.currentCelestial = null;

    // Guard anti-flickering: hanya satu target aktif pada satu waktu
    // Mencegah bug moon/earth saling muncul saat scan
    this._activeTargetName = null;
    this._targetConfirmTimer = null; // debounce sebelum benar-benar load model

    // Timers
    this._markerLostTimer = null;
    this._rescanTimer     = null;
  }

  // ─── Entry Point ────────────────────────────────────────────────────────────

  async start() {
    console.log('[AstroAR] Menginisialisasi aplikasi WebAR...');

    // 1. Alpine UI store
    initUIStore();

    // 2. State machine
    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) window.arUI.setTrackingState(newState);
    });

    // 3. Utilities
    this.coordinateLock = new CoordinateLock();
    this.modelLoader    = new ModelLoader();

    // 4. Canvas untuk XR8
    this._canvas = this._createCanvas();

    // 5. Inisialisasi 8th Wall Manager
    this.eighthWallMgr = new EighthWallManager({
      canvas: this._canvas,
      imageTargets: AR_IMAGE_TARGETS,
      stateManager: this.arStateManager,
      callbacks: {
        onXRSceneReady: (xrScene) => this._onXRSceneReady(xrScene),
        onScanProgress: (progress) => {
          if (window.arUI) window.arUI.setScanProgress(progress);
        },
        onSurfaceDataCollected: () => {
          console.log('[AstroAR] Permukaan terkumpul. Menunggu konfirmasi user...');
        },
        onTargetFound:   (detail) => this._onTargetFound(detail),
        onTargetUpdated: (detail) => this._onTargetUpdated(detail),
        onTargetLost:    (detail) => this._onTargetLost(detail),
        onTrackingLost:  ()       => this._onTrackingLost(),
        onRender:        (dt)     => this._onRender(dt),
      },
    });

    await this.eighthWallMgr.init();
    await this.eighthWallMgr.start();

    window.arAppBootstrapper = this;
    console.log('[AstroAR] Aplikasi WebAR siap!');
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
      touchAction: 'none', // Cegah scroll browser saat interaksi 3D
    });

    const setCanvasSize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    window.addEventListener('orientationchange', () => {
      setTimeout(setCanvasSize, 200);
    });

    document.getElementById('canvas-container').appendChild(canvas);
    return canvas;
  }

  // ─── XR Scene Ready ─────────────────────────────────────────────────────────

  _onXRSceneReady({ renderer, scene, camera }) {
    this._scene    = scene;
    this._camera   = camera;
    this._renderer = renderer;

    this.lightingMgr = new LightingManager(scene);

    // Inisialisasi GestureManager untuk sentuh drag orbit & pinch zoom
    this.gestureManager = new GestureManager({
      canvas: this._canvas,
      camera: this._camera,
      onTap: () => {
        if (window.arUI && this.currentCelestial) {
          window.arUI.showDetail = true;
        }
      },
    });

    console.log('[AstroAR] XR Scene Three.js & GestureManager siap.');
  }

  // ─── Konfirmasi Scan Permukaan Selesai (Klik OK) ─────────────────────────────

  confirmSurfaceDone() {
    this.arStateManager.setState(ARSTATES.MARKER_SCAN);
    if (window.arUI) {
      window.arUI.setTrackingState(ARSTATES.MARKER_SCAN);
    }
    console.log('[AstroAR] Konfirmasi permukaan diterima → Mode MARKER_SCAN aktif.');
  }

  // ─── Toggle Lock / Unlock Coordinate (Tombol HUD) ───────────────────────────

  toggleCoordinateLock() {
    // ── Mode: SLAM_LOCKED → Buka kuncian, kembali ke Marker ──
    if (this.coordinateLock.isSlamLocked) {
      this.coordinateLock.unlockFromSlam(this.anchorGroup);
      // Sembunyikan objek sampai marker terlihat lagi
      if (this.anchorGroup) this.anchorGroup.visible = false;
      this.arStateManager.setState(ARSTATES.MARKER_SCAN);
      if (window.arUI) {
        window.arUI.setSlamLocked(false);
        window.arUI.setTrackingState(ARSTATES.MARKER_SCAN);
        window.arUI.setCollectProgress?.(0);
      }
      console.log('[AstroAR] SLAM dibuka → Kembali ke mode Marker. Arahkan kamera ke kartu.');
      return;
    }

    // ── Mode: Sedang collecting → Batalkan ──
    if (this.coordinateLock.isCollecting) {
      this.coordinateLock._isCollecting = false;
      this.coordinateLock._onCollectionDone = null;
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setSlamLocked(false);
        window.arUI.setTrackingState(ARSTATES.MARKER_TRACKING);
        window.arUI.setCollectProgress?.(0);
      }
      console.log('[AstroAR] Pengumpulan data SLAM dibatalkan.');
      return;
    }

    // ── Mode: MARKER_TRACKING → Mulai kumpulkan data pose SLAM ──
    if (!this.coordinateLock.isTracking) {
      console.warn('[AstroAR] Tidak bisa lock: marker belum terdeteksi. Arahkan kamera ke kartu.');
      return;
    }

    // Mulai fase pengumpulan 30 frame pose data yang konkret & valid
    const started = this.coordinateLock.startSlamCollection(() => {
      // Dipanggil otomatis setelah 30 frame terkumpul — commit lock!
      this.coordinateLock.commitSlamLock(this.anchorGroup);
      this.arStateManager.setState(ARSTATES.SLAM_LOCKED);
      if (window.arUI) {
        window.arUI.setSlamLocked(true);
        window.arUI.setTrackingState(ARSTATES.SLAM_LOCKED);
        window.arUI.setCollectProgress?.(1.0);
      }
      console.log('[AstroAR] SLAM World Anchor terkunci kokoh di ruang fisik!');
    });

    if (started) {
      this.arStateManager.setState(ARSTATES.SLAM_COLLECTING);
      if (window.arUI) {
        window.arUI.setSlamLocked(false);
        window.arUI.setTrackingState(ARSTATES.SLAM_COLLECTING);
        window.arUI.setCollectProgress?.(0);
      }
      console.log('[AstroAR] Mulai mengumpulkan data SLAM (30 frame)...');
    }
  }

  // ─── Image Target Found ──────────────────────────────────────────────────────


  async _onTargetFound(detail) {
    this._clearMarkerLostTimer();
    this._clearRescanTimer();

    const celestial = resolveCelestial(detail.name);
    if (!celestial) {
      console.warn('[AstroAR] Target tidak dikenali:', detail.name);
      return;
    }

    // ── Anti-flickering guard ─────────────────────────────────────────────────
    // Jika target yang masuk BERBEDA dari yang aktif, abaikan dulu selama 400ms
    // Ini mencegah bug "scan bumi → muncul bulan" akibat race condition
    if (this._activeTargetName && this._activeTargetName !== celestial.id) {
      console.warn(`[AstroAR] Target "${celestial.id}" masuk saat "${this._activeTargetName}" aktif — diabaikan.`);
      return;
    }
    // Set nama target aktif segera
    this._activeTargetName = celestial.id;

    // Kunci pose awal
    this.coordinateLock.lock(detail);

    // Jika belum dalam keadaan SLAM_LOCKED, set state ke MARKER_TRACKING
    if (!this.coordinateLock.isSlamLocked) {
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setShowRescanNotif(false);
        window.arUI.setSlamLocked(false);
      }
    }

    // Load model jika belum ada atau berbeda
    if (this.currentCelestial?.id !== celestial.id || !this.anchorGroup) {
      await this._loadModel(celestial, detail);
    }
  }

  // ─── Image Target Updated ────────────────────────────────────────────────────

  _onTargetUpdated(detail) {
    // Tolak update pose dari target yang berbeda dengan yang sedang aktif
    // Ini mencegah bug di mana update bulan menggeser posisi bumi (race condition)
    const celestial = resolveCelestial(detail.name);
    if (!celestial || celestial.id !== this._activeTargetName) return;

    // Update target pose di CoordinateLock (jika dalam SLAM_LOCKED, otomatis diabaikan)
    this.coordinateLock.update(detail);
  }

  // ─── Image Target Lost ───────────────────────────────────────────────────────

  _onTargetLost(detail) {
    // Hanya proses kehilangan target jika memang target yang aktif yang hilang
    if (detail && this._activeTargetName) {
      const celestial = resolveCelestial(detail.name);
      if (!celestial || celestial.id !== this._activeTargetName) return;
    }

    this.coordinateLock.setTargetLost();

    // Jika dalam mode SLAM_LOCKED, objek tetap kokoh menancap di ruang fisik SLAM!
    if (this.coordinateLock.isSlamLocked) {
      console.log('[AstroAR] Kartu lepas dari pandangan, tetapi SLAM_LOCKED aktif: Objek tetap kokoh.');
      return;
    }

    if (!this.arStateManager.is(ARSTATES.MARKER_TRACKING)) return;

    this.arStateManager.setState(ARSTATES.VALIDATING);

    this._markerLostTimer = setTimeout(() => {
      this._handleMarkerFullyLost();
    }, MARKER_LOST_TIMEOUT_MS);
  }

  _handleMarkerFullyLost() {
    if (this.coordinateLock.isSlamLocked) return;

    if (this.coordinateLock.isValid(this._camera?.position)) {
      // Masih valid: kembali ke pencarian marker
      this.arStateManager.setState(ARSTATES.MARKER_SCAN);
      console.log('[AstroAR] Marker lepas, kembali ke mode MARKER_SCAN.');
    } else {
      this._requestRescan();
    }
  }

  // ─── World Tracking Error ────────────────────────────────────────────────────

  _onTrackingLost() {
    if (window.arUI) window.arUI.setShowRescanNotif(true);
    this._requestRescan();
  }

  _requestRescan() {
    this.arStateManager.setState(ARSTATES.SURFACE_SCAN);
    if (window.arUI) window.arUI.setShowRescanNotif(true);
    this.eighthWallMgr.resetToSurfaceScan();

    this._clearRescanTimer();
    this._rescanTimer = setTimeout(() => {
      if (this.arStateManager.is(ARSTATES.SURFACE_SCAN)) {
        this._disposeCurrentModel();
        if (window.arUI) {
          window.arUI.setSelectedCelestial(null);
          window.arUI.setSlamLocked(false);
        }
        this.coordinateLock.clear();
      }
    }, RESCAN_TIMEOUT_MS);

    console.log('[AstroAR] Meminta scan ulang permukaan ruangan...');
  }

  // ─── Model Loading dengan Two-Tier Hierarchy ─────────────────────────────────

  async _loadModel(celestialInfo) {
    this._disposeCurrentModel();
    if (window.arUI) window.arUI.setLoadingModel(true);

    try {
      const modelPath = celestialInfo.modelPath.replace(/^\/public/, '');
      const model = await this.modelLoader.loadModel(modelPath);
      this.modelLoader.normalizeScale(model, celestialInfo.displaySize ?? 0.15);

      // ── Koreksi Orientasi Model (Fix Rotasi Terbalik) ──
      // GLB planet sering memiliki sumbu Y ke atas yang berbeda dari konvensi 8th Wall.
      // defaultRotation di celestialData mendefinisikan rotasi koreksi awal.
      if (celestialInfo.defaultRotation) {
        const [rx, ry, rz] = celestialInfo.defaultRotation;
        model.rotation.set(rx, ry, rz);
      }

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.side        = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });

      // ── Two-Tier Scene Graph Hierarchy ──
      // Tier 1: anchorGroup (mengatur koordinat dunia SLAM)
      this.anchorGroup = new THREE.Group();
      this.anchorGroup.name = 'AnchorGroup';

      // Tier 2: visualGroup (mengatur rotasi sentuhan & zoom skala pengguna)
      // visualGroup TIDAK mendapatkan defaultRotation — itu sudah diterapkan ke model langsung
      this.visualGroup = new THREE.Group();
      this.visualGroup.name = 'VisualGroup';
      this.visualGroup.add(model);

      this.anchorGroup.add(this.visualGroup);
      this._scene.add(this.anchorGroup);

      // Hubungkan visualGroup ke GestureManager untuk interaktivitas sentuh
      this.gestureManager?.setTarget(this.visualGroup);

      // Posisikan anchorGroup awal
      this.coordinateLock.applyTo(this.anchorGroup, 1.0);

      this.currentCelestial = celestialInfo;
      if (window.arUI) {
        window.arUI.setSelectedCelestial(celestialInfo);
        window.arUI.setLoadingModel(false);
      }

      console.log(`[AstroAR] Model "${celestialInfo.name}" dimuat. Orientasi koreksi: ${celestialInfo.defaultRotation ?? 'default'}.`);
    } catch (err) {
      console.error('[AstroAR] Gagal memuat model:', err);
      if (window.arUI) {
        window.arUI.setLoadError('Gagal memuat model 3D. Periksa koneksi dan coba scan ulang.');
      }
    }
  }

  // ─── Render Loop (Three.js 60 FPS) ──────────────────────────────────────────

  _onRender(dt = 0.016) {
    if (this.anchorGroup) {
      // 1. Update pose anchor fisik di ruang dunia
      this.coordinateLock.applyTo(this.anchorGroup, dt);

      // 2. Update progress bar pengumpulan data SLAM di UI
      if (this.coordinateLock.isCollecting && window.arUI) {
        window.arUI.setCollectProgress(this.coordinateLock.collectProgress);
      }

      // 3. Update gestur sentuh (rotasi inersia damping & pinch scale)
      if (this.gestureManager) {
        this.gestureManager.update(dt);
      }

      // 4. Rotasi kontinu planet pada sumbu Y lokal (setelah koreksi orientasi)
      // Rotasi hanya pada anak model langsung (bukan visualGroup) agar
      // gestur orbit tetap independen dari rotasi otomatis planet
      if (this.visualGroup && !this.gestureManager?.isDragging) {
        const planetModel = this.visualGroup.children[0];
        if (planetModel) planetModel.rotation.y += 0.25 * dt;
      }
    }
  }

  _disposeCurrentModel() {
    if (this.visualGroup) {
      this.gestureManager?.setTarget(null);
      this.modelLoader.disposeModel(this.visualGroup);
    }
    if (this.anchorGroup) {
      this.coordinateLock.unlockFromSlam(this.anchorGroup);
      this._scene?.remove(this.anchorGroup);
      this.anchorGroup = null;
      this.visualGroup = null;
    }
    // Bersihkan active target guard saat model di-dispose
    this._activeTargetName = null;
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
