# ARCuboBetaV2
Beta version


ar-flashcard-project/
├── public/                     # ASET STATIS (Bypass Vite Bundler)
│   ├── alva/
│   │   └── alva_ar.wasm        # Binary WebAssembly AlvaAR
│   ├── models/
│   │   ├── solar_system/       # Objek 3D planet (.glb)
│   │   │   ├── earth.glb
│   │   │   └── mars.glb
│   │   └── placeholders/
│   ├── targets/
│   │   └── flashcards.mind     # Binary target gambar MindAR
│   └── materials/
│       └── pp_dev.webp         # Foto profil pengembang
│
├── src/
│   ├── ar/                     # LOGIKA AR & MATRIKS
│   │   ├── MindARManager.js    # Pengelola lifecycle & event MindAR
│   │   ├── AlvaARManager.js    # Pengelola lifecycle & WASM AlvaAR
│   │   ├── HandoverManager.js  # Logika serah terima Local -> World Matrix
│   │   └── ARState.js          # Finite State Machine (SEARCHING, TRACKED, SLAM)
│   ├── core/                   # ENGINE THREE.JS
│   │   ├── Scene.js            # Instansiasi Scene, Camera, & WebGLRenderer
│   │   ├── Lighting.js         # Pencahayaan PBR (Ambient & Directional)
│   │   └── ModelLoader.js      # Utility GLTFLoader & Manajemen Memori GPU
│   ├── data/                   # DATASET ILMIAH
│   │   └── celestialData.js    # Object JSON data astrofisika & rujukan DOI
│   ├── ui/                     # INTERNET & ALPINE.JS
│   │   └── uiState.js          # Inisialisasi Alpine.js store & data handler
│   ├── styles/                 # CSS MODULAR
│   │   ├── main.css            # Setup layout & canvas 100vw/100vh
│   │   ├── glassmorphism.css   # Effect backdrop-filter & aksen neon
│   │   └── hud.css             # Modal & overlay positioning
│   └── main.js                 # BOOTSTRAPPER (Entry point utama)
│── .gitignore
├── index.html                  # Container HTML5 & Lapisan DOM Alpine.js
├── package.json                # Dependencies (three, mind-ar, alpinejs, vite)
├── vite.config.js              # Konfigurasi build Vite
└── README.md                   # Dokumentasi proyek


documentasi proyek beta version.
last update --- 28-08-2026

