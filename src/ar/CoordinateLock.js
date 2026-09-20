import * as THREE from 'three';

/**
 * CoordinateLock & SLAM Spatial Stabilizer
 *
 * Mengelola transisi dua mode spasial:
 * 1. Mode Marker Dynamic Tracking:
 *    Mengikuti posisi kartu fisik secara dinamis dengan filter Deadband, Outlier Rejection,
 *    dan EMA LERP & Quaternion SLERP yang mulus.
 * 2. Mode SLAM Solid World Anchor:
 *    Saat tombol "Lock Coordinate" ditekan, menghitung consensus pose dari buffer pose (Markley
 *    Quaternion Averaging) dan membekukan matriks dunia (matrixAutoUpdate = false).
 *    Objek secara matematis terkunci kokoh di sistem koordinat dunia SLAM 8th Wall, tidak akan
 *    bergeser sedikit pun saat kamera diarahkan ke mana saja di ruangan.
 */
export class CoordinateLock {
  constructor() {
    this._locked     = false;
    this._slamLocked = false;
    this._isTracking = false;
    this._targetName = null;
    this._timestamp  = null;

    // Pose target dari pembacaan sensor/vision (raw/filtered)
    this._targetPosition   = new THREE.Vector3();
    this._targetQuaternion = new THREE.Quaternion();
    this._targetScale      = new THREE.Vector3(1, 1, 1);

    // Pose saat ini yang terfilter dan diterapkan ke Three.js AnchorGroup
    this._currentPosition   = new THREE.Vector3();
    this._currentQuaternion = new THREE.Quaternion();
    this._currentScale      = new THREE.Vector3(1, 1, 1);

    // Temporary vectors untuk komputasi tanpa GC spikes
    this._candidatePosition   = new THREE.Vector3();
    this._candidateQuaternion = new THREE.Quaternion();

    // ── Parameter Stabilisasi ──
    this.DEADBAND_POS_METERS = 0.002;  // 2 milimeter
    this.DEADBAND_ROT_RAD    = 0.0087; // ~0.5 derajat
    this.MAX_POS_JUMP_METERS = 0.30;   // 30 cm
    this.OUTLIER_CONFIRMATION_FRAMES = 4;
    this._outlierCount = 0;
    this.SMOOTH_LAMBDA = 14.0;
    this.MAX_DRIFT_METERS = 15.0;

    // ── Rolling Pose History Buffer untuk Keyframe Pose Averaging ──
    this.MAX_HISTORY = 8;
    this._poseHistory = [];
  }

  /**
   * Mengunci pose saat target pertama kali ditemukan
   * @param {{ position, rotation, scale, name }} detail
   */
  lock(detail) {
    const { position, rotation, scale, name } = detail;

    if (position) {
      this._candidatePosition.set(position.x, position.y, position.z);
      this._targetPosition.copy(this._candidatePosition);
      this._currentPosition.copy(this._candidatePosition);
    }

    if (rotation) {
      this._candidateQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
      this._targetQuaternion.copy(this._candidateQuaternion);
      this._currentQuaternion.copy(this._candidateQuaternion);
    }

    const initialScale = this._parseScale(scale);
    this._targetScale.copy(initialScale);
    this._currentScale.copy(initialScale);

    this._targetName = name;
    this._timestamp  = Date.now();
    this._locked     = true;
    this._isTracking = true;
    this._outlierCount = 0;
    this._poseHistory  = [];

    this._recordPose(this._currentPosition, this._currentQuaternion);

    console.log(`[CoordinateLock] Pose terkunci untuk "${name}" di`, this._currentPosition);
  }

  /**
   * Update pose saat target masih terlihat di kamera (reality.imageupdated).
   * Hanya memproses jika TIDAK sedang dalam mode SLAM locked.
   * @param {{ position, rotation, scale }} detail
   */
  update(detail) {
    if (!this._locked) return;
    this._isTracking = true;

    // Jika sedang dalam mode SLAM_LOCKED, abaikan update optik kartu sama sekali
    // agar derau optik/sudut pandang kamera tidak menggeser anchor yang kokoh!
    if (this._slamLocked) return;

    const { position, rotation, scale } = detail;

    // 1. Filter Posisi (Deadband + Outlier Rejection)
    if (position) {
      this._candidatePosition.set(position.x, position.y, position.z);
      const posDist = this._targetPosition.distanceTo(this._candidatePosition);

      if (posDist >= this.DEADBAND_POS_METERS) {
        if (posDist > this.MAX_POS_JUMP_METERS) {
          this._outlierCount++;
          if (this._outlierCount >= this.OUTLIER_CONFIRMATION_FRAMES) {
            this._outlierCount = 0;
            this._targetPosition.copy(this._candidatePosition);
          }
        } else {
          this._outlierCount = 0;
          this._targetPosition.copy(this._candidatePosition);
        }
      }
    }

    // 2. Filter Rotasi (Deadband + Normalisasi Kuaternion)
    if (rotation) {
      this._candidateQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
      const rotAngle = this._targetQuaternion.angleTo(this._candidateQuaternion);

      if (rotAngle >= this.DEADBAND_ROT_RAD) {
        this._targetQuaternion.copy(this._candidateQuaternion);
      }
    }

    // 3. Filter Skala
    if (scale) {
      const parsed = this._parseScale(scale);
      this._targetScale.copy(parsed);
    }

    // Simpan ke riwayat pose untuk Keyframe Pose Averaging
    this._recordPose(this._targetPosition, this._targetQuaternion);
  }

  /**
   * Catat pose ke dalam circular buffer history
   */
  _recordPose(pos, quat) {
    this._poseHistory.push({
      position: pos.clone(),
      quaternion: quat.clone(),
    });
    if (this._poseHistory.length > this.MAX_HISTORY) {
      this._poseHistory.shift();
    }
  }

  /**
   * Kunci Koordinat ke SLAM World Space secara permanen (Solid World Anchor).
   * Menghitung consensus pose dan membekukan matrixAutoUpdate.
   * @param {THREE.Object3D} anchorGroup - Parent group Three.js
   */
  lockToSlam(anchorGroup) {
    if (!this._locked) return;

    // 1. Hitung Keyframe Pose Average jika ada riwayat pose
    if (this._poseHistory.length > 0) {
      const avgPos = new THREE.Vector3(0, 0, 0);
      const baseQuat = this._poseHistory[0].quaternion;
      let qx = 0, qy = 0, qz = 0, qw = 0;

      for (const p of this._poseHistory) {
        avgPos.add(p.position);

        // Markley Quaternion Averaging dengan penanganan antipodal
        const dot = p.quaternion.dot(baseQuat);
        const sign = dot >= 0 ? 1 : -1;
        qx += p.quaternion.x * sign;
        qy += p.quaternion.y * sign;
        qz += p.quaternion.z * sign;
        qw += p.quaternion.w * sign;
      }

      avgPos.divideScalar(this._poseHistory.length);
      const avgQuat = new THREE.Quaternion(qx, qy, qz, qw).normalize();

      this._targetPosition.copy(avgPos);
      this._currentPosition.copy(avgPos);
      this._targetQuaternion.copy(avgQuat);
      this._currentQuaternion.copy(avgQuat);
    }

    this._slamLocked = true;

    // 2. Terapkan langsung dan BEKUKAN matriks Three.js agar tidak pernah bergeser
    if (anchorGroup) {
      anchorGroup.position.copy(this._currentPosition);
      anchorGroup.quaternion.copy(this._currentQuaternion);
      anchorGroup.scale.copy(this._currentScale);
      anchorGroup.updateMatrix();
      anchorGroup.updateMatrixWorld(true);
      anchorGroup.matrixAutoUpdate = false; // Matriks terkunci kaku!
    }

    console.log('[CoordinateLock] SLAM Solid World Anchor diaktifkan. Matriks dibekukan di:', this._currentPosition);
  }

  /**
   * Lepaskan kuncian SLAM dan kembali ke mode AR Marker
   * @param {THREE.Object3D} anchorGroup
   */
  unlockFromSlam(anchorGroup) {
    this._slamLocked = false;
    if (anchorGroup) {
      anchorGroup.matrixAutoUpdate = true; // Buka pembekuan matriks
    }
    console.log('[CoordinateLock] SLAM Solid World Anchor dilepas. Kembali ke mode Marker.');
  }

  /**
   * Notifikasi marker lepas dari pandangan kamera (reality.imagelost)
   */
  setTargetLost() {
    this._isTracking = false;
    this._outlierCount = 0;
    if (!this._slamLocked) {
      this._targetPosition.copy(this._currentPosition);
      this._targetQuaternion.copy(this._currentQuaternion);
    }
    console.log('[CoordinateLock] Target marker hilang dari pandangan.');
  }

  /**
   * Terapkan pose ke AnchorGroup di setiap frame render 60 FPS
   * @param {THREE.Object3D} anchorGroup 
   * @param {number} dt 
   */
  applyTo(anchorGroup, dt = 0.016) {
    if (!this._locked || !anchorGroup) return;

    // Jika sedang dalam SLAM_LOCKED, matriks sudah dibekukan kaku, tidak perlu diubah
    if (this._slamLocked) return;

    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
    const alpha  = 1.0 - Math.exp(-this.SMOOTH_LAMBDA * safeDt);

    this._currentPosition.lerp(this._targetPosition, alpha);
    this._currentQuaternion.slerp(this._targetQuaternion, alpha);
    this._currentScale.lerp(this._targetScale, alpha);

    anchorGroup.position.copy(this._currentPosition);
    anchorGroup.quaternion.copy(this._currentQuaternion);
    anchorGroup.scale.copy(this._currentScale);
  }

  isValid(currentCameraPosition) {
    if (!this._locked) return false;
    if (!Number.isFinite(this._currentPosition.x)) return false;

    if (currentCameraPosition) {
      const dist = this._currentPosition.distanceTo(currentCameraPosition);
      if (dist > this.MAX_DRIFT_METERS) {
        console.warn(`[CoordinateLock] Pose melebihi batas drift (${dist.toFixed(2)}m)`);
        return false;
      }
    }
    return true;
  }

  _parseScale(scale) {
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      return new THREE.Vector3(scale, scale, scale);
    } else if (scale && typeof scale.x === 'number') {
      return new THREE.Vector3(scale.x, scale.y, scale.z);
    }
    return new THREE.Vector3(1, 1, 1);
  }

  get isLocked()     { return this._locked; }
  get isSlamLocked() { return this._slamLocked; }
  get isTracking()   { return this._isTracking; }
  get position()     { return this._currentPosition.clone(); }
  get quaternion()   { return this._currentQuaternion.clone(); }
  get scale()        { return this._currentScale.clone(); }
  get targetName()   { return this._targetName; }

  clear(anchorGroup = null) {
    this._locked     = false;
    this._slamLocked = false;
    this._isTracking = false;
    this._targetName = null;
    this._timestamp  = null;
    this._outlierCount = 0;
    this._poseHistory  = [];
    this._currentPosition.set(0, 0, 0);
    this._targetPosition.set(0, 0, 0);
    this._currentQuaternion.identity();
    this._targetQuaternion.identity();
    this._currentScale.set(1, 1, 1);
    this._targetScale.set(1, 1, 1);

    if (anchorGroup) {
      anchorGroup.matrixAutoUpdate = true;
    }
    console.log('[CoordinateLock] Pose di-clear.');
  }
}
