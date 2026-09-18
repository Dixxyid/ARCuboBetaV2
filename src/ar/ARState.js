/**
 * Finite State Machine (FSM) — AR State untuk 8th Wall + Image Targets
 *
 * Alur:
 * WORLD_SCAN → MARKER_SCAN → COORDINATE_LOCKED
 *                                  ↓ (marker hilang sementara)
 *                             VALIDATING
 *                            ↙         ↘
 *                    WORLD_SCAN    WORLD_TRACKING
 *                  (data invalid)  (marker benar hilang)
 */

export const ARSTATES = {
  WORLD_SCAN:          'WORLD_SCAN',          // 8th Wall scan permukaan (SLAM warm-up)
  MARKER_SCAN:         'MARKER_SCAN',          // Mencari image target (flashcard)
  COORDINATE_LOCKED:   'COORDINATE_LOCKED',    // Marker ketemu, pose di-lock di world space
  VALIDATING:          'VALIDATING',           // Marker hilang sementara, cek validitas data
  WORLD_TRACKING:      'WORLD_TRACKING',       // Marker hilang total, 8th Wall world tracking aktif
};

export class ARStateManager {
  constructor(onChangeCallback = null) {
    this.currentState = ARSTATES.WORLD_SCAN;
    this.onChangeCallback = onChangeCallback;
  }

  getState() {
    return this.currentState;
  }

  setState(newState) {
    if (this.currentState === newState) return;

    if (Object.values(ARSTATES).includes(newState)) {
      console.log(`[ARState] ${this.currentState} → ${newState}`);
      this.currentState = newState;
      if (this.onChangeCallback) {
        this.onChangeCallback(this.currentState);
      }
    } else {
      console.warn(`[ARState] State tidak valid: ${newState}`);
    }
  }

  is(state) {
    return this.currentState === state;
  }
}
