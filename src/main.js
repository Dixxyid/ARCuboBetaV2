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
import { OrbitalAnimator }       from './ar/OrbitalAnimator.js';

// Konfigurasi Image Target 8th Wall dengan metadata geometri kartu
const AR_IMAGE_TARGETS = [
  {
    name: '55cancrie',
    type: 'PLANAR',
    imagePath: './targets/raw_images/55cancrie_card.png',
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
    name: 'asteroid',
    type: 'PLANAR',
    imagePath: './targets/raw_images/asteroid_card.png',
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
    name: 'bimasakti',
    type: 'PLANAR',
    imagePath: './targets/raw_images/bimasakti_card.png',
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
    name: 'ceres',
    type: 'PLANAR',
    imagePath: './targets/raw_images/ceres_card.png',
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
    name: 'comet',
    type: 'PLANAR',
    imagePath: './targets/raw_images/comet_card.png',
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
    name: 'enceladus',
    type: 'PLANAR',
    imagePath: './targets/raw_images/enceladus_card.png',
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
    name: 'eris',
    type: 'PLANAR',
    imagePath: './targets/raw_images/eris_card.png',
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
    name: 'europa',
    type: 'PLANAR',
    imagePath: './targets/raw_images/europa_card.png',
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
    name: 'haumea',
    type: 'PLANAR',
    imagePath: './targets/raw_images/haumea_card.png',
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
    name: 'jupiter',
    type: 'PLANAR',
    imagePath: './targets/raw_images/jupiter_card.png',
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
    name: 'makemake',
    type: 'PLANAR',
    imagePath: './targets/raw_images/makemake_card.png',
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
    name: 'merkurius',
    type: 'PLANAR',
    imagePath: './targets/raw_images/merkurius_card.png',
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
    name: 'neptunus',
    type: 'PLANAR',
    imagePath: './targets/raw_images/neptunus_card.png',
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
    name: 'oberon',
    type: 'PLANAR',
    imagePath: './targets/raw_images/oberon_card.png',
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
    name: 'phobos',
    type: 'PLANAR',
    imagePath: './targets/raw_images/phobos_card.png',
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
    name: 'pluto',
    type: 'PLANAR',
    imagePath: './targets/raw_images/pluto_card.png',
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
    name: 'saturnus',
    type: 'PLANAR',
    imagePath: './targets/raw_images/saturnus_card.png',
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
  {
    name: 'titan',
    type: 'PLANAR',
    imagePath: './targets/raw_images/titan_card.png',
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
    name: 'triton',
    type: 'PLANAR',
    imagePath: './targets/raw_images/triton_card.png',
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
    name: 'uranus',
    type: 'PLANAR',
    imagePath: './targets/raw_images/uranus_card.png',
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
    name: 'venus',
    type: 'PLANAR',
    imagePath: './targets/raw_images/venus_card.png',
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
  }
];

// ── Lookup table statis: nama AR target → ID celestialData ────────────────────
// Kunci = nama persis dari AR_IMAGE_TARGETS[].name (sudah lowercase)
// Nilai = key di celestialData
const TARGET_NAME_MAP = {
  '55cancrie':  '55cancrie',
  'asteroid':   'asteroid',
  'bimasakti':  'bimasakti',
  'ceres':      'ceres',
  'comet':      'comet',
  'earth':      'earth',
  'enceladus':  'enceladus',
  'eris':       'eris',
  'europa':     'europa',
  'haumea':     'haumea',
  'jupiter':    'jupiter',
  'makemake':   'makemake',
  'mars':       'mars',
  'merkurius':  'merkurius',
  'moon':       'moon',
  'neptunus':   'neptunus',
  'oberon':     'oberon',
  'phobos':     'phobos',
  'pluto':      'pluto',
  'saturnus':   'saturnus',
  'sun':        'sun',
  'titan':      'titan',
  'triton':     'triton',
  'uranus':     'uranus',
  'venus':      'venus',
};

/**
 * Cocokkan nama target dari event 8th Wall ke data celestial.
 * Menggunakan strict exact-match via lookup table — TIDAK partial match
 * agar satu marker tidak memicu banyak target sekaligus.
 * @param {string} targetName - nama dari event reality.imagefound
 * @returns {object|null}
 */
function resolveCelestial(targetName) {
  if (!targetName) return null;

  // Strip suffix "_card" jika ada (format file: earth_card → earth)
  const raw = String(targetName).toLowerCase().replace(/_card$/, '').trim();

  const celestialKey = TARGET_NAME_MAP[raw];
  if (celestialKey && celestialData[celestialKey]) {
    return celestialData[celestialKey];
  }

  console.warn('[AstroAR] Target tidak dikenali di resolveCelestial:', targetName, '(normalized:', raw, ')');
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

    // ── Orbital Animator ──
    // Mengelola animasi orbital planet-satelit (mis. Bulan mengorbit Bumi)
    this.orbitalAnimator = new OrbitalAnimator();

    // Timers
    this._markerLostTimer = null;
    this._rescanTimer     = null;

    // Page visibility — pause processing saat tab background
    this._isPageVisible = true;
    this._onVisibilityChange = () => {
      this._isPageVisible = document.visibilityState === 'visible';
      console.log(`[AstroAR] Tab ${this._isPageVisible ? 'aktif' : 'background'} → render ${this._isPageVisible ? 'dilanjutkan' : 'dijeda'}.`);
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    // Debounce untuk _updateMultiTargetStatus (batasi spam Alpine store)
    this._statusUpdatePending = false;
    this._statusUpdateTimer   = null;
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

    // Informasikan anisotropy maksimum ke ModelLoader agar texture optimal
    this.modelLoader.setRenderer(renderer);

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
  // Semua model diload PARALEL (Promise.all) — tidak sequential satu per satu.
  // Ini mengurangi total waktu loading dari ~N×T menjadi ~max(T).

  async _preloadAllModels() {
    const loadTasks = Object.keys(celestialData).map(async (key) => {
      const celestial = celestialData[key];
      const targetNode = this.targets.get(celestial.id);
      if (!targetNode) return;

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

        // Buat spinGroup untuk rotasi aksial yang sempurna
        const spinGroup = new THREE.Group();
        
        // Untuk menghitung posisi Y yang presisi agar tepat di atas kartu,
        // kita ukur bounding box model setelah dirotasi.
        // Gunakan parent sementara di origin agar hasil setFromObject murni lokal.
        const tempGroup = new THREE.Group();
        tempGroup.add(model);
        tempGroup.updateMatrixWorld(true);
        
        const box = new THREE.Box3().setFromObject(tempGroup);
        const bottomY = box.min.y; // Titik paling bawah model
        
        // Kembalikan model ke spinGroup
        spinGroup.add(model);
        
        // Posisi Y diangkat sebesar jarak titik terendah ke tengah, plus margin 2cm
        spinGroup.position.y = -bottomY + 0.02; 
        
        targetNode.visualGroup.add(spinGroup);
        targetNode.planetModel = spinGroup; // Digunakan secara umum
        targetNode.spinTarget  = model;     // Referensi khusus untuk rotasi aksial (kiri-kanan)
        
        targetNode.modelReady = true; // Flag: model sudah siap tampil
        console.log(`[AstroAR] ✓ Model "${celestial.name}" siap.`);
      } catch (err) {
        console.error(`[AstroAR] ✗ Gagal memuat model "${celestial.name}":`, err);
        targetNode.modelReady = false;
      }
    });

    // Jalankan semua loading secara paralel
    await Promise.all(loadTasks);
    console.log('[AstroAR] Semua model selesai di-preload (paralel).');
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
      // Hentikan semua animasi orbital terlebih dahulu
      this.orbitalAnimator.clearAll();

      for (const t of this.targets.values()) {
        // Re-freeze matrixAutoUpdate sebelum unlock agar planet tidak melayang
        // (OrbitalAnimator mungkin sudah mengaktifkan kembali untuk satelit)
        t.anchorGroup.matrixAutoUpdate = false;
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
        window.arUI.setOrbitalActive?.(false);
      }
      console.log('[AstroAR] SLAM dibuka → Animasi orbital dihentikan. Kembali ke mode Marker.');
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

          // ── Deteksi pasangan planet-satelit dan aktifkan animasi orbital ──
          this._checkAndActivateOrbitals();
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

    // Guard: jika model planet belum selesai dimuat, jangan tampilkan target kosong
    if (!targetNode.modelReady) {
      console.warn(`[AstroAR] Model "${celestial.name}" belum siap, target diabaikan sementara.`);
      return;
    }

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
  // Debounced: tidak spam Alpine store setiap event — batasi 1x per 200ms

  _updateMultiTargetStatus() {
    if (this.isSlamLocked) return;
    if (this._statusUpdatePending) return;
    this._statusUpdatePending = true;
    clearTimeout(this._statusUpdateTimer);
    this._statusUpdateTimer = setTimeout(() => {
      this._statusUpdatePending = false;
      this._doUpdateMultiTargetStatus();
    }, 200);
  }

  _doUpdateMultiTargetStatus() {
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

    // Bersihkan animasi orbital yang mungkin masih aktif
    this.orbitalAnimator.clearAll();
    if (window.arUI) window.arUI.setOrbitalActive?.(false);

    // Bersihkan debounce status update yang mungkin pending
    clearTimeout(this._statusUpdateTimer);
    this._statusUpdatePending = false;

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

  // ─── Deteksi & Aktivasi Relasi Orbital ──────────────────────────────────────

  /**
   * Setelah semua target terkunci ke SLAM, cek apakah ada pasangan
   * planet–satelit yang keduanya aktif. Jika ya, aktifkan animasi orbital.
   *
   * Data-driven: setiap celestial bisa mendefinisikan `orbitTarget` (string ID)
   * untuk menyatakan bahwa benda ini adalah satelit dari target tersebut.
   */
  _checkAndActivateOrbitals() {
    const lockedTargets = Array.from(this.targets.values()).filter(
      t => t.coordinateLock.isSlamLocked
    );

    const lockedIds = new Set(lockedTargets.map(t => t.id));
    let orbitalCount = 0;

    for (const satelliteNode of lockedTargets) {
      const { orbitTarget, orbitRadius, orbitSpeed, orbitTilt } = satelliteNode.celestial;

      // Hanya proses jika celestial ini punya relasi orbital yang terdefinisi
      if (!orbitTarget) continue;

      // Planet induk harus juga ikut terkunci dalam sesi ini
      if (!lockedIds.has(orbitTarget)) {
        console.log(
          `[AstroAR] Orbital "${satelliteNode.id}" → "${orbitTarget}" dilewati: ` +
          `planet induk tidak aktif dalam sesi ini.`
        );
        continue;
      }

      const parentNode = this.targets.get(orbitTarget);
      if (!parentNode) continue;

      this.orbitalAnimator.addRelation(
        satelliteNode.id,
        satelliteNode,
        parentNode,
        { orbitRadius, orbitSpeed, orbitTilt }
      );
      orbitalCount++;
    }

    if (orbitalCount > 0) {
      console.log(`[AstroAR] ${orbitalCount} animasi orbital diaktifkan!`);
      if (window.arUI) {
        window.arUI.setOrbitalActive?.(true, orbitalCount);
      }
    }
  }

  // ─── Render Loop (Three.js 60 FPS) ──────────────────────────────────────────
  //
  // Optimasi:
  // - dt di-cap 100ms untuk mencegah spike setelah tab background
  // - Visibility culling: skip CoordinateLock.applyTo untuk target tidak aktif
  // - orbitalSatelliteIds di-cache sebagai Set sebelum loop (O(1) lookup)
  // - Axial spin hanya diperhitungkan untuk target yang benar-benar visible

  _onRender(dt = 0.016) {
    // Pause rendering saat tab background — hemat CPU & baterai
    if (!this._isPageVisible) return;

    // Frame-budget guard: cap dt agar tidak ada spike fisika/animasi jika
    // tab sempat background atau browser freeze sesaat
    const safeDt = Math.min(dt, 0.1);

    let maxProgress  = 0;
    let anyCollecting = false;

    // Cache orbital satellite IDs (Set lookup O(1))
    const orbitalSatelliteIds = this.orbitalAnimator.hasActiveRelations
      ? new Set(this.orbitalAnimator._relations.keys())
      : null;

    // Referensi gesture target saat ini — hindari akses property di setiap iterasi
    const isDraggingGlobal = this.gestureManager?.isDragging ?? false;
    const gestureTarget    = this.gestureManager?.targetObject ?? null;

    for (const targetNode of this.targets.values()) {
      const lock   = targetNode.coordinateLock;
      const anchor = targetNode.anchorGroup;

      // 1. Pose update — skip jika:
      //    (a) sedang dalam mode orbital (posisi dikendalikan OrbitalAnimator), ATAU
      //    (b) target tidak visible DAN tidak sedang tracking/collecting
      //    Ini menghemat ~80% CoordinateLock.applyTo() call untuk target tidak aktif
      const isOrbital = orbitalSatelliteIds?.has(targetNode.id) ?? false;
      if (!isOrbital) {
        if (lock.isTracking || lock.isCollecting || anchor.visible) {
          lock.applyTo(anchor, safeDt);
        }
      }

      // 2. Progress collecting
      if (lock.isCollecting) {
        anyCollecting = true;
        maxProgress = Math.max(maxProgress, lock.collectProgress);
      }

      // 3. Axial spin — aturan per tipe objek:
      //    • Planet / bintang / eksoplanet : selalu berputar (PLANET_SPIN_SPEED)
      //    • Satelit (punya orbitTarget)   : DIAM saat idle, berputar pelan saat orbital aktif
      //    • Bimasakti                     : tidak berputar sama sekali
      if (anchor.visible && targetNode.planetModel) {
        const isDraggingThis = isDraggingGlobal && gestureTarget === targetNode.visualGroup;

        if (!isDraggingThis) {
          const cel          = targetNode.celestial;
          const isSatellite  = !!cel.orbitTarget;         // punya parent planet
          const isGalaxy     = cel.id === 'bimasakti';    // galaksi — tidak berputar

          let spinSpeed = 0; // default: diam

          if (isGalaxy) {
            spinSpeed = 0;                     // bimasakti tidak berotasi
          } else if (isSatellite) {
            spinSpeed = isOrbital ? 0.05 : 0; // satelit: diam kecuali saat orbital aktif
          } else {
            spinSpeed = 0.15;                  // planet / bintang / eksoplanet: selalu spin
          }

          if (spinSpeed > 0) {
            if (targetNode.spinTarget) {
              targetNode.spinTarget.rotation.y += spinSpeed * safeDt; // Rotasi di sumbu lokal (kiri-kanan)
            } else {
              targetNode.planetModel.rotation.y += spinSpeed * safeDt; // Fallback
            }
          }
        }
      }
    }

    // 4. Update animasi orbital semua satelit aktif
    this.orbitalAnimator.update(safeDt);

    // 5. Update progress bar collecting (hanya jika berubah)
    if (anyCollecting && window.arUI) {
      window.arUI.setCollectProgress(maxProgress);
    }

    // 6. Update gesture inertia
    if (this.gestureManager) {
      this.gestureManager.update(safeDt);
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
