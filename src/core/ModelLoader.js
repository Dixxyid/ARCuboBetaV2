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
