import Alpine from 'alpinejs';

export function initUIStore() {
  const alpineInstance = window.Alpine || Alpine;
  if (!window.Alpine) window.Alpine = alpineInstance;

  const registerStore = () => {
    const storeObj = {
      // ── Tracking State ──────────────────────────────────────────────────────
      trackingState:       'SURFACE_SCAN',
      trackingStatusText:  'Scan Permukaan (4 Arah)...',

      // ── Scan 4-Arah Progress ────────────────────────────────────────────────
      scanProgress: {
        left:  false,
        right: false,
        front: false,
        down:  false,
      },
      showSurfaceDoneModal: false,

      // ── Model / Content ─────────────────────────────────────────────────────
      selectedCelestial:   null,
      showDetail:          false,
      isLoadingModel:      false,
      loadError:           null,
      _errorTimeout:       null,

      // ── AR SLAM & Marker UI Flags ───────────────────────────────────────────
      isSlamLocked:        false,
      showRescanNotif:     false,

      // ── State Setters ───────────────────────────────────────────────────────

      setTrackingState(state) {
        this.trackingState = state;
        const labels = {
          SURFACE_SCAN:     'Scan Permukaan (4 Arah)...',
          SURFACE_CONFIRM:  'Permukaan Terpetakan ✓',
          MARKER_SCAN:      'Arahkan ke Flashcard...',
          MARKER_TRACKING:  'Marker Terdeteksi',
          SLAM_LOCKED:      'SLAM World Anchor Terkunci ✓',
          VALIDATING:       'Memvalidasi Data...',
        };
        this.trackingStatusText = labels[state] || state;

        if (state === 'SURFACE_CONFIRM') {
          this.showSurfaceDoneModal = true;
        } else {
          this.showSurfaceDoneModal = false;
        }

        if (state !== 'SURFACE_SCAN') {
          this.showRescanNotif = false;
        }
      },

      setScanProgress(progress) {
        this.scanProgress = { ...this.scanProgress, ...progress };
      },

      setSlamLocked(locked) {
        this.isSlamLocked = locked;
      },

      setShowRescanNotif(show) {
        this.showRescanNotif = show;
      },

      // ── Konfirmasi Permukaan Selesai (Klik OK) ──────────────────────────────
      confirmSurfaceDone() {
        this.showSurfaceDoneModal = false;
        if (window.arAppBootstrapper) {
          window.arAppBootstrapper.confirmSurfaceDone();
        }
      },

      // ── Toggle Lock/Unlock Coordinate (Tombol HUD Footer) ───────────────────
      toggleCoordinateLock() {
        if (window.arAppBootstrapper) {
          window.arAppBootstrapper.toggleCoordinateLock();
        }
      },

      // ── Model Loading ───────────────────────────────────────────────────────

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

      // ── Content ─────────────────────────────────────────────────────────────

      setSelectedCelestial(celestial) {
        this.selectedCelestial = celestial;
        if (!celestial) this.showDetail = false;
      },

      toggleDetailModal() {
        this.showDetail = !this.showDetail;
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
