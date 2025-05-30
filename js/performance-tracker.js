// enhanced-performance-tracker.js - with SpectorJS for GPU monitoring and object timing

class PerformanceTracker {
    constructor(options) {
        this.options = Object.assign({
            updateInterval: 1000, // Interval untuk update FPS dan UI (ms)
            reportInterval: 30000, // Interval untuk mengirim data ke server (ms)
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
            captureSpectorFrames: 10
        }, options);

        this.metrics = {
            fps: 0,
            frameCount: 0,
            latency: 0,
            memory: 0,
            trackingQuality: 'N/A', // Nilai awal sebelum AR atau jika tidak ada info
            trackingConfidence: 0,
            surfacesDetected: 0,
            frameLatencies: [],
            startTime: 0, // Akan direset saat tracking dimulai
            lastFpsUpdateTime: 0, // Akan direset saat tracking dimulai
            lastFrameTime: 0, // Akan direset saat tracking dimulai
            lastReportTime: performance.now(),
            sessionId: this._generateSessionId(),
            totalFrames: 0, // Bisa direset per sesi AR jika diinginkan
            droppedFrames: 0, // Bisa direset per sesi AR jika diinginkan
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

        this.elements = {
            fps: document.getElementById('fps'),
            latency: document.getElementById('latency'),
            memory: document.getElementById('memory'),
            tracking: document.getElementById('tracking'),
            cpu: document.getElementById('cpu'),
            gpu: document.getElementById('gpu'),
            objectTime: document.getElementById('objectTime'),
            gpuUsage: document.getElementById('gpuUsage'),
            // Tambahkan elemen lain jika ada di HTML Anda untuk statistik lain
            sessionId: document.getElementById('sessionId'),
            timestamp: document.getElementById('timestamp'),
            elapsedTime: document.getElementById('elapsedTime'),
            trackingConfidence: document.getElementById('trackingConfidence'),
            surfacesDetected: document.getElementById('surfacesDetected'),
            droppedFrames: document.getElementById('droppedFrames'),
            totalFrames: document.getElementById('totalFrames'),
            renderTime: document.getElementById('renderTime'),
            jsExecutionTime: document.getElementById('jsExecutionTime'),
            gcTime: document.getElementById('gcTime')
        };

        this.isTracking = false; // Flag untuk status pelacakan aktif
        this.animationFrameId = null; // Untuk menyimpan ID dari requestAnimationFrame
        this.reportingInterval = null; // Untuk interval pelaporan ke server
        this.lastUIUpdate = 0; // Untuk membatasi frekuensi update UI

        this.spector = null;
        this.frameTimeMarkers = {};

        this._initPerformanceObserver();
        this._initEventListeners(); // Pastikan listener 'visibilitychange' sudah dihapus dari sini
        this._getGPUInfo();
        this._initCPUMonitoring(); // CPU monitoring bisa berjalan terus untuk info umum

        if (this.options.webGLContext &&
            (this.options.webGLContext instanceof WebGLRenderingContext ||
             this.options.webGLContext instanceof WebGL2RenderingContext)) {
            this._initSpectorJS();
        } else {
            console.warn('PerformanceTracker: No valid WebGL context provided at construction. SpectorJS monitoring may be disabled or delayed.');
        }

        // Panggil _updateUI sekali untuk mengisi nilai default dari HTML atau metrics awal
        this._updateUI();
    }

    start() {
        if (this.isTracking) {
            return; // Sudah aktif
        }
        this.isTracking = true;
        console.log('Performance tracking actively STARTED.');

        // Reset metrik waktu dan frame untuk sesi baru
        this.metrics.startTime = performance.now();
        this.metrics.lastFpsUpdateTime = this.metrics.startTime;
        this.metrics.lastFrameTime = this.metrics.startTime;
        this.metrics.frameCount = 0;
        this.metrics.frameLatencies = []; // Kosongkan latensi frame sebelumnya
        // Pertimbangkan untuk mereset totalFrames dan droppedFrames jika ingin per sesi AR
        // this.metrics.totalFrames = 0;
        // this.metrics.droppedFrames = 0;
        this.metrics.trackingQuality = 'Initializing'; // Set ke initializing saat AR dimulai

        // Mulai interval pelaporan ke server jika belum ada dan interval > 0
        if (!this.reportingInterval && this.options.reportInterval > 0) {
            this.reportingInterval = setInterval(() => {
                if (this.isTracking) { // Hanya kirim laporan jika masih aktif melacak
                    this.reportToServer();
                }
            }, this.options.reportInterval);
        }

        this.lastRenderTime = performance.now(); // Inisialisasi untuk _updateLoop
        this._updateLoop(); // Mulai loop pembaruan internal
    }

    stop() {
        if (!this.isTracking) {
            return; // Sudah berhenti
        }
        this.isTracking = false;
        console.log('Performance tracking actively STOPPED.');

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // `app.js` akan memanggil `reportToServer()` secara eksplisit sebelum `stop()`,
        // jadi interval bisa dibersihkan di sini.
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
            this.reportingInterval = null;
        }
        // Nilai terakhir di `this.metrics` dan UI akan tetap karena `_updateUI` tidak dipanggil lagi.
    }

    _updateLoop() {
        if (!this.isTracking) {
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            return;
        }

        this.markFrame(); // Hitung metrik per frame

        this.animationFrameId = requestAnimationFrame(() => this._updateLoop());
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

    _updateMetrics(now) {
        if (!this.isTracking && !(now === undefined)) { // Cek jika now undefined untuk pemanggilan awal dari constructor
            // Jika tidak tracking aktif dan bukan pemanggilan dari constructor, jangan update metrik real-time.
            // Namun, _updateUI tetap bisa dipanggil untuk memastikan tampilan default.
            // Untuk kasus ini, _updateMetrics tidak seharusnya dipanggil jika !isTracking.
            // Pemanggilan _updateUI dari constructor sudah cukup untuk nilai awal.
             return;
        }

        const timeDiff = (now - this.metrics.lastFpsUpdateTime) / 1000;
        if (timeDiff > 0) {
            this.metrics.fps = Math.round(this.metrics.frameCount / timeDiff);
        } else if (this.isTracking) { // Hanya pertahankan FPS jika sedang tracking aktif
             this.metrics.fps = this.metrics.fps; // Pertahankan FPS terakhir jika timeDiff <= 0 saat tracking
        } else {
            this.metrics.fps = 0; // Default ke 0 jika tidak tracking
        }

        this.metrics.frameCount = 0;
        this.metrics.lastFpsUpdateTime = now;

        if (this.metrics.frameLatencies.length > 0) {
            const avgLatency = this.metrics.frameLatencies.reduce((a, b) => a + b, 0) / this.metrics.frameLatencies.length;
            this.metrics.latency = avgLatency;
        } else {
            this.metrics.latency = 0; // Default ke 0 jika tidak ada data latensi
        }


        this.updateMemoryUsage(); // Ini bisa tetap dipanggil karena performance.memory pasif

        // Panggil _updateUI hanya jika sedang tracking atau jika ini pemanggilan khusus
        // (pemanggilan dari constructor _updateUI() langsung sudah cukup untuk nilai awal)
        if(this.isTracking){
            this._updateUI();
        }
    }

    updateMemoryUsage() {
        if (performance.memory) {
            this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        } else {
            this.metrics.memory = 0; // Atau 'N/A'
        }
    }


    _updateUI() {
        // Update UI bisa lebih sering, tapi perhitungan metrik utama (FPS, dll) sesuai interval.
        // Untuk kesederhanaan, _updateUI dipanggil setelah _updateMetrics.
        // Jika ingin UI selalu menampilkan nilai this.metrics bahkan saat tidak tracking (nilai terakhir/default):
        // Panggil _updateUI() ini sekali di akhir constructor.
        // Dan pastikan _updateMetrics hanya dipanggil saat isTracking=true.

        const set = (elId, value, color = null) => {
            const el = this.elements[elId];
            if (el) {
                // Untuk angka, format ke string dengan presisi tertentu jika perlu
                let displayValue = value;
                if (typeof value === 'number' && !Number.isInteger(value)) {
                    displayValue = value.toFixed(1); // Contoh presisi 1 desimal
                }
                if (elId === 'fps' && typeof value === 'number') displayValue = value.toFixed(0);
                if (elId === 'latency' && typeof value === 'number') displayValue = `${Math.round(value)}ms`;
                if (elId === 'memory' && typeof value === 'number') displayValue = `${value}MB`;
                if (elId === 'cpuUsage' || elId === 'gpuUsage') displayValue = `${parseFloat(value).toFixed(1)}%`;


                el.textContent = displayValue;
                if (color) el.style.color = color;
            }
        };
        
        // Selalu update semua elemen dengan nilai dari this.metrics
        set('sessionId', this.metrics.sessionId);
        set('timestamp', new Date().toLocaleTimeString()); // Timestamp update UI
        set('elapsedTime', this.isTracking ? ((performance.now() - this.metrics.startTime) / 1000).toFixed(1) + 's' : '-s');

        set('fps', this.metrics.fps, this.isTracking ? this._colorFromFPS(this.metrics.fps) : null);
        set('latency', this.metrics.latency, this.isTracking ? this._colorFromLatency(this.metrics.latency) : null);
        set('memory', this.metrics.memory);
        set('tracking', this.metrics.trackingQuality);
        set('trackingConfidence', this.metrics.trackingConfidence.toFixed(2));
        set('cpu', this.metrics.cpuUsage, this.isTracking ? this._colorFromUsage(this.metrics.cpuUsage) : null);
        set('gpu', this.metrics.gpuInfo);
        set('gpuUsage', this.metrics.gpuUsage, this.isTracking ? this._colorFromUsage(this.metrics.gpuUsage) : null);
        set('surfacesDetected', this.metrics.surfacesDetected);
        set('droppedFrames', this.metrics.droppedFrames);
        set('totalFrames', this.metrics.totalFrames);
        set('renderTime', this.metrics.renderTime.toFixed(2) + 'ms');
        set('jsExecutionTime', this.metrics.jsExecutionTime.toFixed(2) + 'ms');
        set('gcTime', this.metrics.gcTime.toFixed(2) + 'ms');
        
        // Untuk objectTime, mungkin perlu logika khusus jika hanya diupdate saat objek muncul
        const lastObjectTimingKey = Object.keys(this.metrics.objectTimings).pop();
        if (lastObjectTimingKey && this.metrics.objectTimings[lastObjectTimingKey]) {
            set('objectTime', `${this.metrics.objectTimings[lastObjectTimingKey].loadTime.toFixed(2)}ms`);
        } else if (!this.isTracking) {
             set('objectTime', '-ms'); // Default jika tidak tracking
        }


    }

    _initEventListeners() {
        // Listener 'visibilitychange' sudah dipindahkan ke app.js
        window.addEventListener('devicemotion', (e) => {
            const a = e.acceleration;
            if (a && (Math.abs(a.x) > 10 || Math.abs(a.y) > 10 || Math.abs(a.z) > 10)) {
                console.log('PerformanceTracker: Rapid motion detected - may affect AR tracking');
            }
        });
    }

    // ... (Sisa metode Anda: _initSpectorJS, _setupSpector, _setupFrameCapture, _analyzeGPUUsage,
    // _initCPUMonitoring, markObjectLoadStart, markObjectAppeared, getObjectLoadTime,
    // getAllObjectTimings, _getGPUInfo, _colorFromFPS, _colorFromLatency, _colorFromUsage,
    // setTrackingQuality, setSurfacesDetected, reportToServer, _initPerformanceObserver,
    // markRenderStart, _generateSessionId tetap sama seperti yang sudah Anda miliki)
    // Pastikan semua metode tersebut tidak secara internal memulai/menghentikan _updateLoop
    // atau mengubah this.isTracking tanpa melalui metode start()/stop() utama.

    // Initialize Spector.JS for WebGL monitoring
    _initSpectorJS() {
        // Load Spector.js from CDN if it's not already loaded
        if (!window.SPECTOR) {
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
        } else {
            this._setupSpector();
        }
    }

    _setupSpector() {
        if (!window.SPECTOR) {
            console.error('Spector.js not available');
            return;
        }

        try {
            this.spector = new SPECTOR.Spector();
            
            // Add Spector UI if needed (for debugging)
            // this.spector.displayUI();
            
            // Set up frame capture
            if (this.options.webGLContext) {
                // Make sure we have a valid WebGL context with a canvas
                if (!this.options.webGLContext.canvas) {
                    console.error('WebGL context provided does not have a canvas property');
                    return;
                }
                
                console.log('Capturing WebGL context with Spector.js');
                this.spector.captureContext(this.options.webGLContext);
                
                // Set up capture listener to analyze GPU usage
                this.spector.onCapture.add((capture) => {
                    this._analyzeGPUUsage(capture);
                });
                
                // Safely capture frames periodically with error handling
                this._setupFrameCapture();
            } else {
                console.warn('No WebGL context provided for Spector.js');
            }
        } catch (e) {
            console.error('Error setting up Spector.js', e);
        }
    }
    
    _setupFrameCapture() {
        // Safely capture frames with error handling
        const captureFrame = () => {
            try {
                // Make sure the context and spector are still valid and page is visible
                if (this.isTracking && this.spector && this.options.webGLContext && this.options.webGLContext.canvas && 
                    document.visibilityState === 'visible') { // Hanya capture jika tracking aktif
                    this.spector.captureNextFrame();
                }
            } catch (err) {
                console.error('Error capturing frame with Spector.js', err);
            }
            
            // Continue capturing frames (akan dievaluasi kondisinya di pemanggilan berikutnya)
            setTimeout(captureFrame, 10000); // Capture every 10 seconds
        };
        
        // Start capture loop
        setTimeout(captureFrame, 10000);
    }

    _analyzeGPUUsage(capture) {
        if (!this.isTracking || !capture || !capture.commands) return; // Hanya proses jika tracking
        
        const drawCalls = capture.commands.filter(cmd => 
            cmd.name.includes('draw') || cmd.name.includes('Draw')).length;
        
        const textureBindings = capture.commands.filter(cmd => 
            cmd.name.includes('bindTexture')).length;
            
        const bufferUploads = capture.commands.filter(cmd => 
            cmd.name.includes('bufferData') || cmd.name.includes('texImage')).length;
            
        const maxDrawCallsPerFrame = 1000; 
        const drawCallWeight = 0.5;
        const textureWeight = 0.3;
        const bufferWeight = 0.2;
        
        const normalizedDrawCalls = Math.min(drawCalls / maxDrawCallsPerFrame, 1);
        const normalizedTextures = Math.min(textureBindings / 50, 1); 
        const normalizedBuffers = Math.min(bufferUploads / 30, 1); 
        
        this.metrics.gpuUsage = Math.min(100, Math.round(100 * (
            drawCallWeight * normalizedDrawCalls +
            textureWeight * normalizedTextures +
            bufferWeight * normalizedBuffers
        )));
        
        // Update UI untuk GPU usage akan terjadi via _updateUI() periodik
    }

    _initCPUMonitoring() {
        let lastCheckTime = performance.now();
        let frameTimeSum = 0;
        let frameTimeCount = 0;
        const frameTimeWindow = 20; 
        
        const monitorCPU = () => {
            if (this.isTracking) { // Hanya hitung jika tracking aktif
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
                // Jika tidak tracking, reset agar tidak menggunakan data lama saat tracking dimulai lagi
                lastCheckTime = performance.now();
                frameTimeSum = 0;
                frameTimeCount = 0;
                // this.metrics.cpuUsage = 0; // Atau biarkan nilai terakhir, _updateUI akan menampilkannya
            }
            requestAnimationFrame(monitorCPU);
        };
        requestAnimationFrame(monitorCPU);
        
        if (window.requestIdleCallback) {
            let lastIdleTime = 0;
            let idleTimeSum = 0;
            let idleTimeCount = 0;
            
            const estimateCPU = (deadline) => {
                if (this.isTracking) { // Hanya hitung jika tracking
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
    }

    markObjectLoadStart(objectId) {
        if (!this.isTracking) return performance.now(); // Kembalikan waktu tapi jangan catat jika tidak tracking
        const startTime = performance.now();
        this.metrics.objectStartTime = startTime; // Ini mungkin perlu array jika ada beberapa objek bersamaan
        this.frameTimeMarkers[objectId] = { startTime, status: 'loading' };
        console.log(`Object ${objectId} load started at ${startTime.toFixed(3)}ms`);
        return startTime;
    }

    markObjectAppeared(objectId) {
        if (!this.isTracking && !this.frameTimeMarkers[objectId]) return null; // Jangan catat jika tidak tracking KECUALI marker sudah ada (misal start sebelum stop)

        const appearTime = performance.now();
        const marker = this.frameTimeMarkers[objectId];
        
        if (marker) {
            marker.appearTime = appearTime;
            marker.status = 'appeared';
            marker.loadTime = appearTime - marker.startTime;
            
            this.metrics.objectAppearanceTime = appearTime; // Sama, mungkin perlu array
            this.metrics.objectTimings[objectId] = marker;
            
            console.log(`Object ${objectId} appeared at ${appearTime.toFixed(3)}ms (took ${marker.loadTime.toFixed(3)}ms)`);
            
            if (this.elements.objectTime) { // Update UI objectTime
                this.elements.objectTime.textContent = `${marker.loadTime.toFixed(2)}ms`;
                this.elements.objectTime.setAttribute('data-object', objectId);
            }
            return marker.loadTime;
        } else {
            console.warn(`No start marker found for object ${objectId}`);
            return null;
        }
    }

    getObjectLoadTime(objectId) {
        const timing = this.metrics.objectTimings[objectId];
        return timing ? timing.loadTime : null;
    }

    getAllObjectTimings() {
        return this.metrics.objectTimings;
    }

    _getGPUInfo() {
        // Ini bisa dipanggil sekali saat konstruksi
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (!gl) {
            this.metrics.gpuInfo = 'WebGL not supported';
            if (this.elements.gpu) this.elements.gpu.textContent = this.metrics.gpuInfo;
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
        if (this.elements.gpu) this.elements.gpu.textContent = this.metrics.gpuInfo;
    }

    _colorFromFPS(fps) {
        if (fps > 55) return '#4CAF50';
        if (fps > 45) return '#8BC34A';
        if (fps > 30) return '#FFEB3B';
        if (fps > 20) return '#FFC107';
        if (fps > 15) return '#FF9800';
        return '#F44336';
    }

    _colorFromLatency(latency) {
        if (latency < 8) return '#4CAF50';
        if (latency < 16) return '#8BC34A';
        if (latency < 33) return '#FFEB3B';
        if (latency < 50) return '#FFC107';
        if (latency < 100) return '#FF9800';
        return '#F44336';
    }
    
    _colorFromUsage(usage) {
        if (usage < 30) return '#4CAF50';
        if (usage < 60) return '#FFC107';
        if (usage < 85) return '#FF9800';
        return '#F44336';
    }

    setTrackingQuality(quality, confidence = 0) {
        // Ini bisa dipanggil dari ARManager bahkan saat !isTracking untuk status awal
        this.metrics.trackingQuality = quality;
        this.metrics.trackingConfidence = confidence;
        if (!this.isTracking) { // Jika tidak tracking, update UI sekali untuk ini
            this._updateUI();
        }
    }

    setSurfacesDetected(count) {
        this.metrics.surfacesDetected = count;
         if (!this.isTracking) { // Jika tidak tracking, update UI sekali untuk ini
            this._updateUI();
        }
    }

    reportToServer() {
        // Hanya kirim data jika startTime valid (artinya sesi tracking pernah dimulai)
        if (this.metrics.startTime === 0 && !Object.keys(this.metrics.objectTimings).length > 0) {
            console.log("PerformanceTracker: No tracking session started, skipping report.");
            return;
        }

        const now = performance.now();
        const elapsedTime = this.metrics.startTime > 0 ? (now - this.metrics.startTime) / 1000 : 0;
        
        const detailedTimings = {
            renderTime: this.metrics.renderTime.toFixed(2),
            jsExecutionTime: this.metrics.jsExecutionTime.toFixed(2),
            gcTime: this.metrics.gcTime.toFixed(2)
        };
        
        const formattedObjectTimings = {};
        Object.keys(this.metrics.objectTimings).forEach(objId => {
            const timing = this.metrics.objectTimings[objId];
            formattedObjectTimings[objId] = {
                loadTime: timing.loadTime ? timing.loadTime.toFixed(2) : 'N/A',
                startTime: timing.startTime && this.metrics.startTime > 0 ? (timing.startTime - this.metrics.startTime).toFixed(2) : 'N/A',
                appearTime: timing.appearTime && this.metrics.startTime > 0 ? (timing.appearTime - this.metrics.startTime).toFixed(2) : 'N/A'
            };
        });
        
        const dataToSend = {
            sessionId: this.metrics.sessionId,
            timestamp: new Date().toISOString(),
            elapsedTime: elapsedTime.toFixed(1),
            fps: this.metrics.fps, // Data terakhir yang terekam
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
            renderTime: detailedTimings.renderTime,
            jsExecutionTime: detailedTimings.jsExecutionTime,
            gcTime: detailedTimings.gcTime,
            detailedTimings: detailedTimings,
            objectTimings: formattedObjectTimings,
            ...this.options.deviceInfo
        };

        console.log('Sending performance data to server:', dataToSend);

        fetch(this.options.reportURL, {
            method: 'POST',
            mode: 'no-cors', // Tambahkan ini jika ada masalah CORS dan server Apps Script Anda mengizinkannya
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dataToSend)
        })
        .then(res => { // Dengan no-cors, Anda tidak bisa membaca response body atau status secara detail
            if (res.ok || res.type === 'opaque') { // opaque response untuk no-cors biasanya berarti sukses dikirim
                 console.log('Performance data likely reported successfully (no-cors).');
            } else {
                // Ini mungkin tidak akan pernah tercapai dengan no-cors jika ada error server-side
                return Promise.reject(`Server responded with status: ${res.status}`);
            }
        })
        // .then(data => { // Tidak bisa membaca data dengan no-cors
        //     console.log('Performance data reported successfully', data);
        //     if (data.status === 'error') {
        //         console.error('Server reported error:', data.message);
        //     }
        // })
        .catch(err => {
            console.error('Failed to report performance data', err);
        });
    }

    _initPerformanceObserver() {
        if (!window.PerformanceObserver) return;
        
        try {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (this.isTracking && entry.duration > 50) { // Hanya catat jika tracking
                        this.metrics.droppedFrames++;
                        console.warn('Long task detected:', entry.duration.toFixed(2) + 'ms');
                    }
                });
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            
            const paintObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.name === 'first-paint' || entry.name === 'first-contentful-paint') {
                        console.log(`PerformancePaintTiming: ${entry.name}: ${entry.startTime.toFixed(2)}ms`);
                    }
                });
            });
            paintObserver.observe({ entryTypes: ['paint'] });
            
            const resourceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest' ||
                        entry.initiatorType === 'script' || entry.initiatorType === 'img') {
                        console.log(`ResourceLoaded: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
                    }
                });
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            
            if (window.PerformanceObserver.supportedEntryTypes && 
                window.PerformanceObserver.supportedEntryTypes.includes('gc')) {
                const gcObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                         if (this.isTracking) { // Hanya catat jika tracking
                            this.metrics.gcTime += entry.duration;
                            console.warn(`Garbage collection: ${entry.duration.toFixed(2)}ms (during tracking)`);
                         }
                    });
                });
                gcObserver.observe({ entryTypes: ['gc'] });
            }
            
            const pageNav = performance.getEntriesByType('navigation')[0];
            if (pageNav) {
                const scriptTime = pageNav.domContentLoadedEventEnd - pageNav.domContentLoadedEventStart;
                this.metrics.jsExecutionTime = scriptTime; // Waktu eksekusi JS awal
            }
            
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
            
        } catch (e) {
            console.warn('PerformanceObserver not fully supported or error during setup', e);
        }
    }

    markRenderStart() {
        if (this.isTracking) { // Hanya tandai jika tracking
            performance.mark('render-start');
        }
    }

    _generateSessionId() {
        return 'wxr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

window.PerformanceTracker = PerformanceTracker;