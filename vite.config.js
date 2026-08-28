import { defineConfig } from 'vite';

export default defineConfig({
  // Sesuaikan nilai base dengan nama repository GitHub Anda.
  // Contoh: jika URL repository Anda adalah https://username.github.io/ar-flashcard-project/
  // maka diisi dengan '/ar-flashcard-project/'
  base: '/ARCuboBetaV2/',

  publicDir: 'public',

  server: {
    host: true,
    port: 3000,
    open: true
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Memastikan file biner seperti WASM & GLB diatasi dengan benar
    assetsInlineLimit: 0
  },

  // Mendukung pengiriman jenis MIME yang tepat saat mode dev
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.mind', '**/*.wasm']
});
