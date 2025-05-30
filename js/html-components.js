/**
 * UI Manager for WebXR World-Locked AR Experience
 * Combines UI controls, screen responsiveness, help panels, and AR session management
 */
class UIManager {
    constructor() {
        this.elements = {
            startButton: null,
            removeButton: null,
            nextModelButton: null,
            clearButton: null,
            scaleUpButton: null,
            scaleDownButton: null
        };

        this.state = {
            helpShown: false,
            isARActive: false,
            notificationTimer: null,
            instructionTimeout: null
        };
    }

    init() {
        this._findElements();
        this._setupEventListeners();
        this._adjustUIForScreen();
        console.log('UI Manager initialized');
    }

    _findElements() {
        this.elements.startButton = document.getElementById('start-ar');
        this.elements.removeButton = document.getElementById('remove-btn');
        this.elements.nextModelButton = document.getElementById('next-model-btn');
        this.elements.clearButton = document.getElementById('clear-btn');
        this.elements.scaleUpButton = document.getElementById('scale-up-btn');
        this.elements.scaleDownButton = document.getElementById('scale-down-btn');
    }

    _setupEventListeners() {
        // Remove button event listener
        if (this.elements.removeButton) {
            this.elements.removeButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.removeObject === 'function') {
                    window.arManager.removeObject();
                }
            });
        }

        // Next model button event listener
        if (this.elements.nextModelButton) {
            this.elements.nextModelButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.nextModel === 'function') {
                    window.arManager.nextModel();
                }
            });
        }

        // Clear button event listener
        if (this.elements.clearButton) {
            this.elements.clearButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.clearObjects === 'function') {
                    window.arManager.clearObjects();
                }
            });
        }

        // Scale up button event listener
        if (this.elements.scaleUpButton) {
            this.elements.scaleUpButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.increaseScale === 'function') {
                    window.arManager.increaseScale();
                }
            });
        }

        // Scale down button event listener
        if (this.elements.scaleDownButton) {
            this.elements.scaleDownButton.addEventListener('click', () => {
                if (window.arManager && typeof window.arManager.decreaseScale === 'function') {
                    window.arManager.decreaseScale();
                }
            });
        }
    }

    updateARSessionState(active) {
        this.state.isARActive = active;

        const controlPanel = document.getElementById('control-panel');
        const modeIndicator = document.getElementById('ar-mode-indicator');
        const instructionsPanel = this.elements.instructions;

        if (active) {
            if (controlPanel) controlPanel.classList.add('ar-active');
            if (modeIndicator) modeIndicator.style.opacity = '1';
            
            if (instructionsPanel) {
                instructionsPanel.style.display = 'block';
                instructionsPanel.style.opacity = '1';
                
                if (this.state.instructionTimeout) clearTimeout(this.state.instructionTimeout);
                this.state.instructionTimeout = setTimeout(() => {
                    if (instructionsPanel) {
                        instructionsPanel.style.opacity = '0';
                        setTimeout(() => { 
                            instructionsPanel.style.display = 'none';
                        }, 500);
                    }
                }, 7000);
            }
            
            this.setUIVisibility(true);
        } else {
            if (controlPanel) controlPanel.classList.remove('ar-active');
            if (modeIndicator) modeIndicator.style.opacity = '0';
            
            if (instructionsPanel) {
                instructionsPanel.style.display = 'none';
                instructionsPanel.style.opacity = '0';
            }
        }
    }

    _adjustUIForScreen() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallScreen = window.innerWidth < 600;

        const controlPanel = document.getElementById('control-panel');
        const instructions = this.elements.instructions;
        const performanceStats = document.getElementById('performance-stats');
        const modelInfo = document.getElementById('model-info');

        [controlPanel, performanceStats, modelInfo].forEach(el => {
            if (!el) return;
            
            if (isLandscape) {
                el.classList.add('landscape');
            } else {
                el.classList.remove('landscape');
            }
        });

        if (instructions) {
            instructions.className = '';
            if (isSmallScreen) instructions.classList.add('small-screen');
            if (isLandscape) instructions.classList.add('landscape');
        }
    }

    setUIVisibility(visible) {
        const ids = ['control-panel', 'performance-stats', 'model-info'];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'control-panel') {
                    el.style.opacity = visible ? '1' : (this.state.isARActive ? '0' : '1');
                    el.style.pointerEvents = visible ? 'auto' : (this.state.isARActive ? 'none' : 'auto');
                } else {
                    el.style.opacity = visible ? '1' : '0';
                    el.style.pointerEvents = visible ? 'auto' : 'none';
                }
            }
        });
    }

    toggleUIVisibility() {
        const controlPanel = document.getElementById('control-panel');
        const isCurrentlyVisible = controlPanel ? (controlPanel.style.opacity !== '0') : false;
        this.setUIVisibility(!isCurrentlyVisible);
    }

    showNotification(message, duration = 2000) {
        const notification = document.getElementById('ar-notification');
        if (!notification) {
            console.warn("Elemen #ar-notification tidak ditemukan oleh UIManager.");
            return;
        }

        if (this.state.notificationTimer) clearTimeout(this.state.notificationTimer);

        notification.textContent = message;
        notification.style.opacity = '1';
        notification.classList.add('visible');

        this.state.notificationTimer = setTimeout(() => {
            notification.style.opacity = '0';
            notification.classList.remove('visible');
        }, duration);
    }
}

window.UIManager = UIManager;