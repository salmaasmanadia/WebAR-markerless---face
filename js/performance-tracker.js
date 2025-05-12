/**
 * Unified Performance Tracker for WebXR World-Locked AR
 * Tracks FPS, latency, memory, CPU/GPU usage, tracking quality, surfaces, and reports to Google Sheets
 */
class PerformanceTracker {
    constructor(options) {
        this.options = Object.assign({
            updateInterval: 1000,
            reportInterval: 30000,
            reportURL: 'https://script.google.com/macros/s/AKfycby1wliupR46OkwUoCraslZm5ofvLdUBjv8EAmhIRZKZmtRmUiF7CJUKNcWDQOdGPMLOYg/exec',
            maxLatencySamples: 30,
            deviceInfo: {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                devicePixelRatio: window.devicePixelRatio,
                arMode: 'world-locked'
            },
            showNotification: null
        }, options);

        this.metrics = {
            fps: 0,
            frameCount: 0,
            latency: 0,
            memory: 0,
            trackingQuality: 'Initializing',
            trackingConfidence: 0,
            surfacesDetected: 0,
            frameLatencies: [],
            startTime: performance.now(),
            lastFpsUpdateTime: performance.now(),
            lastFrameTime: performance.now(),
            lastReportTime: performance.now(),
            sessionId: this._generateSessionId(),
            totalFrames: 0,
            droppedFrames: 0,
            gpuInfo: 'Unknown',
            cpuUsage: 0
        };

        this.elements = {
            fps: document.getElementById('fps'),
            latency: document.getElementById('latency'),
            memory: document.getElementById('memory'),
            tracking: document.getElementById('tracking'),
            cpu: document.getElementById('cpu'),
            gpu: document.getElementById('gpu')
        };

        this._initPerformanceObserver();
        this._initEventListeners();
        this._getGPUInfo();
    }

    start() {
        this.metrics.startTime = performance.now();
        this.metrics.lastFpsUpdateTime = this.metrics.startTime;
        this.metrics.lastFrameTime = this.metrics.startTime;
        this.metrics.lastReportTime = this.metrics.startTime;
        this._updateLoop();

        this.reportingInterval = setInterval(() => {
            this.reportToServer();
        }, this.options.reportInterval);

        console.log('Performance tracking started');
    }

    stop() {
        clearInterval(this.reportingInterval);
        console.log('Performance tracking stopped');
    }

    markFrame() {
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

    _updateMetrics(now) {
        const timeDiff = (now - this.metrics.lastFpsUpdateTime) / 1000;
        this.metrics.fps = Math.round(this.metrics.frameCount / timeDiff);
        this.metrics.frameCount = 0;
        this.metrics.lastFpsUpdateTime = now;

        const avgLatency = this.metrics.frameLatencies.reduce((a, b) => a + b, 0) /
            Math.max(1, this.metrics.frameLatencies.length);
        this.metrics.latency = avgLatency;

        this.updateCPUAndRAM();
        this._updateUI();
    }

    updateCPUAndRAM() {
        if (performance.memory) {
            this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
        navigator.getBattery?.().then(battery => {
            this.metrics.cpuUsage = battery.level * 100;
        });
    }

    _getGPUInfo() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            this.metrics.gpuInfo = renderer;
            if (this.elements.gpu) this.elements.gpu.textContent = renderer;
        }
    }

    _updateUI() {
        const set = (id, value, color = null) => {
            const el = this.elements[id];
            if (el) {
                el.textContent = value;
                if (color) el.style.color = color;
            }
        };

        set('fps', this.metrics.fps, this._colorFromFPS(this.metrics.fps));
        set('latency', Math.round(this.metrics.latency), this._colorFromLatency(this.metrics.latency));
        set('memory', this.metrics.memory);
        set('cpu', this.metrics.cpuUsage.toFixed(2));
        set('gpu', this.metrics.gpuInfo);
        set('tracking', this.metrics.trackingQuality);
    }

    _colorFromFPS(fps) {
        if (fps > 45) return '#4CAF50';
        if (fps > 30) return '#8BC34A';
        if (fps > 20) return '#FFC107';
        return '#F44336';
    }

    _colorFromLatency(latency) {
        if (latency < 16) return '#4CAF50';
        if (latency < 33) return '#8BC34A';
        if (latency < 50) return '#FFC107';
        return '#F44336';
    }

    setTrackingQuality(quality, confidence = 0) {
        this.metrics.trackingQuality = quality;
        this.metrics.trackingConfidence = confidence;
    }

    setSurfacesDetected(count) {
        this.metrics.surfacesDetected = count;
    }

    reportToServer() {
        const now = performance.now();
        const elapsedTime = (now - this.metrics.startTime) / 1000;
        const dataToSend = {
            sessionId: this.metrics.sessionId,
            timestamp: new Date().toISOString(),
            elapsedTime: elapsedTime.toFixed(1),
            fps: this.metrics.fps,
            latency: this.metrics.latency.toFixed(1),
            memory: this.metrics.memory,
            cpu: this.metrics.cpuUsage.toFixed(2),
            gpu: this.metrics.gpuInfo,
            trackingQuality: this.metrics.trackingQuality,
            trackingConfidence: this.metrics.trackingConfidence.toFixed(2),
            surfacesDetected: this.metrics.surfacesDetected,
            droppedFrames: this.metrics.droppedFrames,
            totalFrames: this.metrics.totalFrames,
            ...this.options.deviceInfo
        };

    fetch(this.options.reportURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // ✅ penting
        body: JSON.stringify(dataToSend)
    })
    .then(res => res.ok ? res.json() : Promise.reject(res.status))
    .then(data => console.log('Reported performance data', data))
    .catch(err => console.error('Failed to report performance data', err));
        }

    _initPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.duration > 50) {
                        this.metrics.droppedFrames++;
                        console.warn('Long task detected:', entry.duration);
                    }
                });
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            console.warn('PerformanceObserver not fully supported', e);
        }
    }

    _initEventListeners() {
        document.addEventListener('visibilitychange', () => {
            document.hidden ? this.stop() : this.start();
        });

        window.addEventListener('devicemotion', (e) => {
            const a = e.acceleration;
            if (a && (Math.abs(a.x) > 10 || Math.abs(a.y) > 10 || Math.abs(a.z) > 10)) {
                console.log('Rapid motion detected - may affect AR tracking');
            }
        });
    }

    _updateLoop() {
        this.markFrame();
        requestAnimationFrame(() => this._updateLoop());
    }

    _generateSessionId() {
        return 'wxr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

window.PerformanceTracker = PerformanceTracker;
