import Alpine from 'alpinejs';
import { ARSTATES } from '../ar/ARState.js';

/**
 * Inisialisasi dan Manajer Store Reaktif Alpine.js
 */
export function initUIStore() {
  Alpine.data('arApp', () => ({
    trackingState: ARSTATES.SEARCHING,
    selectedCelestial: null,
    showDetail: false,

    init() {
      // Expose instance Alpine ke window agar bisa diakses dari main bootstrapper
      window.arUI = this;
    },

    get trackingStatusText() {
      switch (this.trackingState) {
        case ARSTATES.SEARCHING:
          return 'Mencari Target...';
        case ARSTATES.TRACKED:
          return 'Kartu Terdeteksi';
        case ARSTATES.SLAM:
          return 'Mode Dunia (SLAM Active)';
        default:
          return 'Menyiapkan AR...';
      }
    },

    setTrackingState(state) {
      this.trackingState = state;
    },

    setSelectedCelestial(data) {
      this.selectedCelestial = data;
    },

    toggleDetailModal() {
      this.showDetail = !this.showDetail;
    },

    resetView() {
      if (window.arAppBootstrapper) {
        window.arAppBootstrapper.resetView();
      }
    }
  }));

  Alpine.start();
}
