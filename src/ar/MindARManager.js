import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'; // Import langsung dari node_modules

/**
 * Pengelola Lifecycle & Event MindAR Image Tracking (Multi-Marker)
 */
export class MindARManager {
  constructor({ container, targetPath, targetCount = 2, onTargetFound, onTargetLost }) {
    this.container = container;
    this.targetPath = targetPath;
    this.targetCount = targetCount;
    this.onTargetFound = onTargetFound;
    this.onTargetLost = onTargetLost;
    this.mindarThree = null;
    this.anchors = [];
  }

  async init() {
    // Inisialisasi MindAR menggunakan modul ES murni
    this.mindarThree = new MindARThree({
      container: this.container,
      imageTargetSrc: this.targetPath,
      uiScanning: 'no',
      uiLoading: 'no'
    });

    const { scene, camera, renderer } = this.mindarThree;

    for (let i = 0; i < this.targetCount; i++) {
      const anchor = this.mindarThree.addAnchor(i);
      
      anchor.onTargetFound = () => {
        console.log(`[MindAR] Target Flashcard Index ${i} Terdeteksi`);
        if (this.onTargetFound) this.onTargetFound(anchor.group, i);
      };

      anchor.onTargetLost = () => {
        console.log(`[MindAR] Target Flashcard Index ${i} Hilang`);
        if (this.onTargetLost) this.onTargetLost(i);
      };

      this.anchors.push(anchor);
    }

    return { scene, camera, renderer };
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
