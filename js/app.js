/**
 * Main Application File (Updated)
 * Initializes and manages the WebXR AR experience with world-locked capabilities
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing World-Locked WebXR Experience...');

    let arManager, uiManager, performanceTracker;
    let isLoading = true;

    const loadingScreen = document.getElementById('loading-screen');
    const startButton = document.getElementById('start-ar');
    const placeBtn = document.getElementById('place-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const removeBtn = document.getElementById('remove-btn');
    const modelBtn = document.getElementById('next-model-btn');
    const sizeUpBtn = document.getElementById('scale-up-btn');
    const sizeDownBtn = document.getElementById('scale-down-btn');
    const arMessage = document.getElementById('ar-message');

    async function init() {
        try {
            if (navigator.xr) {
                const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
                if (isArSupported) {
                    arMessage.textContent = 'AR is supported! Click Enter AR to begin.';
                } else {
                    arMessage.textContent = 'WebXR AR not supported on this device.';
                    throw new Error('WebXR AR not supported on this device');
                }
            } else {
                arMessage.textContent = 'WebXR not supported in this browser.';
                throw new Error('WebXR not supported in this browser');
            }

            uiManager = new UIManager();
            uiManager.init();

            uiManager.showNotification('Initializing World-Locked AR experience...', 3000);

            performanceTracker = new PerformanceTracker({
                reportURL: 'https://script.google.com/macros/s/YOUR_GOOGLE_SHEET_SCRIPT_ID/exec',
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    devicePixelRatio: window.devicePixelRatio,
                    arMode: 'world-locked'
                }
            });

            arManager = new ARManager({
                showNotification: (msg, dur) => uiManager.showNotification(msg, dur)
            });

            await arManager.init();

            setInterval(updateTrackingQuality, 1000);
            setupEventListeners();

            startButton.style.display = 'block';
            uiManager.showNotification('AR experience ready! World-locked mode active.', 5000);
            performanceTracker.start();

            console.log('World-Locked WebXR Experience initialized successfully');
        } catch (error) {
            console.error('Failed to initialize WebXR AR:', error);
            uiManager?.showNotification('Error initializing AR: ' + error.message, 5000);

            if (arMessage) {
                arMessage.textContent = 'Error: ' + error.message;
                arMessage.style.color = '#f44336';
            }
        }
    }

    function startExperience() {
        arManager.startARSession();

        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                isLoading = false;
                uiManager.showNotification('Move your device to detect surfaces, tap to place objects', 5000);
            }, 500);
        }
    }

    function updateTrackingQuality() {
        const fps = performanceTracker.metrics.fps;
        const hitTestResults = arManager.state ? arManager.state.xrHitTestResults : [];
        let quality = 'Unknown';

        if (fps > 45 && hitTestResults.length > 0) {
            quality = 'Excellent';
            performanceTracker.elements.tracking.style.color = '#4CAF50';
        } else if (fps > 30 && hitTestResults.length > 0) {
            quality = 'Good';
            performanceTracker.elements.tracking.style.color = '#8BC34A';
        } else if (fps > 20) {
            quality = 'Fair';
            performanceTracker.elements.tracking.style.color = '#FFC107';
        } else {
            quality = 'Poor';
            performanceTracker.elements.tracking.style.color = '#F44336';
        }

        performanceTracker.setTrackingQuality(quality);
    }

    function setupEventListeners() {
        if (startButton) {
            startButton.addEventListener('click', startExperience);
        }

        if (placeBtn) {
            placeBtn.addEventListener('click', () => arManager.placeObject());
        }

        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => arManager.rotateObject(45));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => arManager.removeObject());
        }

        if (modelBtn) {
            modelBtn.addEventListener('click', () => arManager.nextModel());
        }

        if (sizeUpBtn) {
            sizeUpBtn.addEventListener('click', () => arManager.increaseScale());
        }

        if (sizeDownBtn) {
            sizeDownBtn.addEventListener('click', () => arManager.decreaseScale());
        }

        window.addEventListener('orientationchange', () => {
            setTimeout(() => uiManager?._adjustUIForScreen(), 300);
        });

        document.addEventListener('keydown', (event) => {
            if (isLoading) return;

            switch (event.key) {
                case ' ':
                    arManager.placeObject(); break;
                case 'Delete':
                case 'Backspace':
                    arManager.removeObject(); break;
                case 'ArrowUp':
                    arManager.increaseScale(); break;
                case 'ArrowDown':
                    arManager.decreaseScale(); break;
                case 'r':
                case 'R':
                    arManager.rotateObject(45); break;
                case 'm':
                case 'M':
                    arManager.nextModel(); break;
                case 'Escape':
                    arManager.endARSession(); break;
            }
        });
    }

    init();
});
