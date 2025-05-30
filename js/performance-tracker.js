/**
 * Enhanced Performance Tracker with SpectorJS for GPU monitoring and object timing
 * Provides comprehensive performance monitoring for WebXR applications
 */
class PerformanceTracker {
    constructor(options = {}) {
        this.options = {
            updateInterval: 1000,
            reportInterval: 30000,
            reportURL: 'https://script.google.com/macros/s/AKfycbyX_bSfX1_qhXPy_5zd7PTosSlFRkqffqnDT8eDD9NFcXL6K0aoWadzoqjknRJJuh4o4Q/exec',
            maxLatencySamples: 30,
            deviceInfo: {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                devicePixelRatio: window.devicePixelRatio,
                arMode: 'world-locked'
            },
            showNotification: null,
            webGLContext: null,
            captureSpectorFrames: 10,
            ...options
        };

        this.metrics = {
            fps: 0,
            frameCount: 0,
            latency: 0,
            memory: 0,
            trackingQuality: 'N/A',
            trackingConfidence: 0,
            surfacesDetected: 0,
            frameLatencies: [],
            startTime: 0,
            lastFpsUpdateTime: 0,
            lastFrameTime: 0,
            lastReportTime: performance.now(),
            sessionId: this._generateSessionId(),
            totalFrames: 0,
            droppedFrames: 0,
            gpuInfo: 'Unknown',
            cpuUsage: 0,
            gpuUsage: 0,
            objectTimings: {},
            objectStartTime: null,
            objectAppearanceTime: null,
            renderTime: 0,
            jsExecutionTime: 0,
            gcTime: 0
        };

        this.elements = this._initializeElements();
        this.isTracking = false;
        this.animationFrameId = null;
        this.reportingInterval = null;
        this.lastUIUpdate = 0;
        this.spector = null;
        this.frameTimeMarkers = {};

        this._initialize();
    }

    // Public Methods
    start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('Performance tracking started');

        this._resetMetrics();
        this._startReporting();
        this._updateLoop();
    }

    stop() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        console.log('Performance tracking stopped');

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
            this.reportingInterval = null;
        }
    }

    markFrame() {
        if (!this.isTracking) return;

        const now = performance.now();
        const frameTime = now - this.metrics.lastFrameTime;
        this.metrics.lastFrameTime = now;

        this.metrics.frameCount++;
        this.metrics.totalFrames++;
        this.metrics.frameLatencies.push(frameTime);

        if (this.metrics.frameLatencies.length > this.options.maxLatencySamples) {
            this.metrics.frameLatencies.shift();
        }

        if (now - this.metrics.lastFpsUpdateTime > this.options.updateInterval) {
            this._updateMetrics(now);
        }
    }

    markObjectLoadStart(objectId) {
        const startTime = performance.now();
        if (!this.isTracking) return startTime;

        this.metrics.objectStartTime = startTime;
        this.frameTimeMarkers[objectId] = { startTime, status: 'loading' };
        console.log(`Object ${objectId} load started at ${startTime.toFixed(3)}ms`);
        return startTime;
    }

    markObjectAppeared(objectId) {
        const appearTime = performance.now();
        const marker = this.frameTimeMarkers[objectId];
        
        if (!marker) {
            console.warn(`No start marker found for object ${objectId}`);
            return null;
        }

        marker.appearTime = appearTime;
        marker.status = 'appeared';
        marker.loadTime = appearTime - marker.startTime;
        
        this.metrics.objectAppearanceTime = appearTime;
        this.metrics.objectTimings[objectId] = marker;
        
        console.log(`Object ${objectId} appeared in ${marker.loadTime.toFixed(3)}ms`);
        this._updateObjectUI(objectId, marker.loadTime);
        
        return marker.loadTime;
    }

    markRenderStart() {
        if (this.isTracking) {
            performance.mark('render-start');
        }
    }

    setTrackingQuality(quality, confidence = 0) {
        this.metrics.trackingQuality = quality;
        this.metrics.trackingConfidence = confidence;
        if (!this.isTracking) {
            this._updateUI();
        }
    }

    setSurfacesDetected(count) {
        this.metrics.surfacesDetected = count;
        if (!this.isTracking) {
            this._updateUI();
        }
    }

    getObjectLoadTime(objectId) {
        const timing = this.metrics.objectTimings[objectId];
        return timing ? timing.loadTime : null;
    }

    getAllObjectTimings() {
        return this.metrics.objectTimings;
    }

    updateMemoryUsage() {
        if (performance.memory) {
            this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        } else {
            this.metrics.memory = 0;
        }
    }

    reportToServer() {
        if (this.metrics.startTime === 0 && Object.keys(this.metrics.objectTimings).length === 0) {
            console.log("No tracking session data to report");
            return;
        }

        const reportData = this._buildReportData();
        console.log('Sending performance data to server:', reportData);

        fetch(this.options.reportURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(reportData)
        })
        .then(res => {
            if (res.ok || res.type === 'opaque') {
                console.log('Performance data reported successfully');
            } else {
                return Promise.reject(`Server responded with status: ${res.status}`);
            }
        })
        .catch(err => {
            console.error('Failed to report performance data', err);
        });
    }

    // Private Methods
    _initialize() {
        this._initPerformanceObserver();
        this._initEventListeners();
        this._getGPUInfo();
        this._initCPUMonitoring();

        if (this._isValidWebGLContext()) {
            this._initSpectorJS();
        } else {
            console.warn('No valid WebGL context provided - SpectorJS monitoring disabled');
        }

        this._updateUI();
    }

    _initializeElements() {
        const elementIds = [
            'fps', 'latency', 'memory', 'tracking', 'cpu', 'gpu', 'objectTime', 
            'gpuUsage', 'sessionId', 'timestamp', 'elapsedTime', 'trackingConfidence',
            'surfacesDetected', 'droppedFrames', 'totalFrames', 'renderTime',
            'jsExecutionTime', 'gcTime'
        ];

        const elements = {};
        elementIds.forEach(id => {
            elements[id] = document.getElementById(id);
        });
        return elements;
    }

    _resetMetrics() {
        const now = performance.now();
        this.metrics.startTime = now;
        this.metrics.lastFpsUpdateTime = now;
        this.metrics.lastFrameTime = now;
        this.metrics.frameCount = 0;
        this.metrics.frameLatencies = [];
        this.metrics.trackingQuality = 'Initializing';
    }

    _startReporting() {
        if (!this.reportingInterval && this.options.reportInterval > 0) {
            this.reportingInterval = setInterval(() => {
                if (this.isTracking) {
                    this.reportToServer();
                }
            }, this.options.reportInterval);
        }
    }

    _updateLoop() {
        if (!this.isTracking) {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            return;
        }

        this.markFrame();
        this.animationFrameId = requestAnimationFrame(() => this._updateLoop());
    }

    _updateMetrics(now) {
        if (!this.isTracking && now !== undefined) return;

        const timeDiff = (now - this.metrics.lastFpsUpdateTime) / 1000;
        if (timeDiff > 0) {
            this.metrics.fps = Math.round(this.metrics.frameCount / timeDiff);
        } else if (!this.isTracking) {
            this.metrics.fps = 0;
        }

        this.metrics.frameCount = 0;
        this.metrics.lastFpsUpdateTime = now;

        if (this.metrics.frameLatencies.length > 0) {
            const avgLatency = this.metrics.frameLatencies.reduce((a, b) => a + b, 0) / this.metrics.frameLatencies.length;
            this.metrics.latency = avgLatency;
        } else {
            this.metrics.latency = 0;
        }

        this.updateMemoryUsage();

        if (this.isTracking) {
            this._updateUI();
        }
    }

    _updateUI() {
        const formatValue = (value, type) => {
            switch (type) {
                case 'fps':
                    return typeof value === 'number' ? value.toFixed(0) : value;
                case 'latency':
                    return typeof value === 'number' ? `${Math.round(value)}ms` : value;
                case 'memory':
                    return typeof value === 'number' ? `${value}MB` : value;
                case 'percentage':
                    return typeof value === 'number' ? `${value.toFixed(1)}%` : value;
                case 'time':
                    return typeof value === 'number' ? `${value.toFixed(2)}ms` : value;
                case 'decimal':
                    return typeof value === 'number' ? value.toFixed(2) : value;
                default:
                    return value;
            }
        };

        const setElement = (id, value, type = 'default', color = null) => {
            const element = this.elements[id];
            if (element) {
                element.textContent = formatValue(value, type);
                if (color) element.style.color = color;
            }
        };

        // Basic metrics
        setElement('sessionId', this.metrics.sessionId);
        setElement('timestamp', new Date().toLocaleTimeString());
        setElement('elapsedTime', this.isTracking ? 
            `${((performance.now() - this.metrics.startTime) / 1000).toFixed(1)}s` : '-s');

        // Performance metrics with colors
        setElement('fps', this.metrics.fps, 'fps', 
            this.isTracking ? this._getColorFromFPS(this.metrics.fps) : null);
        setElement('latency', this.metrics.latency, 'latency',
            this.isTracking ? this._getColorFromLatency(this.metrics.latency) : null);
        setElement('memory', this.metrics.memory, 'memory');

        // Tracking metrics
        setElement('tracking', this.metrics.trackingQuality);
        setElement('trackingConfidence', this.metrics.trackingConfidence, 'decimal');
        setElement('surfacesDetected', this.metrics.surfacesDetected);

        // System metrics
        setElement('cpu', this.metrics.cpuUsage, 'percentage',
            this.isTracking ? this._getColorFromUsage(this.metrics.cpuUsage) : null);
        setElement('gpu', this.metrics.gpuInfo);
        setElement('gpuUsage', this.metrics.gpuUsage, 'percentage',
            this.isTracking ? this._getColorFromUsage(this.metrics.gpuUsage) : null);

        // Frame metrics
        setElement('droppedFrames', this.metrics.droppedFrames);
        setElement('totalFrames', this.metrics.totalFrames);

        // Timing metrics
        setElement('renderTime', this.metrics.renderTime, 'time');
        setElement('jsExecutionTime', this.metrics.jsExecutionTime, 'time');
        setElement('gcTime', this.metrics.gcTime, 'time');

        // Object timing
        const lastObjectId = Object.keys(this.metrics.objectTimings).pop();
        if (lastObjectId && this.metrics.objectTimings[lastObjectId]) {
            setElement('objectTime', this.metrics.objectTimings[lastObjectId].loadTime, 'time');
        } else if (!this.isTracking) {
            setElement('objectTime', '-ms');
        }
    }

    _updateObjectUI(objectId, loadTime) {
        if (this.elements.objectTime) {
            this.elements.objectTime.textContent = `${loadTime.toFixed(2)}ms`;
            this.elements.objectTime.setAttribute('data-object', objectId);
        }
    }

    _buildReportData() {
        const now = performance.now();
        const elapsedTime = this.metrics.startTime > 0 ? (now - this.metrics.startTime) / 1000 : 0;
        
        const formattedObjectTimings = {};
        Object.keys(this.metrics.objectTimings).forEach(objId => {
            const timing = this.metrics.objectTimings[objId];
            formattedObjectTimings[objId] = {
                loadTime: timing.loadTime ? timing.loadTime.toFixed(2) : 'N/A',
                startTime: timing.startTime && this.metrics.startTime > 0 ? 
                    (timing.startTime - this.metrics.startTime).toFixed(2) : 'N/A',
                appearTime: timing.appearTime && this.metrics.startTime > 0 ? 
                    (timing.appearTime - this.metrics.startTime).toFixed(2) : 'N/A'
            };
        });
        
        return {
            sessionId: this.metrics.sessionId,
            timestamp: new Date().toISOString(),
            elapsedTime: elapsedTime.toFixed(1),
            fps: this.metrics.fps,
            latency: this.metrics.latency.toFixed(1),
            memory: this.metrics.memory,
            cpu: this.metrics.cpuUsage.toFixed(1),
            gpu: this.metrics.gpuInfo,
            gpuUsage: this.metrics.gpuUsage.toFixed(1),
            trackingQuality: this.metrics.trackingQuality,
            trackingConfidence: this.metrics.trackingConfidence.toFixed(2),
            surfacesDetected: this.metrics.surfacesDetected,
            droppedFrames: this.metrics.droppedFrames,
            totalFrames: this.metrics.totalFrames,
            renderTime: this.metrics.renderTime.toFixed(2),
            jsExecutionTime: this.metrics.jsExecutionTime.toFixed(2),
            gcTime: this.metrics.gcTime.toFixed(2),
            objectTimings: formattedObjectTimings,
            ...this.options.deviceInfo
        };
    }

    // SpectorJS Methods
    _isValidWebGLContext() {
        return this.options.webGLContext && 
               (this.options.webGLContext instanceof WebGLRenderingContext ||
                this.options.webGLContext instanceof WebGL2RenderingContext);
    }

    _initSpectorJS() {
        if (!window.SPECTOR) {
            this._loadSpectorJS();
        } else {
            this._setupSpector();
        }
    }

    _loadSpectorJS() {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/spectorjs@0.9.30/dist/spector.bundle.min.js';
        script.onload = () => {
            this._setupSpector();
            console.log('Spector.js loaded successfully');
        };
        script.onerror = (err) => {
            console.error('Failed to load Spector.js', err);
        };
        document.head.appendChild(script);
    }

    _setupSpector() {
        if (!window.SPECTOR) {
            console.error('Spector.js not available');
            return;
        }

        try {
            this.spector = new SPECTOR.Spector();
            
            if (!this.options.webGLContext.canvas) {
                console.error('WebGL context does not have a canvas property');
                return;
            }
            
            console.log('Capturing WebGL context with Spector.js');
            this.spector.captureContext(this.options.webGLContext);
            
            this.spector.onCapture.add((capture) => {
                this._analyzeGPUUsage(capture);
            });
            
            this._setupFrameCapture();
        } catch (e) {
            console.error('Error setting up Spector.js', e);
        }
    }
    
    _setupFrameCapture() {
        const captureFrame = () => {
            try {
                if (this.isTracking && this.spector && this.options.webGLContext && 
                    this.options.webGLContext.canvas && document.visibilityState === 'visible') {
                    this.spector.captureNextFrame();
                }
            } catch (err) {
                console.error('Error capturing frame with Spector.js', err);
            }
            
            setTimeout(captureFrame, 10000);
        };
        
        setTimeout(captureFrame, 10000);
    }

    _analyzeGPUUsage(capture) {
        if (!this.isTracking || !capture || !capture.commands) return;
        
        const drawCalls = capture.commands.filter(cmd => 
            cmd.name.includes('draw') || cmd.name.includes('Draw')).length;
        const textureBindings = capture.commands.filter(cmd => 
            cmd.name.includes('bindTexture')).length;
        const bufferUploads = capture.commands.filter(cmd => 
            cmd.name.includes('bufferData') || cmd.name.includes('texImage')).length;
            
        const normalizedDrawCalls = Math.min(drawCalls / 1000, 1);
        const normalizedTextures = Math.min(textureBindings / 50, 1); 
        const normalizedBuffers = Math.min(bufferUploads / 30, 1); 
        
        this.metrics.gpuUsage = Math.min(100, Math.round(100 * (
            0.5 * normalizedDrawCalls +
            0.3 * normalizedTextures +
            0.2 * normalizedBuffers
        )));
    }

    // Monitoring Methods
    _initCPUMonitoring() {
        this._initFrameTimeMonitoring();
        this._initIdleTimeMonitoring();
    }

    _initFrameTimeMonitoring() {
        let lastCheckTime = performance.now();
        let frameTimeSum = 0;
        let frameTimeCount = 0;
        const frameTimeWindow = 20;
        
        const monitorCPU = () => {
            if (this.isTracking) {
                const now = performance.now();
                const frameDuration = now - lastCheckTime;
                lastCheckTime = now;
                
                frameTimeSum += frameDuration;
                frameTimeCount++;
                
                if (frameTimeCount > frameTimeWindow) {
                    const avgFrameTime = frameTimeSum / frameTimeCount;
                    const targetFrameTime = 16.67;
                    const normalizedUsage = Math.min(avgFrameTime / (targetFrameTime * 2), 1);
                    this.metrics.cpuUsage = Math.round(normalizedUsage * 100);
                    
                    frameTimeSum = 0;
                    frameTimeCount = 0;
                }
            } else {
                lastCheckTime = performance.now();
                frameTimeSum = 0;
                frameTimeCount = 0;
            }
            requestAnimationFrame(monitorCPU);
        };
        requestAnimationFrame(monitorCPU);
    }

    _initIdleTimeMonitoring() {
        if (!window.requestIdleCallback) return;

        let lastIdleTime = 0;
        let idleTimeSum = 0;
        let idleTimeCount = 0;
        
        const estimateCPU = (deadline) => {
            if (this.isTracking) {
                const idleTime = deadline.timeRemaining();
                const timeSinceLastIdle = performance.now() - lastIdleTime;
                
                if (timeSinceLastIdle > 100) {
                    idleTimeSum += idleTime;
                    idleTimeCount++;
                    
                    if (idleTimeCount > 10) {
                        const avgIdleTime = idleTimeSum / idleTimeCount;
                        const maxIdleTime = 50;
                        const idleCpuUsage = 100 * (1 - Math.min(avgIdleTime / maxIdleTime, 1));
                        this.metrics.cpuUsage = Math.round((this.metrics.cpuUsage + idleCpuUsage) / 2);
                        idleTimeSum = 0;
                        idleTimeCount = 0;
                    }
                    lastIdleTime = performance.now();
                }
            } else {
                lastIdleTime = performance.now();
                idleTimeSum = 0;
                idleTimeCount = 0;
            }
            window.requestIdleCallback(estimateCPU);
        };
        window.requestIdleCallback(estimateCPU);
    }

    _initPerformanceObserver() {
        if (!window.PerformanceObserver) return;
        
        try {
            this._setupLongTaskObserver();
            this._setupPaintObserver();
            this._setupResourceObserver();
            this._setupGCObserver();
            this._setupFrameObserver();
            this._initializeJSExecutionTime();
        } catch (e) {
            console.warn('PerformanceObserver setup error:', e);
        }
    }

    _setupLongTaskObserver() {
        const longTaskObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (this.isTracking && entry.duration > 50) {
                    this.metrics.droppedFrames++;
                    console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                }
            });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
    }

    _setupPaintObserver() {
        const paintObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.name === 'first-paint' || entry.name === 'first-contentful-paint') {
                    console.log(`${entry.name}: ${entry.startTime.toFixed(2)}ms`);
                }
            });
        });
        paintObserver.observe({ entryTypes: ['paint'] });
    }

    _setupResourceObserver() {
        const resourceObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                const relevantTypes = ['fetch', 'xmlhttprequest', 'script', 'img'];
                if (relevantTypes.includes(entry.initiatorType)) {
                    console.log(`Resource loaded: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
                }
            });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
    }

    _setupGCObserver() {
        if (window.PerformanceObserver.supportedEntryTypes && 
            window.PerformanceObserver.supportedEntryTypes.includes('gc')) {
            const gcObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (this.isTracking) {
                        this.metrics.gcTime += entry.duration;
                        console.warn(`Garbage collection: ${entry.duration.toFixed(2)}ms`);
                    }
                });
            });
            gcObserver.observe({ entryTypes: ['gc'] });
        }
    }

    _setupFrameObserver() {
        const frameObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (this.isTracking && entry.name === 'render-start' && entry.entryType === 'mark') {
                    performance.mark('render-end');
                    const renderMeasure = performance.measure('render-time', 'render-start', 'render-end');
                    this.metrics.renderTime = renderMeasure.duration;
                }
            });
        });
        frameObserver.observe({ entryTypes: ['mark'] });
    }

    _initializeJSExecutionTime() {
        const pageNav = performance.getEntriesByType('navigation')[0];
        if (pageNav) {
            const scriptTime = pageNav.domContentLoadedEventEnd - pageNav.domContentLoadedEventStart;
            this.metrics.jsExecutionTime = scriptTime;
        }
    }

    _initEventListeners() {
        window.addEventListener('devicemotion', (e) => {
            const a = e.acceleration;
            if (a && (Math.abs(a.x) > 10 || Math.abs(a.y) > 10 || Math.abs(a.z) > 10)) {
                console.log('Rapid motion detected - may affect AR tracking');
            }
        });
    }

    _getGPUInfo() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        
        if (!gl) {
            this.metrics.gpuInfo = 'WebGL not supported';
            return;
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            this.metrics.gpuInfo = `${vendor} - ${renderer}`;
        } else {
            this.metrics.gpuInfo = 'GPU Info N/A';
        }

        if (this.elements.gpu) {
            this.elements.gpu.textContent = this.metrics.gpuInfo;
        }
    }

    // Color Helpers
    _getColorFromFPS(fps) {
        if (fps > 55) return '#4CAF50';
        if (fps > 45) return '#8BC34A';
        if (fps > 30) return '#FFEB3B';
        if (fps > 20) return '#FFC107';
        if (fps > 15) return '#FF9800';
        return '#F44336';
    }

    _getColorFromLatency(latency) {
        if (latency < 8) return '#4CAF50';
        if (latency < 16) return '#8BC34A';
        if (latency < 33) return '#FFEB3B';
        if (latency < 50) return '#FFC107';
        if (latency < 100) return '#FF9800';
        return '#F44336';
    }
    
    _getColorFromUsage(usage) {
        if (usage < 30) return '#4CAF50';
        if (usage < 60) return '#FFC107';
        if (usage < 85) return '#FF9800';
        return '#F44336';
    }

    _generateSessionId() {
        return 'wxr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

// Export to global scope
window.PerformanceTracker = PerformanceTracker;