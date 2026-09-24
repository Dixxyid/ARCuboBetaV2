import * as THREE from 'three';

/**
 * GestureManager — v2 Optimasi
 *
 * Interaksi sentuhan pada model 3D:
 * 1. Drag 1 Jari: Memutar model di sumbu Y dan X dengan inersia damping.
 * 2. Pinch 2 Jari: Memperbesar/memperkecil skala model.
 * 3. Tap: Raycasting deteksi ketukan planet untuk info modal.
 *
 * Optimasi v2:
 * - pointermove di-throttle via requestAnimationFrame — tidak proses 120Hz berlebih
 * - Reusable Vector2 & Raycaster — tidak ada new THREE.* di hot-path
 * - Guard: tidak proses event jika tidak ada targetObject dan tidak ada model visible
 * - pointerdown di canvas saja, move/up di window (sudah benar)
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

    this.targetObject = null;
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
    this.isPinching       = false;
    this.initialPinchDist = 0;
    this.initialScale     = 1.0;
    this.currentScale     = 1.0;
    this.MIN_SCALE        = 0.35;
    this.MAX_SCALE        = 3.0;

    // ── Status Tap ──
    this.touchStartTime = 0;
    this.touchStartX    = 0;
    this.touchStartY    = 0;

    // Active touch pointers
    this.activeTouches = new Map();

    // ── RAF Throttle untuk pointermove ──
    this._pendingMoveEvent = null;
    this._rafId            = null;

    // Provider daftar objek interaktif (dari AppBootstrapper)
    this.interactiveObjectsProvider = null;

    this._bindEvents();
  }

  setTarget(object3D) {
    this.targetObject = object3D;
    if (object3D) {
      this.currentScale = object3D.scale.x || 1.0;
    }
  }

  reset() {
    this.isDragging = false;
    this.isPinching = false;
    this.velocityX  = 0;
    this.velocityY  = 0;
    this.activeTouches.clear();
    this._pendingMoveEvent = null;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ─── Event Binding ──────────────────────────────────────────────────────────

  _bindEvents() {
    this._onPointerDown   = this._handlePointerDown.bind(this);
    this._onPointerMove   = this._handlePointerMoveQueued.bind(this);
    this._onPointerUp     = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);

    this.canvas.addEventListener('pointerdown',   this._onPointerDown,   { passive: false });
    window.addEventListener('pointermove',         this._onPointerMove,   { passive: false });
    window.addEventListener('pointerup',           this._onPointerUp,     { passive: false });
    window.addEventListener('pointercancel',       this._onPointerCancel, { passive: false });
  }

  _handlePointerDown(e) {
    // Jangan tangkap sentuhan jika berada di atas elemen HUD/Modal UI
    if (e.target && e.target !== this.canvas) return;

    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activeTouches.size === 1) {
      this.isDragging     = true;
      this.isPinching     = false;
      this.lastPointerX   = e.clientX;
      this.lastPointerY   = e.clientY;
      this.touchStartX    = e.clientX;
      this.touchStartY    = e.clientY;
      this.touchStartTime = performance.now();
      this.velocityX      = 0;
      this.velocityY      = 0;
    } else if (this.activeTouches.size === 2) {
      this.isDragging       = false;
      this.isPinching       = true;
      this.initialPinchDist = this._getTouchDistance();
      this.initialScale     = this.currentScale;
    }
  }

  /**
   * Queue pointermove ke RAF — tidak proses setiap event secara sync.
   * Mobile bisa kirim 120Hz, kita hanya perlu ~60Hz (sinkron dengan render loop).
   */
  _handlePointerMoveQueued(e) {
    if (!this.activeTouches.has(e.pointerId)) return;
    // Simpan event terbaru, proses di frame berikutnya
    this._pendingMoveEvent = e;
    if (!this._rafId) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (this._pendingMoveEvent) {
          this._processPointerMove(this._pendingMoveEvent);
          this._pendingMoveEvent = null;
        }
      });
    }
  }

  _processPointerMove(e) {
    if (!this.activeTouches.has(e.pointerId)) return;
    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.isPinching && this.activeTouches.size >= 2) {
      // ── Pinch to Zoom ──
      const currentDist = this._getTouchDistance();
      if (this.initialPinchDist > 0 && currentDist > 0) {
        const factor   = currentDist / this.initialPinchDist;
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
      // Cek tap: ketukan singkat dengan pergeseran minimal
      if (this.activeTouches.size === 1 && !this.isPinching) {
        const dt   = performance.now() - this.touchStartTime;
        const dist = Math.hypot(e.clientX - this.touchStartX, e.clientY - this.touchStartY);
        if (dt < 280 && dist < 12) {
          this._checkTapRaycast(e.clientX, e.clientY);
        }
      }
      this.activeTouches.delete(e.pointerId);
    }

    if (this.activeTouches.size === 1) {
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
   * Raycasting dari sentuhan layar ke model 3D untuk deteksi ketukan.
   * Hanya berjalan jika ada kandidat objek interaktif — tidak waste GPU.
   */
  _checkTapRaycast(clientX, clientY) {
    if (!this.camera || !this.onTap) return;

    let candidates = [];
    if (typeof this.interactiveObjectsProvider === 'function') {
      candidates = this.interactiveObjectsProvider() || [];
    } else if (this.targetObject) {
      candidates = this.targetObject.children || [];
    }
    if (candidates.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouseVec.x = ((clientX - rect.left) / rect.width)  *  2 - 1;
    this.mouseVec.y = -((clientY - rect.top)  / rect.height) *  2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const intersects = this.raycaster.intersectObjects(candidates, true);

    if (intersects.length > 0) {
      this.onTap(intersects[0]);
    }
  }

  /**
   * Update inertia rotasi di setiap frame render 60 FPS.
   * Guard: skip jika tidak ada target atau velocity sudah terlalu kecil.
   * @param {number} dt
   */
  update(dt = 0.016) {
    if (!this.targetObject || this.isDragging) return;

    const vxAbs = Math.abs(this.velocityX);
    const vyAbs = Math.abs(this.velocityY);

    // Early-exit: tidak ada inersia tersisa — tidak perlu update apapun
    if (vxAbs <= 0.0001 && vyAbs <= 0.0001) return;

    if (vyAbs > 0.0001) {
      this.targetObject.rotation.y += this.velocityY;
      this.velocityY *= this.DAMPING;
    }
    if (vxAbs > 0.0001) {
      this.targetObject.rotation.x = THREE.MathUtils.clamp(
        this.targetObject.rotation.x + this.velocityX,
        -Math.PI / 3,
        Math.PI / 3
      );
      this.velocityX *= this.DAMPING;
    }
  }

  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.canvas.removeEventListener('pointerdown',  this._onPointerDown);
    window.removeEventListener('pointermove',        this._onPointerMove);
    window.removeEventListener('pointerup',          this._onPointerUp);
    window.removeEventListener('pointercancel',      this._onPointerCancel);
    this.activeTouches.clear();
    this.targetObject = null;
  }
}
