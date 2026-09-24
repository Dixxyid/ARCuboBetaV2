import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Utility Pembuat & Pengelola Model 3D GLTF/GLB dengan Optimasi Memori GPU
 *
 * Optimasi v2:
 * - Cache model asli (scene root), clone hanya saat diperlukan
 * - Texture optimization: anisotropy + flipY correction
 * - Reusable Box3/Vector3 untuk normalizeScale (no GC spike)
 * - disposeModel yang menyeluruh mencakup texture & environment maps
 */
export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();

    /** @type {Map<string, THREE.Group>} path → model asli (JANGAN dimodifikasi) */
    this.cache = new Map();

    /** @type {Map<string, Promise<THREE.Group>>} path → promise in-flight */
    this._pending = new Map();

    // Reusable temporaries — tidak dialokasikan ulang setiap normalizeScale()
    this._box    = new THREE.Box3();
    this._size   = new THREE.Vector3();
    this._center = new THREE.Vector3();

    // Anisotropy maksimum renderer (diset setelah renderer tersedia)
    this._maxAnisotropy = 1;
  }

  /**
   * Set anisotropy dari renderer — panggil sekali setelah renderer siap.
   * @param {THREE.WebGLRenderer} renderer
   */
  setRenderer(renderer) {
    this._maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  }

  /**
   * Memuat model GLB/GLTF dengan deduplication request in-flight.
   * Jika path yang sama diminta dua kali secara bersamaan, hanya satu
   * network request yang dibuat — yang kedua menunggu yang pertama selesai.
   *
   * @param {string} path
   * @returns {Promise<THREE.Group>}
   */
  async loadModel(path) {
    // Cache hit — return clone dari model yang sudah tersimpan
    if (this.cache.has(path)) {
      return this._cloneAndOptimize(this.cache.get(path));
    }

    // In-flight deduplication — cegah dua fetch untuk path yang sama
    if (this._pending.has(path)) {
      const original = await this._pending.get(path);
      return this._cloneAndOptimize(original);
    }

    // Buat request baru
    const loadPromise = new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          // Optimasi texture di model asli sebelum cache
          this._optimizeTextures(model);
          this.cache.set(path, model);
          this._pending.delete(path);
          resolve(model);
        },
        undefined,
        (error) => {
          this._pending.delete(path);
          console.error(`[ModelLoader] Gagal memuat model 3D dari path: ${path}`, error);
          reject(error);
        }
      );
    });

    this._pending.set(path, loadPromise);
    const original = await loadPromise;
    return this._cloneAndOptimize(original);
  }

  /**
   * Clone model dan terapkan optimasi material.
   * @param {THREE.Group} original
   * @returns {THREE.Group}
   */
  _cloneAndOptimize(original) {
    const clone = original.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Hindari side=DoubleSide secara default karena costly pada mobile GPU.
        // Hanya aktifkan jika backface benar-benar terlihat.
        child.material.side = THREE.FrontSide;
        child.material.needsUpdate = true;
      }
    });
    return clone;
  }

  /**
   * Optimasi semua texture dalam model: set anisotropy & pastikan mipmaps aktif.
   * @param {THREE.Object3D} model
   */
  _optimizeTextures(model) {
    const anisotropy = this._maxAnisotropy;
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && val.isTexture) {
            val.anisotropy  = anisotropy;
            val.generateMipmaps = true;
            val.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Menormalisasi ukuran model apapun (kecil/besar/tidak diketahui) supaya
   * dimensi terbesarnya (bounding box) selalu sama dengan targetSize.
   *
   * Menggunakan reusable Box3/Vector3 — tidak ada GC allocation di sini.
   *
   * @param {THREE.Object3D} model
   * @param {number} targetSize - ukuran akhir yang diinginkan
   * @returns {THREE.Object3D} model yang sama (sudah di-scale in-place)
   */
  normalizeScale(model, targetSize = 0.15) {
    // 1. Reset scale dulu ke 1 supaya pengukuran bounding box akurat
    model.scale.set(1, 1, 1);

    // 2. Hitung bounding box asli model (reusable)
    this._box.setFromObject(model);
    this._box.getSize(this._size);

    // 3. Ambil dimensi terbesar sebagai acuan
    const maxDimension = Math.max(this._size.x, this._size.y, this._size.z);

    if (maxDimension === 0 || !isFinite(maxDimension)) {
      console.warn('[ModelLoader] Bounding box model tidak valid, skip normalisasi scale.');
      return model;
    }

    // 4. Scale agar maxDimension = targetSize
    const scaleFactor = targetSize / maxDimension;
    model.scale.setScalar(scaleFactor);

    // 5. Pusatkan model (reusable box setelah scale)
    model.updateMatrixWorld(true);
    this._box.setFromObject(model);
    this._box.getCenter(this._center);
    
    // Geser agar titik tengah model tepat di origin (0,0,0)
    model.position.x -= this._center.x;
    model.position.y -= this._center.y;
    model.position.z -= this._center.z;

    return model;
  }

  /**
   * Pembersihan Memori GPU untuk cegah Memory Leak.
   * Menyeluruh: geometry + material + semua texture map + env map.
   * @param {THREE.Object3D} object
   */
  disposeModel(object) {
    if (!object) return;

    object.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          this._disposeMaterial(mat);
        }
      }
    });

    object.parent?.remove(object);
  }

  _disposeMaterial(material) {
    if (!material) return;

    // Dispose semua texture property yang ada
    const textureProps = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
      'envMap', 'alphaMap', 'aoMap', 'emissiveMap', 'displacementMap',
      'roughnessMap', 'metalnessMap', 'gradientMap', 'matcap',
      'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
      'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
    ];

    for (const prop of textureProps) {
      if (material[prop]?.isTexture) {
        material[prop].dispose();
      }
    }
    material.dispose();
  }
}
