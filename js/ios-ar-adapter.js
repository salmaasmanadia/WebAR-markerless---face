/**
 * iOS AR Adapter
 * This adapter ensures compatibility with iOS devices for WebXR AR experiences.
 */

(function() {
    // Check if the device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        // Override the requestSession method to handle iOS specific behavior
        const originalRequestSession = navigator.xr.requestSession;

        navigator.xr.requestSession = async function(sessionType, options) {
            // Check if the session type is immersive-ar
            if (sessionType === 'immersive-ar') {
                // Add any iOS specific options or modifications here
                options = options || {};
                options.requiredFeatures = options.requiredFeatures || [];
                
                // Ensure 'hit-test' is included in required features
                if (!options.requiredFeatures.includes('hit-test')) {
                    options.requiredFeatures.push('hit-test');
                }
            }

            // Call the original requestSession method
            return originalRequestSession.call(this, sessionType, options);
        };
    }
})();
