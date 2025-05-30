// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebXR polyfill (jika ada dan digunakan)
    if (typeof WebXRPolyfill !== 'undefined') {
        new WebXRPolyfill({
            optionalFeatures: ['dom-overlay', 'hit-test'],
            forcePolyfill: true // Sesuaikan jika perlu
        });
        console.log('WebXR Polyfill initialized (jika ada)');
    } else {
        console.warn('WebXR Polyfill not found (info)');
    }

    // Fungsi notifikasi ini bisa dipertimbangkan untuk dihapus jika UIManager.showNotification sudah cukup
    // Untuk saat ini, biarkan jika ada bagian lain yang mungkin masih menggunakannya secara internal.
    // Pastikan tidak konflik dengan notifikasi UIManager.
    if (!window.showNotification) {
        window.showNotification = (message, duration = 3000) => {
            let notification = document.getElementById('ar-notification'); // Menggunakan ID yang sama dengan UIManager
            if (!notification) {
                console.warn('Elemen notifikasi #ar-notification tidak ditemukan oleh ui-visibility.js');
                return;
            }
            notification.textContent = message;
            notification.style.opacity = '1';
            setTimeout(() => {
                notification.style.opacity = '0';
            }, duration);
        };
    }


    /**
     * Memastikan elemen DOM Overlay dan UI Container ada dan terstruktur dengan benar.
     * Menggunakan elemen yang sudah ada dari HTML jika tersedia.
     */
    function ensureDOMOverlayStructure() {
        let overlayElement = document.getElementById('ar-dom-overlay');
        if (!overlayElement) {
            console.warn('#ar-dom-overlay tidak ditemukan, membuatnya...');
            overlayElement = document.createElement('div');
            overlayElement.id = 'ar-dom-overlay';
            // Style dasar jika dibuat dinamis, idealnya styling via CSS
            Object.assign(overlayElement.style, {
                width: '100%', height: '100%', position: 'absolute',
                top: '0', left: '0', pointerEvents: 'none', zIndex: '10' // zIndex disesuaikan
            });
            document.body.appendChild(overlayElement);
        }

        let uiContainer = document.getElementById('ar-ui-container');
        if (!uiContainer) {
            console.warn('#ar-ui-container tidak ditemukan di dalam #ar-dom-overlay, membuatnya...');
            uiContainer = document.createElement('div');
            uiContainer.id = 'ar-ui-container';
            // Style dasar jika dibuat dinamis
            Object.assign(uiContainer.style, {
                position: 'absolute', width: '100%', height: '100%',
                pointerEvents: 'none' // Elemen anak akan mengatur pointerEvents mereka sendiri
            });
            overlayElement.appendChild(uiContainer); // Pastikan uiContainer ada di dalam overlayElement
        } else if (uiContainer.parentElement !== overlayElement) {
            // Jika uiContainer ada tapi tidak di dalam overlayElement yang benar, pindahkan.
            console.warn('#ar-ui-container ada tapi bukan anak dari #ar-dom-overlay. Memindahkan...');
            overlayElement.appendChild(uiContainer);
        }
        return { overlayElement, uiContainer };
    }

    // Panggil sekali untuk memastikan struktur DOM overlay benar saat startup
    const { uiContainer } = ensureDOMOverlayStructure();

    /**
     * (OPSIONAL, jika masih diperlukan)
     * Memindahkan elemen UI yang relevan ke dalam UI Container di DOM Overlay.
     * Fungsi ini sebaiknya dipanggil secara eksplisit oleh app.js jika memang diperlukan,
     * bukan secara otomatis melalui patching.
     */
    window.moveElementsToARUIContainer = function() {
        if (!uiContainer) {
            console.error('ar-ui-container tidak siap untuk memindahkan elemen.');
            return;
        }

        const elementsToMove = [
            'control-panel', 'size-controls', 'model-info',
            'performance-stats', 'ar-mode-indicator', 'instructions',
            'help-btn', // Jika ada tombol ini
            'exit-ar-btn' // Jika ada tombol ini
            // 'reticle-container' // Reticle biasanya dikelola Three.js, bukan dipindah
        ];

        console.log('Memindahkan elemen ke ar-ui-container (jika diperlukan)...');
        elementsToMove.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.parentElement !== uiContainer) {
                // Simpan parent asli untuk jaga-jaga jika perlu restore (meskipun restore sebaiknya ditangani app.js)
                if (!element.dataset.originalParentId) {
                    element.dataset.originalParentId = element.parentElement ? element.parentElement.id || 'body' : 'body';
                }
                uiContainer.appendChild(element);
                console.log(`Elemen ${id} dipindahkan ke ar-ui-container.`);
                // Pastikan elemen tetap interaktif setelah dipindahkan
                element.style.pointerEvents = 'auto';
            }
        });
    };

    /**
     * (OPSIONAL, jika masih diperlukan)
     * Mengembalikan elemen UI ke parent aslinya.
     * Fungsi ini sebaiknya dipanggil secara eksplisit oleh app.js jika memang diperlukan.
     */
    window.restoreElementsFromARUIContainer = function() {
        console.log('Mengembalikan elemen dari ar-ui-container ke parent asli (jika diperlukan)...');
        const elementsToRestore = uiContainer ? Array.from(uiContainer.children) : [];

        elementsToRestore.forEach(element => {
            const originalParentId = element.dataset.originalParentId;
            if (originalParentId) {
                const originalParent = (originalParentId === 'body') ? document.body : document.getElementById(originalParentId);
                if (originalParent) {
                    originalParent.appendChild(element);
                    console.log(`Elemen ${element.id || 'tanpa-id'} dikembalikan ke ${originalParentId}.`);
                } else {
                    document.body.appendChild(element); // Fallback ke body
                    console.warn(`Parent asli ${originalParentId} untuk elemen ${element.id} tidak ditemukan. Dikembalikan ke body.`);
                }
            }
        });
    };


    // PATCHING PADA ARManager dan UIManager DIHILANGKAN/DISEDERHANAKAN
    // Logika untuk menampilkan/menyembunyikan UI saat sesi AR dimulai/berakhir
    // sebaiknya ditangani oleh app.js dan UIManager.

    // Fungsi extendARManagerWithBabylonDOMOverlay tidak lagi melakukan patching otomatis.
    // Metode configureDOMOverlay bisa tetap ada jika berguna sebagai utilitas manual.
    if (window.ARManager && !ARManager.prototype.configureDOMOverlay) {
        ARManager.prototype.configureDOMOverlay = function(options = {}) {
            if (!this.scene || !this.xrHelper) { // xrHelper mungkin spesifik Babylon.js
                console.warn('Tidak dapat mengkonfigurasi DOM overlay: scene atau XR helper tidak terinisialisasi (mungkin pesan dari konteks Babylon.js)');
                return;
            }
            const root = options.root || document.getElementById('ar-dom-overlay');
            if (!root) {
                console.warn('Elemen root DOM overlay tidak ditemukan.');
                return;
            }
            try {
                if (this.xrHelper && this.xrHelper.sessionManager) {
                    this.xrHelper.sessionManager.setSessionOptions({ domOverlay: { root } });
                    console.log('DOM overlay dikonfigurasi dengan elemen root:', root.id);
                } else if (this.state && this.state.renderer && this.state.renderer.xr) {
                    // Untuk Three.js, konfigurasi domOverlay terjadi saat requestSession
                    // Metode ini mungkin lebih relevan untuk Babylon
                    console.log('Untuk Three.js, DOM Overlay dikonfigurasi saat requestSession. Metode ini mungkin tidak banyak berpengaruh setelah sesi dimulai.');
                }
            } catch (err) {
                console.error('Error mengkonfigurasi DOM overlay:', err);
            }
        };
        console.log('Metode ARManager.prototype.configureDOMOverlay ditambahkan (jika belum ada).');
    }


    // Hapus interval yang memaksa visibilitas UI
    // Hapus three-finger touch gesture untuk toggle UI (bisa dibuatkan tombol khusus jika perlu)

    console.log('ui-visibility.js telah disederhanakan untuk mengurangi tumpang tindih.');
    // Jika pemindahan elemen ke ar-ui-container memang mutlak diperlukan untuk DOM Overlay WebXR,
    // pertimbangkan untuk memanggil window.moveElementsToARUIContainer() sekali dari app.js
    // setelah ARManager.startARSession() berhasil dan sebelum render loop dimulai,
    // dan window.restoreElementsFromARUIContainer() saat sesi AR berakhir.
    // Namun, idealnya, CSS dan struktur HTML sudah menangani penempatan elemen dengan benar.

});