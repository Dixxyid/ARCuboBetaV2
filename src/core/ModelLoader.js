import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Utility Pembuat & Pengelola Model 3D GLTF/GLB dengan Optimasi Memori GPU
 */
export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  /**
   * Memuat model GLB/GLTF
   * @param {string} path 
   * @returns {Promise<THREE.Group>}
   */
  async loadModel(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path).clone();
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          this.cache.set(path, model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.error(`Gagal memuat model 3D dari path: ${path}`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Menormalisasi ukuran model apapun (kecil/besar/tidak diketahui) supaya
   * dimensi terbesarnya (bounding box) selalu sama dengan targetSize.
   * Jadi tidak perlu tebak-tebak angka scale manual per model.
   *
   * @param {THREE.Object3D} model
   * @param {number} targetSize - ukuran akhir yang diinginkan (unit dunia MindAR, ~0.1-0.3 biasanya pas di atas marker)
   * @returns {THREE.Object3D} model yang sama (sudah di-scale in-place)
   */
  normalizeScale(model, targetSize = 0.15) {
    // 1. Reset scale dulu ke 1 supaya pengukuran bounding box akurat
    model.scale.set(1, 1, 1);

    // 2. Hitung bounding box asli model
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    // 3. Ambil dimensi terbesar (x/y/z) sebagai acuan, biar proporsi tetap terjaga
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (maxDimension === 0 || !isFinite(maxDimension)) {
      console.warn('[ModelLoader] Bounding box model tidak valid, skip normalisasi scale.');
      return model;
    }

    // 4. Hitung faktor scale supaya maxDimension jadi persis targetSize
    const scaleFactor = targetSize / maxDimension;
    model.scale.setScalar(scaleFactor);

    // 5. Pusatkan model & taruh alasnya di y=0, supaya tidak "melayang"/offset dari anchor
    const centeredBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    centeredBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= centeredBox.min.y;

    console.log(`[ModelLoader] Auto-scale diterapkan. Dimensi asli maks: ${maxDimension.toFixed(3)}, scaleFactor: ${scaleFactor.toFixed(6)}, hasil akhir: ${targetSize}`);

    return model;
  }

  /**
   * Pembersihan Memori GPU untuk cegah Memory Leak
   * @param {THREE.Object3D} object 
   */
  disposeModel(object) {
    if (!object) return;

    object.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => this._disposeMaterial(mat));
          } else {
            this._disposeMaterial(child.material);
          }
        }
      }
    });

    if (object.parent) {
      object.parent.remove(object);
    }
  }

  _disposeMaterial(material) {
    Object.keys(material).forEach((prop) => {
      if (material[prop] && typeof material[prop].dispose === 'function') {
        material[prop].dispose();
      }
    });
    material.dispose();
  }
}
