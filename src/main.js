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
 * Bootstrapper Utama WebAR Application (Mendukung Multi-Marker)
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
    this.currentIndex = null; // Melacak index marker yang sedang aktif
  }

  async start() {
    console.log("[AstroAR] Menginisialisasi Aplikasi...");

    initUIStore();

    this.sceneManager = new SceneManager('canvas-container');
    this.lightingManager = new LightingManager(this.sceneManager.scene);
    this.modelLoader = new ModelLoader();

    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) {
        window.arUI.setTrackingState(newState);
      }
    });

    this.handoverManager = new HandoverManager(this.sceneManager.scene, this.arStateManager);

    // Inisialisasi MindAR dengan targetCount: 2 (Bumi dan Mars)
    // PERBAIKAN: Gunakan path relatif './' agar sesuai dengan sub-path GitHub Pages
    this.mindARManager = new MindARManager({
      container: document.getElementById('canvas-container'),
      targetPath: './targets/flashcards.mind',
      targetCount: 2, 
      onTargetFound: (anchorGroup, index) => this._onTargetFound(anchorGroup, index),
      onTargetLost: (index) => this._onTargetLost(index)
    });

    // Inisialisasi AlvaAR (tanpa path wasm)
    this.alvaARManager = new AlvaARManager();
    await this.alvaARManager.init();

    this._startRenderLoop();
    await this.mindARManager.start();

    window.arAppBootstrapper = this;
    console.log("[AstroAR] Aplikasi WebAR Siap Digunakan!");
  }

  /**
   * Memuat data dan model planet berdasarkan urutan Index
   */
  async _loadCelestialModelByIndex(index) {
    // 1. Bersihkan model lama agar GPU tidak kehabisan memori
    if (this.currentModelGroup) {
      this.modelLoader.disposeModel(this.currentModelGroup);
      this.currentModelGroup = null;
    }

    try {
      // 2. Pemetaan Index ke Dataset
      let data;
      if (index === 0) data = celestialData.earth;
      else if (index === 1) data = celestialData.mars;
      else return; // Jika index tidak dikenali, batalkan

      // 3. Muat Model GLB baru (Sesuaikan path model dengan relative path jika perlu)
      const modelPath = data.modelPath.startsWith('/') ? '.' + data.modelPath : data.modelPath;
      const model = await this.modelLoader.loadModel(modelPath);
      model.scale.set(0.5, 0.5, 0.5);

      this.currentModelGroup = new THREE.Group();
      this.currentModelGroup.add(model);

      // 4. Perbarui Informasi di UI (Alpine.js)
      if (window.arUI) {
        window.arUI.setSelectedCelestial(data);
      }
    } catch (err) {
      console.error(`[AstroAR] Gagal mengunduh model 3D untuk index ${index}:`, err);
    }
  }

  async _onTargetFound(anchorGroup, index) {
    this.anchorGroup = anchorGroup;
    
    // Cegah muat ulang jika kartu yang discan masih sama
    if (this.currentIndex !== index || !this.currentModelGroup) {
      this.currentIndex = index;
      await this._loadCelestialModelByIndex(index);
    }

    // Tempatkan model 3D di atas kartu
    if (this.currentModelGroup) {
      this.handoverManager.handoverToLocal(this.currentModelGroup, this.anchorGroup);
    }
  }

  _onTargetLost(index) {
    // Pastikan event kehilangan (lost) ini milik marker yang sedang aktif
    if (this.currentModelGroup && this.currentIndex === index && this.arStateManager.getState() === ARSTATES.TRACKED) {
      // Pindahkan koordinat planet ke World Coordinate (SLAM)
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

    this.currentIndex = null;
    this.anchorGroup = null;
    this.arStateManager.setState(ARSTATES.SEARCHING);
    
    if (window.arUI) {
       window.arUI.setSelectedCelestial(null);
    }
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      // Rotasi planet berputar pada sumbunya
      if (this.currentModelGroup) {
        this.currentModelGroup.rotation.y += 0.005;
      }

      this.sceneManager.render();
    };

    animate();
  }
}

// Menjalankan aplikasi ketika dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppBootstrapper();
  app.start();
});
