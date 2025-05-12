// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebXR polyfill
    if (typeof WebXRPolyfill !== 'undefined') {
        const polyfill = new WebXRPolyfill({
            optionalFeatures: ['dom-overlay', 'hit-test'],
            forcePolyfill: true
        });
        console.log('WebXR Polyfill initialized');
    } else {
        console.warn('WebXR Polyfill not found');
    }

    // Hide loading indicator once everything is ready
    const hideLoading = () => {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 500);
        }
    };

    // Check AR support
    const checkARSupport = async () => {
        if (navigator.xr) {
            try {
                const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
                console.log('WebXR AR support (native):', isSupported);
                return isSupported;
            } catch (err) {
                console.log('Error checking WebXR support:', err);
                return false;
            }
        } else {
            console.log('WebXR not available on this browser');
            return false;
        }
    };

    // Show notification function
    window.showNotification = (message, duration = 3000) => {
        let notification = document.getElementById('ar-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'ar-notification';
            Object.assign(notification.style, {
                position: 'fixed',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '5px',
                zIndex: '9999',
                opacity: '0',
                transition: 'opacity 0.3s ease'
            });
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.style.opacity = '1';
        setTimeout(() => {
            notification.style.opacity = '0';
        }, duration);
    };

    // Initialize everything
    const initApp = async () => {
        try {
            if (typeof detectARCapabilities === 'function') {
                const capabilities = detectARCapabilities();
                console.log('Device capabilities:', capabilities);
            } else {
                console.warn('detectARCapabilities function not found');
            }

            if (typeof getARManager === 'function') {
                window.arManager = getARManager({
                    modelPath: 'models/dog.glb',
                    models: [
                        { name: '3D Model', type: 'gltf', path: 'models/dog.glb' },
                        { name: 'Box', type: 'primitive', primitive: 'box' },
                        { name: 'Sphere', type: 'primitive', primitive: 'sphere' },
                        { name: 'Cylinder', type: 'primitive', primitive: 'cylinder' }
                    ],
                    currentModelIndex: 0,
                    defaultScale: 1.0,
                    showNotification: window.showNotification
                });

                await window.arManager.init();
            } else {
                console.warn('getARManager function not found');
            }
        } catch (err) {
            console.error('Error initializing app:', err);
            window.showNotification('Error initializing app: ' + err.message);
        } finally {
            hideLoading();
        }
    };

    // Initialize the app
    if (document.readyState === 'complete') {
        initApp();
    } else {
        window.addEventListener('load', initApp);
    }
});


// ===== UI Visibility Patch Integration =====
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // Make sure we don't double-initialize
        if (window.uiVisibilityInitialized) return;
        window.uiVisibilityInitialized = true;
        
        console.log('Initializing UI visibility module');
        const isInAR = document.querySelector('.ar-active') !== null;

        function forceUIVisibility() {
            const elementsToShow = [
                'control-panel',
                'size-controls',
                'model-info',
                'performance-stats',
                'ar-mode-indicator',
                'instructions',
                'help-btn',
                'exit-ar-btn'
            ];

            elementsToShow.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.display = id.includes('controls') ? 'flex' : 'block';
                    element.style.opacity = '1';
                    element.style.pointerEvents = 'auto';
                    element.style.zIndex = '2000';
                }
            });
        }

        function fixARUIVisibility() {
            forceUIVisibility();
            const visibilityInterval = setInterval(forceUIVisibility, 1000);
            window.arUIVisibilityInterval = visibilityInterval;

            document.addEventListener('touchstart', function(event) {
                if (event.touches.length === 3) {
                    const controlPanel = document.getElementById('control-panel');
                    const isVisible = controlPanel?.style.opacity !== '0';

                    const elementsToShow = [
                        'control-panel',
                        'size-controls',
                        'model-info',
                        'performance-stats',
                        'ar-mode-indicator',
                        'instructions',
                        'help-btn',
                        'exit-ar-btn'
                    ];

                    elementsToShow.forEach(id => {
                        const element = document.getElementById(id);
                        if (element) {
                            element.style.opacity = isVisible ? '0' : '1';
                            element.style.pointerEvents = isVisible ? 'none' : 'auto';
                        }
                    });

                    event.preventDefault();
                }
            });
        }

        // Check for ARManager and patch it if available
        if (window.ARManager) {
            console.log('Patching ARManager prototype');
            const originalStartARSession = ARManager.prototype.startARSession;
            ARManager.prototype.startARSession = async function() {
                const result = await originalStartARSession.apply(this, arguments);
                setTimeout(fixARUIVisibility, 500);
                return result;
            };

            const originalEndSession = ARManager.prototype.endARSession;
            ARManager.prototype.endARSession = function() {
                if (window.arUIVisibilityInterval) {
                    clearInterval(window.arUIVisibilityInterval);
                    window.arUIVisibilityInterval = null;
                }
                return originalEndSession.apply(this, arguments);
            };
        }

        // Check for UIManager and patch it if available
        function patchUIManager() {
            // Access UIManager from window instead of directly
            if (window.UIManager && !window.UIManager.prototype._patched) {
                console.log('Patching UIManager prototype');
                
                const UIManagerProto = window.UIManager.prototype;
                const originalUpdateARSessionState = UIManagerProto.updateARSessionState;
                
                UIManagerProto.updateARSessionState = function(active) {
                    originalUpdateARSessionState.apply(this, arguments);
                    if (active) {
                        setTimeout(fixARUIVisibility, 500);
                    }
                };
                
                UIManagerProto._patched = true;
            }
        }

        // Try to patch UIManager now or wait for it to be defined
        if (window.UIManager) {
            patchUIManager();
        } else {
            console.log('UIManager not found, waiting for it to be defined');
            
            // Check every 300ms for UIManager
            const checkInterval = setInterval(() => {
                if (window.UIManager) {
                    clearInterval(checkInterval);
                    patchUIManager();
                    console.log('UIManager found and patched');
                }
            }, 300);
            
            // Stop checking after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn('UIManager not found after timeout');
            }, 10000);
        }

        if (isInAR) {
            fixARUIVisibility();
        }
    });
})();