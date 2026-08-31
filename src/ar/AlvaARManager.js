import * as THREE from 'three';
import * as AlvaARModule from '../../public/alva/alva_ar.js';
import { AlvaARConnectorTHREE } from '../../public/alva/alva_ar_three.js';

export class AlvaARManager {
  constructor() {
    this.alvaInstance = null;
    this.isInitialized = false;
    this.applyPose = null; // fungsi dari AlvaARConnectorTHREE
  }

  // FIX: sekarang wajib terima width & height video (sesuai contoh resmi AlvaAR)
  async init(width, height) {
    try {
      const initializer = AlvaARModule.Initialize || AlvaARModule.default?.Initialize;

      if (initializer) {
        this.alvaInstance = await initializer(width, height); // FIX: kirim dimensi
      } else {
        this.alvaInstance = AlvaARModule;
      }

      // BARU: siapkan fungsi konversi pose -> Three.js camera
      this.applyPose = AlvaARConnectorTHREE.Initialize(THREE);

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

  // BARU: terapkan pose hasil SLAM langsung ke kamera Three.js
  updateCameraFromPose(pose, camera) {
    if (!pose || !this.applyPose) return false;
    this.applyPose(pose, camera.quaternion, camera.position);
    return true;
  }

  resetSLAM() {
    if (this.alvaInstance && typeof this.alvaInstance.reset === 'function') {
      this.alvaInstance.reset();
      console.log("[AlvaAR] Status SLAM berhasil di-reset.");
    }
  }
}
