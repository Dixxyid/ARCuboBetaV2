/**
 * Pengelola Inisialisasi dan Interaksi AlvaAR (Markerless SLAM)
 */
export class AlvaARManager {
  constructor() {
    this.alvaInstance = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // Memeriksa ketersediaan objek global AlvaAR yang dimuat via modul
      if (window.AlvaAR) {
        // Bergantung pada implementasi pembungkus AlvaAR Anda
        this.alvaInstance = await window.AlvaAR.Initialize ? window.AlvaAR.Initialize() : window.AlvaAR;
        this.isInitialized = true;
        console.log("[AlvaAR] Engine Berhasil Diinisialisasi");
      } else {
        console.warn("[AlvaAR] Objek window.AlvaAR belum tersedia secara global.");
      }
    } catch (error) {
      console.error("[AlvaAR] Gagal menginisialisasi engine SLAM:", error);
    }
  }

  /**
   * Memproses frame kamera untuk mendapati matriks pose saat SLAM aktif
   */
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

  /**
   * Mengatur ulang posisi tracking SLAM
   */
  resetSLAM() {
    if (this.alvaInstance && typeof this.alvaInstance.reset === 'function') {
      this.alvaInstance.reset();
      console.log("[AlvaAR] Status SLAM berhasil di-reset.");
    }
  }
}
