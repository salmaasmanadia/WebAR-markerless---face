/**
 * UI Manager for WebXR World-Locked AR Experience
 * Combines UI controls, screen responsiveness, help panels, and AR session management
 */
class UIManager {
    constructor() {
        this.elements = {
            startButton: null,
            removeButton: null,
            // rotateButton: null, // Dihapus karena tombolnya dihilangkan dari HTML
            nextModelButton: null,
            clearButton: null,     // Jika Anda menggunakan tombol ini
            scaleUpButton: null,
            scaleDownButton: null,
            resetScaleButton: null, // Jika Anda menggunakan tombol ini
            helpPanel: null,
            gotItButton: null,
            instructions: null
        };

        this.state = {
            helpShown: false,
            isARActive: false, // Status ini akan dikelola oleh UIManager berdasarkan panggilan dari app.js
            notificationTimer: null,
            instructionTimeout: null
        };

        // _setupEventListeners akan dipanggil oleh init()
    }

    init() {
        this._findElements();
        this._setupEventListeners(); // Pindahkan pemanggilan _setupEventListeners ke sini setelah _findElements
        this._hideHelpPanel();
        this._setupARModeIndicator();
        this._setupInstructions();

        if (!localStorage.getItem('ar-help-shown')) {
            this.showHelpPanel();
            localStorage.setItem('ar-help-shown', 'true');
        }

        this._adjustUIForScreen();
        console.log('UI Manager initialized');
    }

    _findElements() {
        this.elements.startButton = document.getElementById('start-ar');
        this.elements.removeButton = document.getElementById('remove-btn');
        // this.elements.rotateButton = document.getElementById('rotate-btn'); // Tombol sudah dihapus
        this.elements.nextModelButton = document.getElementById('next-model-btn');
        this.elements.clearButton = document.getElementById('clear-btn'); // Jika ada elemen ini di HTML
        this.elements.scaleUpButton = document.getElementById('scale-up-btn');
        this.elements.scaleDownButton = document.getElementById('scale-down-btn');
        this.elements.resetScaleButton = document.getElementById('reset-scale-btn'); // Jika ada
        this.elements.helpPanel = document.getElementById('help-panel');
        this.elements.gotItButton = document.getElementById('got-it');
        this.elements.instructions = document.getElementById('instructions');
    }

    _setupEventListeners() {
        // HAPUS event listener untuk startButton di UIManager, biarkan app.js yang menangani
        /*
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => this._startAR());
        }
        */

        // Listener untuk tombol yang masih ada dan dikelola UIManager (jika ada yang spesifik)
        // atau biarkan app.js yang menangani semua interaksi tombol dengan window.arManager

        // Contoh: Jika tombol-tombol ini masih relevan dan event listenernya di sini
        if (this.elements.removeButton) {
            this.elements.removeButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.removeObject === 'function') {
                    window.arManager.removeObject();
                }
            });
        }

        // if (this.elements.rotateButton) { // Tombol dan listener ini sudah tidak relevan
        //     this.elements.rotateButton.addEventListener('click', () => window.arManager?.rotateObject());
        // }

        if (this.elements.nextModelButton) {
            this.elements.nextModelButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.nextModel === 'function') {
                    window.arManager.nextModel();
                }
            });
        }

        if (this.elements.clearButton) { // Jika tombol ini ada
            this.elements.clearButton.addEventListener('click', () => {
                 if (window.arManager && typeof window.arManager.clearObjects === 'function') { // Asumsi ada metode clearObjects
                    window.arManager.clearObjects();
                 }
            });
        }

        if (this.elements.scaleUpButton) {
            this.elements.scaleUpButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.increaseScale === 'function') {
                    window.arManager.increaseScale();
                }
            });
        }

        if (this.elements.scaleDownButton) {
            this.elements.scaleDownButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.decreaseScale === 'function') {
                    window.arManager.decreaseScale();
                }
            });
        }

        if (this.elements.resetScaleButton) { // Jika tombol ini ada
            this.elements.resetScaleButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.resetScale === 'function') {
                    window.arManager.resetScale();
                }
            });
        }

        if (this.elements.gotItButton) {
            this.elements.gotItButton.addEventListener('click', () => this._hideHelpPanel());
        }

        // Pembuatan tombol help (?) dan exit (X) sudah dihapus/dikomentari sebelumnya
        // jadi tidak perlu diubah lagi di sini.

        window.addEventListener('resize', this._adjustUIForScreen.bind(this));
        this._setupTouchEvents(); // Metode ini bisa dipertahankan jika relevan
    }

    _setupARModeIndicator() {
        // Metode ini bisa dipertahankan jika ar-mode-indicator masih digunakan
        let indicator = document.getElementById('ar-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'ar-mode-indicator';
            indicator.className = 'ar-mode-indicator'; // Pastikan class ini ada di CSS Anda
            indicator.innerHTML = '<span>AR Mode</span>'; // Teks bisa disesuaikan
            document.body.appendChild(indicator);
        }
        // Atur visibilitasnya berdasarkan state atau CSS
        indicator.style.opacity = '0'; // Sembunyikan defaultnya, tampilkan saat AR aktif
        indicator.style.transition = 'opacity 0.5s';
    }

    _setupInstructions() {
        if (!this.elements.instructions) return;
        // Logika untuk menampilkan dan menyembunyikan instruksi bisa disesuaikan
        // Misalnya, tampilkan saat AR dimulai, sembunyikan setelah beberapa saat atau saat interaksi pertama
        this.elements.instructions.style.display = 'none'; // Sembunyikan defaultnya
    }

    _setupTouchEvents() {
        // Metode ini bisa dipertahankan jika fungsionalitas sentuh spesifik iOS masih diperlukan
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            document.addEventListener('touchmove', (e) => {
                if (e.target.classList.contains('control-button')) return;
                e.preventDefault();
            }, { passive: false });

            const buttons = document.querySelectorAll('.control-button');
            buttons.forEach(button => {
                button.addEventListener('touchstart', e => {
                    if (e.currentTarget instanceof HTMLElement) e.currentTarget.classList.add('active');
                });
                button.addEventListener('touchend', e => {
                    if (e.currentTarget instanceof HTMLElement) e.currentTarget.classList.remove('active');
                });
            });
        }
    }

    // HAPUS metode _startAR() karena sudah ditangani oleh app.js
    /*
    _startAR() {
        // ... (logika lama) ...
    }
    */

    showHelpPanel() {
        const helpPanel = this.elements.helpPanel;
        if (helpPanel) {
            helpPanel.style.display = 'block'; // Atau gunakan class untuk animasi
            this.state.helpShown = true;
            // Pertimbangkan untuk tidak otomatis menyembunyikan jika pengguna membukanya manual
            // setTimeout(() => this._hideHelpPanel(), 15000); 
        }
    }

    _hideHelpPanel() {
        if (this.elements.helpPanel) {
            this.elements.helpPanel.style.display = 'none';
            this.state.helpShown = false;
        }
    }

    updateARSessionState(active) {
        this.state.isARActive = active; // UIManager melacak status AR dari panggilan app.js

        const controlPanel = document.getElementById('control-panel');
        // const sizeControls = document.getElementById('size-controls'); // Sudah tidak relevan
        const modeIndicator = document.getElementById('ar-mode-indicator');
        const instructionsPanel = this.elements.instructions; // Ambil dari elemen yang sudah disimpan

        if (active) {
            if (controlPanel) controlPanel.classList.add('ar-active');
            // if (sizeControls) sizeControls.classList.add('ar-active'); // Dihapus
            if (modeIndicator) modeIndicator.style.opacity = '1';
            if (instructionsPanel) { // Tampilkan instruksi saat AR aktif
                instructionsPanel.style.display = 'block'; // atau 'flex' tergantung styling
                instructionsPanel.style.opacity = '1';
                // Sembunyikan instruksi setelah beberapa detik jika diinginkan
                if(this.state.instructionTimeout) clearTimeout(this.state.instructionTimeout);
                this.state.instructionTimeout = setTimeout(() => {
                    if (instructionsPanel) {
                         instructionsPanel.style.opacity = '0';
                         setTimeout(() => { instructionsPanel.style.display = 'none';}, 500);
                    }
                }, 7000); // Tampilkan selama 7 detik
            }
            this.setUIVisibility(true); // Memastikan elemen dasar terlihat
        } else {
            if (controlPanel) controlPanel.classList.remove('ar-active');
            // if (sizeControls) sizeControls.classList.remove('ar-active'); // Dihapus
            if (modeIndicator) modeIndicator.style.opacity = '0';
            if (instructionsPanel) { // Sembunyikan instruksi saat keluar AR
                 instructionsPanel.style.display = 'none';
                 instructionsPanel.style.opacity = '0';
            }
            // Pemanggilan setUIVisibility(false) mungkin tidak diperlukan jika
            // enhanceUIManager di app.js menangani fixPostARUI dengan benar
            // Untuk sekarang, biarkan UIManager mengatur visibilitas elemennya.
            // Namun, 'fixPostARUI' yang ditambahkan di app.js akan memanggil this.setUIVisibility(true)
            // jadi mungkin tidak perlu disembunyikan di sini jika ingin tetap terlihat setelah AR.
            // Mari kita asumsikan setUIVisibility(true) akan dipanggil oleh fixPostARUI.
        }
    }

    _adjustUIForScreen() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallScreen = window.innerWidth < 600;

        const controlPanel = document.getElementById('control-panel');
        // const sizeControls = document.getElementById('size-controls'); // Sudah tidak relevan
        const instructions = this.elements.instructions; // Ambil dari elemen yang sudah disimpan
        const performanceStats = document.getElementById('performance-stats');
        const modelInfo = document.getElementById('model-info');

        // Hapus sizeControls dari array
        [controlPanel, performanceStats, modelInfo].forEach(el => {
            if (!el) return;
            if (isLandscape) {
                el.classList.add('landscape');
            } else {
                el.classList.remove('landscape');
            }
        });

        if (instructions) {
            instructions.className = ''; // Reset kelas untuk instruksi
            if (isSmallScreen) instructions.classList.add('small-screen');
            if (isLandscape) instructions.classList.add('landscape');
        }
    }

    setUIVisibility(visible) {
        // Hapus 'size-controls' dari array
        const ids = ['control-panel', 'performance-stats', 'model-info'];
        // 'instructions' visibilitasnya diatur di updateARSessionState
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // Untuk control-panel, biarkan CSS .ar-active yang mengontrol display (flex/none)
                // Di sini kita hanya atur opacity dan pointerEvents
                if (id === 'control-panel') {
                     el.style.opacity = visible ? '1' : (this.state.isARActive ? '0' : '1'); // Jika tidak AR aktif, tetap terlihat
                     el.style.pointerEvents = visible ? 'auto' : (this.state.isARActive ? 'none' : 'auto');
                } else {
                    el.style.opacity = visible ? '1' : '0';
                    el.style.pointerEvents = visible ? 'auto' : 'none';
                }
            }
        });
    }

    toggleUIVisibility() { // Metode ini bisa berguna untuk debugging atau fitur kustom
        const controlPanel = document.getElementById('control-panel');
        // Cek visibilitas berdasarkan opacity salah satu elemen utama yang dikontrol, misal controlPanel
        const isCurrentlyVisible = controlPanel ? (controlPanel.style.opacity !== '0') : false;
        this.setUIVisibility(!isCurrentlyVisible);
    }

    showNotification(message, duration = 3000) {
        const notification = document.getElementById('ar-notification');
        if (!notification) {
            console.warn("Elemen #ar-notification tidak ditemukan oleh UIManager.");
            return;
        }

        if (this.state.notificationTimer) clearTimeout(this.state.notificationTimer);

        notification.textContent = message;
        notification.style.opacity = '1';
        notification.classList.add('visible'); // Jika ada class .visible di CSS

        this.state.notificationTimer = setTimeout(() => {
            notification.style.opacity = '0';
            notification.classList.remove('visible');
        }, duration);
    }
}

window.UIManager = UIManager;