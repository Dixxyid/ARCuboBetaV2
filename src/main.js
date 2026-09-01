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
    this.currentIndex = null;

    this._frameCanvas = null;
    this._frameCtx = null;
    this._debugFrameCount = 0; // BARU: buat throttle log debug
  }

  async start() {
    console.log("[AstroAR] Menginisialisasi Aplikasi...");

    initUIStore();

    this.sceneManager = new SceneManager('canvas-container');
    this.lightingManager = new LightingManager(this.sceneManager.scene);
    this.modelLoader = new ModelLoader();

    this.arStateManager = new ARStateManager((newState) => {
      if (window.arUI) window.arUI.setTrackingState(newState);
    });

    this.handoverManager = new HandoverManager(this.sceneManager.scene, this.arStateManager);

    this.mindARManager = new MindARManager({
      container: document.getElementById('canvas-container'),
      targetPath: './public/targets/flashcards.mind',
      targetCount: 2,
      onTargetFound: (anchorGroup, index) => this._onTargetFound(anchorGroup, index),
      onTargetLost: (index) => this._onTargetLost(index)
    });

    await this.mindARManager.init();

    const mindarScene = this.mindARManager.mindarThree.scene;
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    const directional = new THREE.DirectionalLight(0xffffff, 1.5);
    directional.position.set(0.5, 1, 0.3);
    mindarScene.add(ambient, directional);

    await this.mindARManager.start(); // start dulu, biar video punya dimensi valid

    // Siapkan canvas tersembunyi untuk ambil frame video buat AlvaAR
    const video = this.mindARManager.mindarThree.video;
    this._frameCanvas = document.createElement('canvas');
    this._frameCanvas.width = video.videoWidth || 640;
    this._frameCanvas.height = video.videoHeight || 480;
    // FIX: willReadFrequently, karena kita getImageData tiap frame
    this._frameCtx = this._frameCanvas.getContext('2d', { willReadFrequently: true });

    this.alvaARManager = new AlvaARManager();
    await this.alvaARManager.init(this._frameCanvas.width, this._frameCanvas.height);

    this._startRenderLoop();

    window.arAppBootstrapper = this;
    console.log("[AstroAR] Aplikasi WebAR Siap Digunakan!");
  }

  async _loadCelestialModelByIndex(index) {
    if (this.currentModelGroup) {
      this.modelLoader.disposeModel(this.currentModelGroup);
      this.currentModelGroup = null;
    }

    if (window.arUI) window.arUI.setLoadingModel(true);

    try {
      let data;
      if (index === 0) data = celestialData.earth;
      else if (index === 1) data = celestialData.mars;
      else return;

      const modelPath = data.modelPath.startsWith('/') ? '.' + data.modelPath : data.modelPath;
      const model = await this.modelLoader.loadModel(modelPath);
      this.modelLoader.normalizeScale(model, data.displaySize ?? 0.15);

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });

      this.currentModelGroup = new THREE.Group();
      this.currentModelGroup.add(model);

      if (window.arUI) {
        window.arUI.setSelectedCelestial(data);
        window.arUI.setLoadingModel(false);
      }
    } catch (err) {
      console.error(`[AstroAR] Gagal mengunduh model 3D untuk index ${index}:`, err);
      if (window.arUI) {
        window.arUI.setLoadError('Gagal memuat model 3D. Periksa koneksi internet kamu dan coba scan ulang.');
      }
    }
  }

  async _onTargetFound(anchorGroup, index) {
    this.anchorGroup = anchorGroup;

    if (this.currentIndex !== index || !this.currentModelGroup) {
      this.currentIndex = index;
      await this._loadCelestialModelByIndex(index);
    }

    if (this.currentModelGroup && this.arStateManager.getState() !== ARSTATES.TRACKED) {
      this.handoverManager.handoverToLocal(this.currentModelGroup, this.anchorGroup);
    }
  }

  _onTargetLost(index) {
    if (this.currentModelGroup && this.currentIndex === index && this.arStateManager.getState() === ARSTATES.TRACKED) {
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

    // Reset kamera SLAM ke posisi awal
    this.sceneManager.camera.position.set(0, 0, 0);
    this.sceneManager.camera.quaternion.identity();

    this.currentIndex = null;
    this.anchorGroup = null;
    this.arStateManager.setState(ARSTATES.SEARCHING);

    if (window.arUI) {
      window.arUI.setSelectedCelestial(null);
      window.arUI.dismissError();
      window.arUI.setLoadingModel(false);
    }
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      if (this.currentModelGroup) {
        this.currentModelGroup.rotation.y += 0.005;
      }

      // Proses frame SLAM TERUS-MENERUS (bukan cuma pas state SLAM),
      // supaya engine sempat "warm up" / mapping lingkungan dari awal.
      if (this.alvaARManager?.isInitialized && this._frameCtx) {
        const video = this.mindARManager.mindarThree.video;

        if (video.readyState >= 2) { // pastikan video sudah punya frame valid
          this._frameCtx.drawImage(video, 0, 0, this._frameCanvas.width, this._frameCanvas.height);
          const frameData = this._frameCtx.getImageData(0, 0, this._frameCanvas.width, this._frameCanvas.height);

          const pose = this.alvaARManager.processFrame(frameData);

          // DEBUG: throttle log, cuma print 1x tiap ~30 frame biar console gak spam
          this._debugFrameCount++;
          if (this._debugFrameCount % 30 === 0) {
            console.log('[DEBUG SLAM]', pose ? 'Pose LOCKED' : 'Pose masih NULL (belum lock)', pose ? Array.from(pose).map(n => n.toFixed(3)) : '');
          }

          // Kamera cuma di-update kalau state memang lagi SLAM
          if (pose && this.arStateManager.getState() === ARSTATES.SLAM) {
            this.alvaARManager.updateCameraFromPose(pose, this.sceneManager.camera);
          }
        }
      }

      this.sceneManager.render();
    };

    animate();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppBootstrapper();
  app.start();
});
