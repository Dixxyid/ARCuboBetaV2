import * as THREE from 'three';

/**
 * Manajer Pencahayaan PBR (Physically Based Rendering)
 */
export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.initLights();
  }

  initLights() {
    // Ambient Light untuk pencahayaan dasar lingkungan
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    
    // Directional Light Mensimulasikan Cahaya Matahari
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunLight.position.set(5, 10, 7);
    
    // Secondary Fill Light untuk sisi gelap objek
    this.fillLight = new THREE.DirectionalLight(0x00f0ff, 0.5);
    this.fillLight.position.set(-5, -2, -5);

    this.scene.add(this.ambientLight);
    this.scene.add(this.sunLight);
    this.scene.add(this.fillLight);
  }
}
