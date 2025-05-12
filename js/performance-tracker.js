/**
 * Performance Tracker
 * Tracks performance metrics for WebXR world-locked AR including FPS, latency, memory usage,
 * tracking quality, and sends data to Google Sheets
 */
class PerformanceTracker {
    constructor(options) {
        // Default options
        this.options = Object.assign({
            updateInterval: 500,      // How often to update metrics (in ms)
            reportInterval: 10000,    // How often to send data to server (in ms)
            reportURL: 'https://script.google.com/macros/s/AKfycbxGm4iKUITMc9VZkIOBfIWSJIYoaChr-1i_-60fXJClgc0KECPRWFdQozNtjArJzdAjHw/exec',
            maxLatencySamples: 30,    // How many latency samples to keep
            deviceInfo: {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                devicePixelRatio: window.devicePixelRatio,
                arMode: 'world-locked' // Added AR mode indicator
            },
            showNotification: null    // Notification function
        }, options);

        // Performance metrics
        this.metrics = {
            fps: 0,
            frameCount: 0,
            latency: 0,
            memory: 0,
            trackingQuality: 'Initializing',
            trackingConfidence: 0,  // Added tracking confidence metric
            surfacesDetected: 0,    // Added number of surfaces detected
            frameLatencies: [],
            startTime: performance.now(),
            lastFpsUpdateTime: performance.now(),
            lastFrameTime: performance.now(),
            lastReportTime: performance.now(),
            sessionId: this._generateSessionId(),
            totalFrames: 0,         // Track total frames for long-term analysis
            droppedFrames: 0        // Estimate dropped frames
        };

        // Elements
        this.elements = {
            fps: document.getElementById('fps'),
            latency: document.getElementById('latency'),
            memory: document.getElementById('memory'),
            tracking: document.getElementById('tracking')
        };

   // Add properties for CPU and GPU
        this.cpuUsage = 0;
        this.gpuUsage = 0; // Placeholder for GPU usage
        // Initialize
        this._initPerformanceObserver();
        this._initEventListeners();
    }
 // Method to update CPU and RAM usage
    updateCPUAndRAM() {
        // Update RAM usage
        if (performance.memory) {
            this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
        // Update CPU usage (this is a simple approximation)
        navigator.getBattery().then(battery => {
            this.cpuUsage = battery.level * 100; // Example: using battery level as CPU usage
        });
        // Update GPU usage (you may need a library or custom implementation)
        this.gpuUsage = this.getGPUInfo(); // Implement this method to get GPU info
    }
    // Example method to get GPU info
    getGPUInfo() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown GPU';
    }
    // Update loop for performance tracking
    _updateLoop() {
        this.markFrame();
        this.updateCPUAndRAM(); // Call the new method
        requestAnimationFrame(() => this._updateLoop());
    }
    /**
     * Initialize Performance Observer (if available)
     * @private
     */
    _initPerformanceObserver() {
        if (window.PerformanceObserver) {
            try {
                // Observer for long tasks (potential jank/stutters)
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        // Report long tasks (over 50ms)
                        if (entry.duration > 50) {
                            this.metrics.droppedFrames++;
                            console.log('Long task detected:', entry.duration.toFixed(1) + 'ms');
                        }
                    }
                });
                
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                
                // Memory observer (if supported)
                if (performance.memory) {
                    const memoryObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        if (entries.length > 0) {
                            const memoryInfo = entries[entries.length - 1];
                            this.metrics.memory = Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024));
                        }
                    });
                    
                    // Observe memory if available
                    if (memoryObserver.observe && 
                        PerformanceObserver.supportedEntryTypes && 
                        PerformanceObserver.supportedEntryTypes.includes('memory')) {
                        memoryObserver.observe({ entryTypes: ['memory'] });
                    }
                }
            } catch (e) {
                console.warn('Performance observer not fully supported:', e);
            }
        }
    }

    /**
     * Start performance tracking
     */
    start() {
        this.metrics.startTime = performance.now();
        this.metrics.lastFpsUpdateTime = this.metrics.startTime;
        this.metrics.lastFrameTime = this.metrics.startTime;
        this.metrics.lastReportTime = this.metrics.startTime;
        this._updateLoop();
        console.log('Performance tracking started for world-locked AR');
        
        // Schedule periodic reporting
        this.reportingInterval = setInterval(() => {
            this.reportToServer();
        }, this.options.reportInterval);
    }

    /**
     * Stop performance tracking
     */
    stop() {
        clearInterval(this.reportingInterval);
        console.log('Performance tracking stopped');
    }

    /**
     * Set tracking quality
     * @param {string} quality - The tracking quality (Excellent, Good, Fair, Poor)
     * @param {number} confidence - Optional confidence level (0-1)
     */
    setTrackingQuality(quality, confidence = 0) {
        this.metrics.trackingQuality = quality;
        this.metrics.trackingConfidence = confidence;
        
        if (this.elements.tracking) {
            this.elements.tracking.textContent = quality;
        }
    }
    
    /**
     * Update the number of detected surfaces
     * @param {number} count - Number of surfaces detected
     */
    setSurfacesDetected(count) {
        this.metrics.surfacesDetected = count;
    }

    /**
     * Mark a frame for performance calculation
     */
    markFrame() {
        const now = performance.now();
        const frameTime = now - this.metrics.lastFrameTime;
        this.metrics.lastFrameTime = now;
        
        this.metrics.frameCount++;
        this.metrics.totalFrames++;
        this.metrics.frameLatencies.push(frameTime);
        
        // Keep only the most recent samples
        if (this.metrics.frameLatencies.length > this.options.maxLatencySamples) {
            this.metrics.frameLatencies.shift();
        }
        
        // Update metrics every update interval
        if (now - this.metrics.lastFpsUpdateTime > this.options.updateInterval) {
            this._updateMetrics(now);
        }
    }

    /**
     * Report performance metrics to Google Sheets (fetch version)
     */
    reportToServer() {
        const now = performance.now();
        const elapsedTime = (now - this.metrics.startTime) / 1000; // in seconds
        
        const dataToSend = {
            sessionId: this.metrics.sessionId,
            timestamp: new Date().toISOString(),
            elapsedTime: elapsedTime.toFixed(1),
            fps: this.metrics.fps,
            latency: this.metrics.latency.toFixed(1),
            memory: this.metrics.memory,
            trackingQuality: this.metrics.trackingQuality,
            trackingConfidence: this.metrics.trackingConfidence.toFixed(2),
            surfacesDetected: this.metrics.surfacesDetected,
            droppedFrames: this.metrics.droppedFrames,
            totalFrames: this.metrics.totalFrames,
            arMode: this.options.deviceInfo.arMode,
            userAgent: this.options.deviceInfo.userAgent,
            screenWidth: this.options.deviceInfo.screenWidth,
            screenHeight: this.options.deviceInfo.screenHeight,
            devicePixelRatio: this.options.deviceInfo.devicePixelRatio
        };

        // Send using fetch with text/plain to avoid preflight CORS
        fetch(this.options.reportURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(dataToSend)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Performance data reported successfully', data);
        })
        .catch(error => {
            console.error('Error reporting performance data', error);
        });

        this.metrics.lastReportTime = now;
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Handle visibility change to pause/resume tracking
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stop();
            } else {
                this.start();
            }
        });
        
        // Handle WebXR session events if available
        if (navigator.xr) {
            // Try to detect session start/end events
            const originalRequestSession = navigator.xr.requestSession;
            if (originalRequestSession) {
                navigator.xr.requestSession = function(...args) {
                    console.log('WebXR session starting');
                    return originalRequestSession.apply(this, args);
                };
            }
        }
        
        // Handle device motion for potential tracking issues
        window.addEventListener('devicemotion', (event) => {
            // Check for rapid device movement that might affect tracking
            const acceleration = event.acceleration;
            if (acceleration && (Math.abs(acceleration.x) > 10 || 
                                 Math.abs(acceleration.y) > 10 || 
                                 Math.abs(acceleration.z) > 10)) {
                console.log('Rapid device motion detected - may affect tracking');
            }
        });
    }

    /**
     * Update performance metrics
     * @private
     * @param {number} now - Current timestamp
     */
    _updateMetrics(now) {
        // Calculate FPS
        const timeDiff = (now - this.metrics.lastFpsUpdateTime) / 1000;
        this.metrics.fps = Math.round(this.metrics.frameCount / timeDiff);
        
        // Update FPS display
        if (this.elements.fps) {
            this.elements.fps.textContent = this.metrics.fps;
            
            // Apply color based on FPS
            if (this.metrics.fps > 45) {
                this.elements.fps.style.color = '#4CAF50'; // Green
            } else if (this.metrics.fps > 30) {
                this.elements.fps.style.color = '#8BC34A'; // Light Green
            } else if (this.metrics.fps > 20) {
                this.elements.fps.style.color = '#FFC107'; // Amber
            } else {
                this.elements.fps.style.color = '#F44336'; // Red
            }
        }
        
        // Reset frame counter
        this.metrics.frameCount = 0;
        this.metrics.lastFpsUpdateTime = now;
        
        // Calculate average latency
        const avgLatency = this.metrics.frameLatencies.reduce((a, b) => a + b, 0) / 
                          Math.max(1, this.metrics.frameLatencies.length);
        this.metrics.latency = avgLatency;
        
        // Update latency display
        if (this.elements.latency) {
            this.elements.latency.textContent = Math.round(avgLatency);
            
            // Apply color based on latency
            if (avgLatency < 16) {
                this.elements.latency.style.color = '#4CAF50'; // Green - under 16ms (60fps)
            } else if (avgLatency < 33) {
                this.elements.latency.style.color = '#8BC34A'; // Light Green - under 33ms (30fps)
            } else if (avgLatency < 50) {
                this.elements.latency.style.color = '#FFC107'; // Amber
            } else {
                this.elements.latency.style.color = '#F44336'; // Red
            }
        }
        
        // Estimate memory usage if available
        if (window.performance && window.performance.memory) {
            this.metrics.memory = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
            if (this.elements.memory) {
                this.elements.memory.textContent = this.metrics.memory;
                
                // Apply color based on memory usage
                const memoryRatio = window.performance.memory.usedJSHeapSize / 
                                   window.performance.memory.jsHeapSizeLimit;
                                   
                if (memoryRatio < 0.5) {
                    this.elements.memory.style.color = '#4CAF50'; // Green
                } else if (memoryRatio < 0.7) {
                    this.elements.memory.style.color = '#FFC107'; // Amber
                } else {
                    this.elements.memory.style.color = '#F44336'; // Red
                }
            }
        } else {
            if (this.elements.memory) {
                this.elements.memory.textContent = "N/A";
            }
        }

         // Update CPU and GPU display
    if (this.elements.cpu) {
        this.elements.cpu.textContent = this.cpuUsage.toFixed(2);
    }
    if (this.elements.gpu) {
        this.elements.gpu.textContent = this.gpuUsage;
    }
    }

    /**
     * Update loop for performance tracking
     * @private
     */
    _updateLoop() {
        this.markFrame();
        requestAnimationFrame(() => this._updateLoop());
    }

    /**
     * Generate a unique session ID
     * @private
     * @returns {string} Unique session ID
     */
    _generateSessionId() {
        return 'wxr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    }
}

// Export the PerformanceTracker class
window.PerformanceTracker = PerformanceTracker;