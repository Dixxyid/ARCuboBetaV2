# Walkthrough — Orbital Animation Earth–Moon

> Dokumen ini merangkum semua perubahan yang telah dilakukan pada sesi implementasi terakhir,
> lengkap dengan konteks teknis dan hasil akhirnya.

---

## Tujuan Sesi

Memastikan sistem **multi-target marker** berjalan dengan benar, dan menambahkan **event deteksi pasangan planet–satelit** yang terpicu ketika tombol "Lock Coordinate" ditekan. Jika kartu **Earth** dan **Moon** keduanya aktif dan dikunci, Bulan harus berputar mengelilingi Bumi di AR world space.

---

## Kondisi Sebelum

| Kondisi | Status |
|---|---|
| Multi-target marker (4 kartu simultaneous) | ✅ Sudah berjalan |
| Per-target CoordinateLock & SLAM anchor | ✅ Sudah berjalan |
| Lock Coordinate mengunci semua target aktif | ✅ Sudah berjalan |
| Rotasi planet pada sumbunya per-frame | ✅ Sudah berjalan |
| Deteksi pasangan Earth–Moon saat lock | ❌ Belum ada |
| Animasi orbital Moon mengelilingi Earth | ❌ Belum ada |
| Badge HUD indikator orbit aktif | ❌ Belum ada |

---

## File yang Diubah

### 1. [`src/data/celestialData.js`](../src/data/celestialData.js)

**Apa yang berubah:** Ditambahkan 4 field opsional pada objek `moon`.

```diff
  moon: {
    id: "moon",
    ...
    doi: "10.1038/nature07842",
+   // ── Relasi Orbital: Bulan mengorbit Bumi ──
+   orbitTarget:  "earth",  // ID planet induk
+   orbitRadius:  0.45,     // Jarak orbit dalam meter (world space AR)
+   orbitSpeed:   0.6,      // Kecepatan angular (rad/s)
+   orbitTilt:    0.09,     // Inklinasi orbit terhadap sumbu Y (rad, ~5.1°)
  },
```

**Kenapa begini:** Sistem dirancang *data-driven* — field `orbitTarget` cukup ditambahkan ke data celestial manapun untuk langsung dikenali sistem sebagai satelit. Tidak perlu ubah kode logika.

---

### 2. [`src/ar/OrbitalAnimator.js`](../src/ar/OrbitalAnimator.js) ✨ FILE BARU

**Apa yang ditambahkan:** Modul baru `OrbitalAnimator` untuk mengelola seluruh animasi orbital.

**Cara kerja inti:**
```
Setiap frame (60 FPS):
  angle += orbitSpeed * dt
  offset.x = cos(angle) * orbitRadius
  offset.y = sin(angle) * orbitRadius * sin(orbitTilt)
  offset.z = sin(angle) * orbitRadius * cos(orbitTilt)
  satellite.anchorGroup.position = parent.worldPosition + offset
  satellite.anchorGroup.updateMatrix()
```

**Optimasi kritis:** `_tmpParentPos` dan `_tmpOffset` adalah `THREE.Vector3` yang dibuat sekali di constructor dan di-reuse setiap frame. Ini menghindari garbage collection spike di render loop 60 FPS.

**API:**
```js
orbitalAnimator.addRelation(satelliteId, satelliteNode, parentNode, config)
orbitalAnimator.clearAll()     // saat Unlock
orbitalAnimator.update(dt)     // dipanggil setiap frame
```

---

### 3. [`src/main.js`](../src/main.js)

**Apa yang berubah:** 4 titik perubahan.

#### a) Constructor — tambah instance OrbitalAnimator
```js
this.orbitalAnimator = new OrbitalAnimator();
```

#### b) `toggleCoordinateLock()` — branch Unlock
```diff
  if (this.isSlamLocked) {
+   this.orbitalAnimator.clearAll();
    for (const t of this.targets.values()) {
+     t.anchorGroup.matrixAutoUpdate = false; // Re-freeze sebelum unlock
      t.coordinateLock.unlockFromSlam(t.anchorGroup);
      ...
    }
+   window.arUI.setOrbitalActive?.(false);
  }
```

#### c) `toggleCoordinateLock()` — callback setelah semua terkunci
```diff
  if (collectedCount >= totalToCollect) {
    this.isSlamLocked = true;
    ...
+   this._checkAndActivateOrbitals();
  }
```

#### d) Method baru `_checkAndActivateOrbitals()`
```js
_checkAndActivateOrbitals() {
  const lockedTargets = [...targets yang isSlamLocked];
  const lockedIds = new Set(lockedTargets.map(t => t.id));

  for (const satelliteNode of lockedTargets) {
    const { orbitTarget, orbitRadius, orbitSpeed, orbitTilt } = satelliteNode.celestial;
    if (!orbitTarget) continue;              // bukan satelit, skip
    if (!lockedIds.has(orbitTarget)) continue; // planet induk tidak aktif, skip
    
    const parentNode = this.targets.get(orbitTarget);
    this.orbitalAnimator.addRelation(satelliteId, satelliteNode, parentNode, {...});
  }
  arUI.setOrbitalActive(true, orbitalCount);
}
```

#### e) `_onRender(dt)` — skip applyTo + lambatkan spin satelit
```diff
+ const orbitalSatelliteIds = this.orbitalAnimator.hasActiveRelations
+   ? new Set(this.orbitalAnimator._relations.keys()) : null;

  for (const targetNode of this.targets.values()) {
-   targetNode.coordinateLock.applyTo(targetNode.anchorGroup, dt);
+   if (!orbitalSatelliteIds?.has(targetNode.id)) {
+     targetNode.coordinateLock.applyTo(targetNode.anchorGroup, dt);
+   }
    
-   targetNode.planetModel.rotation.y += 0.25 * dt;
+   const spinSpeed = orbitalSatelliteIds?.has(targetNode.id) ? 0.12 : 0.25;
+   targetNode.planetModel.rotation.y += spinSpeed * dt;
  }
+ this.orbitalAnimator.update(dt);
```

> **Kenapa `applyTo()` di-skip untuk satelit?** Setelah SLAM lock, `CoordinateLock.applyTo()` tidak melakukan apa-apa untuk node yang `isSlamLocked`. Namun untuk node satelit dalam orbital mode, posisinya diatur penuh oleh `OrbitalAnimator` — memanggil keduanya tidak konflik, tapi skip `applyTo()` lebih bersih dan efisien.

---

### 4. [`src/ui/uiState.js`](../src/ui/uiState.js)

**Apa yang berubah:** Ditambahkan state flag dan setter untuk orbital.

```diff
  isSlamLocked: false,
  showRescanNotif: false,
+ hasOrbitalAnimation: false,
+ orbitalCount: 0,

+ setOrbitalActive(active, count = 0) {
+   this.hasOrbitalAnimation = active;
+   this.orbitalCount = active ? count : 0;
+ },
```

---

### 5. [`index.html`](../index.html)

**Apa yang berubah:** Ditambahkan badge orbital reaktif Alpine.js.

```html
<!-- Badge Animasi Orbital Aktif -->
<template x-if="hasOrbitalAnimation">
  <div class="orbital-badge" x-transition.opacity.duration.500ms>
    <span class="orbital-icon">🌕</span>
    <div class="orbital-text">
      <span class="orbital-title">Orbit Aktif</span>
      <span class="orbital-desc">Bulan mengorbit Bumi</span>
    </div>
    <div class="orbital-pulse"></div>
  </div>
</template>
```

---

### 6. [`src/styles/hud.css`](../src/styles/hud.css)

**Apa yang berubah:** Ditambahkan CSS `.orbital-badge` di bagian bawah file.

Komponen visual:
- Background glassmorphism ungu gelap (`rgba(15, 5, 40, 0.75)`)
- Border + glow ungu (`rgba(147, 51, 234, 0.5)`)
- `.orbital-icon` — spin 8 detik penuh
- `.orbital-pulse` — ring glow pulse 2.5 detik
- Animasi masuk `orbitalSlideIn` — slide dari atas + scale spring

---

## Alur Lengkap Setelah Implementasi

```
[1] User scan permukaan ruangan (4 arah) → OK

[2] User tunjuk kartu EARTH
    → onTargetFound("earth")
    → Earth model muncul di atas kartu, berputar pelan

[3] User tunjuk kartu MOON (kamera bisa bergantian)
    → onTargetFound("moon")
    → Moon model muncul di atas kartunya

[4] User tekan "Lock Coordinate"
    → toggleCoordinateLock()
    → [Earth] 60 frame SLAM collection → commitSlamLock() → beku di world space
    → [Moon]  60 frame SLAM collection → commitSlamLock() → beku di world space
    → collectedCount >= 2 → isSlamLocked = true
    → _checkAndActivateOrbitals() dipanggil
    → moon.orbitTarget === "earth" ✓
    → earth termasuk dalam lockedIds ✓
    → OrbitalAnimator.addRelation("moon", ...) dipanggil
    → moon.anchorGroup.matrixAutoUpdate = true (re-enable untuk animasi)

[5] Setiap frame setelahnya (60 FPS):
    → OrbitalAnimator.update(dt)
    → moon berputar elips mengelilingi posisi world earth
    → Badge "🌕 Orbit Aktif — Bulan mengorbit Bumi" tampil di HUD

[6] User tekan "Unlock Coordinate"
    → orbitalAnimator.clearAll()
    → moon.anchorGroup.matrixAutoUpdate = false (re-freeze)
    → CoordinateLock.unlockFromSlam() semua target
    → Badge hilang, kembali ke MARKER_SCAN
```

---

## Catatan Penting untuk Sesi Selanjutnya

> [!WARNING]
> Saat ini `orbitalDesc` di badge HTML hardcode "Bulan mengorbit Bumi". Jika ada lebih dari satu relasi orbital aktif, teks ini perlu dibuat dinamis (misalnya generate dari `celestial.name` + `parentCelestial.name`).

> [!NOTE]
> GestureManager masih bisa menerima tap/drag pada Moon yang sedang dalam mode orbital. Ini tidak menyebabkan bug, tapi bisa membingungkan user karena model Moon bisa di-drag walaupun sedang beranimasi orbital. Pertimbangkan untuk disable drag pada satelit dalam orbital mode di sesi berikutnya.

> [!TIP]
> Untuk menambah satelit baru (mis. Phobos mengorbit Mars), cukup:
> 1. Tambah entry `phobos` di `celestialData.js` dengan `orbitTarget: "mars"`
> 2. Tambah ke `AR_IMAGE_TARGETS` di `main.js`
> 3. Sediakan `phobos.glb` dan gambar target kartu
> Tidak ada perubahan kode logika yang diperlukan — sistem fully data-driven.
