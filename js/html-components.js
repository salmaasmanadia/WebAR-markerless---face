/**
 * UI Manager for WebXR World-Locked AR Experience
 * Combines UI controls, screen responsiveness, help panels, and AR session management
 */
class UIManager {
    constructor() {
        this.elements = {
            startButton: null,
            removeButton: null,
            rotateButton: null,
            nextModelButton: null,
            clearButton: null,
            scaleUpButton: null,
            scaleDownButton: null,
            resetScaleButton: null,
            helpPanel: null,
            gotItButton: null,
            instructions: null
        };

        this.state = {
            helpShown: false,
            isARActive: false,
            notificationTimer: null,
            instructionTimeout: null
        };

        this._setupEventListeners();
    }

    init() {
        this._findElements();
        this._hideHelpPanel();
        this._setupARModeIndicator();
        this._setupInstructions();

        // Show help panel on first run
        if (!localStorage.getItem('ar-help-shown')) {
            this.showHelpPanel();
            localStorage.setItem('ar-help-shown', 'true');
        }

        this._adjustUIForScreen();
        console.log('UI Manager initialized');
    }

    _findElements() {
        this.elements.startButton = document.getElementById('start-ar');
        this.elements.removeButton = document.getElementById('remove-btn');
        this.elements.rotateButton = document.getElementById('rotate-btn');
        this.elements.nextModelButton = document.getElementById('next-model-btn');
        this.elements.clearButton = document.getElementById('clear-btn');
        this.elements.scaleUpButton = document.getElementById('scale-up-btn');
        this.elements.scaleDownButton = document.getElementById('scale-down-btn');
        this.elements.resetScaleButton = document.getElementById('reset-scale-btn');
        this.elements.helpPanel = document.getElementById('help-panel');
        this.elements.gotItButton = document.getElementById('got-it');
        this.elements.instructions = document.getElementById('instructions');
    }

    _setupEventListeners() {
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => this._startAR());
        }

        if (this.elements.removeButton) {
            this.elements.removeButton.addEventListener('click', () => window.arManager?.removeObject());
        }

        if (this.elements.rotateButton) {
            this.elements.rotateButton.addEventListener('click', () => window.arManager?.rotateObject());
        }

        if (this.elements.nextModelButton) {
            this.elements.nextModelButton.addEventListener('click', () => window.arManager?.nextModel());
        }

        if (this.elements.clearButton) {
            this.elements.clearButton.addEventListener('click', () => window.arManager?.clearObjects());
        }

        if (this.elements.scaleUpButton) {
            this.elements.scaleUpButton.addEventListener('click', () => window.arManager?.increaseScale());
        }

        if (this.elements.scaleDownButton) {
            this.elements.scaleDownButton.addEventListener('click', () => window.arManager?.decreaseScale());
        }

        if (this.elements.resetScaleButton) {
            this.elements.resetScaleButton.addEventListener('click', () => window.arManager?.resetScale());
        }

        if (this.elements.gotItButton) {
            this.elements.gotItButton.addEventListener('click', () => this._hideHelpPanel());
        }

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

        if (controlPanel && !document.getElementById('exit-ar-btn')) {
            const exitBtn = document.createElement('button');
            exitBtn.id = 'exit-ar-btn';
            exitBtn.className = 'control-button';
            exitBtn.title = 'Exit AR';
            exitBtn.innerHTML = '✕';
            exitBtn.addEventListener('click', () => window.arManager?.endARSession());
            controlPanel.appendChild(exitBtn);
        }

        window.addEventListener('resize', this._adjustUIForScreen.bind(this));
        this._setupTouchEvents();
    }

    _setupARModeIndicator() {
        if (!document.getElementById('ar-mode-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'ar-mode-indicator';
            indicator.className = 'ar-mode-indicator';
            indicator.innerHTML = '<span>World-Locked AR</span>';
            document.body.appendChild(indicator);

            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 5000);
        }
    }

    _setupInstructions() {
        if (!this.elements.instructions) return;

        this.state.instructionTimeout = setTimeout(() => {
            this.elements.instructions.style.opacity = '0';
            setTimeout(() => {
                this.elements.instructions.style.display = 'none';
            }, 500);
        }, 10000);
    }

    _setupTouchEvents() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (isIOS) {
            document.addEventListener('touchmove', (e) => {
                if (e.target.classList.contains('control-button')) return;
                e.preventDefault();
            }, { passive: false });

            const buttons = document.querySelectorAll('.control-button');
            buttons.forEach(button => {
                button.addEventListener('touchstart', e => e.target.classList.add('active'));
                button.addEventListener('touchend', e => e.target.classList.remove('active'));
            });
        }
    }

    _startAR() {
        if (this.elements.startButton) {
            this.elements.startButton.style.display = 'none';
        }

        this.showHelpPanel();

        if (window.arManager?.startARSession) {
            window.arManager.startARSession();
            this.state.isARActive = true;
            this.updateARSessionState(true);
        } else {
            this.showNotification('AR Manager not initialized');
        }
    }

    showHelpPanel() {
        const helpPanel = this.elements.helpPanel;
        if (helpPanel) {
            helpPanel.style.display = 'block';
            this.state.helpShown = true;

            setTimeout(() => this._hideHelpPanel(), 15000);
        }
    }

    _hideHelpPanel() {
        if (this.elements.helpPanel) {
            this.elements.helpPanel.style.display = 'none';
            this.state.helpShown = false;
        }
    }

    updateARSessionState(active) {
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
            } else {
                controlPanel.classList.remove('ar-active');
                sizeControls.classList.remove('ar-active');
                if (modeIndicator) modeIndicator.style.opacity = '0';
            }
        }
    }

    _adjustUIForScreen() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallScreen = window.innerWidth < 600;

        const controlPanel = document.getElementById('control-panel');
        const sizeControls = document.getElementById('size-controls');
        const instructions = document.getElementById('instructions');
        const performanceStats = document.getElementById('performance-stats');
        const modelInfo = document.getElementById('model-info');

        [controlPanel, sizeControls, performanceStats, modelInfo].forEach(el => {
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
        const ids = ['control-panel', 'size-controls', 'performance-stats', 'model-info', 'instructions'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = visible ? '1' : '0';
                el.style.pointerEvents = visible ? 'auto' : 'none';
            }
        });
    }

    toggleUIVisibility() {
        const controlPanel = document.getElementById('control-panel');
        const isVisible = controlPanel?.style.opacity !== '0';
        this.setUIVisibility(!isVisible);
    }

    showNotification(message, duration = 3000) {
        const notification = document.getElementById('ar-notification');
        if (!notification) return;

        if (this.state.notificationTimer) clearTimeout(this.state.notificationTimer);

        notification.textContent = message;
        notification.style.opacity = '1';

        this.state.notificationTimer = setTimeout(() => {
            notification.style.opacity = '0';
        }, duration);
    }
}

window.UIManager = UIManager;
