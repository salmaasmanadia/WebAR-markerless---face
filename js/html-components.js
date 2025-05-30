/**
 * UI Manager for WebXR World-Locked AR Experience
 * Manages UI controls, screen responsiveness, help panels, and AR session state
 */
class UIManager {
    constructor() {
        this.elements = {
            startButton: null,
            removeButton: null,
            nextModelButton: null,
            clearButton: null,
            scaleUpButton: null,
            scaleDownButton: null,
            instructions: null
        };

        this.state = {
            helpShown: false,
            isARActive: false,
            notificationTimer: null,
            instructionTimeout: null
        };

        this.config = {
            instructionDisplayDuration: 7000,
            instructionFadeOutDuration: 500,
            defaultNotificationDuration: 2000
        };
    }

    /**
     * Initialize the UI Manager
     */
    init() {
        this._findElements();
        this._setupEventListeners();
        this._adjustUIForScreen();
        this._setupResizeHandler();
        console.log('UI Manager initialized');
    }

    /**
     * Find and cache DOM elements
     * @private
     */
    _findElements() {
        const elementIds = {
            startButton: 'start-ar',
            removeButton: 'remove-btn',
            nextModelButton: 'next-model-btn',
            clearButton: 'clear-btn',
            scaleUpButton: 'scale-up-btn',
            scaleDownButton: 'scale-down-btn',
            instructions: 'instructions'
        };

        Object.keys(elementIds).forEach(key => {
            this.elements[key] = document.getElementById(elementIds[key]);
        });
    }

    /**
     * Setup event listeners for UI controls
     * @private
     */
    _setupEventListeners() {
        const buttonActions = {
            removeButton: 'removeObject',
            nextModelButton: 'nextModel',
            clearButton: 'clearObjects',
            scaleUpButton: 'increaseScale',
            scaleDownButton: 'decreaseScale'
        };

        Object.entries(buttonActions).forEach(([buttonKey, action]) => {
            const button = this.elements[buttonKey];
            if (button) {
                button.addEventListener('click', () => {
                    this._callARManagerMethod(action);
                });
            }
        });
    }

    /**
     * Setup window resize handler
     * @private
     */
    _setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this._adjustUIForScreen();
            }, 100);
        });
    }

    /**
     * Call AR Manager method safely
     * @private
     * @param {string} methodName - Method name to call
     */
    _callARManagerMethod(methodName) {
        if (window.arManager && typeof window.arManager[methodName] === 'function') {
            window.arManager[methodName]();
        } else {
            console.warn(`AR Manager method '${methodName}' not available`);
        }
    }

    /**
     * Update AR session state and adjust UI accordingly
     * @param {boolean} active - Whether AR session is active
     */
    updateARSessionState(active) {
        this.state.isARActive = active;

        const elements = {
            controlPanel: document.getElementById('control-panel'),
            modeIndicator: document.getElementById('ar-mode-indicator'),
            instructionsPanel: this.elements.instructions
        };

        if (active) {
            this._activateARMode(elements);
        } else {
            this._deactivateARMode(elements);
        }
    }

    /**
     * Activate AR mode UI
     * @private
     * @param {Object} elements - DOM elements
     */
    _activateARMode(elements) {
        const { controlPanel, modeIndicator, instructionsPanel } = elements;

        if (controlPanel) controlPanel.classList.add('ar-active');
        if (modeIndicator) modeIndicator.style.opacity = '1';
        
        this._showInstructions(instructionsPanel);
        this.setUIVisibility(true);
    }

    /**
     * Deactivate AR mode UI
     * @private
     * @param {Object} elements - DOM elements
     */
    _deactivateARMode(elements) {
        const { controlPanel, modeIndicator, instructionsPanel } = elements;

        if (controlPanel) controlPanel.classList.remove('ar-active');
        if (modeIndicator) modeIndicator.style.opacity = '0';
        
        this._hideInstructions(instructionsPanel);
    }

    /**
     * Show instructions panel temporarily
     * @private
     * @param {HTMLElement} instructionsPanel - Instructions panel element
     */
    _showInstructions(instructionsPanel) {
        if (!instructionsPanel) return;

        instructionsPanel.style.display = 'block';
        instructionsPanel.style.opacity = '1';
        
        // Clear existing timeout
        if (this.state.instructionTimeout) {
            clearTimeout(this.state.instructionTimeout);
        }

        // Set auto-hide timeout
        this.state.instructionTimeout = setTimeout(() => {
            if (instructionsPanel) {
                instructionsPanel.style.opacity = '0';
                setTimeout(() => { 
                    instructionsPanel.style.display = 'none';
                }, this.config.instructionFadeOutDuration);
            }
        }, this.config.instructionDisplayDuration);
    }

    /**
     * Hide instructions panel
     * @private
     * @param {HTMLElement} instructionsPanel - Instructions panel element
     */
    _hideInstructions(instructionsPanel) {
        if (instructionsPanel) {
            instructionsPanel.style.display = 'none';
            instructionsPanel.style.opacity = '0';
        }
    }

    /**
     * Adjust UI layout based on screen size and orientation
     * @private
     */
    _adjustUIForScreen() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallScreen = window.innerWidth < 600;

        this._adjustPanelLayout(isLandscape);
        this._adjustInstructionsLayout(isSmallScreen, isLandscape);
    }

    /**
     * Adjust panel layout for different orientations
     * @private
     * @param {boolean} isLandscape - Whether screen is in landscape mode
     */
    _adjustPanelLayout(isLandscape) {
        const panelIds = ['control-panel', 'performance-stats', 'model-info'];
        
        panelIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('landscape', isLandscape);
            }
        });
    }

    /**
     * Adjust instructions layout for different screen sizes
     * @private
     * @param {boolean} isSmallScreen - Whether screen is small
     * @param {boolean} isLandscape - Whether screen is in landscape mode
     */
    _adjustInstructionsLayout(isSmallScreen, isLandscape) {
        const instructions = this.elements.instructions;
        if (!instructions) return;

        instructions.className = '';
        if (isSmallScreen) instructions.classList.add('small-screen');
        if (isLandscape) instructions.classList.add('landscape');
    }

    /**
     * Set UI visibility
     * @param {boolean} visible - Whether UI should be visible
     */
    setUIVisibility(visible) {
        const uiElements = ['control-panel', 'performance-stats', 'model-info'];
        
        uiElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;

            if (id === 'control-panel') {
                this._setControlPanelVisibility(element, visible);
            } else {
                this._setElementVisibility(element, visible);
            }
        });
    }

    /**
     * Set control panel visibility with special AR mode handling
     * @private
     * @param {HTMLElement} element - Control panel element
     * @param {boolean} visible - Whether element should be visible
     */
    _setControlPanelVisibility(element, visible) {
        const shouldShow = visible || !this.state.isARActive;
        element.style.opacity = shouldShow ? '1' : '0';
        element.style.pointerEvents = shouldShow ? 'auto' : 'none';
    }

    /**
     * Set element visibility
     * @private
     * @param {HTMLElement} element - Element to modify
     * @param {boolean} visible - Whether element should be visible
     */
    _setElementVisibility(element, visible) {
        element.style.opacity = visible ? '1' : '0';
        element.style.pointerEvents = visible ? 'auto' : 'none';
    }

    /**
     * Toggle UI visibility
     */
    toggleUIVisibility() {
        const controlPanel = document.getElementById('control-panel');
        const isCurrentlyVisible = controlPanel ? (controlPanel.style.opacity !== '0') : false;
        this.setUIVisibility(!isCurrentlyVisible);
    }

    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {number} duration - Display duration in milliseconds
     */
    showNotification(message, duration = this.config.defaultNotificationDuration) {
        const notification = document.getElementById('ar-notification');
        
        if (!notification) {
            console.warn('Notification element #ar-notification not found');
            return;
        }

        // Clear existing notification timer
        if (this.state.notificationTimer) {
            clearTimeout(this.state.notificationTimer);
        }

        // Show notification
        notification.textContent = message;
        notification.style.opacity = '1';
        notification.classList.add('visible');

        // Set auto-hide timer
        this.state.notificationTimer = setTimeout(() => {
            notification.style.opacity = '0';
            notification.classList.remove('visible');
        }, duration);
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Clear timers
        if (this.state.notificationTimer) {
            clearTimeout(this.state.notificationTimer);
        }
        if (this.state.instructionTimeout) {
            clearTimeout(this.state.instructionTimeout);
        }

        // Reset state
        this.state = {
            helpShown: false,
            isARActive: false,
            notificationTimer: null,
            instructionTimeout: null
        };

        console.log('UI Manager destroyed');
    }
}

// Export to global scope
window.UIManager = UIManager;