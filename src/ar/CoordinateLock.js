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
    this._isCollecting = false; // Fase pengumpulan pose sebelum SLAM lock
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

    // ── Parameter Stabilisasi Adaptif (Dual-Speed 1-Euro Principle) ──
    this.DEADBAND_POS_METERS = 0.0015; // 1.5 mm — filter micro-tremor tangan/kamera
    this.DEADBAND_ROT_RAD    = 0.006;  // ~0.35 derajat — filter micro-rotasi
    this.MAX_POS_JUMP_METERS = 0.35;   // 35 cm — batas toleransi jump outlier
    this.OUTLIER_CONFIRMATION_FRAMES = 4;
    this._outlierCount = 0;
    this.MIN_LAMBDA = 8.0;             // Saat kartu diam: peredaman tinggi, rock-solid (0 jitter)
    this.MAX_LAMBDA = 28.0;            // Saat kartu bergerak: respon tinggi instan (0 lag)
    this.MAX_DRIFT_METERS = 15.0;

    // ── Parameter Stabilisasi (Mode Collecting — lebih ketat) ──
    // Saat mengumpulkan data SLAM, deadband diperketat agar hanya sampel
    // berkualitas tinggi yang masuk ke buffer pose averaging.
    this.COLLECT_DEADBAND_POS = 0.001; // 1 mm (lebih ketat dari normal)
    this.COLLECT_DEADBAND_ROT = 0.003; // ~0.17 derajat (lebih ketat)
    this.COLLECT_MAX_JUMP     = 0.10;  // 10 cm — tolak outlier lebih agresif

    // ── Rolling Pose History Buffer ──
    // MAX_HISTORY = 60: menyimpan 1 detik data di 60 FPS.
    // SLAM_COLLECT_TARGET = 60: wajib 60 sampel valid sebelum commit lock.
    this.MAX_HISTORY           = 60;
    this.SLAM_COLLECT_TARGET   = 60;
    this._poseHistory = [];
    this._collectFrameCount = 0;
    this._onCollectionDone = null;

    // ── Watchdog Heartbeat Tracking ──
    // Menghitung waktu sejak update optik terakhir dari kamera.
    // Jika tidak ada update dalam 250ms (~15 frame), target dianggap hilang seketika!
    this._lastSeenTime = 0;
    this.TRACKING_TIMEOUT_MS = 250;
    this.onTrackingLost = null;
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
      this._currentPosition.copy(this._candidatePosition); // Snap langsung
    }

    if (rotation) {
      this._candidateQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
      this._targetQuaternion.copy(this._candidateQuaternion);
      this._currentQuaternion.copy(this._candidateQuaternion); // Snap langsung
    }

    const initialScale = this._parseScale(scale);
    this._targetScale.copy(initialScale);
    this._currentScale.copy(initialScale);

    this._targetName = name;
    this._timestamp  = Date.now();
    this._lastSeenTime = performance.now();
    this._locked     = true;
    this._isTracking = true;
    this._justFound  = true; // Flag: snap ke posisi marker tanpa lerp di frame pertama
    this._outlierCount = 0;
    // Jangan reset poseHistory jika sedang collecting — biarkan terus akumulasi
    if (!this._isCollecting) {
      this._poseHistory = [];
    }

    this._recordPose(this._currentPosition, this._currentQuaternion);

    console.log(`[CoordinateLock] Pose dikunci untuk "${name}" — snap ke`, this._currentPosition);
  }

  /**
   * Update pose saat target masih terlihat di kamera (reality.imageupdated).
   * Hanya memproses jika TIDAK sedang dalam mode SLAM locked.
   * @param {{ position, rotation, scale }} detail
   */
  update(detail) {
    if (!this._locked) return;
    this._isTracking = true;
    this._lastSeenTime = performance.now();

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

    // Simpan ke riwayat pose
    this._recordPose(this._targetPosition, this._targetQuaternion, this._isCollecting);

    // Jika sedang dalam fase pengumpulan SLAM, hitung kemajuan
    if (this._isCollecting) {
      this._collectFrameCount++;

      // Log hanya di milestone (0%, 25%, 50%, 75%, 100%) — tidak spam console
      const pct = Math.floor((this._collectFrameCount / this.SLAM_COLLECT_TARGET) * 100);
      if (pct % 25 === 0 || this._collectFrameCount === 1) {
        console.log(`[CoordinateLock] SLAM Collecting: ${this._collectFrameCount}/${this.SLAM_COLLECT_TARGET} (${pct}%)`);
      }

      if (this._collectFrameCount >= this.SLAM_COLLECT_TARGET) {
        this._isCollecting = false;
        console.log('[CoordinateLock] ✓ Data SLAM cukup! Commit lock...');
        if (this._onCollectionDone) {
          this._onCollectionDone();
          this._onCollectionDone = null;
        }
      }
    }
  }

  /**
   * Catat pose ke dalam circular buffer history.
   * Saat mode collecting, filter lebih ketat dan setiap sampel diberi bobot waktu.
   * @param {THREE.Vector3} pos
   * @param {THREE.Quaternion} quat
   * @param {boolean} isCollectingSample - true jika dipanggil dari fase collecting
   */
  _recordPose(pos, quat, isCollectingSample = false) {
    // Bobot: sampel terbaru lebih dipercaya (exponential weight)
    // Frame ke-N dari total M: weight = e^(N/M) yang dinormalisasi
    const weight = isCollectingSample
      ? Math.exp(this._collectFrameCount / this.SLAM_COLLECT_TARGET)
      : 1.0;

    this._poseHistory.push({
      position:   pos.clone(),
      quaternion: quat.clone(),
      weight,
    });
    if (this._poseHistory.length > this.MAX_HISTORY) {
      this._poseHistory.shift();
    }
  }

  /**
   * Mulai fase pengumpulan data pose untuk SLAM anchor.
   * Dipanggil saat tombol "Lock Coordinate" ditekan.
   * Akan mengakumulasi MAX_HISTORY frame, lalu memanggil onDone().
   * @param {Function} onDone - callback dipanggil otomatis setelah data cukup
   */
  startSlamCollection(onDone) {
    if (!this._locked || !this._isTracking) {
      console.warn('[CoordinateLock] Tidak bisa mulai collecting — marker belum terdeteksi.');
      return false;
    }
    if (this._slamLocked) {
      console.warn('[CoordinateLock] Sudah dalam mode SLAM_LOCKED.');
      return false;
    }
    // Reset buffer dan mulai akumulasi fresh
    this._poseHistory      = [];
    this._collectFrameCount = 0;
    this._isCollecting     = true;
    this._onCollectionDone = onDone;
    console.log(`[CoordinateLock] Mulai kumpulkan ${this.SLAM_COLLECT_TARGET} frame data pose SLAM...`);
    return true;
  }

  /**
   * Hitung consensus pose dari buffer dan bekukan matriks Three.js.
   * Menggunakan:
   *   1. Variance-based Outlier Pruning — buang sampel yang menyimpang > 1 std dev
   *   2. Weighted Markley Quaternion Averaging — frame terbaru diberi bobot lebih tinggi
   *   3. matrixAutoUpdate = false — matriks dibekukan permanen
   * @param {THREE.Object3D} anchorGroup
   */
  commitSlamLock(anchorGroup) {
    if (!this._locked) return;

    const n = this._poseHistory.length;
    if (n > 0) {

      // ── Langkah 1: Hitung mean posisi awal (untuk variance) ──
      const rawMean = new THREE.Vector3();
      for (const p of this._poseHistory) rawMean.add(p.position);
      rawMean.divideScalar(n);

      // ── Langkah 2: Hitung standar deviasi posisi ──
      let variance = 0;
      for (const p of this._poseHistory) {
        variance += p.position.distanceToSquared(rawMean);
      }
      const stdDev = Math.sqrt(variance / n);

      // ── Langkah 3: Prune outlier — buang sampel yang jauh > 1.5 std dev ──
      const threshold = stdDev * 1.5;
      const clean = this._poseHistory.filter(p =>
        p.position.distanceTo(rawMean) <= threshold
      );
      const samples = clean.length > 0 ? clean : this._poseHistory; // fallback
      console.log(`[CoordinateLock] Variance pruning: ${n} → ${samples.length} sampel bersih (stdDev=${stdDev.toFixed(4)}m)`);

      // ── Langkah 4: Weighted Average Posisi & Rotasi ──
      const avgPos  = new THREE.Vector3();
      let totalW = 0;
      let qx = 0, qy = 0, qz = 0, qw = 0;
      const baseQuat = samples[0].quaternion;

      for (const p of samples) {
        const w = p.weight ?? 1.0;
        totalW += w;
        avgPos.addScaledVector(p.position, w);

        // Markley Quaternion Averaging (dengan antipodal flip + weight)
        const dot  = p.quaternion.dot(baseQuat);
        const sign = dot >= 0 ? 1 : -1;
        qx += p.quaternion.x * sign * w;
        qy += p.quaternion.y * sign * w;
        qz += p.quaternion.z * sign * w;
        qw += p.quaternion.w * sign * w;
      }

      avgPos.divideScalar(totalW);
      const avgQuat = new THREE.Quaternion(qx, qy, qz, qw).normalize();

      this._targetPosition.copy(avgPos);
      this._currentPosition.copy(avgPos);
      this._targetQuaternion.copy(avgQuat);
      this._currentQuaternion.copy(avgQuat);

      console.log(`[CoordinateLock] ✓ Consensus pose dari ${samples.length} sampel (weighted). Posisi:`, avgPos);
    }

    this._slamLocked   = true;
    this._isCollecting = false;

    // ── Bekukan matriks Three.js — objek tidak akan bergeser selamanya ──
    if (anchorGroup) {
      anchorGroup.visible = true;
      anchorGroup.position.copy(this._currentPosition);
      anchorGroup.quaternion.copy(this._currentQuaternion);
      anchorGroup.scale.copy(this._currentScale);
      anchorGroup.updateMatrix();
      anchorGroup.updateMatrixWorld(true);
      anchorGroup.matrixAutoUpdate = false; // Matriks terkunci kaku!
    }

    console.log('[CoordinateLock] SLAM Solid World Anchor ✓ LOCKED di:', this._currentPosition);
  }

  /**
   * @deprecated Gunakan startSlamCollection() + commitSlamLock()
   * Tetap tersedia untuk kompatibilitas
   */
  lockToSlam(anchorGroup) {
    this.commitSlamLock(anchorGroup);
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
    this._isTracking   = false;
    this._justFound    = false;
    this._outlierCount = 0;
    this._lastSeenTime = 0;
    if (!this._slamLocked) {
      // Bekukan target pada posisi terakhir yang valid (jangan lerp ke mana-mana)
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

    // ── Watchdog Timeout Check ──
    // Jika tidak ada frame update optik dalam TRACKING_TIMEOUT_MS (~250ms),
    // target otomatis dideklarasikan HILANG seketika tanpa menunggu event engine!
    if (this._isTracking && (performance.now() - this._lastSeenTime > this.TRACKING_TIMEOUT_MS)) {
      this.setTargetLost();
      if (this.onTrackingLost) {
        this.onTrackingLost(this._targetName);
      }
    }

    // ── Guard Visibilitas Utama ──
    // Objek HANYA terlihat jika marker sedang aktif terlihat di kamera
    // atau sedang dalam fase collecting (marker harus ada)
    if (!this._isTracking && !this._isCollecting) {
      if (anchorGroup.visible) anchorGroup.visible = false; // enforce hide
      return;
    }

    if (!anchorGroup.visible) anchorGroup.visible = true; // enforce show

    // ── Snap vs Lerp ──
    // Frame pertama setelah marker ditemukan: snap langsung tanpa lerp
    // agar objek tidak "melayang" dari posisi lama ke posisi baru
    if (this._justFound) {
      this._justFound = false;
      anchorGroup.position.copy(this._currentPosition);
      anchorGroup.quaternion.copy(this._currentQuaternion);
      anchorGroup.scale.copy(this._currentScale);
      return;
    }

    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    // ── Adaptive Dual-Speed Filter (1-Euro Principle) ──
    // Kecepatan rendah (diam / jitter tangan): lambda rendah (~8) → sangat kokoh & stabil
    // Kecepatan tinggi (kartu digerakkan cepat): lambda tinggi (~28) → sangat responsif tanpa visual lag
    const posDist = this._currentPosition.distanceTo(this._targetPosition);
    const speed = posDist / safeDt;
    const speedFactor = Math.min(speed / 0.12, 1.0); // saturasi pada kecepatan 12 cm/s
    const dynamicLambda = THREE.MathUtils.lerp(this.MIN_LAMBDA, this.MAX_LAMBDA, speedFactor);
    const alphaPos = 1.0 - Math.exp(-dynamicLambda * safeDt);

    // Rotasi adaptif: redam micro-wobble sudut saat diam, ikuti cepat saat kartu diputar
    const rotAngle = this._currentQuaternion.angleTo(this._targetQuaternion);
    const rotSpeed = rotAngle / safeDt;
    const rotFactor = Math.min(rotSpeed / 2.0, 1.0);
    const dynamicRotLambda = THREE.MathUtils.lerp(10.0, 26.0, rotFactor);
    const alphaRot = 1.0 - Math.exp(-dynamicRotLambda * safeDt);

    this._currentPosition.lerp(this._targetPosition, alphaPos);
    this._currentQuaternion.slerp(this._targetQuaternion, alphaRot);
    this._currentScale.lerp(this._targetScale, alphaPos);

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

  get isLocked()       { return this._locked; }
  get isSlamLocked()   { return this._slamLocked; }
  get isCollecting()   { return this._isCollecting; }
  get isTracking()     { return this._isTracking; }
  get lastSeenTime()   { return this._lastSeenTime; }
  get collectProgress(){ return this._isCollecting ? Math.min(this._collectFrameCount / this.SLAM_COLLECT_TARGET, 1.0) : 0; }
  get position()       { return this._currentPosition.clone(); }
  get quaternion()     { return this._currentQuaternion.clone(); }
  get scale()          { return this._currentScale.clone(); }
  get targetName()     { return this._targetName; }

  clear(anchorGroup = null) {
    this._locked       = false;
    this._slamLocked   = false;
    this._isCollecting = false;
    this._isTracking   = false;
    this._targetName   = null;
    this._timestamp    = null;
    this._outlierCount      = 0;
    this._collectFrameCount = 0;
    this._onCollectionDone  = null;
    this._poseHistory       = [];
    this._currentPosition.set(0, 0, 0);
    this._targetPosition.set(0, 0, 0);
    this._currentQuaternion.identity();
    this._targetQuaternion.identity();
    this._currentScale.set(1, 1, 1);
    this._targetScale.set(1, 1, 1);

    if (anchorGroup) {
      anchorGroup.matrixAutoUpdate = true;
      anchorGroup.visible = true;
    }
    console.log('[CoordinateLock] Pose di-clear.');
  }
}
