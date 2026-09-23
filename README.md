# 🌌 ARCuboBetaV3 (WebAR Spatial Flashcard)

![Version](https://img.shields.io/badge/version-v3.0.0--beta-00f3ff?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active--Development-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-Academic-orange?style=for-the-badge)

> **Platform Edukasi WebAR Astronomi Berbasis Kartu Fisik & Extended SLAM Tracking**  
> Menggunakan **8th Wall Engine murni (SLAM World Tracking + Image Targets)** terintegrasi dengan **Three.js** dan **Alpine.js**.

> 🤖 **Untuk AI Coding Assistant**: Baca [`AGENTS.md`](./AGENTS.md) terlebih dahulu sebelum membuat perubahan. Log implementasi ada di [`docs/IMPLEMENTATION_LOG.md`](./docs/IMPLEMENTATION_LOG.md).

---

## 🚀 Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white)
![8th Wall](https://img.shields.io/badge/8th%20Wall-XR8%20Engine-FF4081?style=flat-square)
![Alpine.js](https://img.shields.io/badge/Alpine.js-8BC0D0?style=flat-square&logo=alpine.js&logoColor=black)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=flat-square&logo=webassembly&logoColor=white)

---

## ✨ Fitur Utama

1. **Zero-Install WebAR**: Berjalan langsung di peramban web seluler (Chrome Android, Safari iOS) tanpa perlu mengunduh aplikasi tambahan dari Play Store / App Store.
2. **Unified Spatial Coordinate System**: Pelacakan kartu fisik (*Image Targets*) dan pelacakan ruangan (*Visual SLAM*) berbagi satu sistem koordinat spasial 3D yang sama dari 8th Wall XR8.
3. **Multi-Target Simultaneous Tracking**: Beberapa kartu planet dapat terdeteksi dan ditampilkan secara bersamaan dalam satu sesi AR.
4. **Orbital Animation (Earth–Moon)**: Ketika kartu **Bumi** dan **Bulan** keduanya dikunci bersama via Lock Coordinate, Bulan akan berputar mengelilingi Bumi secara real-time di AR world space.
5. **Automatic Coordinate Lock**: Ketika kartu dikenali, posisi spasialnya otomatis terkunci di dunia nyata.
6. **Seamless Markerless Handover**: Jika kartu tersembunyi atau hilang dari bidikan kamera, model planet 3D tetap mengambang di lokasi kartu sebelumnya di ruangan Anda (*World Tracking*).
7. **Drift & Drift Recovery**: Sistem memvalidasi jarak pose terhadap kamera; jika terjadi pergeseran posisi abnormal, sistem memberikan notifikasi cerdas untuk memindai ulang permukaan.
8. **Smooth Planet Self-Rotation**: Objek planet berputar halus pada porosnya secara kontinu untuk visualisasi astronomi yang dinamis.
7. **Futuristic Glassmorphism HUD**: Tampilan antarmuka transparan dengan animasi laser scanner, indikator status neon, modal data astronomi, dan tautan rujukan ilmiah (DOI resmi).

---

## 🔄 Alur Finite State Machine (FSM)

```text
WORLD_SCAN (8th Wall memetakan permukaan lantai/meja dunia nyata)
    ↓ (Permukaan stabil terdeteksi)
MARKER_SCAN (8th Wall mencari kartu flashcard planet)
    ↓ (Kartu terdeteksi)
COORDINATE_LOCKED (Koordinat kartu dikunci di ruang 3D, tombol status menjadi "Terkunci ✓")
    ↓ (Kartu tertutup / keluar dari bidikan kamera)
VALIDATING (Validasi toleransi jarak kamera terhadap posisi objek)
    ├── Drift / Data tidak valid → WORLD_SCAN (Scan ulang permukaan + notifikasi peringatan)
    └── Kartu benar-benar hilang → WORLD_TRACKING (Model 3D tetap mengambang di ruang nyata)
```

---

## 🎴 Target Kartu Flashcard

| Objek | File Target Gambar | Model 3D | Dimensi Target |
|---|---|---|---|
| **Bumi (Earth)** | `public/targets/raw_images/earth_card.png` | `public/models/solar_system/earth.glb` | 638 × 1016 px (Vertikal) |
| **Mars** | `public/targets/raw_images/mars_card.png` | `public/models/solar_system/mars.glb` | 638 × 1016 px (Vertikal) |
| **Bulan (Moon)** | `public/targets/raw_images/moon_card.png` | `public/models/solar_system/moon.glb` | 638 × 1016 px (Vertikal) |

---

## 📂 Pohon Direktori Proyek

```text
ARCuboBetaV2/
├── 📂 public/                     # 🟡 ASET STATIS & BINER ENGINE
│   ├── 📁 xr/                     # ⚙️ Biner lokal 8th Wall (xr.js, xr-slam.js, xr-tracking.js)
│   ├── 📁 models/                 # 🪐 Objek 3D planet (.glb)
│   │   └── 📁 solar_system/       # earth.glb, mars.glb, moon.glb
│   ├── 📁 targets/                # 🎯 Gambar target flashcard
│   │   └── 📂 raw_images/         # earth_card.png, mars_card.png, moon_card.png
│   ├── 📁 materials/              # Aset tekstur & foto profil pengembang
│   └── 📄 _headers                # Konfigurasi COOP/COEP/CORS untuk Netlify
│
├── 📂 src/                        # 🟢 KODE SUMBER UTAMA
│   ├── 📁 ar/                     # 🧮 LOGIKA AR & MATRIKS SPASIAL
│   │   ├── 📄 ARState.js          # Finite State Machine (5 state AR)
│   │   ├── 📄 CoordinateLock.js   # Penyimpanan pose & validasi drift koordinat dunia
│   │   └── 📄 EighthWallManager.js# Pipeline 8th Wall (GlTexture, Threejs, XrController)
│   ├── 📁 core/                   # 🎮 RENDERING & PBR LIGHTING
│   │   ├── 📄 Lighting.js         # Pencahayaan Three.js (Ambient, Sun, & Fill Light)
│   │   └── 📄 ModelLoader.js      # Loader GLTF, auto-scaling & manajemen memori GPU
│   ├── 📁 data/                   # 📚 DATASET ILMIAH & LITERATUR
│   │   └── 📄 celestialData.js    # Data astrofisika planet & referensi DOI resmi
│   ├── 📁 ui/                     # 🖥️ ANTARMUKA REAKTIF (ALPINE.JS)
│   │   └── 📄 uiState.js          # Store Alpine.js untuk status HUD & interaksi modal
│   ├── 📁 styles/                 # 🎨 CSS MODULAR & GLASSMORPHISM
│   │   ├── 📄 main.css            # Setup layout & tokens warna status AR
│   │   ├── 📄 glassmorphism.css   # Efek backdrop blur & aksen neon
│   │   └── 📄 hud.css             # HUD overlay, scanner laser line, badge lock
│   └── 📄 main.js                 # ⚡ BOOTSTRAPPER (Entry point & rotasi per-frame)
│
├── 📂 .github/workflows/          # 🤖 CI/CD Otomatis
│   └── 📄 deploy.yml              # Auto-deploy ke GitHub Pages saat push
├── 📄 netlify.toml                # Konfigurasi build & header untuk Netlify
├── 📄 vite.config.js              # Konfigurasi bundler Vite (base: './')
├── 📄 index.html                  # Container HTML5, preload XR8, & HUD Alpine
└── 📄 package.json                # Dependensi proyek
```

---

## 🛠️ Menjalankan di Lingkungan Lokal (Pengembangan)

```bash
# 1. Install seluruh dependensi
npm install

# 2. Jalankan development server
npm run dev

# 3. Akses dari HP (koneksikan laptop dan HP ke Wi-Fi yang sama):
# Buka URL Network yang tertera di terminal, contoh: http://192.168.x.x:5173
```

---

## 🚀 Panduan Deployment ke Internet

### Opsi 1: Netlify (Sangat Direkomendasikan)
1. Hubungkan repositori GitHub Anda ke Netlify.
2. Netlify akan otomatis membaca konfigurasi dari file [`netlify.toml`](file:///e:/Github/ARCuboBetaV2/netlify.toml).
3. Klik tombol **Deploy Site**. Aplikasi WebAR Anda langsung aktif dengan HTTPS dan dukungan WebAssembly penuh.

### Opsi 2: GitHub Pages (Otomatis via GitHub Actions)
1. Pastikan Anda telah melakukan *push* kode ke GitHub:
   ```bash
   git add .
   git commit -m "feat: complete pure 8th wall webar system"
   git push origin main
   ```
2. Buka repositori Anda di web GitHub > **Settings** > **Pages**.
3. Pada menu **Build and deployment > Source**, pilih **GitHub Actions**.
4. Workflow [`.github/workflows/deploy.yml`](file:///e:/Github/ARCuboBetaV2/.github/workflows/deploy.yml) akan otomatis meng-compile dan mempublikasikan situs Anda dalam 1–2 menit.

---

## 📖 Cara Penggunaan di Perangkat

1. **Izinkan Akses Kamera**: Buka URL aplikasi di peramban seluler dan berikan izin akses kamera.
2. **Scan Permukaan Ruangan**: Arahkan dan gerakkan kamera perlahan ke meja atau lantai hingga panduan laser scanner beralih ke mode pencarian kartu (*Cari Flashcard*).
3. **Arahkan ke Kartu Flashcard**: Sorot kartu Bumi atau Mars. Model 3D planet akan langsung muncul di atas kartu disertai animasi rotasi poros.
4. **Kunci Koordinat**: Posisi telah otomatis terkunci (*Terkunci ✓*). Anda juga dapat menekan tombol **Lock Coordinate** kapan saja untuk mengonfirmasi posisi.
5. **Eksplorasi Dunia Nyata**: Geser atau sembunyikan kartu fisiknya; planet akan tetap mengambang stabil di udara pada koordinat ruangan Anda.
6. **Buka Data Astronomi**: Tekan tombol **Data Astronomi** untuk membaca spesifikasi ilmiah planet (massa, radius, jarak, suhu) serta tautan langsung ke publikasi jurnal bereputasi (DOI).

---

<p align="center">
  &copy; 2026 Arcubo. All Rights Reserved.
</p>
