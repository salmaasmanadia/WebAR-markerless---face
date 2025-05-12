/**
 * AR UI Visibility Fix
 * This patch ensures that UI controls remain visible during AR sessions
 * Add this code to your project to fix the disappearing UI issue
 */

// Immediately invoked function to avoid polluting global scope
(function() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
      // Check if we're already in an AR session
      const isInAR = document.querySelector('.ar-active') !== null;
      
      // Function to force UI visibility in AR mode
      function forceUIVisibility() {
        const elementsToShow = [
          'control-panel',
          'size-controls',
          'model-info',
          'performance-stats',
          'ar-mode-indicator',
          'instructions',
          'help-btn',
          'exit-ar-btn'
        ];
        
        // Show all required elements
        elementsToShow.forEach(id => {
          const element = document.getElementById(id);
          if (element) {
            element.style.display = id.includes('controls') ? 'flex' : 'block';
            element.style.opacity = '1';
            element.style.pointerEvents = 'auto';
            element.style.zIndex = '2000'; // Ensure it's above AR canvas
          }
        });
      }
      
      // Apply the fix when entering AR mode
      function fixARUIVisibility() {
        // First fix: Run immediately
        forceUIVisibility();
        
        // Second fix: Keep checking for hidden UI and restore it
        const visibilityInterval = setInterval(forceUIVisibility, 1000);
        
        // Store the interval ID to clear it when AR session ends
        window.arUIVisibilityInterval = visibilityInterval;
        
        // Add three-finger touch to toggle UI (backup method)
        document.addEventListener('touchstart', function(event) {
          if (event.touches.length === 3) {
            // Toggle UI elements
            const controlPanel = document.getElementById('control-panel');
            const isVisible = controlPanel?.style.opacity !== '0';
            
            elementsToShow.forEach(id => {
              const element = document.getElementById(id);
              if (element) {
                element.style.opacity = isVisible ? '0' : '1';
                element.style.pointerEvents = isVisible ? 'none' : 'auto';
              }
            });
            
            event.preventDefault();
          }
        });
      }
      
      // Patch the ARManager's startARSession method
      if (window.ARManager) {
        const originalStartARSession = ARManager.prototype.startARSession;
        
        ARManager.prototype.startARSession = async function() {
          // Call the original method
          const result = await originalStartARSession.apply(this, arguments);
          
          // Apply our UI visibility fix after a short delay
          setTimeout(fixARUIVisibility, 500);
          
          return result;
        };
        
        // Also patch the session end method to clean up
        const originalEndSession = ARManager.prototype.endARSession;
        
        ARManager.prototype.endARSession = function() {
          // Clear the visibility interval if it exists
          if (window.arUIVisibilityInterval) {
            clearInterval(window.arUIVisibilityInterval);
            window.arUIVisibilityInterval = null;
          }
          
          return originalEndSession.apply(this, arguments);
        };
      }
      
      // Patch the UIManager's updateARSessionState method
      if (window.UIManager) {
        const originalUpdateARSessionState = UIManager.prototype.updateARSessionState;
        
        UIManager.prototype.updateARSessionState = function(active) {
          // Call the original method
          originalUpdateARSessionState.apply(this, arguments);
          
          // If entering AR mode, apply our fix
          if (active) {
            setTimeout(fixARUIVisibility, 500);
          }
        };
      }
      
      // If we're already in AR mode, apply the fix immediately
      if (isInAR) {
        fixARUIVisibility();
      }
    });
  })();