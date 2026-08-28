import * as THREE from 'three';

/**
 * Pengelola Lifecycle & Runtime WASM AlvaAR (Markerless SLAM)
 */
export class AlvaARManager {
  constructor(wasmPath = '/alva/alva_ar.wasm') {
    this.wasmPath = wasmPath;
    this.alvaInstance = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      if (window.AlvaAR) {
        this.alvaInstance = await window.AlvaAR.Initialize(this.wasmPath);
        this.isInitialized = true;
        console.log("[AlvaAR] WASM Engine Berhasil Diinisialisasi");
      } else {
        console.warn("[AlvaAR] Class Global AlvaAR belum dimuat.");
      }
    } catch (error) {
      console.error("[AlvaAR] Gagal menginisialisasi WASM AlvaAR:", error);
    }
  }

  /**
   * Memproses Frame Kamera untuk Ekstraksi Titik Pose / SLAM
   * @param {HTMLVideoElement|ImageData} frameData 
   * @returns {Float32Array|null} Matriks Pose Spasial (4x4)
   */
  processFrame(frameData) {
    if (!this.isInitialized || !this.alvaInstance) return null;
    const poseMatrix = this.alvaInstance.findCameraPose(frameData);
    return poseMatrix || null;
  }

  resetSLAM() {
    if (this.alvaInstance && typeof this.alvaInstance.reset === 'function') {
      this.alvaInstance.reset();
      console.log("[AlvaAR] SLAM Session Di-reset");
    }
  }
}
