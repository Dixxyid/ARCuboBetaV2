import * as THREE from 'three';

/**
 * CoordinateLock & Spatial Stabilizer
 * 
 * Mengelola penguncian pose (posisi, rotasi, skala) di sistem koordinat SLAM 8th Wall.
 * Dilengkapi algoritma stabilisasi multi-tahap:
 * 1. Deadband Filter: Menghilangkan micro-jitter saat kamera/kartu diam.
 * 2. Outlier / Spike Rejection: Mencegah objek melompat (jumping) akibat glitch optik sesaat.
 * 3. Frame-Rate Independent Exponential Moving Average (EMA) & Quaternion SLERP:
 *    Menghasilkan pergerakan halus (smooth 60+ FPS) tanpa rubber-banding atau lag.
 * 4. Persistent World Anchor:
 *    Saat kamera berpaling atau kartu hilang dari pandangan, pose terkunci di ruang 3D dunia
 *    sehingga objek tetap mengapung di posisi fisik kartu di ruangan Anda.
 * 5. Smooth Re-acquisition Blend:
 *    Ketika kamera kembali melihat kartu, posisi disesuaikan secara lembut tanpa pop/teleport.
 */
export class CoordinateLock {
  constructor() {
    this._locked = false;
    this._isTracking = false;
    this._targetName = null;
    this._timestamp = null;

    // Pose target dari pembacaan sensor/vision (raw/target)
    this._targetPosition   = new THREE.Vector3();
    this._targetQuaternion = new THREE.Quaternion();
    this._targetScale      = new THREE.Vector3(1, 1, 1);

    // Pose saat ini yang terfilter dan diterapkan ke Three.js Object3D
    this._currentPosition   = new THREE.Vector3();
    this._currentQuaternion = new THREE.Quaternion();
    this._currentScale      = new THREE.Vector3(1, 1, 1);

    // Temporary vectors untuk komputasi tanpa alokasi memori (cegah GC spikes)
    this._candidatePosition   = new THREE.Vector3();
    this._candidateQuaternion = new THREE.Quaternion();

    // ── Parameter Algoritma Stabilisasi ──
    // Deadband: Pergeseran di bawah ambang ini dianggap derau sensor & diabaikan
    this.DEADBAND_POS_METERS = 0.002;  // 2 milimeter
    this.DEADBAND_ROT_RAD    = 0.0087; // ~0.5 derajat

    // Outlier Threshold: Lonjakan posisi di atas ini dalam 1 frame dicurigai sebagai glitch
    this.MAX_POS_JUMP_METERS = 0.30;   // 30 cm
    this.OUTLIER_CONFIRMATION_FRAMES = 4; // Butuh 4 frame konsisten sebelum menerima perubahan drastis
    this._outlierCount = 0;

    // Kecepatan smoothing lambda (responsif namun sangat mulus)
    this.SMOOTH_LAMBDA = 12.0;

    // Jarak drift maksimum yang wajar dalam skala ruangan (15 meter)
    this.MAX_DRIFT_METERS = 15.0;
  }

  /**
   * Lock pose saat image target pertama kali ditemukan
   * @param {{ position, rotation, scale, name }} detail - dari event reality.imagefound
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

    console.log(`[CoordinateLock] Pose terkunci untuk "${name}" di`, this._currentPosition, 'scale:', this._currentScale);
  }

  /**
   * Update pose saat target masih terlihat (reality.imageupdated)
   * Menyaring jitter dengan Deadband dan Outlier Rejection.
   * @param {{ position, rotation, scale }} detail
   */
  update(detail) {
    if (!this._locked) return;
    this._isTracking = true;

    const { position, rotation, scale } = detail;

    // 1. Filter Posisi (Deadband + Outlier Rejection)
    if (position) {
      this._candidatePosition.set(position.x, position.y, position.z);
      const posDist = this._targetPosition.distanceTo(this._candidatePosition);

      if (posDist >= this.DEADBAND_POS_METERS) {
        if (posDist > this.MAX_POS_JUMP_METERS) {
          // Lonjakan besar dalam 1 frame — kemungkinan optical glitch
          this._outlierCount++;
          if (this._outlierCount >= this.OUTLIER_CONFIRMATION_FRAMES) {
            // Pengguna memang memindahkan kartu secara cepat dan bertahan
            this._outlierCount = 0;
            this._targetPosition.copy(this._candidatePosition);
          }
        } else {
          // Pergerakan wajar: reset counter outlier dan update target
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

    // 3. Filter Skala (stabilkan skala agar tidak bergetar)
    if (scale) {
      const parsed = this._parseScale(scale);
      this._targetScale.copy(parsed);
    }
  }

  /**
   * Beritahu sistem bahwa marker tidak lagi terlihat di kamera (reality.imagelost).
   * Pada titik ini, pose target DIBEKUKAN sebagai World Anchor yang stabil.
   */
  setTargetLost() {
    this._isTracking = false;
    this._outlierCount = 0;
    // Set target pose persis ke posisi stabil saat ini agar tidak ada sisa interpolasi melayang
    this._targetPosition.copy(this._currentPosition);
    this._targetQuaternion.copy(this._currentQuaternion);
    console.log(`[CoordinateLock] Marker lepas dari pandangan. World Anchor dipertahankan di:`, this._currentPosition);
  }

  /**
   * Terapkan pose yang terstabilisasi ke Object3D Three.js.
   * Dijalankan pada loop render 60 FPS untuk interpolasi ultra-smooth.
   * @param {THREE.Object3D} object3D 
   * @param {number} dt - Delta time dalam detik (misal 0.016 untuk 60fps)
   */
  applyTo(object3D, dt = 0.016) {
    if (!this._locked || !object3D) return;

    // Pastikan dt berada dalam rentang wajar (1ms s.d. 100ms) untuk mencegah teleport saat tab berganti
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    // Hitung faktor smoothing independen terhadap frame rate (EMA)
    // Formula: alpha = 1 - e^(-lambda * dt)
    const alpha = 1.0 - Math.exp(-this.SMOOTH_LAMBDA * safeDt);

    // Interpolasi posisi (LERP)
    this._currentPosition.lerp(this._targetPosition, alpha);

    // Interpolasi rotasi (SLERP) untuk mencegah flipping atau gimbal lock
    this._currentQuaternion.slerp(this._targetQuaternion, alpha);

    // Interpolasi skala
    this._currentScale.lerp(this._targetScale, alpha);

    // Terapkan ke matriks Three.js object
    object3D.position.copy(this._currentPosition);
    object3D.quaternion.copy(this._currentQuaternion);
    object3D.scale.copy(this._currentScale);
  }

  /**
   * Validasi apakah pose saat ini masih valid di dunia nyata
   * @param {THREE.Vector3} currentCameraPosition
   * @returns {boolean}
   */
  isValid(currentCameraPosition) {
    if (!this._locked) return false;

    // Cek apakah koordinat adalah angka terhingga
    if (!Number.isFinite(this._currentPosition.x) ||
        !Number.isFinite(this._currentPosition.y) ||
        !Number.isFinite(this._currentPosition.z)) {
      return false;
    }

    // Jika ada posisi kamera, verifikasi jarak dalam batas toleransi ruangan
    if (currentCameraPosition) {
      const dist = this._currentPosition.distanceTo(currentCameraPosition);
      if (dist > this.MAX_DRIFT_METERS) {
        console.warn(`[CoordinateLock] Pose melampaui batas jarak wajar (${dist.toFixed(2)}m > ${this.MAX_DRIFT_METERS}m)`);
        return false;
      }
    }

    return true;
  }

  /** Helper parsing scale dari payload 8th Wall */
  _parseScale(scale) {
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      return new THREE.Vector3(scale, scale, scale);
    } else if (scale && typeof scale.x === 'number') {
      return new THREE.Vector3(scale.x, scale.y, scale.z);
    }
    return new THREE.Vector3(1, 1, 1);
  }

  get isLocked()   { return this._locked; }
  get isTracking() { return this._isTracking; }
  get position()   { return this._currentPosition.clone(); }
  get quaternion() { return this._currentQuaternion.clone(); }
  get scale()      { return this._currentScale.clone(); }
  get targetName() { return this._targetName; }

  clear() {
    this._locked     = false;
    this._isTracking = false;
    this._targetName = null;
    this._timestamp  = null;
    this._outlierCount = 0;
    this._currentPosition.set(0, 0, 0);
    this._targetPosition.set(0, 0, 0);
    this._currentQuaternion.identity();
    this._targetQuaternion.identity();
    this._currentScale.set(1, 1, 1);
    this._targetScale.set(1, 1, 1);
    console.log('[CoordinateLock] Pose di-clear.');
  }
}
