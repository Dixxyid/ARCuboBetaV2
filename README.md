# 🌌 ARCuboBetaV2 (WebAR Spatial Flashcard)

![Version](https://img.shields.io/badge/version-v2.0.0--beta-00f3ff?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active--Development-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-Academic-orange?style=for-the-badge)

> **Dokumentasi Proyek WebAR Spatial Flashcard & Extended Tracking System**  
> *Pembaruan Terakhir: 28 Agustus 2026*

---

## 🚀 Tech Stack

![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white)
![Alpine.js](https://img.shields.io/badge/Alpine.js-8BC0D0?style=flat-square&logo=alpine.js&logoColor=black)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=flat-square&logo=webassembly&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)

---

## 📌 Ringkasan Sistem

> [!NOTE]
> **ARCuboBetaV2** adalah platform edukasi WebAR *zero-install* berbasis browser seluler. Fitur utamanya adalah **Extended Tracking (Matrix Handover)** yang memindahkan koordinat objek 3D secara transparan dari kartu fisik (*MindAR*) ke permukaan dunia nyata (*AlvaAR Visual SLAM*).

---

## 📂 Pohon Direktori Proyek

```text
ar-flashcard-project/
├── 📂 public/                     # 🟡 ASET STATIS (Bypass Vite Bundler)
│   ├── 📁 alva/
│   │   └── 📄 alva_ar.wasm        # ⚙️ Binary WebAssembly AlvaAR SLAM
│   ├── 📁 models/
│   │   ├── 📁 solar_system/       # 🪐 Objek 3D planet (.glb)
│   │   │   ├── 📄 earth.glb
│   │   │   └── 📄 mars.glb
│   │   └── 📁 placeholders/
│   ├── 📁 targets/
│   │   └── 📄 flashcards.mind     # 🎯 Target kompilasi gambar MindAR
│   └── 📁 materials/
│       └── 📄 pp_dev.webp         # 👤 Foto profil pengembang
│
├── 📂 src/                        # 🟢 KODE SUMBER UTAMA
│   ├── 📁 ar/                     # 🧮 LOGIKA AR & MATRIKS SPASIAL
│   │   ├── 📄 MindARManager.js    # Pengelola lifecycle & event MindAR
│   │   ├── 📄 AlvaARManager.js    # Pengelola lifecycle & WASM AlvaAR
│   │   ├── 📄 HandoverManager.js  # 🔥 Logika serah terima Local -> World Matrix
│   │   └── 📄 ARState.js          # Finite State Machine (SEARCHING, TRACKED, SLAM)
│   ├── 📁 core/                   # 🎮 ENGINE THREE.JS & RENDERING
│   │   ├── 📄 Scene.js            # Instansiasi Scene, Camera, & WebGLRenderer
│   │   ├── 📄 Lighting.js         # Pencahayaan PBR (Ambient & Directional)
│   │   └── 📄 ModelLoader.js      # Utility GLTFLoader & Manajemen Memori GPU
│   ├── 📁 data/                   # 📚 DATASET ILMIAH & LITERATUR
│   │   └── 📄 celestialData.js    # Dataset JSON astrofisika & rujukan DOI
│   ├── 📁 ui/                     # 🖥️ ANTARMUKA REAKTF (ALPINE.JS)
│   │   └── 📄 uiState.js          # Inisialisasi Alpine.js store & data handler
│   ├── 📁 styles/                 # 🎨 CSS MODULAR & GLASSMORPHISM
│   │   ├── 📄 main.css            # Setup layout & canvas 100vw/100vh
│   │   ├── 📄 glassmorphism.css   # Effect backdrop-filter & aksen neon
│   │   └── 📄 hud.css             # Modal & overlay positioning
│   └── 📄 main.js                 # ⚡ BOOTSTRAPPER (Entry point utama)
│
├── 📄 .gitignore                  # File/Folder yang diabaikan oleh Git
├── 📄 index.html                  # Container HTML5 & Lapisan DOM Alpine.js
├── 📄 package.json                # Dependensi proyek (Three.js, MindAR, Alpine.js)
├── 📄 vite.config.js              # Konfigurasi bundler Vite
└── 📄 README.md                   # Dokumentasi resmi proyek

## 🏗️ Catatan Arsitektur[!TIP]Separation of Concerns:Struktur direktori di atas dirancang dengan prinsip modularitas tinggi. Logika Augmented Reality, rendering Three.js, dan antarmuka UI dipisahkan secara tegas agar kode mudah dipelihara, diuji, dan di-debug.  Manajemen Aset Statis:Sangat disarankan untuk tidak mengubah letak file di dalam folder public/. Aset komputasi berat seperti biner .wasm (AlvaAR) dan model 3D .glb dikonfigurasi untuk melakukan pembacaan langsung (direct fetch / bypass bundler). Hal ini krusial demi menjaga stabilitas frame rate (FPS) dan mencegah masalah manajemen memori (memory leaks) pada perangkat peramban seluler.
## 🎨 UI/UX DesignTema Visual: Futuristic Space & Glassmorphism[cite: 3]Gaya Antarmuka:Glassmorphism: Efek transparan berlapis dengan batas halus untuk tampilan modern.Translucency (Kaca Buram): Efek blur latar belakang agar teks UI tetap jelas di atas kamera seluler[cite: 3].Flat Design: Desain elemen tombol dan ikon yang bersih, simpel, dan responsif.Palet Warna:Ungu (#8A2BE2): Warna utama antarmuka berkesan futuristik dan nuansa antariksa.Biru (#00D2FF): Warna aksen interaktif, status koneksi, dan pemindaian AR.Kuning (#FFD700): Warna sorotan untuk tombol aksi utama dan informasi penting.Putih (#FFFFFF): Warna utama teks untuk keterbacaan tingkat tinggi di latar belakang dinamis.Tipografi (3 Font Kombinasi):Inter: Font UI utama untuk navigasi dan deskripsi singkat.Roboto: Font teknis untuk penulisan angka, data numerik, dan parameter AR.Montserrat: Font tegas untuk judul (heading) dan penamaan komponen.Flashcard Fisik:Kontras Tinggi (High-Feature Points)[cite: 3]Rasio Standar[cite: 3]

(copyright arcubo 2026)
