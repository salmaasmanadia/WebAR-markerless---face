/**
 * AR Camera Access Fix
 * Ensures camera can be properly accessed in AR mode and fixes UI layering issues
 */

(function() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Function to clean up duplicate UI elements
        function cleanupDuplicateElements() {
            // List of element IDs that should be unique
            const elementIdsToCheck = [
                'control-panel',
                'size-controls',
                'model-info',
                'performance-stats',
                'ar-mode-indicator',
                'instructions',
                'help-panel',
                'ar-notification',
                'ar-overlay',
                'reticle-container'
            ];
            
            // Check for and remove duplicate elements
            elementIdsToCheck.forEach(id => {
                const elements = document.querySelectorAll(`#${id}`);
                if (elements.length > 1) {
                    // Keep only the first instance of each element
                    for (let i = 1; i < elements.length; i++) {
                        elements[i].parentNode.removeChild(elements[i]);
                    }
                }
            });
        }
        
        // Function to ensure camera access is not blocked by UI elements
        function ensureCameraAccess() {
            // First clean up any duplicate elements that might cause issues
            cleanupDuplicateElements();
            
            // Ensure the canvas is layered properly
            const rendererCanvas = document.querySelector('canvas');
            if (rendererCanvas) {
                // Add class for styling
                rendererCanvas.classList.add('xr-canvas');
                
                // Make sure it's positioned at the back
                rendererCanvas.style.position = 'absolute';
                rendererCanvas.style.top = '0';
                rendererCanvas.style.left = '0';
                rendererCanvas.style.width = '100%';
                rendererCanvas.style.height = '100%';
                rendererCanvas.style.zIndex = '1';
                
                // Ensure it's the first child of body for proper layering
                const body = document.body;
                if (body.firstChild !== rendererCanvas) {
                    body.insertBefore(rendererCanvas, body.firstChild);
                }
            }
            
            // Make sure the Enter AR button is always visible
            const startButton = document.getElementById('start-button');
            if (startButton) {
                startButton.style.display = 'block';
                startButton.style.position = 'fixed';
                startButton.style.top = '50%';
                startButton.style.left = '50%';
                startButton.style.transform = 'translate(-50%, -50%)';
                startButton.style.zIndex = '3000'; // Very high z-index
                startButton.style.pointerEvents = 'auto';
                startButton.style.backgroundColor = '#4CAF50';
                startButton.style.color = 'white';
                startButton.style.padding = '15px 25px';
                startButton.style.border = 'none';
                startButton.style.borderRadius = '5px';
                startButton.style.fontSize = '16px';
                startButton.style.cursor = 'pointer';
                startButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }
            
            // Ensure AR overlay doesn't block touches
            const arOverlay = document.getElementById('ar-overlay');
            if (arOverlay) {
                arOverlay.style.pointerEvents = 'none';
                arOverlay.style.touchAction = 'none';
                arOverlay.style.position = 'absolute';
                arOverlay.style.zIndex = '1800';
            }
            
            // Ensure specific elements are configured to avoid blocking camera interactions
            const nonBlockingElements = [
                'instructions',
                'ar-mode-indicator',
                'performance-stats',
                'model-info',
                'ar-notification',
                'reticle-container'
            ];
            
            nonBlockingElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.pointerEvents = 'none';
                    element.style.touchAction = 'none';
                }
            });
            
            // Ensure control buttons have correct pointer events
            const controlButtons = document.querySelectorAll('.control-button, button');
            controlButtons.forEach(button => {
                button.style.pointerEvents = 'auto';
                button.style.zIndex = '2500'; // High z-index to ensure they're clickable
            });
            
            // Fix loading screen position
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.position = 'fixed';
                loadingScreen.style.top = '0';
                loadingScreen.style.left = '0';
                loadingScreen.style.width = '100%';
                loadingScreen.style.height = '100%';
                loadingScreen.style.zIndex = '2000';
                loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                loadingScreen.style.display = 'flex';
                loadingScreen.style.flexDirection = 'column';
                loadingScreen.style.justifyContent = 'center';
                loadingScreen.style.alignItems = 'center';
                loadingScreen.style.color = 'white';
                loadingScreen.style.textAlign = 'center';
            }
            
            // Fix AR notification visibility
            const arNotification = document.getElementById('ar-notification');
            if (arNotification) {
                arNotification.style.position = 'fixed';
                arNotification.style.bottom = '120px';
                arNotification.style.left = '50%';
                arNotification.style.transform = 'translateX(-50%)';
                arNotification.style.zIndex = '2500';
                arNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                arNotification.style.color = 'white';
                arNotification.style.padding = '10px 20px';
                arNotification.style.borderRadius = '5px';
            }
            
            // Fix AR message visibility
            const arMessage = document.getElementById('ar-message');
            if (arMessage) {
                arMessage.style.margin = '20px 0';
                arMessage.style.fontSize = '16px';
                arMessage.style.fontWeight = 'bold';
            }
        }

        // Run clean-up once at the beginning
        setTimeout(cleanupDuplicateElements, 100);
        
        // Patch the ARManager's startARSession method if it exists
        if (window.ARManager) {
            const originalStartARSession = ARManager.prototype.startARSession;
            
            ARManager.prototype.startARSession = async function() {
                try {
                    // Clean up duplicate elements before starting the session
                    cleanupDuplicateElements();
                    
                    // Call the original method
                    const result = await originalStartARSession.apply(this, arguments);
                    
                    // Fix camera access
                    setTimeout(ensureCameraAccess, 300);
                    
                    // Set up a periodic check to maintain camera access
                    if (window.arCameraCheckInterval) {
                        clearInterval(window.arCameraCheckInterval);
                    }
                    const cameraCheckInterval = setInterval(ensureCameraAccess, 2000);
                    window.arCameraCheckInterval = cameraCheckInterval;
                    
                    return result;
                } catch (error) {
                    console.error('Error starting AR session:', error);
                    
                    // Check if there's a permissions issue
                    if (error.name === 'NotAllowedError') {
                        // Show a user-friendly message
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
                // Clear the camera check interval if it exists
                if (window.arCameraCheckInterval) {
                    clearInterval(window.arCameraCheckInterval);
                    window.arCameraCheckInterval = null;
                }
                
                return originalEndSession.apply(this, arguments);
            };
        }
        
        // Apply initial fixes
        setTimeout(ensureCameraAccess, 500);
        
        // Clean up any existing intervals on page unload
        window.addEventListener('beforeunload', function() {
            if (window.arCameraCheckInterval) {
                clearInterval(window.arCameraCheckInterval);
                window.arCameraCheckInterval = null;
            }
        });
    });
})();