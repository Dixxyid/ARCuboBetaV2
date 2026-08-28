import * as THREE from 'three';

/**
 * Manajer Utama Three.js Canvas, Camera, dan WebGLRenderer
 */
export class SceneManager {
  constructor(containerId = 'canvas-container') {
    this.container = document.getElementById(containerId);
    
    // Inisialisasi Tiga Komponen Utama
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60, 
      window.innerWidth / window.innerHeight, 
      0.01, 
      1000
    );
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance" 
    });

    this._setupRenderer();
    this._handleResize();
  }

  _setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Masukkan canvas ke dalam DOM container
    this.container.appendChild(this.renderer.domElement);
  }

  _handleResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
