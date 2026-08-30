import Alpine from 'alpinejs';

export function initUIStore() {
  const alpineInstance = window.Alpine || Alpine;
  if (!window.Alpine) {
    window.Alpine = alpineInstance;
  }

  const registerStore = () => {
    const storeObj = {
      trackingState: 'SEARCHING',
      trackingStatusText: 'Mencari Target...',
      selectedCelestial: null,
      showDetail: false,

      // ===== TAMBAHAN BARU =====
      isLoadingModel: false,
      loadError: null,
      _errorTimeout: null,

      setLoadingModel(isLoading) {
        this.isLoadingModel = isLoading;
        if (isLoading) this.loadError = null; // reset error tiap kali mulai load baru
      },

      setLoadError(message) {
        this.isLoadingModel = false;
        this.loadError = message;

        // Auto-dismiss setelah 6 detik
        clearTimeout(this._errorTimeout);
        this._errorTimeout = setTimeout(() => {
          this.loadError = null;
        }, 6000);
      },

      dismissError() {
        clearTimeout(this._errorTimeout);
        this.loadError = null;
      },
      // ===== AKHIR TAMBAHAN =====

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
    };

    if (alpineInstance.store) {
      alpineInstance.store('arApp', storeObj);
      window.arUI = alpineInstance.store('arApp');
    }

    if (alpineInstance.data) {
      alpineInstance.data('arApp', () => (alpineInstance.store ? alpineInstance.store('arApp') : storeObj));
    }
  };

  registerStore();
  document.addEventListener('alpine:init', registerStore);

  if (!window.__alpineStarted && alpineInstance.start) {
    alpineInstance.start();
    window.__alpineStarted = true;
  }
}
