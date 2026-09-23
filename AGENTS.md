# AstroARV3 — AI Agent Context (AGENTS.md)

> **Baca file ini sebelum membuat perubahan apapun pada proyek ini.**
> File ini adalah panduan arsitektur dan konteks penting untuk AI coding assistant.

---

## Ringkasan Proyek

**AstroARV3** adalah aplikasi WebAR edukasi astronomi berbasis flashcard.
Pengguna mengarahkan kamera ke kartu fisik (Earth, Mars, Moon, Sun) dan model 3D planet muncul di atasnya secara real-time menggunakan teknologi SLAM + Image Target dari **8th Wall (XR8)**.

**Stack Teknologi:**
- **Runtime AR**: 8th Wall XR8 (`/public/xr/xr.js`) — SLAM world tracking + Image Target detection
- **3D Engine**: Three.js (di-bundle via Vite)
- **UI Reaktif**: Alpine.js (store `arApp`)
- **Bundler**: Vite
- **Deploy**: Netlify

---

## Struktur File

```
ARCuboBetaV2/
├── index.html               # Entry point HTML + Alpine x-data binding
├── src/
│   ├── main.js              # ⭐ AppBootstrapper — orchestrator utama seluruh aplikasi
│   ├── ar/
│   │   ├── ARState.js       # Finite State Machine (FSM) state tracking AR
│   │   ├── CoordinateLock.js # Stabilizer pose marker + SLAM world anchor
│   │   ├── EighthWallManager.js # Inisialisasi & pipeline XR8
│   │   └── OrbitalAnimator.js   # ✨ Animasi orbital planet-satelit (Earth-Moon)
│   ├── core/
│   │   ├── GestureManager.js  # Touch drag (orbit), pinch zoom, tap raycasting
│   │   ├── ModelLoader.js     # GLTF/GLB loader + normalisasi skala
│   │   └── Lighting.js        # Setup lampu ambient + directional
│   ├── data/
│   │   └── celestialData.js   # ⭐ Data planet: ID, nama, ukuran, path model, relasi orbital
│   ├── ui/
│   │   └── uiState.js         # Alpine store: state HUD, orbital flags, tracking status
│   └── styles/
│       ├── main.css
│       ├── glassmorphism.css
│       └── hud.css            # Semua komponen HUD overlay + badge orbital
├── public/
│   ├── models/solar_system/   # File .glb 3D (earth.glb, mars.glb, moon.glb, sun.glb)
│   ├── targets/raw_images/    # Gambar kartu flashcard untuk image target XR8
│   └── xr/xr.js              # Binary 8th Wall XR8 engine (lokal)
└── docs/
    └── IMPLEMENTATION_LOG.md  # Log riwayat implementasi fitur
```

---

## Arsitektur Inti

### Two-Tier Node Hierarchy (Per Planet)

```
Scene (Three.js world space)
└── AnchorGroup           ← dikontrol oleh CoordinateLock (pose marker / SLAM matrix)
    └── VisualGroup       ← dikontrol oleh GestureManager (drag rotate, pinch zoom)
        └── planetModel   ← GLB model 3D (auto-spin axial setiap frame)
```

### State Machine AR (ARSTATES)

```
SURFACE_SCAN → SURFACE_CONFIRM → MARKER_SCAN → MARKER_TRACKING → SLAM_COLLECTING → SLAM_LOCKED
                                                      ↑                                   ↓
                                                      └───────── Unlock Coordinate ────────
```

### Multi-Target Registry (`this.targets`)

`AppBootstrapper.targets` adalah `Map<string, TargetNode>` dengan struktur:
```js
{
  id: "earth",          // string ID
  celestial: {...},     // data dari celestialData.js
  anchorGroup,          // THREE.Group — world space anchor
  visualGroup,          // THREE.Group — gesture target
  coordinateLock,       // CoordinateLock instance
  planetModel,          // THREE.Object3D (GLB)
  isVisible: boolean,
}
```

---

## Fitur-Fitur Penting

### 1. CoordinateLock & SLAM
- **Mode Marker**: Pose mengikuti kartu fisik secara real-time dengan filter adaptif (Deadband + EMA + Quaternion SLERP)
- **SLAM Collection**: Setelah "Lock Coordinate" ditekan, mengumpulkan 60 frame pose data dengan weighted averaging
- **SLAM Lock**: `matrixAutoUpdate = false` → objek beku di world space, tidak bergeser walau marker hilang
- Kelas: [`src/ar/CoordinateLock.js`](src/ar/CoordinateLock.js)

### 2. Animasi Orbital (Earth–Moon) ✨
Fitur utama: ketika kartu **Earth** dan **Moon** keduanya terdeteksi dan dikunci bersama, Bulan akan berputar mengelilingi Bumi di world space AR.

**Cara kerja:**
1. Setelah `toggleCoordinateLock()` → semua target di-SLAM-lock → `_checkAndActivateOrbitals()` dipanggil
2. Sistem cek `celestial.orbitTarget` pada setiap target yang terkunci
3. Jika `moon.orbitTarget === "earth"` dan `earth` juga terkunci → `OrbitalAnimator.addRelation(...)` dipanggil
4. Setiap frame: `moon.anchorGroup.position = earth.worldPosition + polarOffset(angle, radius, tilt)`
5. Sudut bertambah `orbitSpeed * dt` per frame
6. Badge "🌕 Orbit Aktif" muncul di HUD

**Konfigurasi orbital** ada di [`src/data/celestialData.js`](src/data/celestialData.js):
```js
moon: {
  orbitTarget: "earth",   // ID planet induk
  orbitRadius: 0.45,      // meter di AR world space
  orbitSpeed:  0.6,       // rad/s
  orbitTilt:   0.09,      // inklinasi orbit (~5.1°)
}
```

**Untuk menambah relasi orbital baru** (mis. Phobos→Mars): cukup tambah field `orbitTarget`, `orbitRadius`, `orbitSpeed`, `orbitTilt` pada data celestial baru, sistem otomatis mendeteksinya — **fully data-driven**.

### 3. GestureManager
- **1 jari drag**: Rotasi VisualGroup di sumbu Y dan X dengan inersia damping (`DAMPING = 0.92`)
- **2 jari pinch**: Scale VisualGroup antara `MIN_SCALE = 0.35` dan `MAX_SCALE = 3.0`
- **Tap (< 280ms, < 12px)**: Raycasting ke interactiveObjectsProvider → buka info modal
- Kelas: [`src/core/GestureManager.js`](src/core/GestureManager.js)

### 4. EighthWallManager
- Menginisialisasi XR8 pipeline
- Mendaftarkan image target dari `AR_IMAGE_TARGETS` array
- Mendeteksi sapuan 4 arah (kiri, kanan, depan, bawah) untuk validasi permukaan SLAM
- Kelas: [`src/ar/EighthWallManager.js`](src/ar/EighthWallManager.js)

---

## Data Planet (`celestialData.js`)

Setiap entry memiliki field wajib:

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string | Harus sesuai dengan nama di `AR_IMAGE_TARGETS` (main.js) |
| `name` | string | Nama tampil di HUD |
| `category` | string | Tampil di modal info |
| `modelPath` | string | Path ke file .glb (`./models/solar_system/*.glb`) |
| `displaySize` | number | Ukuran normalisasi model (unit relatif) |
| `defaultRotation` | `[rx, ry, rz]` | Euler awal model dalam radian |
| `description` | string | Deskripsi di modal |
| `doi` | string | Referensi ilmiah |

Field opsional untuk relasi orbital:
| Field | Tipe | Keterangan |
|---|---|---|
| `orbitTarget` | string | ID planet induk (jika benda ini satelit) |
| `orbitRadius` | number | Jarak orbit dalam meter (AR world space) |
| `orbitSpeed` | number | Kecepatan angular (rad/s) |
| `orbitTilt` | number | Inklinasi orbit (radian) |

---

## UI (Alpine.js Store `arApp`)

State HUD dikelola oleh Alpine store di [`src/ui/uiState.js`](src/ui/uiState.js).

Key state yang sering digunakan:
```js
trackingState        // string ARSTATES value
trackingStatusText   // teks badge header
isSlamLocked         // boolean
hasOrbitalAnimation  // boolean — true jika animasi orbital aktif
orbitalCount         // number — jumlah relasi orbital aktif
selectedCelestial    // object celestialData atau null
showDetail           // boolean — toggle info modal
```

Semua setter tersedia sebagai method: `setTrackingState()`, `setSlamLocked()`, `setOrbitalActive()`, dll.

---

## Aturan Penting Saat Melakukan Perubahan

> [!IMPORTANT]
> **Jangan ubah Two-Tier hierarchy** (AnchorGroup → VisualGroup). GestureManager dan CoordinateLock bergantung pada pemisahan ini.

> [!WARNING]
> **Setelah SLAM Lock**: `anchorGroup.matrixAutoUpdate = false`. Untuk node satelit dalam orbital mode, `OrbitalAnimator` mengaktifkan kembali `matrixAutoUpdate = true` dan memanggil `updateMatrix()` manual setiap frame. Jangan reset ini sembarangan.

> [!NOTE]
> **Menambah planet baru**: (1) Tambah entry di `celestialData.js`, (2) Tambah ke `AR_IMAGE_TARGETS` di `main.js`, (3) Sediakan model `.glb` di `public/models/solar_system/`, (4) Sediakan gambar target di `public/targets/raw_images/`

> [!NOTE]
> **Performa render loop**: `_onRender()` dipanggil 60 FPS. Hindari alokasi objek baru (`new THREE.Vector3()`, dll) di dalam loop. Gunakan object reusable seperti yang dilakukan `OrbitalAnimator`.
