import * as THREE from 'three';

/**
 * Pengelola Lifecycle & Event MindAR Image Tracking
 */
export class MindARManager {
  constructor({ container, targetPath, onTargetFound, onTargetLost }) {
    this.container = container;
    this.targetPath = targetPath;
    this.onTargetFound = onTargetFound;
    this.onTargetLost = onTargetLost;
    this.mindarThree = null;
    this.anchor = null;
  }

  async init() {
    if (!window.MINDAR || !window.MINDAR.IMAGE) {
      console.error("[MindAR] Library MindAR tidak ditemukan di global scope.");
      return;
    }

    this.mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: this.container,
      imageTargetSrc: this.targetPath,
      uiScanning: 'no',
      uiLoading: 'no'
    });

    // Anchor index 0 untuk target flashcard utama
    this.anchor = this.mindarThree.addAnchor(0);

    this.anchor.onTargetFound = () => {
      console.log("[MindAR] Target Flashcard Terdeteksi");
      if (this.onTargetFound) this.onTargetFound(this.anchor.group);
    };

    this.anchor.onTargetLost = () => {
      console.log("[MindAR] Target Flashcard Hilang");
      if (this.onTargetLost) this.onTargetLost();
    };

    return { 
      scene: this.mindarThree.scene, 
      camera: this.mindarThree.camera, 
      renderer: this.mindarThree.renderer 
    };
  }

  async start() {
    if (this.mindarThree) {
      await this.mindarThree.start();
    }
  }

  stop() {
    if (this.mindarThree) {
      this.mindarThree.stop();
    }
  }
}
