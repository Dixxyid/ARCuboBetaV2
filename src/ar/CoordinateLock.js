import * as THREE from 'three';

/**
 * CoordinateLock
 * Menyimpan pose (posisi + rotasi) saat image target pertama kali ditemukan
 * di world coordinate system 8th Wall, lalu memvalidasi apakah data masih valid.
 */
export class CoordinateLock {
  constructor() {
    this._locked      = false;
    this._position    = new THREE.Vector3();
    this._quaternion  = new THREE.Quaternion();
    this._scale       = new THREE.Vector3(1, 1, 1);
    this._targetName  = null;
    this._timestamp   = null;

    // Threshold: pose dianggap tidak valid jika bergeser terlalu jauh
    this.MAX_DRIFT_METERS = 2.0;
  }

  /**
   * Lock pose dari data image target 8th Wall
   * @param {{ position, rotation, scale, name }} detail - detail dari event reality.imagefound
   */
  lock(detail) {
    const { position, rotation, scale, name } = detail;

    if (position) this._position.set(position.x, position.y, position.z);
    if (rotation) this._quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      this._scale.set(scale, scale, scale);
    } else if (scale && typeof scale.x === 'number') {
      this._scale.set(scale.x, scale.y, scale.z);
    } else {
      this._scale.set(1, 1, 1);
    }

    this._targetName = name;
    this._timestamp  = Date.now();
    this._locked     = true;

    console.log(`[CoordinateLock] Pose terkunci untuk target "${name}" di`, this._position, 'scale:', this._scale);
  }

  /**
   * Update pose saat target masih terlihat (reality.imageupdated)
   * @param {{ position, rotation, scale }} detail
   */
  update(detail) {
    if (!this._locked) return;
    const { position, rotation, scale } = detail;
    if (position) this._position.set(position.x, position.y, position.z);
    if (rotation) this._quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      this._scale.set(scale, scale, scale);
    } else if (scale && typeof scale.x === 'number') {
      this._scale.set(scale.x, scale.y, scale.z);
    }
  }

  /**
   * Validasi apakah pose saat ini masih dianggap valid
   * @param {THREE.Vector3} currentCameraPosition - posisi kamera sekarang
   * @returns {boolean}
   */
  isValid(currentCameraPosition) {
    if (!this._locked) return false;

    // Cek apakah objek sudah terlalu jauh dari kamera (mungkin salah mapping)
    const dist = this._position.distanceTo(currentCameraPosition);
    if (dist > this.MAX_DRIFT_METERS) {
      console.warn(`[CoordinateLock] Pose terlalu jauh (${dist.toFixed(2)}m), dianggap tidak valid`);
      return false;
    }
    return true;
  }

  /** Terapkan pose yang tersimpan ke object3D */
  applyTo(object3D) {
    if (!this._locked || !object3D) return;
    object3D.position.copy(this._position);
    object3D.quaternion.copy(this._quaternion);
    object3D.scale.copy(this._scale);
  }

  get isLocked()   { return this._locked; }
  get position()   { return this._position.clone(); }
  get quaternion() { return this._quaternion.clone(); }
  get targetName() { return this._targetName; }

  clear() {
    this._locked     = false;
    this._targetName = null;
    this._timestamp  = null;
    console.log('[CoordinateLock] Pose di-clear.');
  }
}
