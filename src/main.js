import * as THREE from 'three';
import Alpine from 'alpinejs';

import { initUIStore } from './ui/uiState.js';
import { celestialData } from './data/celestialData.js';
import { SceneManager } from './core/Scene.js';
import { LightingManager } from './core/Lighting.js';
import { ModelLoader } from './core/ModelLoader.js';
import { ARStateManager, ARSTATES } from './ar/ARState.js';
import { MindARManager } from './ar/MindARManager.js';
import { AlvaARManager } from './ar/AlvaARManager.js';
import { HandoverManager } from './ar/HandoverManager.js';

/**
 * Bootstrapper Utama WebAR Application
 */
class AppBootstrapper {
  constructor() {
    this.sceneManager = null;
    this.lightingManager = null;
    this.modelLoader = null;
    this.arStateManager = null;
    this.mindARManager = null;
    this.alvaARManager = null;
    this.handoverManager = null;

    this.currentModelGroup = null;
    this.anchorGroup = null;
  }

  async start() {
    console.log("[AstroAR] Menginisialisasi Aplikasi...");

    // 1. Inisialisasi Alpine.js Store UI
    initUIStore();

    // 2. Inisialisasi Core Three.js Scene
    this.sceneManager = new SceneManager('canvas-container');
    this.lightingManager = new LightingManager(this.sceneManager.scene);
    this.modelLoader = new ModelLoader();

    // 3. Setup Finite State Machine
    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) {
        window.arUI.setTrackingState(newState);
      }
    });

    // 4. Inisialisasi Handover Manager
    this.handoverManager = new HandoverManager(this.sceneManager.scene, this.arStateManager);

    // 5. Inisialisasi & Setup MindAR Image Tracking
    this.mindARManager = new MindARManager({
      container: document.getElementById('canvas-container'),
      targetPath: '/targets/flashcards.mind',
      onTargetFound: (anchorGroup) => this._onTargetFound(anchorGroup),
      onTargetLost: () => this._onTargetLost()
    });

    // 6. Inisialisasi AlvaAR (WASM SLAM)
    this.alvaARManager = new AlvaARManager('/alva/alva_ar.wasm');
    await this.alvaARManager.init();

    // 7. Muat Model 3D Planet Utama (Bumi) secara Asinkron
    await this._loadDefaultCelestialModel();

    // 8. Jalankan Render Loop & Mulai Tracking Kamera
    this._startRenderLoop();
    await this.mindARManager.start();

    // Bind instance ke window untuk akses global (misal: tombol reset)
    window.arAppBootstrapper = this;
    console.log("[AstroAR] Aplikasi WebAR Siap Digunakan!");
  }

  async _loadDefaultCelestialModel() {
    try {
      const data = celestialData.earth;
      const model = await this.modelLoader.loadModel(data.modelPath);
      
      // Atur Skala & Orientasi Model
      model.scale.set(0.5, 0.5, 0.5);

      this.currentModelGroup = new THREE.Group();
      this.currentModelGroup.add(model);

      if (window.arUI) {
        window.arUI.setSelectedCelestial(data);
      }
    } catch (err) {
      console.error("[AstroAR] Gagal mengunduh model 3D awal:", err);
    }
  }

  _onTargetFound(anchorGroup) {
    this.anchorGroup = anchorGroup;

    if (this.currentModelGroup) {
      this.handoverManager.handoverToLocal(this.currentModelGroup, this.anchorGroup);
    }
  }

  _onTargetLost() {
    // Saat kartu tidak terdeteksi kamera, alihkan objek ke World Space (SLAM Mode)
    if (this.currentModelGroup && this.arStateManager.getState() === ARSTATES.TRACKED) {
      this.handoverManager.handoverToWorld(this.currentModelGroup, this.anchorGroup);
    }
  }

  resetView() {
    if (this.currentModelGroup) {
      this.modelLoader.disposeModel(this.currentModelGroup);
      this.currentModelGroup = null;
    }

    if (this.alvaARManager) {
      this.alvaARManager.resetSLAM();
    }

    this.arStateManager.setState(ARSTATES.SEARCHING);
    this._loadDefaultCelestialModel();
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      // Rotasi kontinu planet jika model aktif
      if (this.currentModelGroup) {
        this.currentModelGroup.rotation.y += 0.005;
      }

      // Render Three.js Scene
      this.sceneManager.render();
    };

    animate();
  }
}

// Bootstrap saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppBootstrapper();
  app.start();
});
