import * as AlvaARModule from '../../alva/alva_ar.js';
import '../../alva/alva_ar_three.js';

/**
 * Pengelola Inisialisasi dan Interaksi AlvaAR (Markerless SLAM) berbasis ESM
 */
export class AlvaARManager {
  constructor() {
    this.alvaInstance = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      const initializer = AlvaARModule.Initialize || AlvaARModule.default?.Initialize;
      
      if (initializer) {
        this.alvaInstance = await initializer();
      } else {
        this.alvaInstance = AlvaARModule;
      }

      this.isInitialized = true;
      console.log("[AlvaAR] Engine Berhasil Diinisialisasi via Modul");
    } catch (error) {
      console.error("[AlvaAR] Gagal menginisialisasi engine SLAM:", error);
    }
  }

  processFrame(frameData) {
    if (!this.isInitialized || !this.alvaInstance) return null;
    
    try {
      if (typeof this.alvaInstance.findCameraPose === 'function') {
        return this.alvaInstance.findCameraPose(frameData) || null;
      }
      return null;
    } catch (err) {
      console.error("[AlvaAR] Kesalahan saat memproses frame pose:", err);
      return null;
    }
  }

  resetSLAM() {
    if (this.alvaInstance && typeof this.alvaInstance.reset === 'function') {
      this.alvaInstance.reset();
      console.log("[AlvaAR] Status SLAM berhasil di-reset.");
    }
  }
}
