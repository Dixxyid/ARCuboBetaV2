# Implementation Log — AstroARV3

Log riwayat implementasi fitur. Ditulis untuk AI coding assistant agar bisa memahami konteks perubahan yang telah dilakukan.

---

## [2026-09-23] — Fitur Orbital Earth–Moon + Multi-Target Optimization

### Latar Belakang

Proyek sudah memiliki sistem multi-target AR yang berjalan (Earth, Mars, Moon, Sun), namun belum ada **relasi semantik antar kartu**. Permintaan: ketika kartu **Earth** dan **Moon** keduanya aktif dan pengguna menekan **"Lock Coordinate"**, Bulan harus berputar mengelilingi Bumi di AR world space.

---

### Perubahan yang Dilakukan

#### 1. `src/data/celestialData.js` — Tambah Metadata Relasi Orbital

Ditambahkan field baru pada objek `moon`:

```js
orbitTarget: "earth",  // ID planet induk
orbitRadius: 0.45,     // meter di AR world space
orbitSpeed:  0.6,      // rad/s
orbitTilt:   0.09,     // inklinasi orbit (rad, ~5.1°)
```

**Desain keputusan**: Field ini bersifat **opsional** — jika tidak ada `orbitTarget`, celestial dianggap bukan satelit. Ini membuat sistem fully data-driven dan extensible.

---

#### 2. `src/ar/OrbitalAnimator.js` — Modul Baru

Kelas baru untuk mengelola animasi orbital planet-satelit di AR world space.

**API publik:**
```js
addRelation(satelliteId, satelliteNode, parentNode, config)
removeRelation(satelliteId)
clearAll()
update(dt)         // dipanggil setiap frame dari render loop
```

**Algoritma posisi satelit (per frame):**
```js
entry.currentAngle += orbitSpeed * dt;
const cosA = Math.cos(entry.currentAngle);
const sinA = Math.sin(entry.currentAngle);
offset = Vector3(
  cosA * orbitRadius,
  sinA * orbitRadius * sin(orbitTilt),  // inklinasi vertikal
  sinA * orbitRadius * cos(orbitTilt),
);
satellite.anchorGroup.position = parent.worldPosition + offset;
```

**Optimasi performa**: Menggunakan `_tmpParentPos` dan `_tmpOffset` sebagai Vector3 reusable (tidak alokasi baru setiap frame → zero GC pressure).

**Catatan penting tentang matrixAutoUpdate**: Setelah `commitSlamLock()`, `anchorGroup.matrixAutoUpdate = false`. Untuk satelit yang beranimasi orbital, `addRelation()` mengaktifkan kembali `matrixAutoUpdate = true` pada node satelit saja, dan `updateMatrix()` dipanggil manual setiap frame.

---

#### 3. `src/main.js` — Integrasi OrbitalAnimator

**Perubahan di constructor:**
```js
this.orbitalAnimator = new OrbitalAnimator();
```

**Perubahan di `toggleCoordinateLock()` — unlock branch:**
```js
this.orbitalAnimator.clearAll();
// Re-freeze matrixAutoUpdate sebelum unlock:
t.anchorGroup.matrixAutoUpdate = false;
t.coordinateLock.unlockFromSlam(t.anchorGroup);
```

**Perubahan di `toggleCoordinateLock()` — lock completion callback:**
```js
// Setelah semua target terkunci:
this._checkAndActivateOrbitals();
```

**Method baru `_checkAndActivateOrbitals()`:**
- Mengiterasi semua target yang `isSlamLocked === true`
- Untuk tiap target yang punya `celestial.orbitTarget`, cek apakah planet induk juga terkunci
- Jika ya → `orbitalAnimator.addRelation(...)`
- Jika tidak → skip dengan log informatif

**Perubahan di `_onRender(dt)`:**
```js
// Skip applyTo() untuk satelit dalam mode orbital
// (posisi dikendalikan OrbitalAnimator, bukan CoordinateLock)
if (!orbitalSatelliteIds?.has(targetNode.id)) {
  targetNode.coordinateLock.applyTo(targetNode.anchorGroup, dt);
}

// Rotasi aksial lebih lambat untuk satelit (simulasi tidally locked)
const spinSpeed = orbitalSatelliteIds?.has(targetNode.id) ? 0.12 : 0.25;
targetNode.planetModel.rotation.y += spinSpeed * dt;

// Update semua orbital setelah loop planet
this.orbitalAnimator.update(dt);
```

---

#### 4. `src/ui/uiState.js` — State Flag Orbital

Ditambahkan ke Alpine store:
```js
hasOrbitalAnimation: false,   // boolean
orbitalCount: 0,              // number

setOrbitalActive(active, count = 0) {
  this.hasOrbitalAnimation = active;
  this.orbitalCount = active ? count : 0;
}
```

---

#### 5. `index.html` — Badge Orbital di HUD

Ditambahkan badge reaktif Alpine:
```html
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

#### 6. `src/styles/hud.css` — CSS Orbital Badge

Ditambahkan class `.orbital-badge` dengan:
- Glassmorphism background ungu gelap
- Border gradient ungu + glow `box-shadow`
- `.orbital-icon` dengan animasi spin 8 detik
- `.orbital-pulse` dengan animasi ring pulse 2.5 detik
- Animasi masuk `orbitalSlideIn` (slide + scale dari atas)

---

### Alur Lengkap Fitur Orbital

```
User arahkan kamera ke Earth card
         ↓ onTargetFound("earth")
         ↓ CoordinateLock.lock() + anchorGroup.visible = true
         ↓ Earth model muncul, berputar pada sumbunya

User arahkan kamera ke Moon card
         ↓ onTargetFound("moon")
         ↓ CoordinateLock.lock() + anchorGroup.visible = true
         ↓ Moon model muncul, berputar pada sumbunya

User tekan "Lock Coordinate"
         ↓ toggleCoordinateLock()
         ↓ [Earth] startSlamCollection() → 60 frame → commitSlamLock()
         ↓ [Moon]  startSlamCollection() → 60 frame → commitSlamLock()
         ↓ collectedCount >= totalToCollect
         ↓ _checkAndActivateOrbitals()
         ↓ moon.orbitTarget === "earth" ✓
         ↓ earth terkunci ✓
         ↓ OrbitalAnimator.addRelation("moon", moonNode, earthNode, {...})
         ↓ moon.anchorGroup.matrixAutoUpdate = true
         ↓ arUI.setOrbitalActive(true, 1)

Setiap frame (60 FPS):
         ↓ OrbitalAnimator.update(dt)
         ↓ angle += 0.6 * dt
         ↓ moon.anchorGroup.position = earth.worldPosition + polarOffset(angle)
         ↓ moon.anchorGroup.updateMatrix()
         ↓ moon.planetModel.rotation.y += 0.12 * dt  (axial spin lambat)
         ↓ earth.planetModel.rotation.y += 0.25 * dt (axial spin normal)

User tekan "Unlock Coordinate"
         ↓ orbitalAnimator.clearAll()
         ↓ moon.anchorGroup.matrixAutoUpdate = false
         ↓ CoordinateLock.unlockFromSlam() untuk semua
         ↓ arUI.setOrbitalActive(false)
         ↓ Kembali ke MARKER_SCAN
```

---

### Catatan untuk Pengembangan Selanjutnya

- **Menambah satelit baru**: Cukup tambah `orbitTarget` + parameter orbital ke entry di `celestialData.js`. Tidak perlu ubah `main.js` atau `OrbitalAnimator.js`.
- **Inklinasi orbit**: Saat ini menggunakan model elips sederhana. Untuk orbit yang lebih akurat, bisa ditambahkan parameter `orbitEccentricity`.
- **Orbit Moon mengelilingi Mars** (jika ditambah Phobos): Tambah entry `phobos` dengan `orbitTarget: "mars"`.
- **Label planet induk dinamis**: `orbitalDesc` di badge saat ini hardcode "Bulan mengorbit Bumi". Bisa dibuat dinamis dari `celestial.name` + `parentCelestial.name` jika dibutuhkan.
- **GestureManager dan satelit dalam orbit**: Saat ini jika user tap Moon yang sedang orbital, GestureManager masih bisa aktif. Pertimbangkan untuk menonaktifkan drag pada satelit yang sedang orbital mode agar tidak konflik dengan posisi orbital.
