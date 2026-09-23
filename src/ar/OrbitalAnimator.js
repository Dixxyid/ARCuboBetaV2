import * as THREE from 'three';

/**
 * OrbitalAnimator
 *
 * Mengelola animasi orbital planet-satelit dalam AR world space.
 * Setelah SLAM Lock aktif, satelit (mis. Bulan) akan berputar
 * mengelilingi planet induknya (mis. Bumi) menggunakan posisi
 * world-anchor masing-masing sebagai referensi.
 *
 * Cara kerja:
 *  - Posisi world planet induk (SLAM-locked) stabil → dijadikan pusat orbit
 *  - Setiap frame: angle += speed * dt
 *  - Posisi satelit = posisi induk + offset polar(angle, radius, tilt)
 *  - matrixAutoUpdate satelit diaktifkan kembali agar bisa digerakkan setiap frame
 */
export class OrbitalAnimator {
  constructor() {
    /** @type {Map<string, OrbitalEntry>} satelliteId → entry */
    this._relations = new Map();

    // Reusable temporaries — hindari GC spike setiap frame
    this._tmpParentPos = new THREE.Vector3();
    this._tmpOffset    = new THREE.Vector3();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Daftarkan relasi orbital baru.
   * @param {string}          satelliteId   - ID target satelit (mis. "moon")
   * @param {object}          satelliteNode - Entry dari targets Map
   * @param {object}          parentNode    - Entry dari targets Map (planet induk)
   * @param {object}          config        - { orbitRadius, orbitSpeed, orbitTilt }
   */
  addRelation(satelliteId, satelliteNode, parentNode, config = {}) {
    const {
      orbitRadius = 0.45,
      orbitSpeed  = 0.6,
      orbitTilt   = 0.09,
    } = config;

    // Re-enable matrixAutoUpdate pada anchorGroup satelit agar bisa digeser tiap frame
    // (setelah commitSlamLock, matrixAutoUpdate di-set false)
    const satAnchor = satelliteNode.anchorGroup;
    satAnchor.matrixAutoUpdate = true;

    this._relations.set(satelliteId, {
      satelliteNode,
      parentNode,
      orbitRadius,
      orbitSpeed,
      orbitTilt,
      currentAngle: Math.random() * Math.PI * 2, // Mulai dari sudut acak agar tidak overlap
    });

    console.log(
      `[OrbitalAnimator] Relasi orbital aktif: "${satelliteId}" mengorbit "${parentNode.id}"` +
      ` (r=${orbitRadius}m, speed=${orbitSpeed}rad/s, tilt=${(orbitTilt * 180 / Math.PI).toFixed(1)}°)`
    );
  }

  /**
   * Hapus relasi orbital untuk satelit tertentu.
   * @param {string} satelliteId
   */
  removeRelation(satelliteId) {
    if (this._relations.has(satelliteId)) {
      this._relations.delete(satelliteId);
      console.log(`[OrbitalAnimator] Relasi orbital dihapus: "${satelliteId}"`);
    }
  }

  /** Hapus semua relasi orbital aktif (dipanggil saat Unlock Coordinate). */
  clearAll() {
    const ids = [...this._relations.keys()];
    this._relations.clear();
    if (ids.length > 0) {
      console.log(`[OrbitalAnimator] Semua relasi orbital dihapus (${ids.join(', ')})`);
    }
  }

  /** Apakah ada relasi orbital yang aktif? */
  get hasActiveRelations() {
    return this._relations.size > 0;
  }

  /** Jumlah relasi orbital aktif */
  get count() {
    return this._relations.size;
  }

  // ─── Render Update ────────────────────────────────────────────────────────

  /**
   * Dipanggil setiap frame dari render loop AppBootstrapper._onRender(dt).
   * @param {number} dt - Delta time dalam detik
   */
  update(dt) {
    if (this._relations.size === 0) return;

    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    for (const entry of this._relations.values()) {
      this._updateEntry(entry, safeDt);
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Update posisi satu satelit dalam orbit.
   * @param {OrbitalEntry} entry
   * @param {number} dt
   */
  _updateEntry(entry, dt) {
    const { satelliteNode, parentNode, orbitRadius, orbitSpeed, orbitTilt } = entry;

    // Guard: kedua node harus valid dan visible
    if (!satelliteNode.anchorGroup || !parentNode.anchorGroup) return;
    if (!parentNode.anchorGroup.visible) return;

    // 1. Increment sudut orbit
    entry.currentAngle += orbitSpeed * dt;
    if (entry.currentAngle > Math.PI * 2) {
      entry.currentAngle -= Math.PI * 2; // Wrap agar tidak overflow float
    }

    // 2. Ambil posisi world planet induk (sudah SLAM-locked, stabil)
    parentNode.anchorGroup.getWorldPosition(this._tmpParentPos);

    // 3. Hitung offset orbital dengan inklinasi (tilt) pada sumbu XZ
    //    Inklinasi: komponen Y dimodulasi oleh tilt untuk simulasi orbit miring
    const cosA = Math.cos(entry.currentAngle);
    const sinA = Math.sin(entry.currentAngle);
    this._tmpOffset.set(
      cosA * orbitRadius,
      sinA * orbitRadius * Math.sin(orbitTilt), // Elips vertikal tipis (inklinasi)
      sinA * orbitRadius * Math.cos(orbitTilt),
    );

    // 4. Terapkan posisi baru ke anchorGroup satelit
    const satAnchor = satelliteNode.anchorGroup;
    satAnchor.position.copy(this._tmpParentPos).add(this._tmpOffset);
    satAnchor.visible = true;

    // Pastikan matrix world diperbarui setiap frame (karena matrixAutoUpdate = true)
    satAnchor.updateMatrix();
  }
}

/**
 * @typedef {object} OrbitalEntry
 * @property {object} satelliteNode   - targets Map entry untuk satelit
 * @property {object} parentNode      - targets Map entry untuk planet induk
 * @property {number} orbitRadius     - Jarak orbit (meter)
 * @property {number} orbitSpeed      - Kecepatan angular (rad/s)
 * @property {number} orbitTilt       - Inklinasi orbit (rad)
 * @property {number} currentAngle    - Sudut orbit saat ini (rad)
 */
