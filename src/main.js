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
  {
    name: 'sun',
    type: 'PLANAR',
    imagePath: './targets/raw_images/sun_card.png',
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
  if (name.includes('sun') || name.includes('matahari')) return celestialData.sun;
  return null;
}

const MARKER_LOST_TIMEOUT_MS = 2500;
const RESCAN_TIMEOUT_MS = 5000;

class AppBootstrapper {
  constructor() {
    this.arStateManager = null;
    this.eighthWallMgr  = null;
    this.modelLoader    = null;
    this.lightingMgr    = null;
    this.gestureManager = null;

    // Three.js objects dari XR8 scene
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;
    this._canvas   = null;

    // ── Multi-Target Node Registry ──
    // Menyimpan anchorGroup, visualGroup, model, dan CoordinateLock mandiri untuk SETIAP planet
    this.targets = new Map();
    this.currentCelestial = null;
    this.isSlamLocked = false;

    // Timers
    this._markerLostTimer = null;
    this._rescanTimer     = null;
  }

  // ─── Entry Point ────────────────────────────────────────────────────────────

  async start() {
    console.log('[AstroAR] Menginisialisasi aplikasi WebAR Multi-Target...');

    // 1. Alpine UI store
    initUIStore();

    // 2. State machine
    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) window.arUI.setTrackingState(newState);
    });

    // 3. Model Loader
    this.modelLoader = new ModelLoader();

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
    console.log('[AstroAR] Aplikasi WebAR Multi-Target siap!');
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
      onTap: (intersect) => {
        // Cari planet mana yang diketuk pengguna
        let obj = intersect?.object;
        while (obj && !obj.userData?.celestialId && obj.parent) {
          obj = obj.parent;
        }
        const celestialId = obj?.userData?.celestialId;
        if (celestialId && this.targets.has(celestialId)) {
          this._setActiveFocus(celestialId, false);
          if (window.arUI) window.arUI.showDetail = true;
        } else if (this.currentCelestial) {
          if (window.arUI) window.arUI.showDetail = true;
        }
      },
    });

    // Berikan list seluruh visualGroup aktif ke GestureManager untuk tap raycasting
    this.gestureManager.interactiveObjectsProvider = () => {
      const list = [];
      for (const t of this.targets.values()) {
        if (t.isVisible && t.anchorGroup.visible) {
          list.push(...t.visualGroup.children);
        }
      }
      return list;
    };

    // ── Inisialisasi Multi-Target Nodes (Earth, Mars, Moon) ──
    for (const key of Object.keys(celestialData)) {
      const celestial = celestialData[key];

      // Tier 1: AnchorGroup di ruang dunia Three.js
      const anchorGroup = new THREE.Group();
      anchorGroup.name = `AnchorGroup_${celestial.id}`;
      anchorGroup.visible = false;

      // Tier 2: VisualGroup untuk manipulasi rotasi/zoom pengguna
      const visualGroup = new THREE.Group();
      visualGroup.name = `VisualGroup_${celestial.id}`;
      visualGroup.userData = { celestialId: celestial.id };
      anchorGroup.add(visualGroup);

      this._scene.add(anchorGroup);

      // CoordinateLock & Stabilizer independen untuk tiap target
      const lock = new CoordinateLock();
      lock.onTrackingLost = () => {
        this._onTargetLost({ name: celestial.id });
      };

      this.targets.set(celestial.id, {
        id: celestial.id,
        celestial,
        anchorGroup,
        visualGroup,
        coordinateLock: lock,
        planetModel: null,
        isVisible: false,
      });
    }

    // Preload seluruh model astronomi ke anchor-nya masing-masing
    this._preloadAllModels();

    console.log('[AstroAR] Multi-Target XR Scene, AnchorGroups & Stabilizers siap.');
  }

  // ─── Preload Model ke Tiap Target Anchor ────────────────────────────────────

  async _preloadAllModels() {
    for (const key of Object.keys(celestialData)) {
      const celestial = celestialData[key];
      const targetNode = this.targets.get(celestial.id);
      if (!targetNode) continue;

      try {
        const modelPath = celestial.modelPath.replace(/^\/public/, '');
        const model = await this.modelLoader.loadModel(modelPath);
        this.modelLoader.normalizeScale(model, celestial.displaySize ?? 0.15);

        // Koreksi orientasi awal
        if (celestial.defaultRotation) {
          const [rx, ry, rz] = celestial.defaultRotation;
          model.rotation.set(rx, ry, rz);
        }

        model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.side        = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        });

        targetNode.visualGroup.add(model);
        targetNode.planetModel = model;
        console.log(`[AstroAR] Model multi-target "${celestial.name}" siap.`);
      } catch (err) {
        console.error(`[AstroAR] Gagal memuat model "${celestial.name}":`, err);
      }
    }
  }

  // ─── Fokus Planet Aktif untuk Gestur & Detail ───────────────────────────────

  _setActiveFocus(celestialId, resetGestures = true) {
    const targetNode = this.targets.get(celestialId);
    if (!targetNode) return;

    this.currentCelestial = targetNode.celestial;
    this.gestureManager.setTarget(targetNode.visualGroup);
    if (resetGestures) {
      this.gestureManager.reset();
    }
    if (window.arUI) {
      window.arUI.setSelectedCelestial(targetNode.celestial);
    }
  }

  // ─── Konfirmasi Scan Permukaan Selesai (Klik OK) ─────────────────────────────

  confirmSurfaceDone() {
    this.arStateManager.setState(ARSTATES.MARKER_SCAN);
    if (window.arUI) {
      window.arUI.setTrackingState(ARSTATES.MARKER_SCAN);
    }
    console.log('[AstroAR] Konfirmasi permukaan diterima → Mode MARKER_SCAN aktif.');
  }

  // ─── Toggle Lock / Unlock Coordinate (Tombol HUD Multi-Target) ──────────────

  toggleCoordinateLock() {
    // ── Mode: SLAM_LOCKED → Buka kuncian, kembali ke Marker ──
    if (this.isSlamLocked) {
      for (const t of this.targets.values()) {
        t.coordinateLock.unlockFromSlam(t.anchorGroup);
        t.anchorGroup.visible = false;
        t.isVisible = false;
      }
      this.isSlamLocked = false;
      this.arStateManager.setState(ARSTATES.MARKER_SCAN);
      if (window.arUI) {
        window.arUI.setSlamLocked(false);
        window.arUI.setTrackingState(ARSTATES.MARKER_SCAN);
        window.arUI.setCollectProgress?.(0);
      }
      console.log('[AstroAR] SLAM dibuka → Seluruh objek kembali ke mode Marker.');
      return;
    }

    // ── Mode: Sedang collecting → Batalkan ──
    let isCollectingAny = false;
    for (const t of this.targets.values()) {
      if (t.coordinateLock.isCollecting) {
        t.coordinateLock._isCollecting = false;
        t.coordinateLock._onCollectionDone = null;
        isCollectingAny = true;
      }
    }
    if (isCollectingAny) {
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setSlamLocked(false);
        window.arUI.setTrackingState(ARSTATES.MARKER_TRACKING);
        window.arUI.setCollectProgress?.(0);
      }
      console.log('[AstroAR] Pengumpulan data SLAM dibatalkan.');
      return;
    }

    // ── Mode: MARKER_TRACKING → Mulai kumpulkan pose data SLAM untuk seluruh kartu yang aktif ──
    const activeTargets = Array.from(this.targets.values()).filter(t => t.coordinateLock.isTracking);
    if (activeTargets.length === 0) {
      console.warn('[AstroAR] Tidak bisa lock: belum ada marker terdeteksi. Arahkan kamera ke kartu.');
      return;
    }

    let collectedCount = 0;
    const totalToCollect = activeTargets.length;

    this.arStateManager.setState(ARSTATES.SLAM_COLLECTING);
    if (window.arUI) {
      window.arUI.setSlamLocked(false);
      window.arUI.setTrackingState(ARSTATES.SLAM_COLLECTING);
      window.arUI.setCollectProgress?.(0);
    }

    activeTargets.forEach(t => {
      t.coordinateLock.startSlamCollection(() => {
        collectedCount++;
        t.coordinateLock.commitSlamLock(t.anchorGroup);

        if (collectedCount >= totalToCollect) {
          this.isSlamLocked = true;
          this.arStateManager.setState(ARSTATES.SLAM_LOCKED);
          if (window.arUI) {
            window.arUI.setSlamLocked(true);
            window.arUI.setTrackingState(ARSTATES.SLAM_LOCKED);
            window.arUI.setCollectProgress?.(1.0);
          }
          console.log(`[AstroAR] Multi-target SLAM World Anchor terkunci (${totalToCollect} objek)!`);
        }
      });
    });

    console.log(`[AstroAR] Mulai mengumpulkan data SLAM untuk ${totalToCollect} marker...`);
  }

  // ─── Image Target Found ──────────────────────────────────────────────────────

  async _onTargetFound(detail) {
    this._clearMarkerLostTimer();
    this._clearRescanTimer();

    // Abaikan jika sedang dalam fase scan permukaan ruangan awal
    if (this.arStateManager.is(ARSTATES.SURFACE_SCAN) ||
        this.arStateManager.is(ARSTATES.SURFACE_CONFIRM)) {
      return;
    }

    // Jika SLAM sudah terkunci permanen, abaikan deteksi kartu
    if (this.isSlamLocked) {
      return;
    }

    const celestial = resolveCelestial(detail.name);
    if (!celestial) {
      console.warn('[AstroAR] Target tidak dikenali:', detail.name);
      return;
    }

    const targetNode = this.targets.get(celestial.id);
    if (!targetNode) return;

    // Kunci pose pada koordinat marker yang sesuai
    targetNode.coordinateLock.lock(detail);
    targetNode.anchorGroup.visible = true;
    targetNode.isVisible = true;

    // Fokuskan interaksi ke kartu yang baru terdeteksi
    this._setActiveFocus(celestial.id);

    // Set state MARKER_TRACKING jika belum SLAM collecting
    if (!this.arStateManager.is(ARSTATES.SLAM_COLLECTING)) {
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setShowRescanNotif(false);
        window.arUI.setSlamLocked(false);
      }
    }

    this._updateMultiTargetStatus();
    console.log(`[AstroAR] Multi-target terdeteksi: "${celestial.name}"`);
  }

  // ─── Image Target Updated ────────────────────────────────────────────────────

  _onTargetUpdated(detail) {
    if (this.arStateManager.is(ARSTATES.SURFACE_SCAN) ||
        this.arStateManager.is(ARSTATES.SURFACE_CONFIRM) ||
        this.isSlamLocked) {
      return;
    }

    const celestial = resolveCelestial(detail.name);
    if (!celestial) return;

    const targetNode = this.targets.get(celestial.id);
    if (!targetNode || targetNode.coordinateLock.isSlamLocked) return;

    targetNode.coordinateLock.update(detail);
    if (!targetNode.anchorGroup.visible && targetNode.coordinateLock.isTracking) {
      targetNode.anchorGroup.visible = true;
      targetNode.isVisible = true;
      this._updateMultiTargetStatus();
    }
  }

  // ─── Image Target Lost ───────────────────────────────────────────────────────

  _onTargetLost(detail) {
    if (this.isSlamLocked) return;

    const celestial = resolveCelestial(detail?.name);
    if (!celestial) return;

    const targetNode = this.targets.get(celestial.id);
    if (!targetNode) return;

    targetNode.coordinateLock.setTargetLost();
    targetNode.anchorGroup.visible = false;
    targetNode.isVisible = false;

    console.log(`[AstroAR] Marker "${celestial.name}" hilang dari pandangan.`);
    this._updateMultiTargetStatus();
  }

  // ─── Update Status & HUD Multi-Target ────────────────────────────────────────

  _updateMultiTargetStatus() {
    if (this.isSlamLocked) return;

    const visibleTargets = Array.from(this.targets.values()).filter(t => t.isVisible);

    if (visibleTargets.length === 0) {
      this.arStateManager.setState(ARSTATES.MARKER_SCAN);
      if (window.arUI) {
        window.arUI.setTrackingState(ARSTATES.MARKER_SCAN);
      }
      this.gestureManager?.setTarget(null);
    } else if (visibleTargets.length === 1) {
      const single = visibleTargets[0];
      this._setActiveFocus(single.id, false);
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setTrackingState(ARSTATES.MARKER_TRACKING, `Marker Terdeteksi: ${single.celestial.name}`);
      }
    } else {
      // Lebih dari 1 kartu aktif secara bersamaan!
      const names = visibleTargets.map(t => t.celestial.name.split(' ')[0]).join(', ');
      this.arStateManager.setState(ARSTATES.MARKER_TRACKING);
      if (window.arUI) {
        window.arUI.setTrackingState(ARSTATES.MARKER_TRACKING, `${visibleTargets.length} Marker Aktif (${names})`);
      }
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
    this.isSlamLocked = false;

    for (const t of this.targets.values()) {
      t.coordinateLock.clear();
      t.anchorGroup.visible = false;
      t.isVisible = false;
    }

    this._clearRescanTimer();
    this._rescanTimer = setTimeout(() => {
      if (this.arStateManager.is(ARSTATES.SURFACE_SCAN)) {
        if (window.arUI) {
          window.arUI.setSelectedCelestial(null);
          window.arUI.setSlamLocked(false);
        }
      }
    }, RESCAN_TIMEOUT_MS);

    console.log('[AstroAR] Meminta scan ulang permukaan ruangan...');
  }

  // ─── Render Loop (Three.js 60 FPS) ──────────────────────────────────────────

  _onRender(dt = 0.016) {
    let maxProgress = 0;
    let anyCollecting = false;

    for (const targetNode of this.targets.values()) {
      // 1. Terapkan pose adaptif dan eksekusi watchdog timeout masing-masing target
      targetNode.coordinateLock.applyTo(targetNode.anchorGroup, dt);

      if (targetNode.coordinateLock.isCollecting) {
        anyCollecting = true;
        maxProgress = Math.max(maxProgress, targetNode.coordinateLock.collectProgress);
      }

      // 2. Rotasi otomatis planet jika terlihat dan sedang tidak disentuh oleh drag pengguna
      if (targetNode.anchorGroup.visible && targetNode.planetModel) {
        const isDraggingThis = (this.gestureManager?.isDragging && this.gestureManager.targetObject === targetNode.visualGroup);
        if (!isDraggingThis) {
          targetNode.planetModel.rotation.y += 0.25 * dt;
        }
      }
    }

    // Update progress bar jika sedang collecting
    if (anyCollecting && window.arUI) {
      window.arUI.setCollectProgress(maxProgress);
    }

    // 3. Update gestur sentuh (rotasi inersia damping & pinch scale)
    if (this.gestureManager) {
      this.gestureManager.update(dt);
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
