import * as THREE from 'three';

/**
 * Pengelola Lifecycle & Event MindAR Image Tracking (Mendukung Multi-Marker)
 */
export class MindARManager {
  constructor({ container, targetPath, targetCount = 2, onTargetFound, onTargetLost }) {
    this.container = container;
    this.targetPath = targetPath;
    this.targetCount = targetCount; // Jumlah marker di dalam flashcards.mind
    this.onTargetFound = onTargetFound;
    this.onTargetLost = onTargetLost;
    this.mindarThree = null;
    this.anchors = []; // Menyimpan banyak anchor
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

    const { scene, camera, renderer } = this.mindarThree;

    // Inisialisasi Anchor secara berulang berdasarkan jumlah targetCount
    for (let i = 0; i < this.targetCount; i++) {
      const anchor = this.mindarThree.addAnchor(i);
      
      anchor.onTargetFound = () => {
        console.log(`[MindAR] Target Flashcard Index ${i} Terdeteksi`);
        // Mengirimkan group anchor dan index marker yang terdeteksi
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
