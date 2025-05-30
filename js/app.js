/**
 * Main Application File (Combined and Optimized)
 * Initializes and manages the WebXR AR experience with world-locked capabilities
 * Integrated with enhanced PerformanceTracker for advanced metrics
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing World-Locked WebXR Experience...');

    // Global variables
    let arManager, uiManager, performanceTracker;
    let isLoading = true;
    let xrSession = null;
    let webGLContext = null;
    let isARModeActive = false;

    // DOM Element References
    const loadingScreen = document.getElementById('loading-screen');
    const startButton = document.getElementById('start-ar');
    const removeBtn = document.getElementById('remove-btn');
    const modelBtn = document.getElementById('next-model-btn');
    const sizeUpBtn = document.getElementById('scale-up-btn');
    const sizeDownBtn = document.getElementById('scale-down-btn');
    const arMessage = document.getElementById('ar-message');

    /**
     * Initialize the AR application
     */
    async function init() {
        try {
            // Check WebXR support
            if (!navigator.xr) {
                throw new Error('WebXR not supported in this browser');
            }

            const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!isArSupported) {
                throw new Error('WebXR AR not supported on this device');
            }

            arMessage.textContent = 'AR is supported! Click Enter AR to begin.';

            // Initialize UI Manager
            uiManager = new UIManager();
            uiManager.init();
            uiManager.showNotification('Initializing World-Locked AR experience...', 3000);

            // Create temporary WebGL context for performance tracking
            const tempCanvas = document.createElement('canvas');
            webGLContext = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');

            // Initialize Performance Tracker
            performanceTracker = new PerformanceTracker({
                reportURL: 'https://script.google.com/macros/s/AKfycby1wliupR46OkwUoCraslZm5ofvLdUBjv8EAmhIRZKZmtRmUiF7CJUKNcWDQOdGPMLOYg/exec',
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    devicePixelRatio: window.devicePixelRatio,
                    arMode: 'world-locked'
                },
                showNotification: (msg, dur) => uiManager.showNotification(msg, dur),
                webGLContext: webGLContext,
                captureSpectorFrames: 5
            });

            // Initialize AR Manager
            arManager = new ARManager({
                showNotification: (msg, dur) => uiManager.showNotification(msg, dur),
                performanceTracker: performanceTracker
            });

            await arManager.init();

            // Update WebGL context with actual renderer context
            if (arManager.state && arManager.state.renderer) {
                const actualContext = arManager.state.renderer.getContext();
                performanceTracker.options.webGLContext = actualContext;
                if (performanceTracker._setupSpector) {
                    performanceTracker._setupSpector();
                }
            }

            // Setup intervals and event listeners
            setInterval(updateTrackingQuality, 1000);
            setupEventListeners();
            setupPerformanceVisibilityHandler();

            // Show AR start button and notification
            startButton.style.display = 'block';
            uiManager.showNotification('AR experience ready! World-locked mode active.', 2000);
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

    /**
     * Start AR experience
     */
    async function startExperience() {
        console.log('🚀 Starting AR experience...');
        
        // Hide start button immediately
        if (startButton) {
            startButton.style.display = 'none';
            console.log('Start button hidden');
        }
        
        // Show loading screen
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
        
        document.body.classList.add('ar-mode');
        isLoading = true;

        try {
            await arManager.startARSession();
            console.log('✅ AR session started successfully');

            isARModeActive = true;
            
            // Show exit button if exists
            const exitButton = document.getElementById('exit-ar');
            if (exitButton) {
                exitButton.style.display = 'block';
            }
            
            // Start performance tracking
            if (performanceTracker && !document.hidden) {
                performanceTracker.start();
                console.log("Performance tracking started");
            }

            // Hide loading screen
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    isLoading = false;
                    if (uiManager) {
                        uiManager.showNotification('Move device to scan surfaces, tap to place objects', 4000);
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Failed to start AR:', error);
            
            // Reset everything if failed
            isARModeActive = false;
            document.body.classList.remove('ar-mode');
            
            // Show start button again if failed
            showEnterARButton();
            
            // Hide loading
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            
            if (uiManager) {
                uiManager.showNotification('AR start failed: ' + error.message, 5000);
            }
            
            isLoading = false;
        }
    }

    /**
     * Exit AR mode and restore Enter AR button
     */
    function exitARMode() {
        console.log('🚪 Exiting AR mode...');
        isARModeActive = false; 

        if (arManager && arManager.state && arManager.state.xrSession) {
            console.log('Ending AR session and stopping performance tracking...');
            const session = arManager.state.xrSession;

            // Stop performance tracking
            if (performanceTracker) {
                performanceTracker.stop();
                performanceTracker.reportToServer();
                console.log("Performance tracking stopped");
            }

            // End XR session
            session.end().then(() => {
                console.log('✅ AR session ended successfully');
                
                // Reset AR Manager state
                if (arManager) {
                    arManager.state.xrSession = null;
                    arManager.state.xrHitTestSource = null;
                    arManager.state.renderer.setAnimationLoop(null);
                }
                
                // Show Enter AR button again
                showEnterARButton();
                
                // Reset UI
                resetUIToNormalMode();
                
                // Update UI manager
                if (uiManager) {
                    uiManager.updateARSessionState(false);
                    uiManager.showNotification('AR ended. Click Enter AR to start again!', 3000);
                }
                
            }).catch(err => {
                console.error('Error ending AR session:', err);
                showEnterARButton();
                resetUIToNormalMode();
            });
        } else {
            console.warn('No active AR session to end');
            if (performanceTracker && performanceTracker.reportingInterval) {
                performanceTracker.stop();
                performanceTracker.reportToServer();
            }
            showEnterARButton();
            resetUIToNormalMode();
        }
    }

    /**
     * Show Enter AR button
     */
    function showEnterARButton() {
        console.log('🔄 Restoring Enter AR button...');
        
        const startButton = document.getElementById('start-ar');
        const exitButton = document.getElementById('exit-ar');
        
        if (startButton) {
            startButton.style.display = 'block';
            startButton.style.visibility = 'visible';
            startButton.style.opacity = '1';
            startButton.disabled = false;
            startButton.style.pointerEvents = 'auto';
            startButton.classList.remove('hidden');
            startButton.classList.add('visible');
            console.log('✅ Enter AR button restored and visible');
        } else {
            console.error('❌ Start button not found in DOM!');
        }
        
        if (exitButton) {
            exitButton.style.display = 'none';
        }
        
        // Update AR message
        const arMessage = document.getElementById('ar-message');
        if (arMessage) {
            arMessage.textContent = 'AR is ready! Click Enter AR to begin.';
            arMessage.style.color = '#4CAF50';
            arMessage.style.display = 'block';
        }
    }

    /**
     * Reset UI to normal mode
     */
    function resetUIToNormalMode() {
        console.log('🔄 Resetting UI to normal mode...');
        
        // Remove AR mode from body
        document.body.classList.remove('ar-mode');
        document.body.classList.add('normal-mode');
        
        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
            loadingScreen.style.opacity = '0';
        }
        
        // Reset control panel
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.classList.remove('ar-active');
            controlPanel.style.display = 'flex';
            controlPanel.style.opacity = '1';
            controlPanel.style.visibility = 'visible';
            controlPanel.style.pointerEvents = 'auto';
        }
        
        // Reset size controls
        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.classList.remove('ar-active');
            sizeControls.style.display = 'flex';
            sizeControls.style.opacity = '1';
            sizeControls.style.visibility = 'visible';
            sizeControls.style.pointerEvents = 'auto';
        }
        
        // Clear session reference
        xrSession = null;
        
        console.log('✅ UI reset to normal mode complete');
    }

    /**
     * Update tracking quality information
     */
    function updateTrackingQuality() {
        const fps = performanceTracker.metrics.fps;
        const hitTestResults = arManager.state ? arManager.state.xrHitTestResults : [];
        const surfacesCount = hitTestResults.length;
        let quality = 'Unknown';

        // Update surfacesDetected metric
        performanceTracker.setSurfacesDetected(surfacesCount);

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

        performanceTracker.setTrackingQuality(quality, surfacesCount > 0 ? 1.0 : 0.5);
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        if (startButton) {
            startButton.addEventListener('click', startExperience);
            console.log('✅ Start button event listener added');
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => arManager.removeObject());
        }

        if (modelBtn) {
            modelBtn.addEventListener('click', () => {
                const modelId = `model-change-${Date.now()}`;
                performanceTracker.markObjectLoadStart(modelId);
                arManager.nextModel();
                setTimeout(() => performanceTracker.markObjectAppeared(modelId), 200);
            });
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

        // Keyboard events
        document.addEventListener('keydown', (event) => {
            if (isLoading) return;

            switch (event.key) {
                case 'Delete':
                case 'Backspace':
                    if (isARModeActive) arManager.removeObject();
                    break;
                case 'ArrowUp':
                    if (isARModeActive) arManager.increaseScale();
                    break;
                case 'ArrowDown':
                    if (isARModeActive) arManager.decreaseScale();
                    break;
                case 'm':
                case 'M':
                    if (isARModeActive) {
                        const modelId = `model-change-${Date.now()}`;
                        performanceTracker.markObjectLoadStart(modelId);
                        arManager.nextModel();
                        setTimeout(() => performanceTracker.markObjectAppeared(modelId), 200);
                    }
                    break;
                case 'Escape':
                    if (isARModeActive) {
                        console.log('ESC pressed - exiting AR mode');
                        exitARMode();
                    }
                    break;
                case 'Enter':
                    if (!isARModeActive && startButton && startButton.style.display !== 'none') {
                        console.log('Enter pressed - starting AR mode');
                        startExperience();
                    }
                    break;
                case 'p':
                case 'P':
                    performanceTracker.reportToServer();
                    uiManager.showNotification('Performance data reported', 2000);
                    break;
            }
        });
        
        console.log('✅ All event listeners setup complete');
    }

    /**
     * Helper function to ensure Enter AR button is always available when not in AR
     */
    function ensureEnterARAvailable() {
        if (!isARModeActive) {
            const startButton = document.getElementById('start-ar');
            if (startButton) {
                startButton.style.display = 'block';
                startButton.style.visibility = 'visible';
                startButton.style.opacity = '1';
                startButton.disabled = false;
                console.log('Enter AR button availability ensured');
            }
        }
    }

    /**
     * Enhanced visibility handler with Enter AR button check
     */
    function setupPerformanceVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!performanceTracker) return;

            if (document.hidden) {
                performanceTracker.stop();
                console.log("Performance tracking paused due to page visibility change (hidden).");
            } else {
                if (isARModeActive) {
                    performanceTracker.start();
                    console.log("Performance tracking resumed due to page visibility change (visible in AR mode).");
                } else {
                    ensureEnterARAvailable();
                }
            }
        });
    }

    /**
     * Reset control panel to default state
     */
    function resetControlPanel() {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.flexDirection = 'row';
            controlPanel.style.position = 'fixed';
            controlPanel.style.bottom = '20px';
            controlPanel.style.left = '50%';
            controlPanel.style.transform = 'translateX(-50%)';
            controlPanel.style.gap = '10px';
            controlPanel.style.zIndex = '1000';
            controlPanel.style.opacity = '1';
        }
    }

    /**
     * General UI reset function
     */
    function resetUI() {
        resetControlPanel();
        
        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.opacity = '1';
        }
    }

    /**
     * Handle document visibility changes
     */
    function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                resetUI();
                
                if (!xrSession) {
                    resetControlPanel();
                    if (uiManager) {
                        uiManager.updateARSessionState(false);
                    }
                }
                
                if (performanceTracker) {
                    performanceTracker.start();
                }
            } else {
                if (performanceTracker) {
                    performanceTracker.stop();
                }
            }
        });
    }

    /**
     * Update AR session state
     */
    function updateARSessionState(active) {
        this.state.isARActive = active;

        const controlPanel = document.getElementById('control-panel');
        const sizeControls = document.getElementById('size-controls');
        const modeIndicator = document.getElementById('ar-mode-indicator');

        if (controlPanel && sizeControls) {
            if (active) {
                controlPanel.classList.add('ar-active');
                sizeControls.classList.add('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '1';
                this.setUIVisibility(true);
                
                if (arManager && arManager.state && arManager.state.xrSession) {
                    xrSession = arManager.state.xrSession;
                }
            } else {
                controlPanel.classList.remove('ar-active');
                sizeControls.classList.remove('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '0';
                
                controlPanel.style.background = 'var(--bg-color)';
                controlPanel.style.padding = '10px';
                controlPanel.style.borderRadius = '30px';
                
                sizeControls.style.background = 'var(--bg-color)';
                sizeControls.style.padding = '10px';
                sizeControls.style.borderRadius = '20px';
                
                xrSession = null;
            }
        }
    }

    /**
     * Handle device orientation changes
     */
    function setupOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (uiManager) {
                    uiManager._adjustUIForScreen();
                }
                
                if (!xrSession) {
                    resetControlPanel();
                }
                
                if (performanceTracker) {
                    performanceTracker.options.deviceInfo.orientation = window.orientation || 0;
                    performanceTracker.reportToServer();
                }
            }, 300);
        });
    }

    /**
     * Enhance the UIManager with improved post-AR UI handling
     */
    function enhanceUIManager() {
        UIManager.prototype.fixPostARUI = function() {
            document.body.classList.remove('ar-mode');
            document.body.classList.add('normal-mode');
            
            const controlPanel = document.getElementById('control-panel');
            const sizeControls = document.getElementById('size-controls');
            
            if (controlPanel) {
                controlPanel.classList.add('post-ar-state');
                controlPanel.classList.add('exit-transition');
                controlPanel.classList.add('force-visible');
                
                setTimeout(() => {
                    controlPanel.classList.remove('exit-transition');
                    controlPanel.classList.remove('post-ar-state');
                }, 500);
            }
            
            if (sizeControls) {
                sizeControls.classList.add('post-ar-state');
                sizeControls.classList.add('exit-transition');
                sizeControls.classList.add('force-visible');
                
                setTimeout(() => {
                    sizeControls.classList.remove('exit-transition');
                    sizeControls.classList.remove('post-ar-state');
                }, 500);
            }
            
            this.setUIVisibility(true);
        };
        
        const originalUpdateARSessionState = UIManager.prototype.updateARSessionState;
        UIManager.prototype.updateARSessionState = function(active) {
            originalUpdateARSessionState.call(this, active);
            
            if (!active) {
                this.fixPostARUI();
            } else {
                document.body.classList.add('ar-mode');
                document.body.classList.remove('normal-mode');
            }
        };
    }

    // Initialize the application
    init();
    setupVisibilityHandler();
    setupOrientationHandler();
    enhanceUIManager();
});