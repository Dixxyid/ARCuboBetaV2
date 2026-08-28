import { ARSTATES } from './ARState.js';

/**
 * Logika Serah Terima (Handover) Matriks Spasial dari Local (Marker) ke World Coordinate System
 */
export class HandoverManager {
  constructor(scene, stateManager) {
    this.scene = scene;
    this.stateManager = stateManager;
    
    // Vektor Bantu untuk Kalkulasi Transformasi Global
    this._worldPosition = new THREE.Vector3();
    this._worldQuaternion = new THREE.Quaternion();
    this._worldScale = new THREE.Vector3();
  }

  /**
   * Menyerahkan objek 3D dari Anchor Kartu (Local) ke Root Scene (World)
   * @param {THREE.Object3D} object3D - Objek model 3D (Planet)
   * @param {THREE.Object3D} sourceAnchorGroup - Group Anchor milik MindAR
   */
  handoverToWorld(object3D, sourceAnchorGroup) {
    if (!object3D || !sourceAnchorGroup) return;

    // 1. Ekstrak Transformasi Global Objek saat berada di dalam Anchor
    object3D.getWorldPosition(this._worldPosition);
    object3D.getWorldQuaternion(this._worldQuaternion);
    object3D.getWorldScale(this._worldScale);

    // 2. Lepaskan dari Anchor Group dan tambahkan ke Root Scene Utama
    this.scene.add(object3D);

    // 3. Terapkan Matriks World yang telah diekstrak
    object3D.position.copy(this._worldPosition);
    object3D.quaternion.copy(this._worldQuaternion);
    object3D.scale.copy(this._worldScale);

    // 4. Perbarui status FSM ke mode SLAM
    this.stateManager.setState(ARSTATES.SLAM);
    console.log("[Handover] Objek berhasil dialihkan ke World Coordinate.");
  }

  /**
   * Mengembalikan objek 3D ke Anchor Kartu jika pelacakan gambar terhubung kembali
   * @param {THREE.Object3D} object3D 
   * @param {THREE.Object3D} targetAnchorGroup 
   */
  handoverToLocal(object3D, targetAnchorGroup) {
    if (!object3D || !targetAnchorGroup) return;

    // Reset transformasi lokal saat ditempatkan kembali di Anchor
    object3D.position.set(0, 0, 0);
    object3D.quaternion.identity();
    object3D.scale.set(1, 1, 1);

    targetAnchorGroup.add(object3D);
    this.stateManager.setState(ARSTATES.TRACKED);
    console.log("[Handover] Objek dikembalikan ke Local Marker Coordinate.");
  }
}
