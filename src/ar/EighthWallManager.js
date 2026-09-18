import * as THREE from 'three';

if (typeof window !== 'undefined' && !window.THREE) {
  window.THREE = THREE;
}
import { XR8Promise } from '@8thwall/engine';
import { ARSTATES } from './ARState.js';

/**
 * EighthWallManager
 * Mengelola siklus hidup 8th Wall XR8:
 *  - World Tracking (SLAM via engine-binary)
 *  - Image Targets (flashcard detection)
 *  - Camera pipeline module untuk Three.js
 *
 * Alur state:
 *  WORLD_SCAN → MARKER_SCAN → COORDINATE_LOCKED ↔ WORLD_TRACKING
 */
export class EighthWallManager {
  /**
   * @param {object} options
   * @param {HTMLElement}     options.canvas        - Elemen canvas untuk XR8
   * @param {Array}           options.imageTargets  - Metadata array imageTargetData
   * @param {ARStateManager}  options.stateManager  - FSM state manager
   * @param {object}          options.callbacks     - { onXRSceneReady, onSurfaceReady, onTargetFound, onTargetUpdated, onTargetLost, onTrackingLost, onRender }
   */
  constructor({ canvas, imageTargets = [], stateManager, callbacks = {} }) {
    this.canvas       = canvas;
    this.imageTargets = imageTargets;
    this.stateManager = stateManager;
    this.callbacks    = callbacks;

    this._XR8           = null;
    this._isRunning     = false;
    this._surfaceReady  = false;
    this._surfaceFrameCount = 0;
    this.SURFACE_READY_THRESHOLD = 30; // Minimal frame tracking stabil sebelum "surface ready"
  }

  // ─── Inisialisasi & Start ──────────────────────────────────────────────────

  async init() {
    try {
      console.log('[8thWall] Menunggu XR8 engine siap...');
      this._XR8 = await XR8Promise;
      console.log('[8thWall] XR8 engine siap:', this._XR8.version?.());
    } catch (err) {
      console.error('[8thWall] Gagal memuat XR8 engine:', err);
      throw err;
    }
  }

  async start() {
    if (!this._XR8) {
      throw new Error('[8thWall] Panggil init() terlebih dahulu.');
    }
    if (this._isRunning) return;

    const XR8 = this._XR8;

    // Konfigurasi XrController: aktifkan world tracking + image targets
    const xrConfig = {
      scale:          'absolute',
      enableLighting: true,
    };

    if (this.imageTargets && this.imageTargets.length > 0) {
      xrConfig.imageTargetData = this.imageTargets;
    }

    XR8.XrController.configure(xrConfig);

    // Tambahkan pipeline modules
    XR8.addCameraPipelineModules([
      // 1. Render feed kamera ke background canvas
      XR8.GlTextureRenderer.pipelineModule(),

      // 2. FullWindowCanvas — menjaga canvas tetap sinkron ukuran layar secara responsif
      ...(XR8.FullWindowCanvas ? [XR8.FullWindowCanvas.pipelineModule()] : []),

      // 3. Integrasikan Three.js dengan XR8 camera
      XR8.Threejs.pipelineModule(),

      // 4. World tracking / SLAM
      XR8.XrController.pipelineModule(),

      // 5. Image target detection (jika modul tersedia)
      ...(XR8.XrImageTargets ? [XR8.XrImageTargets.pipelineModule()] : []),

      // 6. Pipeline modul kustom (handle events + update Three.js)
      this._buildCustomPipelineModule(),
    ]);

    XR8.run({ canvas: this.canvas });
    this._isRunning = true;
    console.log('[8thWall] XR8 pipeline dimulai.');
  }

  stop() {
    if (!this._isRunning || !this._XR8) return;
    this._XR8.stop();
    this._isRunning     = false;
    this._surfaceReady  = false;
    this._surfaceFrameCount = 0;
    console.log('[8thWall] XR8 dihentikan.');
  }

  // ─── Custom Pipeline Module ────────────────────────────────────────────────

  _buildCustomPipelineModule() {
    const self = this;

    return {
      name: 'astroar-pipeline',

      // ── Inisialisasi Three.js via XR8 ──
      onStart: ({ canvas }) => {
        const { renderer, scene, camera } = self._XR8.Threejs.xrScene();

        // Gunakan renderer/scene/camera dari XR8.Threejs (sudah sinkron dengan XR8)
        // Kita simpan referensinya agar bisa diakses dari luar
        self._xrThreeScene = { renderer, scene, camera };

        // Expose scene ke caller lewat callback (akan diinisialisasi dengan LightingManager dll)
        if (self.callbacks.onXRSceneReady) {
          self.callbacks.onXRSceneReady({ renderer, scene, camera });
        }

        // Mulai dengan state WORLD_SCAN
        self.stateManager.setState(ARSTATES.WORLD_SCAN);
        console.log('[8thWall] Pipeline siap. State: WORLD_SCAN');
      },

      // ── Update per frame ──
      onUpdate: ({ processCpuResult }) => {
        const reality = processCpuResult?.reality;
        if (!reality) return;

        // Deteksi kestabilan world tracking untuk WORLD_SCAN → MARKER_SCAN
        if (self.stateManager.is(ARSTATES.WORLD_SCAN)) {
          if (reality.trackingStatus === 'LIMITED' || reality.trackingStatus === 'NORMAL') {
            self._surfaceFrameCount++;

            if (self._surfaceFrameCount >= self.SURFACE_READY_THRESHOLD) {
              self._surfaceReady = true;
              self.stateManager.setState(ARSTATES.MARKER_SCAN);
              if (self.callbacks.onSurfaceReady) self.callbacks.onSurfaceReady();
              console.log('[8thWall] Permukaan terdeteksi → MARKER_SCAN');
            }
          } else {
            // Reset jika tracking hilang
            self._surfaceFrameCount = Math.max(0, self._surfaceFrameCount - 2);
          }
        }
      },

      // ── Image Target: Ditemukan ──
      listeners: [
        {
          event: 'reality.imagefound',
          process: ({ detail }) => {
            console.log('[8thWall] Image target ditemukan:', detail.name);
            if (self.callbacks.onTargetFound) {
              self.callbacks.onTargetFound(detail);
            }
          },
        },

        // ── Image Target: Update posisi ──
        {
          event: 'reality.imageupdated',
          process: ({ detail }) => {
            if (self.callbacks.onTargetUpdated) {
              self.callbacks.onTargetUpdated(detail);
            }
          },
        },

        // ── Image Target: Hilang ──
        {
          event: 'reality.imagelost',
          process: ({ detail }) => {
            console.log('[8thWall] Image target hilang:', detail.name);
            if (self.callbacks.onTargetLost) {
              self.callbacks.onTargetLost(detail);
            }
          },
        },

        // ── World Tracking: Error / Lost ──
        {
          event: 'reality.projectilerror',
          process: () => {
            console.warn('[8thWall] World tracking error — meminta scan ulang...');
            self._surfaceReady = false;
            self._surfaceFrameCount = 0;
            if (self.callbacks.onTrackingLost) {
              self.callbacks.onTrackingLost();
            }
          },
        },
      ],

      // ── Render ──
      onRender: () => {
        if (self.callbacks.onRender) {
          self.callbacks.onRender();
        }
        if (self._xrThreeScene) {
          const { renderer, scene, camera } = self._xrThreeScene;
          renderer.render(scene, camera);
        }
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Ambil scene/camera/renderer yang di-manage XR8 */
  getXRScene() {
    return this._xrThreeScene || null;
  }

  /** Force reset ke WORLD_SCAN (misal setelah scan ulang diminta) */
  resetToWorldScan() {
    this._surfaceReady = false;
    this._surfaceFrameCount = 0;
    this.stateManager.setState(ARSTATES.WORLD_SCAN);
    console.log('[8thWall] Reset ke WORLD_SCAN');
  }

  get isRunning()    { return this._isRunning; }
  get surfaceReady() { return this._surfaceReady; }
}
