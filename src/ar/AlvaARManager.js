/**
 * Pengelola Lifecycle & Runtime AlvaAR (Markerless SLAM)
 */
export class AlvaARManager {
  constructor() {
    this.alvaInstance = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      if (window.AlvaAR) {
        // Inisialisasi AlvaAR menggunakan script JS yang dimuat secara global
        this.alvaInstance = await window.AlvaAR.Initialize();
        this.isInitialized = true;
        console.log("[AlvaAR] Engine Berhasil Diinisialisasi");
      } else {
        console.warn("[AlvaAR] Class Global AlvaAR belum dimuat di window context.");
      }
    } catch (error) {
      console.error("[AlvaAR] Gagal menginisialisasi AlvaAR:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Memproses Frame Kamera untuk Ekstraksi Titik Pose / SLAM
   * @param {HTMLVideoElement|ImageData} frameData 
   * @returns {Float32Array|null} Matriks Pose Spasial (4x4)
   */
  processFrame(frameData) {
    if (!this.isInitialized || !this.alvaInstance) return null;

    try {
      const poseMatrix = this.alvaInstance.findCameraPose(frameData);
      return poseMatrix || null;
    } catch (error) {
      console.error("[AlvaAR] Gagal memproses frame kamera:", error);
      return null;
    }
  }

  resetSLAM() {
    if (this.alvaInstance && typeof this.alvaInstance.reset === 'function') {
      this.alvaInstance.reset();
      console.log("[AlvaAR] SLAM Session Di-reset");
    }
  }
}
