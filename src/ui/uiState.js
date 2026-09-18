import Alpine from 'alpinejs';

export function initUIStore() {
  const alpineInstance = window.Alpine || Alpine;
  if (!window.Alpine) window.Alpine = alpineInstance;

  const registerStore = () => {
    const storeObj = {
      // ── Tracking State ──────────────────────────────────────────────────────
      trackingState:       'WORLD_SCAN',
      trackingStatusText:  'Scan Permukaan...',

      // ── Model / Content ─────────────────────────────────────────────────────
      selectedCelestial:   null,
      showDetail:          false,
      isLoadingModel:      false,
      loadError:           null,
      _errorTimeout:       null,

      // ── AR-specific UI flags ─────────────────────────────────────────────────
      isCoordinateLocked:  false,
      showRescanNotif:     false,

      // ── State setters ────────────────────────────────────────────────────────

      setTrackingState(state) {
        this.trackingState = state;
        const labels = {
          WORLD_SCAN:        'Scan Permukaan...',
          MARKER_SCAN:       'Cari Flashcard...',
          COORDINATE_LOCKED: 'Coordinate Terkunci ✓',
          VALIDATING:        'Memvalidasi Data...',
          WORLD_TRACKING:    'World Tracking Aktif',
        };
        this.trackingStatusText = labels[state] || state;

        // Auto-clear notif saat state berubah ke bukan WORLD_SCAN
        if (state !== 'WORLD_SCAN') this.showRescanNotif = false;
      },

      setCoordinateLocked(locked) {
        this.isCoordinateLocked = locked;
      },

      setShowRescanNotif(show) {
        this.showRescanNotif = show;
      },

      // ── Model loading ─────────────────────────────────────────────────────────

      setLoadingModel(isLoading) {
        this.isLoadingModel = isLoading;
        if (isLoading) this.loadError = null;
      },

      setLoadError(message) {
        this.isLoadingModel = false;
        this.loadError      = message;
        clearTimeout(this._errorTimeout);
        this._errorTimeout  = setTimeout(() => { this.loadError = null; }, 6000);
      },

      dismissError() {
        clearTimeout(this._errorTimeout);
        this.loadError = null;
      },

      // ── Content ───────────────────────────────────────────────────────────────

      setSelectedCelestial(celestial) {
        this.selectedCelestial = celestial;
        if (!celestial) this.showDetail = false;
      },

      toggleDetailModal() {
        this.showDetail = !this.showDetail;
      },

      // ── Lock Coordinate (dipanggil dari tombol HTML) ──────────────────────────

      lockCoordinate() {
        if (window.arAppBootstrapper) {
          window.arAppBootstrapper.lockCoordinate();
        }
      },
    };

    if (alpineInstance.store) {
      alpineInstance.store('arApp', storeObj);
      window.arUI = alpineInstance.store('arApp');
    }

    if (alpineInstance.data) {
      alpineInstance.data('arApp', () =>
        alpineInstance.store ? alpineInstance.store('arApp') : storeObj
      );
    }
  };

  registerStore();
  document.addEventListener('alpine:init', registerStore);

  if (!window.__alpineStarted && alpineInstance.start) {
    alpineInstance.start();
    window.__alpineStarted = true;
  }
}
