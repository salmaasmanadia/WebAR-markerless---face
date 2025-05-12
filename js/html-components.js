/**
 * HTML Components
 * Contains helper functions for managing UI components in WebXR world-locked AR
 */
class UIManager {
    constructor() {
        this.state = {
            helpShown: false,
            notificationTimer: null,
            isARActive: false
        };
        
        this._setupEventListeners();
    }
    
    /**
     * Initialize UI components
     */
    init() {
        this._hideHelpPanel();
        this._setupARModeIndicator();
        
        // Show help panel on first run
        if (!localStorage.getItem('ar-help-shown')) {
            this.showHelpPanel();
            localStorage.setItem('ar-help-shown', 'true');
        }
        
        // Adjust UI for current screen
        this._adjustUIForScreen();
    }
    
    /**
     * Set up AR mode indicator
     * @private
     */
    _setupARModeIndicator() {
        // Create a mode indicator if it doesn't exist
        if (!document.getElementById('ar-mode-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'ar-mode-indicator';
            indicator.className = 'ar-mode-indicator';
            indicator.innerHTML = '<span>World-Locked AR</span>';
            document.body.appendChild(indicator);
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 5000);
        }
    }
    
    /**
     * Update AR session state
     * @param {boolean} active - Whether AR session is active
     */
    updateARSessionState(active) {
        this.state.isARActive = active;
        
        // Update UI based on AR state
        const controlPanel = document.getElementById('control-panel');
        const sizeControls = document.getElementById('size-controls');
        const modeIndicator = document.getElementById('ar-mode-indicator');
        
        if (controlPanel && sizeControls) {
            if (active) {
                controlPanel.classList.add('ar-active');
                sizeControls.classList.add('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '1';
                
                // Ensure controls are visible when AR is active
                this.setUIVisibility(true);
            } else {
                controlPanel.classList.remove('ar-active');
                sizeControls.classList.remove('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '0';
            }
        }
    }
    
    /**
     * Show help panel
     */
    showHelpPanel() {
        const helpPanel = document.getElementById('help-panel');
        if (helpPanel) {
            helpPanel.style.display = 'block';
            this.state.helpShown = true;
        }
    }
    
    /**
     * Hide help panel
     * @private
     */
    _hideHelpPanel() {
        const helpPanel = document.getElementById('help-panel');
        if (helpPanel) {
            helpPanel.style.display = 'none';
            this.state.helpShown = false;
        }
    }
    
    /**
     * Show notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, duration = 3000) {
        const notification = document.getElementById('ar-notification');
        if (!notification) return;
        
        // Clear previous timer
        if (this.state.notificationTimer) {
            clearTimeout(this.state.notificationTimer);
        }
        
        // Update and show notification
        notification.textContent = message;
        notification.style.opacity = '1';
        
        // Set timer to hide
        this.state.notificationTimer = setTimeout(() => {
            notification.style.opacity = '0';
        }, duration);
    }
    
    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Handle "Got it" button in help panel
        const gotItBtn = document.getElementById('got-it');
        if (gotItBtn) {
            gotItBtn.addEventListener('click', () => {
                this._hideHelpPanel();
            });
        }
        
        // Add help button in UI if it doesn't exist
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel && !document.getElementById('help-btn')) {
            const helpBtn = document.createElement('button');
            helpBtn.id = 'help-btn';
            helpBtn.className = 'control-button';
            helpBtn.title = 'Help';
            helpBtn.innerHTML = '<span style="font-size: 18px;">?</span>';
            helpBtn.addEventListener('click', () => this.showHelpPanel());
            controlPanel.appendChild(helpBtn);
        }
        
        // Add exit AR button if it doesn't exist
        if (controlPanel && !document.getElementById('exit-ar-btn')) {
            const exitBtn = document.createElement('button');
            exitBtn.id = 'exit-ar-btn';
            exitBtn.className = 'control-button';
            exitBtn.title = 'Exit AR';
            exitBtn.innerHTML = '✕';
            exitBtn.addEventListener('click', () => {
                // Find AR manager in global scope and end session
                if (window.arManager && typeof window.arManager.endARSession === 'function') {
                    window.arManager.endARSession();
                }
            });
            controlPanel.appendChild(exitBtn);
        }
        
        // Handle resize events to adjust UI
        window.addEventListener('resize', this._adjustUIForScreen.bind(this));
    }
    
    /**
     * Adjust UI based on screen size and orientation
     * @private
     */
    _adjustUIForScreen() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallScreen = window.innerWidth < 600;
        
        // Get UI elements
        const controlPanel = document.getElementById('control-panel');
        const sizeControls = document.getElementById('size-controls');
        const instructions = document.getElementById('instructions');
        const performanceStats = document.getElementById('performance-stats');
        const modelInfo = document.getElementById('model-info');
        
        if (controlPanel && sizeControls) {
            // Adjust for landscape vs portrait
            if (isLandscape) {
                controlPanel.classList.add('landscape');
                sizeControls.classList.add('landscape');
                
                if (performanceStats) {
                    performanceStats.classList.add('landscape');
                }
                
                if (modelInfo) {
                    modelInfo.classList.add('landscape');
                }
            } else {
                controlPanel.classList.remove('landscape');
                sizeControls.classList.remove('landscape');
                
                if (performanceStats) {
                    performanceStats.classList.remove('landscape');
                }
                
                if (modelInfo) {
                    modelInfo.classList.remove('landscape');
                }
            }
        }
        
        if (instructions) {
            // Adjust instructions based on screen size
            instructions.className = '';
            if (isSmallScreen) instructions.classList.add('small-screen');
            if (isLandscape) instructions.classList.add('landscape');
        }
    }
    
    /**
     * Update UI visibility
     * @param {boolean} visible - Whether UI should be visible
     */
    setUIVisibility(visible) {
        const elements = [
            'control-panel',
            'size-controls',
            'performance-stats',
            'model-info',
            'instructions'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.opacity = visible ? '1' : '0';
                element.style.pointerEvents = visible ? 'auto' : 'none';
            }
        });
    }
    
    /**
     * Toggle UI visibility
     */
    toggleUIVisibility() {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            const isVisible = controlPanel.style.opacity !== '0';
            this.setUIVisibility(!isVisible);
        }
    }
}

// Export the UI Manager
window.UIManager = UIManager;