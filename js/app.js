/**
 * World-Locked WebXR AR Application
 * Clean and optimized main application file
 */

class ARApplication {
    constructor() {
        this.arManager = null;
        this.uiManager = null;
        this.performanceTracker = null;
        this.xrSession = null;
        this.webGLContext = null;
        this.isLoading = true;
        this.trackingInterval = null;
        this.isTrackingActive = false;
        
        // Cache DOM elements
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            startButton: document.getElementById('start-ar'),
            exitButton: document.getElementById('exit-ar'),
            placeBtn: document.getElementById('place-btn'),
            rotateBtn: document.getElementById('rotate-btn'),
            removeBtn: document.getElementById('remove-btn'),
            modelBtn: document.getElementById('next-model-btn'),
            sizeUpBtn: document.getElementById('scale-up-btn'),
            sizeDownBtn: document.getElementById('scale-down-btn'),
            arMessage: document.getElementById('ar-message'),
            controlPanel: document.getElementById('control-panel'),
            sizeControls: document.getElementById('size-controls'),
            arOverlay: document.getElementById('ar-overlay')
        };
    }

    /**
     * Initialize the AR application
     */
    async init() {
        try {
            await this.checkWebXRSupport();
            await this.initializeManagers();
            this.setupEventListeners();
            this.setupIntervalUpdates();
            this.finishInitialization();
            
            console.log('World-Locked WebXR Experience initialized successfully');
        } catch (error) {
            this.handleInitError(error);
        }
    }

    /**
     * Check WebXR support
     */
    async checkWebXRSupport() {
        if (!navigator.xr) {
            throw new Error('WebXR not supported in this browser');
        }
        
        const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isArSupported) {
            throw new Error('WebXR AR not supported on this device');
        }
        
        this.elements.arMessage.textContent = 'AR is supported! Click Enter AR to begin.';
    }

    /**
     * Initialize all managers
     */
    async initializeManagers() {
        // Initialize UI Manager
        this.uiManager = new UIManager();
        this.uiManager.init();
        this.uiManager.showNotification('Initializing World-Locked AR experience...', 3000);

        // Create WebGL context for performance tracking
        const tempCanvas = document.createElement('canvas');
        this.webGLContext = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');

        // Initialize Performance Tracker
        this.performanceTracker = new PerformanceTracker({
            reportURL: 'https://script.google.com/macros/s/AKfycbzJujiVxqZtuuk7UrJABKsQLLvAiZn5yCgQiHqMAE_GGo8DirByTRbiu8_3phlSf2I/exec',
            deviceInfo: {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                devicePixelRatio: window.devicePixelRatio,
                arMode: 'world-locked'
            },
            showNotification: (msg, dur) => this.uiManager.showNotification(msg, dur),
            webGLContext: this.webGLContext,
            captureSpectorFrames: 5
        });

        // Initialize AR Manager
        this.arManager = new ARManager({
            showNotification: (msg, dur) => this.uiManager.showNotification(msg, dur),
            performanceTracker: this.performanceTracker
        });

        await this.arManager.init();

        // Update WebGL context with actual renderer context
        if (this.arManager.state?.renderer) {
            const actualContext = this.arManager.state.renderer.getContext();
            this.performanceTracker.options.webGLContext = actualContext;
            if (this.performanceTracker._setupSpector) {
                this.performanceTracker._setupSpector();
            }
        }
    }

    /**
     * Setup interval updates
     */
    setupIntervalUpdates() {
        // Don't start interval here - wait for AR session
    }

    /**
     * Finish initialization
     */
    finishInitialization() {
        this.elements.startButton.style.display = 'block';
        this.uiManager.showNotification('AR experience ready! World-locked mode active.', 5000);
        // Don't start tracking yet - wait for AR session to begin
    }

    /**
     * Handle initialization errors
     */
    handleInitError(error) {
        console.error('Failed to initialize WebXR AR:', error);
        this.uiManager?.showNotification('Error initializing AR: ' + error.message, 5000);

        if (this.elements.arMessage) {
            this.elements.arMessage.textContent = 'Error: ' + error.message;
            this.elements.arMessage.style.color = '#f44336';
        }
    }

    /**
     * Start AR experience
     */
    startExperience() {
        document.body.classList.add('ar-mode');
        document.body.classList.remove('normal-mode');
        
        // Start performance tracking when AR session begins
        this.isTrackingActive = true;
        this.performanceTracker.start();
        
        // Start tracking quality updates interval
        this.trackingInterval = setInterval(() => this.updateTrackingQuality(), 1000);
        
        this.performanceTracker.markObjectLoadStart('ar-session');
        this.arManager.startARSession();
        
        this.elements.exitButton.style.display = 'block';
        this.elements.startButton.style.display = 'none';

        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.style.opacity = '0';
            setTimeout(() => {
                this.elements.loadingScreen.style.display = 'none';
                this.isLoading = false;
                
                this.performanceTracker.markObjectAppeared('ar-session');
                this.uiManager.showNotification('Move your device to detect surfaces, tap to place objects', 5000);
            }, 500);
        }
    }

    /**
     * Exit AR mode
     */
    exitARMode() {
        if (!this.arManager?.state?.xrSession) {
            console.warn('No active AR session to end');
            this.resetUI();
            return;
        }

        console.log('Ending AR session properly...');
        const session = this.arManager.state.xrSession;
        
        // Stop tracking and clear interval
        this.isTrackingActive = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        this.performanceTracker.stop();
        this.performanceTracker.reportToServer();
        
        session.end().then(() => {
            console.log('AR session ended successfully');
            this.cleanupARSession();
            this.resetUI();
            this.uiManager.showNotification('AR session ended', 2000);
        }).catch(err => {
            console.error('Error ending AR session:', err);
            this.resetUI();
        });
    }

    /**
     * Cleanup AR session state
     */
    cleanupARSession() {
        if (this.arManager?.state) {
            this.arManager.state.xrSession = null;
            this.arManager.state.xrHitTestSource = null;
            this.arManager.state.renderer.setAnimationLoop(null);
        }
        
        this.xrSession = null;
        document.body.classList.remove('ar-mode');
        document.body.classList.add('normal-mode');
        
        this.elements.exitButton.style.display = 'none';
        this.elements.startButton.style.display = 'block';
        
        if (this.uiManager) {
            this.uiManager.updateARSessionState(false);
        }
    }

    /**
     * Reset UI to normal state
     */
    resetUI() {
        console.log('Resetting UI...');
        
        document.body.classList.remove('ar-mode');
        document.body.classList.add('normal-mode');
        
        // Reset control elements
        const elementsToReset = [
            'control-panel', 'size-controls', 'performance-stats', 
            'model-info', 'instructions', 'ar-overlay', 'reticle-container'
        ];
        
        elementsToReset.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('ar-active', 'display-force', 'post-ar-state', 'exit-transition');
                element.style.pointerEvents = 'auto';
                element.style.opacity = '1';
                element.style.zIndex = '1000';
            }
        });

        this.resetControlPanel();
        this.resetSizeControls();
        
        if (this.elements.arOverlay) {
            this.elements.arOverlay.style.display = 'none';
        }
        
        // Force reflow
        document.body.offsetHeight;
        console.log('UI reset complete');
    }

    /**
     * Reset control panel styles
     */
    resetControlPanel() {
        if (!this.elements.controlPanel) return;
    }

    /**
     * Reset size controls styles
     */
    resetSizeControls() {
        if (!this.elements.sizeControls) return;
    }

    /**
     * Update tracking quality
     */
    updateTrackingQuality() {
        // Only update if tracking is active
        if (!this.isTrackingActive || !this.performanceTracker || !this.arManager?.state?.xrSession) {
            return;
        }

        const fps = this.performanceTracker.metrics.fps;
        const hitTestResults = this.arManager.state?.xrHitTestResults || [];
        const surfacesCount = hitTestResults.length;
        
        this.performanceTracker.setSurfacesDetected(surfacesCount);
        
        let quality, color;
        if (fps > 45 && surfacesCount > 0) {
            quality = 'Excellent';
            color = '#4CAF50';
        } else if (fps > 30 && surfacesCount > 0) {
            quality = 'Good';
            color = '#8BC34A';
        } else if (fps > 20) {
            quality = 'Fair';
            color = '#FFC107';
        } else {
            quality = 'Poor';
            color = '#F44336';
        }

        if (this.performanceTracker.elements?.tracking) {
            this.performanceTracker.elements.tracking.style.color = color;
        }
        
        this.performanceTracker.setTrackingQuality(quality, surfacesCount > 0 ? 1.0 : 0.5);
    }

    /**
     * Place object with performance tracking
     */
    placeObject() {
        if (!this.isTrackingActive) return;
        
        const objId = `placed-object-${Date.now()}`;
        this.performanceTracker.markObjectLoadStart(objId);
        this.arManager.placeObject();
        setTimeout(() => this.performanceTracker.markObjectAppeared(objId), 100);
    }

    /**
     * Change model with performance tracking
     */
    changeModel() {
        // Always allow model change, but only track performance if in AR mode
        if (this.isTrackingActive) {
            const modelId = `model-change-${Date.now()}`;
            this.performanceTracker.markObjectLoadStart(modelId);
            this.arManager.nextModel();
            setTimeout(() => this.performanceTracker.markObjectAppeared(modelId), 200);
        } else {
            // Just change model without performance tracking
            this.arManager.nextModel();
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Button event listeners
        this.elements.startButton?.addEventListener('click', () => this.startExperience());
        this.elements.exitButton?.addEventListener('click', () => this.exitARMode());
        this.elements.placeBtn?.addEventListener('click', () => this.placeObject());
        this.elements.rotateBtn?.addEventListener('click', () => this.arManager.rotateObject(45));
        this.elements.removeBtn?.addEventListener('click', () => this.arManager.removeObject());
        this.elements.modelBtn?.addEventListener('click', () => this.changeModel());
        this.elements.sizeUpBtn?.addEventListener('click', () => this.arManager.increaseScale());
        this.elements.sizeDownBtn?.addEventListener('click', () => this.arManager.decreaseScale());

        // Keyboard controls
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        
        // Orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.uiManager?._adjustUIForScreen();
                if (!this.xrSession) this.resetControlPanel();
                // Only report orientation change if tracking is active
                if (this.performanceTracker && this.isTrackingActive) {
                    this.performanceTracker.options.deviceInfo.orientation = window.orientation || 0;
                    this.performanceTracker.reportToServer();
                }
            }, 300);
        });

        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.resetUI();
                if (!this.xrSession && this.uiManager) {
                    this.uiManager.updateARSessionState(false);
                }
                // Only restart tracking if we're in AR mode and tracking was active
                if (this.arManager?.state?.xrSession && this.isTrackingActive) {
                    this.performanceTracker?.start();
                }
            } else {
                // Only stop tracking if it was active
                if (this.isTrackingActive) {
                    this.performanceTracker?.stop();
                }
            }
        });
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(event) {
        if (this.isLoading) return;

        const keyActions = {
            ' ': () => this.placeObject(),
            'Delete': () => this.arManager.removeObject(),
            'Backspace': () => this.arManager.removeObject(),
            'ArrowUp': () => this.arManager.increaseScale(),
            'ArrowDown': () => this.arManager.decreaseScale(),
            'r': () => this.arManager.rotateObject(45),
            'R': () => this.arManager.rotateObject(45),
            'm': () => this.changeModel(),
            'M': () => this.changeModel(),
            'Escape': () => this.exitARMode(),
            'p': () => {
                if (this.isTrackingActive) {
                    this.performanceTracker.reportToServer();
                    this.uiManager.showNotification('Performance data reported', 2000);
                } else {
                    this.uiManager.showNotification('No active AR session to report', 2000);
                }
            },
            'P': () => {
                if (this.isTrackingActive) {
                    this.performanceTracker.reportToServer();
                    this.uiManager.showNotification('Performance data reported', 2000);
                } else {
                    this.uiManager.showNotification('No active AR session to report', 2000);
                }
            }
        };

        const action = keyActions[event.key];
        if (action) {
            event.preventDefault();
            action();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing World-Locked WebXR Experience...');
    const app = new ARApplication();
    app.init();
});