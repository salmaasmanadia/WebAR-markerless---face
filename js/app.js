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
    
    // Communicate AR state to UI manager
    if (uiManager) {
        uiManager.state.isARActive = true;
    }
    
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
    
    // Apply AR-specific classes to body for global CSS targeting
    document.body.classList.add('ar-mode-active');
}

/**
 * Ensure UI visibility in AR mode
 */
function ensureUIVisibility() {
    const isARActive = arManager && arManager.state && arManager.state.isARActive;
    
    if (isARActive) {
        // Force UI visibility
        const controlPanel = document.getElementById('control-panel');
        const sizeControls = document.getElementById('size-controls');
        
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.opacity = '1';
            controlPanel.style.pointerEvents = 'auto';
            controlPanel.classList.add('display-force');
        }
        
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.opacity = '1';
            sizeControls.style.pointerEvents = 'auto';
            sizeControls.classList.add('display-force');
        }
        
        // Add classes to other UI elements
        const uiElements = [
            'model-info', 'instructions', 'performance-stats'
        ];
        
        uiElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'block';
                element.style.opacity = '1';
                element.classList.add('display-force');
            }
        });
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
        // Add AR UI class
        placeBtn.classList.add('ar-ui-element');
    }
    
    // Rotate button
    if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
            arManager.rotateObject(45);
        });
        // Add AR UI class
        rotateBtn.classList.add('ar-ui-element');
    }
    
    // Remove button
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            arManager.removeObject();
        });
        // Add AR UI class
        removeBtn.classList.add('ar-ui-element');
    }
    
    // Model button
    if (modelBtn) {
        modelBtn.addEventListener('click', () => {
            arManager.nextModel();
        });
        // Add AR UI class
        modelBtn.classList.add('ar-ui-element');
    }
    
    // Size up button
    if (sizeUpBtn) {
        sizeUpBtn.addEventListener('click', () => {
            arManager.increaseScale();
        });
        // Add AR UI class
        sizeUpBtn.classList.add('ar-ui-element');
    }
    
    // Size down button
    if (sizeDownBtn) {
        sizeDownBtn.addEventListener('click', () => {
            arManager.decreaseScale();
        });
        // Add AR UI class
        sizeDownBtn.classList.add('ar-ui-element');
    }
    
    // Add periodic visibility check to ensure UI stays visible
    setInterval(ensureUIVisibility, 2000);
    
    // Handle device orientation changes
    window.addEventListener('orientationchange', () => {
        // Give time for the resize to complete
        setTimeout(() => {
            if (uiManager) {
                uiManager._adjustUIForScreen();
                // Re-ensure UI visibility after orientation change
                ensureUIVisibility();
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
                // Remove AR mode class
                document.body.classList.remove('ar-mode-active');
                break;
        }
    });
}
    
    // Initialize the application
    init();
    addRestartARButton();
});