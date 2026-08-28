
/**
 * Finite State Machine (FSM) untuk Mengelola Mode AR Tracking & SLAM
 */
export const ARSTATES = {
  SEARCHING: 'SEARCHING', // Mencari target gambar (Flashcard)
  TRACKED: 'TRACKED',     // Target terdeteksi, terkunci pada kartu
  SLAM: 'SLAM'           // Berpindah ke World Coordinate (Markerless Tracking)
};

export class ARStateManager {
  constructor(onChangeCallback = null) {
    this.currentState = ARSTATES.SEARCHING;
    this.onChangeCallback = onChangeCallback;
  }

  getState() {
    return this.currentState;
  }

  setState(newState) {
    if (this.currentState === newState) return;
    
    if (Object.values(ARSTATES).includes(newState)) {
      console.log(`[ARState] Transisi State: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      if (this.onChangeCallback) {
        this.onChangeCallback(this.currentState);
      }
    } else {
      console.warn(`[ARState] State tidak valid: ${newState}`);
    }
  }
}
