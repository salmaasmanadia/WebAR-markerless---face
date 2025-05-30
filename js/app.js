/**
 * Main Application File (Combined and Optimized)
 * Initializes and manages the WebXR AR experience with world-locked capabilities
 * Integrated with enhanced PerformanceTracker for advanced metrics
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing World-Locked WebXR Experience...');

    let arManager, uiManager, performanceTracker;
    let isLoading = true;
    let xrSession = null; // To store the AR session
    let webGLContext = null; // To store the WebGL context for performance monitoring
    let isARModeActive = false; // Untuk melacak status mode AR

    // DOM Element References
    const loadingScreen = document.getElementById('loading-screen');
    const startButton = document.getElementById('start-ar');
    // const exitButton = document.getElementById('exit-ar');
    // const placeBtn = document.getElementById('place-btn');
    // const rotateBtn = document.getElementById('rotate-btn');
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
            // Check if WebXR is supported
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

            // Initialize UI Manager
            uiManager = new UIManager();
            uiManager.init();
            uiManager.showNotification('Initializing World-Locked AR experience...', 3000);

            // Create a temporary WebGL context for performance tracking
            const tempCanvas = document.createElement('canvas');
            webGLContext = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');

            // Initialize Performance Tracker with WebGL context for GPU monitoring
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
                webGLContext: webGLContext, // Pass WebGL context for Spector.js monitoring
                captureSpectorFrames: 5 // Limit frames captured to reduce overhead
            });

            // Initialize AR Manager
            arManager = new ARManager({
                showNotification: (msg, dur) => uiManager.showNotification(msg, dur),
                performanceTracker: performanceTracker // Pass performance tracker to AR manager
            });

            await arManager.init();

            // After init, update the WebGL context with the actual renderer context
            if (arManager.state && arManager.state.renderer) {
                const actualContext = arManager.state.renderer.getContext();
                // Update the performance tracker with the actual WebGL context
                performanceTracker.options.webGLContext = actualContext;
                // Re-init Spector with the correct context if needed
                if (performanceTracker._setupSpector) {
                    performanceTracker._setupSpector();
                }
            }

            // Setup update intervals and event listeners
            setInterval(updateTrackingQuality, 1000);
            setupEventListeners();
            setupPerformanceVisibilityHandler();

            // Show AR start button and notification
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

/**
 * Properly end an AR session and restore Enter AR button
 */
function exitARMode() {
    console.log('Exiting AR mode...');
    isARModeActive = false; // Set status mode AR ke false

    if (arManager && arManager.state && arManager.state.xrSession) {
        console.log('Ending AR session and stopping performance tracking...');
        const session = arManager.state.xrSession;

        // Stop performance tracking
        if (performanceTracker) {
            performanceTracker.stop();
            performanceTracker.reportToServer();
            console.log("Performance tracking stopped and data reported for AR session.");
        }

        // End XR session properly
        session.end().then(() => {
            console.log('AR session ended successfully');
            
            // Reset AR Manager state
            if (arManager) {
                arManager.state.xrSession = null;
                arManager.state.xrHitTestSource = null;
                arManager.state.renderer.setAnimationLoop(null);
            }
            
            // Reset UI completely and show Enter AR button
            resetUIAfterARExit();
            
            // Notify UI manager of session end
            if (uiManager) {
                uiManager.updateARSessionState(false);
                uiManager.showNotification('AR session ended. You can start AR again!', 3000);
            }
            
        }).catch(err => {
            console.error('Error ending AR session:', err);
            // Even if there's an error, still reset the UI
            resetUIAfterARExit();
        });
    } else {
        console.warn('No active AR session to end.');
        // If tracker might still be running due to unexpected conditions
        if (performanceTracker && performanceTracker.reportingInterval) {
            performanceTracker.stop();
            performanceTracker.reportToServer();
            console.log("Performance tracking stopped (no active AR session but was running).");
        }
        resetUIAfterARExit();
    }
}

/**
 * Reset UI specifically after exiting AR mode
 */
function resetUIAfterARExit() {
    console.log('Resetting UI after AR exit...');
    
    // Remove AR mode class from body
    document.body.classList.remove('ar-mode');
    document.body.classList.add('normal-mode');
    
    // Show Start AR button and hide Exit AR button
    const startButton = document.getElementById('start-ar');
    const exitButton = document.getElementById('exit-ar');
    
    if (startButton) {
        startButton.style.display = 'block';
        startButton.style.visibility = 'visible';
        startButton.style.opacity = '1';
        startButton.disabled = false;
        console.log('Start AR button restored');
    }
    
    if (exitButton) {
        exitButton.style.display = 'none';
    }
    
    // Hide loading screen if it's still visible
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        loadingScreen.style.opacity = '0';
    }
    
    // Reset AR message to ready state
    const arMessage = document.getElementById('ar-message');
    if (arMessage) {
        arMessage.textContent = 'AR is ready! Click Enter AR to begin.';
        arMessage.style.color = '#4CAF50'; // Green color for ready state
    }
    
    // Reset control panel to normal mode
    const controlPanel = document.getElementById('control-panel');
    if (controlPanel) {
        controlPanel.classList.remove('ar-active');
        controlPanel.style.display = 'flex';
        controlPanel.style.flexDirection = 'row';
        controlPanel.style.position = 'fixed';
        controlPanel.style.bottom = '20px';
        controlPanel.style.left = '50%';
        controlPanel.style.transform = 'translateX(-50%)';
        controlPanel.style.gap = '10px';
        controlPanel.style.background = 'var(--bg-color)';
        controlPanel.style.padding = '10px';
        controlPanel.style.borderRadius = '30px';
        controlPanel.style.opacity = '1';
        controlPanel.style.visibility = 'visible';
        controlPanel.style.pointerEvents = 'auto';
        controlPanel.style.zIndex = '1000';
    }
    
    // Reset size controls
    const sizeControls = document.getElementById('size-controls');
    if (sizeControls) {
        sizeControls.classList.remove('ar-active');
        sizeControls.style.display = 'flex';
        sizeControls.style.flexDirection = 'column';
        sizeControls.style.position = 'fixed';
        sizeControls.style.right = '20px';
        sizeControls.style.top = '50%';
        sizeControls.style.transform = 'translateY(-50%)';
        sizeControls.style.gap = '15px';
        sizeControls.style.background = 'var(--bg-color)';
        sizeControls.style.padding = '10px';
        sizeControls.style.borderRadius = '20px';
        sizeControls.style.opacity = '1';
        sizeControls.style.visibility = 'visible';
        sizeControls.style.pointerEvents = 'auto';
    }
    
    // Hide AR overlay elements
    const arOverlay = document.getElementById('ar-overlay');
    if (arOverlay) {
        arOverlay.style.display = 'none';
    }
    
    // Hide performance stats or move them to a less prominent position
    const performanceStats = document.getElementById('performance-stats');
    if (performanceStats) {
        performanceStats.style.opacity = '0.7'; // Make it less prominent
        performanceStats.style.fontSize = '12px';
    }
    
    // Reset any AR-specific UI elements
    document.querySelectorAll('.ar-ui-element').forEach(el => {
        el.classList.remove('display-force');
        el.classList.remove('ar-active');
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
    });
    
    // Reset reticle container
    const reticleContainer = document.getElementById('reticle-container');
    if (reticleContainer) {
        reticleContainer.style.display = 'none';
    }
    
    // Clear any session references
    xrSession = null;
    
    // Force a reflow to ensure styles are applied
    document.body.offsetHeight;
    
    console.log('UI reset complete - Enter AR button should be visible');
}

/**
 * Improved resetUICompletely function with Enter AR button restoration
 */
function resetUICompletely() {
    console.log('Resetting UI completely...');
    
    // Remove any AR-specific classes from body
    document.body.classList.remove('ar-mode');
    document.body.classList.add('normal-mode');
    
    // CRITICAL: Show the Start AR button so user can enter AR again
    const startButton = document.getElementById('start-ar');
    const exitButton = document.getElementById('exit-ar');
    
    if (startButton) {
        startButton.style.display = 'block';
        startButton.style.visibility = 'visible';
        startButton.style.opacity = '1';
        startButton.disabled = false;
        console.log('✅ Start AR button restored and enabled');
    } else {
        console.warn('⚠️ Start AR button not found!');
    }
    
    if (exitButton) {
        exitButton.style.display = 'none';
    }
    
    // Reset AR message to ready state
    const arMessage = document.getElementById('ar-message');
    if (arMessage) {
        arMessage.textContent = 'AR experience ready! Click Enter AR to begin.';
        arMessage.style.color = '#4CAF50';
    }
    
    // Elements to reset
    const elementsToReset = [
        'control-panel',
        'size-controls',
        'performance-stats',
        'model-info',
        'instructions',
        'ar-overlay',
        'reticle-container'
    ];
    
    // Reset each element with appropriate styles
    elementsToReset.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Remove any AR-specific classes
            element.classList.remove('ar-active');
            element.classList.remove('display-force');
            element.classList.remove('post-ar-state');
            element.classList.remove('exit-transition');
            
            // Enable pointer events
            element.style.pointerEvents = 'auto';
            element.style.opacity = '1';
            element.style.zIndex = '1000';
            element.style.visibility = 'visible';
        }
    });
    
    // Reset control panel specifically
    const controlPanel = document.getElementById('control-panel');
    if (controlPanel) {
        controlPanel.style.display = 'flex';
        controlPanel.style.flexDirection = 'row';
        controlPanel.style.position = 'fixed';
        controlPanel.style.bottom = '20px';
        controlPanel.style.left = '50%';
        controlPanel.style.transform = 'translateX(-50%)';
        controlPanel.style.gap = '10px';
        controlPanel.style.background = 'var(--bg-color)';
        controlPanel.style.padding = '10px';
        controlPanel.style.borderRadius = '30px';
    }
    
    // Reset size controls specifically
    const sizeControls = document.getElementById('size-controls');
    if (sizeControls) {
        sizeControls.style.display = 'flex';
        sizeControls.style.flexDirection = 'column';
        sizeControls.style.position = 'fixed';
        sizeControls.style.right = '20px';
        sizeControls.style.top = '50%';
        sizeControls.style.transform = 'translateY(-50%)';
        sizeControls.style.gap = '15px';
        sizeControls.style.background = 'var(--bg-color)';
        sizeControls.style.padding = '10px';
        sizeControls.style.borderRadius = '20px';
    }
    
    // Hide AR overlay elements
    const arOverlay = document.getElementById('ar-overlay');
    if (arOverlay) {
        arOverlay.style.display = 'none';
    }
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        loadingScreen.style.opacity = '0';
    }
    
    // Reset any other specific styles that might be causing issues
    document.querySelectorAll('.ar-ui-element').forEach(el => {
        el.classList.remove('display-force');
        el.style.opacity = '1';
    });
    
    // Clear session reference
    xrSession = null;
    
    // Force a reflow to ensure styles are applied
    document.body.offsetHeight;
    
    console.log('✅ UI reset complete - Enter AR should be available');
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
            // Only start performance tracking if we're actually in AR mode
            if (isARModeActive) {
                performanceTracker.start();
                console.log("Performance tracking resumed due to page visibility change (visible in AR mode).");
            } else {
                // If not in AR mode, ensure Enter AR button is available
                ensureEnterARAvailable();
            }
        }
    });
}

/**
 * Helper function to ensure Enter AR button is always available when not in AR
 */
async function startExperience() {
    console.log('Starting AR experience...');
    
    // Hide start button immediately to prevent double-clicking
    if (startButton) {
        startButton.style.display = 'none';
    }
    
    // Show loading screen
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
    }
    
    // Update AR message
    if (arMessage) {
        arMessage.textContent = 'Starting AR session...';
        arMessage.style.color = '#2196F3'; // Blue color for loading
    }
    
    document.body.classList.add('ar-mode');
    isLoading = true;

    try {
        await arManager.startARSession();
        console.log('AR session started successfully.');

        isARModeActive = true; // Set status mode AR
        
        // Start performance tracking if page is visible
        if (performanceTracker && !document.hidden) {
            performanceTracker.start();
            console.log("Performance tracking started for AR session.");
        }

        // Show exit button if it exists
        const exitButtonElement = document.getElementById('exit-ar');
        if (exitButtonElement) {
            exitButtonElement.style.display = 'block';
        }

        // Hide loading screen with animation
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                isLoading = false;
                if (uiManager) {
                    uiManager.showNotification('Move your device to detect surfaces, tap to place objects', 5000);
                }
            }, 500);
        }
        
        // Update AR message for active state
        if (arMessage) {
            arMessage.textContent = 'AR session active - Press ESC to exit';
            arMessage.style.color = '#4CAF50'; // Green for active
        }
        
    } catch (error) {
        console.error('Failed to start AR session:', error);
        
        // Reset everything if AR failed to start
        isARModeActive = false;
        document.body.classList.remove('ar-mode');
        
        // Show start button again
        if (startButton) {
            startButton.style.display = 'block';
        }
        
        // Hide exit button
        const exitButtonElement = document.getElementById('exit-ar');
        if (exitButtonElement) {
            exitButtonElement.style.display = 'none';
        }
        
        // Hide loading screen
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
            loadingScreen.style.opacity = '0';
        }
        
        // Update AR message with error
        if (arMessage) {
            arMessage.textContent = 'Failed to start AR. Please try again.';
            arMessage.style.color = '#f44336'; // Red for error
        }
        
        // Show error notification
        if (uiManager) {
            uiManager.showNotification('Error starting AR: ' + error.message, 5000);
        }
        
        isLoading = false;
    }
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
        }

        // if (exitButton) {
        //     exitButton.addEventListener('click', exitARMode);
        // }

        // if (placeBtn) {
        //     placeBtn.addEventListener('click', () => {
        //         // Use performance tracking for object placement
        //         const objId = `placed-object-${Date.now()}`;
        //         performanceTracker.markObjectLoadStart(objId);
                
        //         arManager.placeObject();
                
        //         // Mark when object appears (give a small delay for rendering)
        //         setTimeout(() => {
        //             performanceTracker.markObjectAppeared(objId);
        //         }, 100);
        //     });
        // }

        // if (rotateBtn) {
        //     rotateBtn.addEventListener('click', () => arManager.rotateObject(45));
        // }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => arManager.removeObject());
        }

        if (modelBtn) {
            modelBtn.addEventListener('click', () => {
                // Track model change timing
                const modelId = `model-change-${Date.now()}`;
                performanceTracker.markObjectLoadStart(modelId);
                
                arManager.nextModel();
                
                // Mark when model appears (give a small delay for rendering)
                setTimeout(() => {
                    performanceTracker.markObjectAppeared(modelId);
                }, 200);
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

        document.addEventListener('keydown', (event) => {
            if (isLoading) return;

            switch (event.key) {
                // case ' ':
                //     const objId = `placed-object-${Date.now()}`;
                //     performanceTracker.markObjectLoadStart(objId);
                //     arManager.placeObject();
                //     setTimeout(() => performanceTracker.markObjectAppeared(objId), 100);
                //     break;
                case 'Delete':
                case 'Backspace':
                    arManager.removeObject(); break;
                case 'ArrowUp':
                    arManager.increaseScale(); break;
                case 'ArrowDown':
                    arManager.decreaseScale(); break;
                // case 'r':
                // case 'R':
                //     arManager.rotateObject(45); break;
                case 'm':
                case 'M':
                    const modelId = `model-change-${Date.now()}`;
                    performanceTracker.markObjectLoadStart(modelId);
                    arManager.nextModel();
                    setTimeout(() => performanceTracker.markObjectAppeared(modelId), 200);
                    break;
                case 'Escape':
                    exitARMode(); break;
                case 'p':
                case 'P':
                    // Debug function: Force performance data report
                    performanceTracker.reportToServer();
                    uiManager.showNotification('Performance data reported', 2000);
                    break;
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
        // Reset control panel
        resetControlPanel();
        
        // Reset other UI elements
        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.opacity = '1';
        }
        
        // Reset AR overlay
        const arOverlay = document.getElementById('ar-overlay');
        if (arOverlay) {
            if (!arManager || !arManager.state || !arManager.state.xrSession) {
                arOverlay.style.display = 'none';
            }
        }
    }

    /**
     * Handle document visibility changes to fix UI when app becomes active again
     */
    function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // If the app returns to foreground, ensure UI displays correctly
                resetUI();
                
                // If not in an AR session, restore normal UI
                if (!xrSession) {
                    resetControlPanel();
                    if (uiManager) {
                        uiManager.updateARSessionState(false);
                    }
                }
                
                // Resume performance tracking
                if (performanceTracker) {
                    performanceTracker.start();
                }
            } else {
                // When app goes to background, pause tracking
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
                
                // Update XR session reference
                if (arManager && arManager.state && arManager.state.xrSession) {
                    xrSession = arManager.state.xrSession;
                }
            } else {
                // When AR session ends
                controlPanel.classList.remove('ar-active');
                sizeControls.classList.remove('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '0';
                
                // Add styles back
                controlPanel.style.background = 'var(--bg-color)';
                controlPanel.style.padding = '10px';
                controlPanel.style.borderRadius = '30px';
                
                sizeControls.style.background = 'var(--bg-color)';
                sizeControls.style.padding = '10px';
                sizeControls.style.borderRadius = '20px';
                
                // Clear session reference
                xrSession = null;
            }
        }
    }

    /**
     * Handle device orientation changes better
     */
    function setupOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            // Wait a bit for orientation to actually change
            setTimeout(() => {
                if (uiManager) {
                    uiManager._adjustUIForScreen();
                }
                
                // If not in an AR session, ensure UI displays correctly
                if (!xrSession) {
                    resetControlPanel();
                }
                
                // Send orientation change to performance tracker
                if (performanceTracker) {
                    performanceTracker.options.deviceInfo.orientation = window.orientation || 0;
                    // Report after orientation change as this can affect performance
                    performanceTracker.reportToServer();
                }
            }, 300);
        });
    }

    /**
     * Enhance the UIManager with improved post-AR UI handling
     */
    function enhanceUIManager() {
        // Ensure UI remains visible after exiting AR
        UIManager.prototype.fixPostARUI = function() {
            document.body.classList.remove('ar-mode');
            document.body.classList.add('normal-mode');
            
            const controlPanel = document.getElementById('control-panel');
            const sizeControls = document.getElementById('size-controls');
            
            if (controlPanel) {
                controlPanel.classList.add('post-ar-state');
                controlPanel.classList.add('exit-transition');
                controlPanel.classList.add('force-visible');
                
                // Remove transition classes after animation completes
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
            
            // Ensure all UI elements are visible
            this.setUIVisibility(true);
        };
        
        // Override the updateARSessionState method
        const originalUpdateARSessionState = UIManager.prototype.updateARSessionState;
        UIManager.prototype.updateARSessionState = function(active) {
            originalUpdateARSessionState.call(this, active);
            
            if (!active) {
                // Call the new method when exiting AR mode
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