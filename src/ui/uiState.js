// Jika menggunakan CDN cdn.min.js, Alpine otomatis terdaftar ke window.Alpine
const Alpine = window.Alpine;

export function initUIStore() {
  document.addEventListener('alpine:init', () => {
    Alpine.store('arApp', {
      trackingState: 'SEARCHING',
      trackingStatusText: 'Mencari Target...',
      selectedCelestial: null,
      showDetail: false,

      setTrackingState(state) {
        this.trackingState = state;
        if (state === 'SEARCHING') this.trackingStatusText = 'Mencari Target...';
        else if (state === 'TRACKED') this.trackingStatusText = 'Target Terdeteksi';
        else if (state === 'SLAM') this.trackingStatusText = 'Mode SLAM Aktif';
      },

      setSelectedCelestial(celestial) {
        this.selectedCelestial = celestial;
      },

      toggleDetailModal() {
        this.showDetail = !this.showDetail;
      }
      
        resetView() {
      if (window.arAppBootstrapper) {
        window.arAppBootstrapper.resetView();
      }
    }
    });
  });

  if (!window.Alpine && Alpine) {
    window.Alpine = Alpine;
  }
}
