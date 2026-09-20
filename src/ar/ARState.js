/**
 * Finite State Machine (FSM) — AR State untuk 8th Wall SLAM + Image Targets
 *
 * Alur Baru:
 * SURFACE_SCAN (Scan 4 arah: kanan, kiri, depan, bawah)
 *      ↓ (Data SLAM tercukupi)
 * SURFACE_CONFIRM (Modal: "Data permukaan terkumpul! Klik OK")
 *      ↓ (Klik OK)
 * MARKER_SCAN (Mencari kartu flashcard)
 *      ↓ (Kartu terdeteksi)
 * MARKER_TRACKING (Objek mengikuti kartu dinamis; Tombol "Lock Coordinate")
 *      ↓ (Klik "Lock Coordinate")
 * SLAM_LOCKED (Matriks dibekukan di world space; Objek kokoh; Tombol "Unlock Coordinate")
 *      ↓ (Klik "Unlock Coordinate")
 * MARKER_TRACKING / MARKER_SCAN (Kembali ke mode marker)
 */

export const ARSTATES = {
  SURFACE_SCAN:     'SURFACE_SCAN',     // 8th Wall SLAM mapping 4 arah
  SURFACE_CONFIRM:  'SURFACE_CONFIRM',  // Menunggu konfirmasi OK data terkumpul
  MARKER_SCAN:      'MARKER_SCAN',      // Mencari image target (flashcard)
  MARKER_TRACKING:  'MARKER_TRACKING',  // Objek aktif mengikuti kartu fisik
  SLAM_LOCKED:      'SLAM_LOCKED',      // Objek terkunci permanen di SLAM world space
  VALIDATING:       'VALIDATING',       // Transisi / validasi saat tracking goyang
};

export class ARStateManager {
  constructor(onChangeCallback = null) {
    this.currentState = ARSTATES.SURFACE_SCAN;
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
