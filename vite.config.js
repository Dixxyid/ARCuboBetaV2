import { defineConfig } from 'vite';

export default defineConfig({
  // Gunakan relative path agar kompatibel di Netlify dan subpath GitHub Pages
  base: './',
  // Struktur proyek: index.html di root, output ke dist/
  root: '.',
  publicDir: 'public',

  server: {
    port: 5173,
    // Header wajib untuk WASM + SharedArrayBuffer (8th Wall engine)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Izinkan akses dari perangkat lain di jaringan yang sama (untuk test di HP)
    host: true,
    https: false,
  },

  build: {
    outDir: 'dist',
    // Batasan warning ukuran file dinaikkan (model 3D & WASM bisa besar)
    chunkSizeWarningLimit: 8000,
  },

  optimizeDeps: {
    // Exclude file WASM & Worker dari pre-bundling Vite
    exclude: [],
  },

  // Pastikan file .wasm dan 3D models dibundle dengan benar
  assetsInclude: ['**/*.wasm', '**/*.glb', '**/*.gltf'],
});
