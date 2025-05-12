/**
 * Main Application File
 * Initializes and manages the WebXR AR experience with world-locked capabilities
 */
document.addEventListener('DOMContentLoaded', () => {
    // Wait for document to be fully loaded
    console.log('Initializing World-Locked WebXR Experience...');
    
    // Global objects
    let arManager, uiManager, performanceTracker;
    let isLoading = true;
    
    // DOM elements
    const loadingScreen = document.getElementById('loading-screen');
    const startButton = document.getElementById('start-button');
    const placeBtn = document.getElementById('place-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const removeBtn = document.getElementById('remove-btn');
    const modelBtn = document.getElementById('model-btn');
    const sizeUpBtn = document.getElementById('size-up');
    const sizeDownBtn = document.getElementById('size-down');
    const arMessage = document.getElementById('ar-message');
    
    /**
     * Initialize the application
     */
    async function init() {
        try {
            // First check if WebXR is supported
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
            
            // Create UI Manager (handles all UI components)
            uiManager = new UIManager();
            uiManager.init();
            
            // Show loading message
            showNotification('Initializing World-Locked AR experience...', 3000);
            
            // Create Performance Tracker
            performanceTracker = new PerformanceTracker({
                showNotification: showNotification
            });
            
            // Create AR Manager with world-locked mode
            arManager = new ARManager({
                showNotification: showNotification
            });
            
            // Initialize AR components
            await arManager.init();
            
            // Update tracking quality periodically
            setInterval(updateTrackingQuality, 1000);
            
            // Setup event listeners
            setupEventListeners();
            
            // Show start button when ready
            startButton.style.display = 'block';
            
            // Show notification about world-locked mode
            showNotification('AR experience ready! World-locked mode active.', 5000);
            
            // Start performance tracking
            performanceTracker.start();
            
            console.log('World-Locked WebXR Experience initialized successfully');
        } catch (error) {
            console.error('Failed to initialize WebXR AR:', error);
            showNotification('Error initializing AR: ' + error.message, 5000);
            
            // Show error in loading screen
            if (arMessage) {
                arMessage.textContent = 'Error: ' + error.message;
                arMessage.style.color = '#f44336';
            }
        }
    }
    
    /**
     * Start the AR experience
     */
    function startExperience() {
        // Start the WebXR session
        arManager.startARSession();
        
        // Hide loading screen with animation
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                isLoading = false;
                
                // Show helpful instructions
                showNotification('Move your device to detect surfaces, tap to place objects', 5000);
            }, 500);
        }
    }
    
    /**
     * Update tracking quality based on FPS and hit test results
     */
    function updateTrackingQuality() {
        const fps = performanceTracker.metrics.fps;
        let quality = 'Unknown';
        
        // Get hit test results if available
        const hitTestResults = arManager.state ? arManager.state.xrHitTestResults : [];
        
        // Determine quality based on FPS and hit test results
        if (fps > 45 && hitTestResults && hitTestResults.length > 0) {
            quality = 'Excellent';
            performanceTracker.elements.tracking.style.color = '#4CAF50'; // Green
        } else if (fps > 30 && hitTestResults && hitTestResults.length > 0) {
            quality = 'Good';
            performanceTracker.elements.tracking.style.color = '#8BC34A'; // Light Green
        } else if (fps > 20) {
            quality = 'Fair';
            performanceTracker.elements.tracking.style.color = '#FFC107'; // Amber
        } else {
            quality = 'Poor';
            performanceTracker.elements.tracking.style.color = '#F44336'; // Red
        }
        
        performanceTracker.setTrackingQuality(quality);
    }
    
    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    function showNotification(message, duration = 3000) {
        if (uiManager) {
            uiManager.showNotification(message, duration);
        } else {
            // Fallback if UI manager isn't ready
            const notification = document.getElementById('ar-notification');
            if (notification) {
                notification.textContent = message;
                notification.style.opacity = '1';
                
                setTimeout(() => {
                    notification.style.opacity = '0';
                }, duration);
            }
        }
    }
    
    /**
     * Setup event listeners for UI controls
     */
    function setupEventListeners() {
        // Start button
        if (startButton) {
            startButton.addEventListener('click', startExperience);
        }
        
        // Place button
        if (placeBtn) {
            placeBtn.addEventListener('click', () => {
                arManager.placeObject();
            });
        }
        
        // Rotate button
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => {
                arManager.rotateObject(45);
            });
        }
        
        // Remove button
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                arManager.removeObject();
            });
        }
        
        // Model button
        if (modelBtn) {
            modelBtn.addEventListener('click', () => {
                arManager.nextModel();
            });
        }
        
        // Size up button
        if (sizeUpBtn) {
            sizeUpBtn.addEventListener('click', () => {
                arManager.increaseScale();
            });
        }
        
        // Size down button
        if (sizeDownBtn) {
            sizeDownBtn.addEventListener('click', () => {
                arManager.decreaseScale();
            });
        }
        
        // Handle device orientation changes
        window.addEventListener('orientationchange', () => {
            // Give time for the resize to complete
            setTimeout(() => {
                if (uiManager) {
                    uiManager._adjustUIForScreen();
                }
            }, 300);
        });
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (isLoading) return;
            
            switch (event.key) {
                case ' ':  // Space bar
                    arManager.placeObject();
                    break;
                case 'Delete':
                case 'Backspace':
                    arManager.removeObject();
                    break;
                case 'ArrowUp':
                    arManager.increaseScale();
                    break;
                case 'ArrowDown':
                    arManager.decreaseScale();
                    break;
                case 'r':
                case 'R':
                    arManager.rotateObject(45);
                    break;
                case 'm':
                case 'M':
                    arManager.nextModel();
                    break;
                case 'Escape':
                    // End AR session
                    arManager.endARSession();
                    break;
            }
        });
    }
    
    // Initialize the application
    init();
});