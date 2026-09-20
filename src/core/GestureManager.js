import * as THREE from 'three';

/**
 * GestureManager
 * 
 * Mengelola interaksi sentuhan pada model 3D (visualGroup) tanpa mengganggu anchor dunia fisik:
 * 1. Drag 1 Jari (Orbit Drag): Memutar model di sumbu Y dan X dengan inersia damping.
 * 2. Pinch 2 Jari (Pinch to Zoom): Memperbesar & memperkecil skala model secara dinamis.
 * 3. Tap Sentuh (Raycasting): Mendeteksi ketukan pada objek 3D untuk membuka modal informasi.
 */
export class GestureManager {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {THREE.Camera} options.camera
   * @param {Function} [options.onTap]
   */
  constructor({ canvas, camera, onTap = null }) {
    this.canvas = canvas;
    this.camera = camera;
    this.onTap  = onTap;

    this.targetObject = null; // VisualModelGroup (Two-Tier Hierarchy)
    this.raycaster    = new THREE.Raycaster();
    this.mouseVec     = new THREE.Vector2();

    // ── Status Drag ──
    this.isDragging    = false;
    this.lastPointerX  = 0;
    this.lastPointerY  = 0;
    this.velocityX     = 0;
    this.velocityY     = 0;
    this.ROTATION_SPEED = 0.006;
    this.DAMPING        = 0.92;

    // ── Status Pinch ──
    this.isPinching     = false;
    this.initialPinchDist = 0;
    this.initialScale   = 1.0;
    this.currentScale   = 1.0;
    this.MIN_SCALE      = 0.35;
    this.MAX_SCALE      = 3.0;

    // ── Status Tap ──
    this.touchStartTime = 0;
    this.touchStartX    = 0;
    this.touchStartY    = 0;

    // Active touch pointers
    this.activeTouches = new Map();

    this._bindEvents();
  }

  setTarget(object3D) {
    this.targetObject = object3D;
    if (object3D) {
      this.currentScale = object3D.scale.x || 1.0;
    }
  }

  // ─── Event Binding ──────────────────────────────────────────────────────────

  _bindEvents() {
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp   = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);

    this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { passive: false });
    window.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
  }

  _handlePointerDown(e) {
    // Jangan tangkap sentuhan jika berada di atas elemen HUD/Modal UI
    if (e.target && e.target !== this.canvas) return;

    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activeTouches.size === 1) {
      // Mulai drag 1 jari / tap tracking
      this.isDragging       = true;
      this.isPinching       = false;
      this.lastPointerX     = e.clientX;
      this.lastPointerY     = e.clientY;
      this.touchStartX      = e.clientX;
      this.touchStartY      = e.clientY;
      this.touchStartTime   = performance.now();
      this.velocityX        = 0;
      this.velocityY        = 0;
    } else if (this.activeTouches.size === 2) {
      // Beralih ke mode pinch 2 jari
      this.isDragging       = false;
      this.isPinching       = true;
      this.initialPinchDist = this._getTouchDistance();
      this.initialScale     = this.currentScale;
    }
  }

  _handlePointerMove(e) {
    if (!this.activeTouches.has(e.pointerId)) return;
    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.isPinching && this.activeTouches.size >= 2) {
      // ── Pinch to Zoom ──
      const currentDist = this._getTouchDistance();
      if (this.initialPinchDist > 0 && currentDist > 0) {
        const factor = currentDist / this.initialPinchDist;
        const newScale = THREE.MathUtils.clamp(this.initialScale * factor, this.MIN_SCALE, this.MAX_SCALE);
        this.currentScale = newScale;

        if (this.targetObject) {
          this.targetObject.scale.setScalar(newScale);
        }
      }
    } else if (this.isDragging && this.activeTouches.size === 1) {
      // ── Drag to Rotate ──
      const deltaX = e.clientX - this.lastPointerX;
      const deltaY = e.clientY - this.lastPointerY;

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.velocityY = deltaX * this.ROTATION_SPEED;
      this.velocityX = deltaY * this.ROTATION_SPEED;

      if (this.targetObject) {
        this.targetObject.rotation.y += this.velocityY;
        this.targetObject.rotation.x = THREE.MathUtils.clamp(
          this.targetObject.rotation.x + this.velocityX,
          -Math.PI / 3,
          Math.PI / 3
        );
      }
    }
  }

  _handlePointerUp(e) {
    if (this.activeTouches.has(e.pointerId)) {
      // Cek apakah aksi ini adalah Tap (ketukan singkat dengan pergeseran minim)
      if (this.activeTouches.size === 1 && !this.isPinching) {
        const dt = performance.now() - this.touchStartTime;
        const dist = Math.hypot(e.clientX - this.touchStartX, e.clientY - this.touchStartY);

        if (dt < 280 && dist < 12) {
          this._checkTapRaycast(e.clientX, e.clientY);
        }
      }
      this.activeTouches.delete(e.pointerId);
    }

    if (this.activeTouches.size === 1) {
      // Masih ada 1 jari tersisa
      this.isPinching = false;
      this.isDragging = true;
      const [remaining] = this.activeTouches.values();
      this.lastPointerX = remaining.x;
      this.lastPointerY = remaining.y;
    } else if (this.activeTouches.size === 0) {
      this.isDragging = false;
      this.isPinching = false;
    }
  }

  _handlePointerCancel(e) {
    this.activeTouches.delete(e.pointerId);
    if (this.activeTouches.size === 0) {
      this.isDragging = false;
      this.isPinching = false;
    }
  }

  _getTouchDistance() {
    const points = Array.from(this.activeTouches.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  /**
   * Raycasting dari sentuhan layar ke model 3D untuk deteksi ketukan
   */
  _checkTapRaycast(clientX, clientY) {
    if (!this.camera || !this.targetObject || !this.onTap) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const intersects = this.raycaster.intersectObjects(this.targetObject.children, true);

    if (intersects.length > 0) {
      console.log('[GestureManager] Objek planet disentuh:', intersects[0].object.name || 'mesh');
      this.onTap(intersects[0]);
    }
  }

  /**
   * Update inertia rotasi di setiap frame render 60 FPS
   * @param {number} dt 
   */
  update(dt = 0.016) {
    if (!this.targetObject) return;

    // Jika pengguna sedang tidak menyentuh, redam sisa kecepatan rotasi (damping inertia)
    if (!this.isDragging) {
      if (Math.abs(this.velocityY) > 0.0001) {
        this.targetObject.rotation.y += this.velocityY;
        this.velocityY *= this.DAMPING;
      }
      if (Math.abs(this.velocityX) > 0.0001) {
        this.targetObject.rotation.x = THREE.MathUtils.clamp(
          this.targetObject.rotation.x + this.velocityX,
          -Math.PI / 3,
          Math.PI / 3
        );
        this.velocityX *= this.DAMPING;
      }
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerCancel);
    this.activeTouches.clear();
    this.targetObject = null;
  }
}
