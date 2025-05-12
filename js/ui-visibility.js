/**
 * AR UI Visibility Manager
 * Comprehensive solution for AR UI layout and visibility issues
 */

(function() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Store original positions of UI elements
        const originalStyles = {};
        
        // Elements that need special positioning in AR mode
        const arUIElements = [
            'control-panel',
            'size-controls',
            'model-info',
            'performance-stats',
            'ar-mode-indicator',
            'instructions',
            'help-panel',
            'ar-notification',
            'ar-overlay',
            'reticle-container',
            'start-button'
        ];
        
        // Save original styles
        arUIElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                originalStyles[id] = {
                    position: element.style.position,
                    top: element.style.top,
                    left: element.style.left,
                    bottom: element.style.bottom,
                    right: element.style.right,
                    zIndex: element.style.zIndex,
                    transform: element.style.transform,
                    display: element.style.display,
                    opacity: element.style.opacity,
                    pointerEvents: element.style.pointerEvents
                };
            }
        });

        // Function to ensure proper AR button visibility
        function ensureARButtonVisibility() {
            const startButton = document.getElementById('start-button');
            if (startButton) {
                // Ensure the button is visible and clickable
                startButton.style.display = 'block';
                startButton.style.position = 'fixed';
                startButton.style.top = '50%';
                startButton.style.left = '50%';
                startButton.style.transform = 'translate(-50%, -50%)';
                startButton.style.zIndex = '3000'; // Very high z-index
                startButton.style.opacity = '1';
                startButton.style.pointerEvents = 'auto';
                startButton.style.backgroundColor = '#4CAF50';
                startButton.style.color = 'white';
                startButton.style.padding = '15px 25px';
                startButton.style.border = 'none';
                startButton.style.borderRadius = '5px';
                startButton.style.fontSize = '16px';
                startButton.style.cursor = 'pointer';
                startButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                
                // Make sure loading screen is behind the button
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.style.zIndex = '2500';
                }
            }
        }
        
        // Function to properly position UI elements in AR mode
        function applyARUILayout() {
            // Reset the z-index stacking context
            document.body.style.position = 'relative';
            document.body.style.overflow = 'hidden';
            
            // Make sure any existing canvas is properly positioned
            const rendererCanvas = document.querySelector('canvas');
            if (rendererCanvas) {
                rendererCanvas.style.position = 'absolute';
                rendererCanvas.style.top = '0';
                rendererCanvas.style.left = '0';
                rendererCanvas.style.width = '100%';
                rendererCanvas.style.height = '100%';
                rendererCanvas.style.zIndex = '1';
            }
            
            // Ensure AR overlay doesn't block touches
            const arOverlay = document.getElementById('ar-overlay');
            if (arOverlay) {
                arOverlay.style.position = 'absolute';
                arOverlay.style.top = '0';
                arOverlay.style.left = '0';
                arOverlay.style.width = '100%';
                arOverlay.style.height = '100%';
                arOverlay.style.pointerEvents = 'none';
                arOverlay.style.zIndex = '1800';
            }
            
            // Position each UI element properly
            const elementsPositioning = {
                'control-panel': { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: '2000', display: 'flex' },
                'size-controls': { position: 'fixed', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: '2000', display: 'flex' },
                'model-info': { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: '2000', display: 'block' },
                'performance-stats': { position: 'fixed', top: '10px', left: '10px', zIndex: '2000', display: 'block' },
                'ar-mode-indicator': { position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: '2000', display: 'block' },
                'instructions': { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '1900', display: 'block', pointerEvents: 'none' },
                'help-panel': { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '2500', display: 'none' },
                'reticle-container': { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '1900', pointerEvents: 'none' },
                'ar-notification': { position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)', zIndex: '2100', display: 'block' }
            };
            
            // Apply positioning to elements
            Object.keys(elementsPositioning).forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    Object.assign(element.style, elementsPositioning[id]);
                }
            });
            
            // Ensure control buttons have correct pointer events
            const controlButtons = document.querySelectorAll('.control-button, button');
            controlButtons.forEach(button => {
                button.style.pointerEvents = 'auto';
                button.style.zIndex = '2200';
            });
            
            // Make sure the help panel is properly styled but hidden by default
            const helpPanel = document.getElementById('help-panel');
            if (helpPanel) {
                helpPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                helpPanel.style.color = 'white';
                helpPanel.style.padding = '20px';
                helpPanel.style.borderRadius = '10px';
                helpPanel.style.maxWidth = '80%';
                helpPanel.style.maxHeight = '80%';
                helpPanel.style.overflow = 'auto';
                
                // Make sure the "Got it" button is visible
                const gotItButton = document.getElementById('got-it');
                if (gotItButton) {
                    gotItButton.style.display = 'block';
                    gotItButton.style.margin = '20px auto 0';
                    gotItButton.style.padding = '10px 20px';
                }
            }
            
            // Make sure the start button is always visible
            ensureARButtonVisibility();
        }
        
        // Function to restore original UI positions
        function restoreOriginalLayout() {
            arUIElements.forEach(id => {
                const element = document.getElementById(id);
                if (element && originalStyles[id]) {
                    Object.assign(element.style, originalStyles[id]);
                }
            });
        }
        
        // Create a global toggle function for help panel
        window.toggleHelpPanel = function() {
            const helpPanel = document.getElementById('help-panel');
            if (helpPanel) {
                if (helpPanel.style.display === 'none' || !helpPanel.style.display) {
                    helpPanel.style.display = 'block';
                } else {
                    helpPanel.style.display = 'none';
                }
            }
        };
        
        // Set up help panel toggling
        const gotItButton = document.getElementById('got-it');
        if (gotItButton) {
            gotItButton.addEventListener('click', function() {
                const helpPanel = document.getElementById('help-panel');
                if (helpPanel) {
                    helpPanel.style.display = 'none';
                }
            });
        }
        
        // Patch the ARManager's startARSession method if it exists
        if (window.ARManager) {
            const originalStartARSession = ARManager.prototype.startARSession;
            
            ARManager.prototype.startARSession = async function() {
                try {
                    // Apply enhanced UI layout before starting the session
                    document.body.classList.add('ar-mode-active');
                    applyARUILayout();
                    
                    // Call the original method
                    const result = await originalStartARSession.apply(this, arguments);
                    
                    // Set up a periodic check to maintain UI layout
                    if (window.arUILayoutInterval) {
                        clearInterval(window.arUILayoutInterval);
                    }
                    window.arUILayoutInterval = setInterval(applyARUILayout, 2000);
                    
                    return result;
                } catch (error) {
                    console.error('Error starting AR session:', error);
                    
                    // Handle permission errors specially
                    if (error.name === 'NotAllowedError') {
                        if (this.options && this.options.showNotification) {
                            this.options.showNotification('Camera permission denied. Please allow camera access.', 5000);
                        }
                    }
                    
                    throw error;
                }
            };
            
            // Also patch the session end method to clean up
            const originalEndSession = ARManager.prototype.endARSession;
            
            ARManager.prototype.endARSession = function() {
                // Clear the layout interval if it exists
                if (window.arUILayoutInterval) {
                    clearInterval(window.arUILayoutInterval);
                    window.arUILayoutInterval = null;
                }
                
                // Remove AR mode class
                document.body.classList.remove('ar-mode-active');
                
                // Restore original layout
                restoreOriginalLayout();
                
                return originalEndSession.apply(this, arguments);
            };
        }
        
        // Apply initial fixes - make sure Enter AR button is visible
        setTimeout(ensureARButtonVisibility, 500);
        
        // Set up a listener for the start button to ensure AR layout is applied
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', function() {
                // This will be called before the AR session starts
                setTimeout(applyARUILayout, 100);
            });
        }
        
        // Clean up any existing intervals on page unload
        window.addEventListener('beforeunload', function() {
            if (window.arUILayoutInterval) {
                clearInterval(window.arUILayoutInterval);
                window.arUILayoutInterval = null;
            }
        });
    });
})();