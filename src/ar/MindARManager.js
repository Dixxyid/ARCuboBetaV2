import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

/**
 * Pengelola Siklus Hidup dan Interaksi MindAR (Image Tracking)
 */
export class MindARManager {
  constructor({ container, targetPath, targetCount, onTargetFound, onTargetLost }) {
    this.container = container;
    this.targetPath = targetPath;
    this.targetCount = targetCount || 1;
    this.onTargetFound = onTargetFound;
    this.onTargetLost = onTargetLost;

    this.mindarThree = null;
    this.anchors = [];
  }

  async init() {
    try {
      // Menginisialisasi mesin MindARThree
      this.mindarThree = new MindARThree({
        container: this.container,
        imageTargetSrc: this.targetPath,
        maxTrack: 1, // Melacak satu kartu dalam satu waktu
      });

      // Mendaftarkan anchor (titik jangkar) sesuai jumlah target marker
      for (let i = 0; i < this.targetCount; i++) {
        const anchor = this.mindarThree.addAnchor(i);
        this.anchors.push(anchor);

        // Menghubungkan event callback
        anchor.onTargetFound = () => {
          if (this.onTargetFound) this.onTargetFound(anchor.group, i);
        };

        anchor.onTargetLost = () => {
          if (this.onTargetLost) this.onTargetLost(i);
        };
      }
    } catch (error) {
      console.error("[MindAR] Kesalahan saat inisialisasi:", error);
      throw error;
    }
  }

  async start() {
    if (!this.mindarThree) {
      throw new Error("[MindAR] Mesin belum diinisialisasi. Panggil init() terlebih dahulu.");
    }

    await this.mindarThree.start();

    // FIX UTAMA: MindAR tidak otomatis render scene-nya sendiri,
    // wajib dipanggil manual seperti ini.
    this.mindarThree.renderer.setAnimationLoop(() => {
      this.mindarThree.renderer.render(this.mindarThree.scene, this.mindarThree.camera);
    });

    // PERBAIKAN LAYAR HITAM: Memaksa video kamera agar full-screen dan berada di layer paling belakang
    const videoElement = this.mindarThree.video;
    if (videoElement) {
      videoElement.style.position = 'absolute';
      videoElement.style.top = '0px';
      videoElement.style.left = '0px';
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.style.zIndex = '-2';
    }

    // PERBAIKAN LAYAR HITAM: Memaksa canvas Three.js agar full-screen dan latar belakangnya tembus pandang
    const canvasElement = this.mindarThree.renderer.domElement;
    if (canvasElement) {
      canvasElement.style.position = 'absolute';
      canvasElement.style.top = '0px';
      canvasElement.style.left = '0px';
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';
      canvasElement.style.zIndex = '1';

      // Mengatur ulang warna latar belakang renderer menjadi benar-benar transparan
      this.mindarThree.renderer.setClearColor(0x000000, 0);
    }
  }

  stop() {
    if (this.mindarThree) {
      this.mindarThree.stop();
    }
  }
}
