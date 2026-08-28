/**
 * Pengelola Inisialisasi dan Interaksi AlvaAR (Markerless SLAM) dengan Penanganan Async Load
 */
export class AlvaARManager {
  constructor() {
    this.alvaInstance = null;
    this.isInitialized = false;
  }

  // Fungsi pembantu untuk menunggu window.AlvaAR tersedia
  async _waitForAlva(timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (window.AlvaAR) {
        return window.AlvaAR;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Cek setiap 100ms
    }
    throw new Error("Timeout: Gagal memuat library AlvaAR secara global.");
  }

  async init() {
    try {
      // Menunggu hingga skrip AlvaAR selesai dimuat oleh browser
      const AlvaARLib = await this._waitForAlva();

      this.alvaInstance = typeof AlvaARLib.Initialize === 'function' 
        ? await AlvaARLib.Initialize() 
        : AlvaARLib;
        
      this.isInitialized = true;
      console.log("[AlvaAR] Engine Berhasil Diinisialisasi");
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
