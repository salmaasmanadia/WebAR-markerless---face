/**
 * Enhanced WebXR AR Manager with Performance Tracking
 * Handles the AR experience with integrated performance monitoring for
 * surface detection, object placement, and object manipulation using WebXR API
 */
class ARManager {
    constructor(options) {
        // Default options
        this.options = Object.assign({
            models: [
                { name: 'Sofa', type: 'gltf', path: 'models/sofa.glb' },    // GANTI DENGAN PATH AKTUAL MODEL SOFA ANDA
                { name: 'Sofa merah', type: 'gltf', path: 'models/sofa merah.glb' }, // GANTI DENGAN PATH AKTUAL MODEL KURSI ANDA
                { name: 'Kursi Biru', type: 'gltf', path: 'models/kursi biru.glb' }
            ],
            currentModelIndex: 0, // Model pertama yang akan aktif adalah Sofa
            defaultScale: 1.0,
            showNotification: this._showNotification.bind(this),
            performanceMonitoring: true,
            performanceOptions: {
                updateInterval: 1000,
                reportInterval: 30000,
                reportURL: 'https://script.google.com/macros/s/AKfycbz0E7QfuE6vwJ6ljqosNuGYncA8HTJcJPzYFIYhdkJDn-CDBdxNkhWPcSCDUCZgWt7C5A/exec',
                maxLatencySamples: 30,
                captureSpectorFrames: 10 // Number of frames to capture with Spector.js
            }
        }, options);

        // State
        this.state = {
            isInitialized: false,
            isArSupported: false,
            xrSession: null,
            xrReferenceSpace: null,
            xrHitTestSource: null,
            renderer: null,
            scene: null,
            camera: null,
            placedObjects: [],
            currentScale: this.options.defaultScale,
            activeObject: null,
            reticle: null,
            reticleVisible: false,
            controller: null,
            raycaster: new THREE.Raycaster(),
            modelInfo: {
                name: this.options.models[this.options.currentModelIndex].name,
                scale: this.options.defaultScale
            },
            gltfLoader: null,
            isDragging: false,
            dragObject: null,
            clock: new THREE.Clock(),
            xrHitTestResults: [],
            // Performance tracking
            performanceTracker: null,
            frameCounter: 0,
            lastRenderTime: 0,
            renderStartTime: 0
        };

        // Bind methods
        this._onSelect = this._onSelect.bind(this);
        this._onSessionEnded = this._onSessionEnded.bind(this);
        this._onHitTest = this._onHitTest.bind(this);
        this._updateHitTest = this._updateHitTest.bind(this);
        this._render = this._render.bind(this);
    }

    /**
     * Initialize the WebXR AR experience with performance tracking
     */
    async init() {
        if (this.state.isInitialized) return Promise.resolve();

        return new Promise(async (resolve, reject) => {
            try {
                // Mark start time for initialization performance
                const initStartTime = performance.now();

                // Check WebXR support
                if (navigator.xr) {
                    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
                    this.state.isArSupported = isSupported;
                    if (!isSupported) {
                        throw new Error('WebXR AR not supported on this device');
                    }
                } else {
                    throw new Error('WebXR not supported in this browser');
                }

                // Setup Three.js scene
                this._setupThreeJs();

                // Create the reticle
                this._createReticle();

                // Init GLTF loader
                this.state.gltfLoader = new THREE.GLTFLoader(); //

                // Setup the container for AR UI elements
                this._setupARUI();

                // Setup performance tracking if enabled
                if (this.options.performanceMonitoring) {
                    this._setupPerformanceTracking();
                }

                this.state.isInitialized = true;

                // Calculate and log initialization time
                const initTime = performance.now() - initStartTime;
                console.log(`AR initialization completed in ${initTime.toFixed(2)}ms`);

                if (this.state.performanceTracker) {
                    this.state.performanceTracker.markObjectLoadStart('ar-init');
                    this.state.performanceTracker.markObjectAppeared('ar-init');
                }

                this.options.showNotification(`AR initialized successfully (${initTime.toFixed(0)}ms)`, 2000);
                resolve();
            } catch (error) {
                console.error('AR initialization error:', error);
                this.options.showNotification(`AR Error: ${error.message}`, 3000);
                reject(error);
            }
        });
    }

    /**
     * Set up Performance Tracking system
     * @private
     */
    _setupPerformanceTracking() {
        try {
            // Check if PerformanceTracker is available globally
            if (window.PerformanceTracker) {
                // Initialize with current device info
                const deviceInfo = {
                    userAgent: navigator.userAgent,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    devicePixelRatio: window.devicePixelRatio,
                    arMode: 'world-locked',
                    arVersion: 'WebXR'
                };

                // Create performance tracker instance with WebGL context for GPU monitoring
                this.state.performanceTracker = new PerformanceTracker({
                    ...this.options.performanceOptions,
                    deviceInfo: deviceInfo,
                    showNotification: this.options.showNotification,
                    webGLContext: this.state.renderer ? this.state.renderer.getContext() : null
                }); //

                // Start tracking
                this.state.performanceTracker.start();
                console.log('Performance tracking initialized');
            } else {
                console.warn('PerformanceTracker not available, performance monitoring disabled');
            }
        } catch (error) {
            console.error('Failed to initialize performance tracking:', error);
        }
    }

    /**
     * Set up Three.js scene and renderer
     * @private
     */
    _setupThreeJs() {
        // Create renderer with alpha:true to allow camera feed to show through
        this.state.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.state.renderer.setPixelRatio(window.devicePixelRatio);
        this.state.renderer.setSize(window.innerWidth, window.innerHeight);
        this.state.renderer.xr.enabled = true;

        // IMPORTANT: Set the clear color to transparent with 0 alpha
        this.state.renderer.setClearColor(0x000000, 0);

        // Append renderer to DOM
        document.body.appendChild(this.state.renderer.domElement);

        // Create scene
        this.state.scene = new THREE.Scene();

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); //
        this.state.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); //
        directionalLight.position.set(0, 5, 0); //
        this.state.scene.add(directionalLight);

        // Create camera (will be updated by WebXR)
        this.state.camera = new THREE.PerspectiveCamera(
            70, window.innerWidth / window.innerHeight, 0.01, 1000
        );

        // Handle window resize
        window.addEventListener('resize', () => {
            this.state.camera.aspect = window.innerWidth / window.innerHeight;
            this.state.camera.updateProjectionMatrix();
            this.state.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    /**
     * Create reticle for indicating hit test surface
     * @private
     */
    _createReticle() {
        // Create a reticle mesh
        const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2); //
        const material = new THREE.MeshBasicMaterial({
            color: 0x44CC88,
            transparent: true,
            opacity: 0.8
        }); //

        this.state.reticle = new THREE.Mesh(geometry, material);
        this.state.reticle.matrixAutoUpdate = false;
        this.state.reticle.visible = false;
        this.state.scene.add(this.state.reticle);
    }

    /**
     * Setup AR UI elements
     * @private
     */
    _setupARUI() {
        const arOverlay = document.getElementById('ar-overlay');
        if (arOverlay) {
            // Make sure it's visible but not blocking
            arOverlay.style.display = 'block';
            arOverlay.style.pointerEvents = 'none';
        }

        // Make sure control panel is visible in AR mode
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.zIndex = '1000';
        }

        // Make sure size controls are visible in AR mode
        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.zIndex = '1000';
        }

        // Performance stats should be visible
        const perfStats = document.getElementById('performance-stats');
        if (perfStats) {
            perfStats.style.display = 'block';
            perfStats.style.zIndex = '1000';
        }

        // Enable pointer events for control buttons but not the reticle container
        const reticleContainer = document.getElementById('reticle-container');
        if (reticleContainer) {
            reticleContainer.style.pointerEvents = 'none';
        }
    }

    /**
     * Start WebXR AR session with performance monitoring
     */
    async startARSession() {
        if (!this.state.isInitialized || !this.state.isArSupported) {
            this.options.showNotification('AR not supported or not initialized', 3000);
            return;
        }

        try {
            // Mark session start for performance tracking
            const sessionStartTime = performance.now();

            // Check if session is already running
            if (this.state.xrSession) {
                console.log('AR session already running');
                return;
            }

            // IMPORTANT: Define required features
            const requiredFeatures = ['local', 'hit-test']; //
            const optionalFeatures = ['dom-overlay', 'camera-access']; //
            const sessionInit = {
                requiredFeatures,
                optionalFeatures,
                // Request camera access explicitly
                environmentIntegration: true //
            };

            // Add DOM overlay if available
            const arOverlay = document.getElementById('ar-overlay'); //
            if (arOverlay) {
                sessionInit.domOverlay = { root: arOverlay }; //
                // arOverlay.style.display = 'block'; //
            }

            // Ensure UI controls are visible before entering AR
            this._showUIControls();

            // Track session start in performance monitor
            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('ar-session');
            }

            // Request the session
            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.state.xrSession = session;

            // Setup session
            this.state.renderer.xr.setReferenceSpaceType('local');
            await this.state.renderer.xr.setSession(session);

            // Set up reference space and hit testing
            this.state.xrReferenceSpace = await session.requestReferenceSpace('local'); //
            const viewerReferenceSpace = await session.requestReferenceSpace('viewer'); //

            // Create hit test source
            this.state.xrHitTestSource = await session.requestHitTestSource({ //
                space: viewerReferenceSpace //
            });

            // Add event listeners
            session.addEventListener('end', this._onSessionEnded);

            // Set up controller for interactions
            this.state.controller = this.state.renderer.xr.getController(0);
            this.state.controller.addEventListener('select', this._onSelect);
            this.state.scene.add(this.state.controller);

            // Set a black background with zero opacity to ensure camera feed is visible
            document.body.style.backgroundColor = 'transparent';

            // Make sure the canvas is properly configured for camera feed
            const canvas = this.state.renderer.domElement;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = '1'; // Above background, below UI

            // Record session initialization time and mark completion
            const sessionInitTime = performance.now() - sessionStartTime;
            console.log(`AR session started in ${sessionInitTime.toFixed(2)}ms`);

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectAppeared('ar-session');
                // Update tracking quality to initial state
                this.state.performanceTracker.setTrackingQuality('Initializing', 0);
            }

            // Start rendering
            this.state.renderer.setAnimationLoop(this._render);
            this.options.showNotification(`AR session started (${sessionInitTime.toFixed(0)}ms)`, 2000);
        } catch (error) {
            console.error('Error starting AR session:', error);
            this.options.showNotification(`AR Error: ${error.message}`, 3000);
            if (this.state.performanceTracker) {
                // Record error in performance tracking
                this.state.performanceTracker.setTrackingQuality('Failed', 0);
            }
        }
    }

    /**
     * Show UI controls for AR mode
     * @private
     */
    _showUIControls() {
        // Show control panel
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.zIndex = '1000';
            // Make sure pointer events work
            controlPanel.style.pointerEvents = 'auto';
        }

        // Show size controls
        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.zIndex = '1000';
            // Make sure pointer events work
            sizeControls.style.pointerEvents = 'auto';
        }

        // Show model info
        const modelInfo = document.getElementById('model-info');
        if (modelInfo) {
            modelInfo.style.display = 'block';
            modelInfo.style.zIndex = '1000';
        }

        // Make sure the instructions are visible
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = 'block';
            instructions.style.zIndex = '1000';
        }

        // Show performance stats
        const perfStats = document.getElementById('performance-stats');
        if (perfStats) {
            perfStats.style.display = 'block';
            perfStats.style.zIndex = '1000';
        }
    }

    /**
     * End WebXR AR session
     */
    endARSession() {
        if (this.state.xrSession) {
            if (this.state.performanceTracker) {
                // Record session end event
                this.state.performanceTracker.markObjectLoadStart('session-end');
            }

            this.state.xrSession.end();

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectAppeared('session-end');
            }
        }
    }

    /**
     * Handle WebXR session ended
     * @private
     */
    _onSessionEnded() {
        this.state.xrSession = null;
        this.state.xrHitTestSource = null;
        this.state.renderer.setAnimationLoop(null);
        this.options.showNotification('AR session ended', 2000);

        // If performance tracking is enabled, report final session data
        if (this.state.performanceTracker) {
            this.state.performanceTracker.reportToServer(); //
        }
    }

    /**
     * Handle select event (tap in AR view)
     * @private
     * @param {Event} event - Select event
     */
    _onSelect() {
        if (this.state.reticle.visible) {
            // Get reticle position and place object there
            const position = new THREE.Vector3();
            const rotation = new THREE.Euler();
            const scale = new THREE.Vector3();

            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), scale); //

            // Track how long it takes to process the selection and place the object
            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('object-placement');
            }

            // Place the object
            this.placeObject(position);
        }
    }

    /**
     * Process hit test results
     * @private
     * @param {XRFrame} frame - XR frame
     */
    _updateHitTest(frame) {
        if (!this.state.xrHitTestSource) return;

        // Get hit test results
        const hitTestResults = frame.getHitTestResults(this.state.xrHitTestSource);

        // Save for later use
        this.state.xrHitTestResults = hitTestResults;

        if (hitTestResults.length > 0) {
            // Get pose from the first hit test result
            const hitPose = hitTestResults[0].getPose(this.state.xrReferenceSpace);

            if (hitPose) {
                // Update reticle position to show where object will be placed
                this.state.reticle.visible = true;
                this.state.reticle.matrix.fromArray(hitPose.transform.matrix);

                // Update tracking quality in performance monitor
                if (this.state.performanceTracker) {
                    this.state.performanceTracker.setTrackingQuality('Good', 1.0);
                    this.state.performanceTracker.setSurfacesDetected(hitTestResults.length);
                }
            }
        } else {
            // Hide reticle if no surfaces detected
            this.state.reticle.visible = false;

            // Update tracking quality
            if (this.state.performanceTracker) {
                this.state.performanceTracker.setTrackingQuality('Poor', 0.2);
                this.state.performanceTracker.setSurfacesDetected(0);
            }
        }
    }

    /**
     * WebXR render loop with performance measuring
     * @private
     * @param {DOMHighResTimeStamp} timestamp - Current timestamp
     * @param {XRFrame} frame - XR frame
     */
    _render(timestamp, frame) {
        if (!frame) return;

        // Record render start time for performance metrics
        this.state.renderStartTime = performance.now();

        // Update hit testing
        this._onHitTest(frame);

        // Animate placed objects if needed
        const delta = this.state.clock.getDelta();

        for (const obj of this.state.placedObjects) {
            if (obj.userData.animation) {
                // Update animation mixer if available
                if (obj.userData.mixer) {
                    obj.userData.mixer.update(delta);
                }

                // Apply custom rotation animations for primitives
                if (obj.userData.rotationSpeed) {
                    obj.rotation.x += obj.userData.rotationSpeed.x;
                    obj.rotation.y += obj.userData.rotationSpeed.y;
                    obj.rotation.z += obj.userData.rotationSpeed.z;
                }
            }
        }

        // Render the scene
        this.state.renderer.render(this.state.scene, this.state.camera);

        // Calculate render time and track performance
        const renderTime = performance.now() - this.state.renderStartTime;
        this.state.frameCounter++;

        // Track performance every frame
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markFrame();

            // Update detailed render timing metrics every 10 frames
            if (this.state.frameCounter % 10 === 0) { //
                this.state.performanceTracker.metrics.renderTime = renderTime; //
                this.state.performanceTracker.metrics.jsExecutionTime = renderTime - this.state.renderer.info.render.frame; //
            }
        }
    }

    /**
     * Handle hit test results
     * @private
     * @param {XRFrame} frame - XR frame
     */
    _onHitTest(frame) {
        if (!this.state.xrSession || !this.state.xrHitTestSource) return;

        // Update hit test
        this._updateHitTest(frame);
    }

    /**
     * Place a 3D object in the AR scene with performance tracking
     * @param {THREE.Vector3} position - Position to place the object
     */
    placeObject(position = null) {
        const modelDef = this.options.models[this.options.currentModelIndex]; //
        const objectId = `${modelDef.name}-${Date.now()}`;

        // Start object placement timing
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart(objectId);
        }

        // If position not provided and we have reticle, use its position
        if (!position && this.state.reticle && this.state.reticle.visible) {
            position = new THREE.Vector3();
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3()); //
        }

        // If still no position, can't place object
        if (!position) {
            this.options.showNotification('Move device to find a surface', 2000);
            return null;
        }

        if (modelDef.type === 'gltf') {
            // Create GLTF model
            this.state.gltfLoader.load(modelDef.path, (gltf) => { //
                const model = gltf.scene;

                // Set position
                model.position.copy(position);

                // Apply scale
                model.scale.set(
                    this.state.currentScale,
                    this.state.currentScale,
                    this.state.currentScale
                );

                // Add to scene
                this.state.scene.add(model);

                // Track the object
                this.state.placedObjects.push(model);
                this.state.activeObject = model;

                // Add animation if available
                if (gltf.animations && gltf.animations.length > 0) { //
                    const mixer = new THREE.AnimationMixer(model); //

                    // Play all animations
                    for (let i = 0; i < gltf.animations.length; i++) { //
                        const clip = gltf.animations[i]; //
                        const action = mixer.clipAction(clip); //
                        action.play(); //
                    }

                    model.userData.mixer = mixer; //
                    model.userData.animation = true; //
                }

                // Add metadata
                model.userData.type = modelDef.name;
                model.userData.scale = this.state.currentScale;
                model.userData.id = objectId;

                // Mark object placement completion in performance tracker
                if (this.state.performanceTracker) {
                    const loadTime = this.state.performanceTracker.markObjectAppeared(objectId);
                    this.options.showNotification(`Placed ${modelDef.name} (${loadTime ? loadTime.toFixed(0) + "ms" : "N/A"})`, 2000);
                } else {
                    this.options.showNotification(`Placed ${modelDef.name}`, 2000);
                }

                this._updateModelInfo();

                return model;
            },
            // Progress callback
            (progress) => {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                if (percent % 20 === 0) { // Log at 0%, 20%, 40%, 60%, 80%, 100%
                    console.log(`Loading model: ${percent}%`);
                }
            },
            // Error callback
            (error) => {
                console.error('Error loading GLTF model:', error);
                this.options.showNotification('Failed to load 3D model', 2000);

                // Mark failure in performance tracking
                if (this.state.performanceTracker) {
                    this.state.performanceTracker.markObjectLoadStart(`${objectId}-failed`);
                    this.state.performanceTracker.markObjectAppeared(`${objectId}-failed`);
                }

                return null;
            });
        }
        // Primitive object creation logic is removed as per user request
        // else if (modelDef.type === 'primitive') { ... }
    }

    /**
     * Increase the scale of the current or active object
     */
    increaseScale() {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = currentScale * 1.2; // Increase by 20%

            if (newScale >= 5.0) { //
                this.options.showNotification("Maximum scale reached", 2000);
                return;
            }

            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            // Update default scale for next placed object
            this.state.currentScale *= 1.2;
            if (this.state.currentScale >= 5.0) { //
                this.state.currentScale = 5.0;
            }
            this.options.showNotification(`Default scale: ${this.state.currentScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();
    }

    /**
     * Decrease the scale of the current or active object
     */
    decreaseScale() {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = currentScale * 0.8; // Decrease by 20%

            if (newScale <= 0.1) { //
                this.options.showNotification("Minimum scale reached", 2000);
                return;
            }

            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            // Update default scale for next placed object
            this.state.currentScale *= 0.8;
            if (this.state.currentScale <= 0.1) { //
                this.state.currentScale = 0.1;
            }
            this.options.showNotification(`Default scale: ${this.state.currentScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();
    }

    /**
     * Reset the scale of the current object to default
     */
    resetScale() {
        if (this.state.activeObject) {
            // Reset to default scale
            this.state.activeObject.scale.set(
                this.options.defaultScale,
                this.options.defaultScale,
                this.options.defaultScale
            );
            this.state.activeObject.userData.scale = this.options.defaultScale;
            this.options.showNotification(`Scale reset to ${this.options.defaultScale.toFixed(2)}x`, 1000);
        } else {
            // Reset default scale for next placed object
            this.state.currentScale = this.options.defaultScale;
            this.options.showNotification(`Default scale reset to ${this.options.defaultScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();

        // Track scale reset in performance metrics
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('scale-reset');
            this.state.performanceTracker.markObjectAppeared('scale-reset');
        }
    }

    /**
     * Change the current model to next in list
     */
    nextModel() {
        // Track model switching performance
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('model-switch');
        }

        this.options.currentModelIndex = (this.options.currentModelIndex + 1) % this.options.models.length;
        const modelName = this.options.models[this.options.currentModelIndex].name;
        this.options.showNotification(`Selected model: ${modelName}`, 2000);

        this._updateModelInfo();

        // Track completion of model switch
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('model-switch');
        }
    }

    /**
     * Remove the last placed object
     */
    removeLastObject() { // Note: in app.js, the remove button calls arManager.removeObject(), this might need to be removeLastObject() or removeObject needs to be implemented to remove the active or last.
        // Track operation performance
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('remove-object');
        }

        if (this.state.placedObjects.length > 0) {
            // Get the last object
            const lastObject = this.state.placedObjects.pop();

            // Remove from scene
            this.state.scene.remove(lastObject);

            // Clear active object if it was the one removed
            if (this.state.activeObject === lastObject) {
                this.state.activeObject = null;
            }

            this.options.showNotification(`Removed ${lastObject.userData.type}`, 2000);

            // Track memory usage after object removal
            if (this.state.performanceTracker) {
                this.state.performanceTracker.updateMemoryUsage();
            }
        } else {
            this.options.showNotification('No objects to remove', 2000);
        }

        // Track completion of remove operation
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('remove-object');
        }
    }
    
    // Method to remove the currently active object, potentially more useful for UI button.
    removeObject() {
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('remove-active-object');
        }

        if (this.state.activeObject) {
            const objectToRemove = this.state.activeObject;
            this.state.scene.remove(objectToRemove);

            // Remove from placedObjects array
            this.state.placedObjects = this.state.placedObjects.filter(obj => obj !== objectToRemove);
            
            this.options.showNotification(`Removed ${objectToRemove.userData.type}`, 2000);
            this.state.activeObject = null; // Clear active object

            if (this.state.performanceTracker) {
                this.state.performanceTracker.updateMemoryUsage();
                this.state.performanceTracker.markObjectAppeared('remove-active-object');
            }
        } else if (this.state.placedObjects.length > 0) {
            // If no active object, remove the last one
            this.removeLastObject();
             if (this.state.performanceTracker) { // Ensure this also gets marked correctly if falling back to removeLastObject
                this.state.performanceTracker.markObjectAppeared('remove-active-object'); // Or a different marker
            }
        }
        else {
            this.options.showNotification('No active object to remove', 2000);
             if (this.state.performanceTracker) { // Ensure this path also marks completion
                this.state.performanceTracker.markObjectAppeared('remove-active-object');
            }
        }
        this._updateModelInfo();
    }


    /**
     * Toggle animation for active object
     */
    toggleAnimation() {
        // Track operation performance
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('toggle-animation');
        }

        if (this.state.activeObject) {
            const isAnimating = this.state.activeObject.userData.animation;
            this.state.activeObject.userData.animation = !isAnimating;

            const status = this.state.activeObject.userData.animation ? 'enabled' : 'disabled';
            this.options.showNotification(`Animation ${status}`, 2000);
        } else {
            this.options.showNotification('No active object', 2000);
        }

        // Track completion
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('toggle-animation');
        }
    }

    /**
     * Rotate the active object (example: by 45 degrees around Y axis)
     * You might want to make the axis and angle configurable
     */
    rotateObject(degrees = 45) {
        if (this.state.activeObject) {
            const radians = THREE.MathUtils.degToRad(degrees);
            this.state.activeObject.rotateY(radians); // Rotate around Y axis
            this.options.showNotification(`Object rotated by ${degrees}°`, 1000);
        } else {
            this.options.showNotification('No active object to rotate', 2000);
        }
    }


    /**
     * Update displayed model info
     * @private
     */
    _updateModelInfo() {
        const modelInfoElem = document.getElementById('model-info');
        if (!modelInfoElem) return;

        // Check if models array is not empty
        if (!this.options.models || this.options.models.length === 0) {
            modelInfoElem.textContent = `Model: None | Scale: N/A | Objects: ${this.state.placedObjects.length}`;
            this.state.modelInfo = {
                name: "None",
                scale: 0,
                objectCount: this.state.placedObjects.length
            };
            return;
        }
        
        // Ensure currentModelIndex is valid
        if (this.options.currentModelIndex < 0 || this.options.currentModelIndex >= this.options.models.length) {
            this.options.currentModelIndex = 0; // Reset to a safe default if out of bounds
        }


        const currentModel = this.options.models[this.options.currentModelIndex].name;
        let scale = this.options.defaultScale;

        if (this.state.activeObject && this.state.activeObject.userData) { // Added check for userData
            scale = this.state.activeObject.userData.scale || this.state.currentScale;
        } else {
            scale = this.state.currentScale;
        }

        // Update the UI element with model info
        const modelNameSpan = document.getElementById('current-model-name');
        const scaleSpan = document.getElementById('current-scale');
        
        if (modelNameSpan) modelNameSpan.textContent = currentModel;
        if (scaleSpan) scaleSpan.textContent = `${scale.toFixed(2)}x`;


        // Also update the main model-info div if it's used directly for combined text
        // modelInfoElem.textContent = `Model: ${currentModel} | Scale: ${scale.toFixed(2)}x | Objects: ${this.state.placedObjects.length}`;
        
        // Update state model info for performance tracking
        this.state.modelInfo = {
            name: currentModel,
            scale: scale,
            objectCount: this.state.placedObjects.length
        };
    }

    /**
     * Generate a random color for primitive objects (No longer used as primitives are removed)
     * @private
     * @returns {number} - RGB color value
     */
    // _getRandomColor() { ... } // Removed as primitives are not used

    /**
     * Display a notification message
     * @private
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    _showNotification(message, duration = 2000) {
        // This method is passed as a callback, check if the UIManager's notification is preferred
        // For now, assuming a generic notification element or relying on the passed `showNotification` from options.
        // If UIManager's notification is globally available and preferred:
        // if (window.uiManager && typeof window.uiManager.showNotification === 'function') {
        //     window.uiManager.showNotification(message, duration);
        //     return;
        // }

        const notificationElem = document.getElementById('ar-notification'); // Using existing notification element from HTML
        if (!notificationElem) {
            console.warn("Notification element 'ar-notification' not found.");
            return;
        }

        // Clear any existing timeout
        if (this._notificationTimeout) {
            clearTimeout(this._notificationTimeout);
        }

        // Show notification
        notificationElem.textContent = message;
        notificationElem.style.opacity = '1'; // Make it visible
        // notificationElem.classList.add('visible'); // If using class-based visibility

        // Hide after duration
        this._notificationTimeout = setTimeout(() => {
            notificationElem.style.opacity = '0'; // Hide it
            // notificationElem.classList.remove('visible');
        }, duration);
    }

    /**
     * Capture current AR view and save as image
     * Can be used for sharing or debugging
     */
    captureARView() {
        // Mark start of capture process for performance metrics
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('capture-view');
        }

        try {
            // Convert canvas to data URL
            const dataURL = this.state.renderer.domElement.toDataURL('image/png'); //

            // Create temporary link for download
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `ar-capture-${Date.now()}.png`;
            document.body.appendChild(link);

            // Simulate click to trigger download
            link.click();

            // Clean up
            document.body.removeChild(link);

            this.options.showNotification('AR view captured', 2000);

            // Mark completion of capture
            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectAppeared('capture-view');
            }
        } catch (error) {
            console.error('Error capturing AR view:', error);
            this.options.showNotification('Failed to capture AR view', 2000);

            // Track error in performance metrics
            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('capture-error');
                this.state.performanceTracker.markObjectAppeared('capture-error');
            }
        }
    }

    /**
     * Generate a detailed performance report
     * @returns {Object} - Performance report data
     */
    generatePerformanceReport() {
        if (!this.state.performanceTracker) {
            return { error: 'Performance tracking not enabled' };
        }

        // Get all object timings
        const objectTimings = this.state.performanceTracker.getAllObjectTimings(); //

        // Get current performance metrics
        const currentMetrics = { ...this.state.performanceTracker.metrics };

        // Add AR-specific metrics
        const arMetrics = {
            objectsPlaced: this.state.placedObjects.length,
            activeModel: (this.options.models && this.options.models.length > 0) ? this.options.models[this.options.currentModelIndex].name : "None",
            currentScale: this.state.currentScale,
            surfacesDetected: this.state.xrHitTestResults ? this.state.xrHitTestResults.length : 0,
            sessionActive: !!this.state.xrSession,
            elapsedTime: ((performance.now() - this.state.performanceTracker.metrics.startTime) / 1000).toFixed(1)
        };

        // Generate full report
        const report = {
            timestamp: new Date().toISOString(),
            sessionId: this.state.performanceTracker.metrics.sessionId,
            hardware: {
                gpu: this.state.performanceTracker.metrics.gpuInfo,
                devicePixelRatio: window.devicePixelRatio,
                screenResolution: `${window.screen.width}x${window.screen.height}`
            },
            performance: {
                fps: currentMetrics.fps,
                avgLatency: currentMetrics.latency.toFixed(2),
                memoryUsage: currentMetrics.memory,
                cpuUsage: currentMetrics.cpuUsage.toFixed(1),
                gpuUsage: currentMetrics.gpuUsage.toFixed(1),
                frameCount: currentMetrics.totalFrames,
                droppedFrames: currentMetrics.droppedFrames
            },
            arStatus: arMetrics,
            objectTimings: objectTimings
        };

        console.log('Generated performance report:', report);
        return report;
    }

    /**
     * Register WebXR errors with performance tracker
     * @param {Error} error - Error to register
     * @param {string} context - Context where error occurred
     */
    _trackError(error, context) {
        console.error(`AR error (${context}):`, error);

        if (this.state.performanceTracker) {
            // Create unique error ID
            const errorId = `error-${context}-${Date.now()}`;

            // Track error start
            this.state.performanceTracker.markObjectLoadStart(errorId);

            // Add metadata and mark completion
            this.state.performanceTracker.markObjectAppeared(errorId);

            // Force a performance report when error occurs
            this.state.performanceTracker.reportToServer();
        }

        this.options.showNotification(`AR Error: ${error.message}`, 3000);
    }

    /**
     * Update lighting based on environment
     * @param {number} ambientIntensity - Ambient light intensity (0-1)
     * @param {number} directionalIntensity - Directional light intensity (0-1)
     */
    updateLighting(ambientIntensity = 0.6, directionalIntensity = 0.8) {
        // Track lighting update performance
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('update-lighting');
        }

        // Find and update ambient light
        const ambientLight = this.state.scene.children.find(
            child => child instanceof THREE.AmbientLight
        ); //

        if (ambientLight) {
            ambientLight.intensity = Math.max(0, Math.min(1, ambientIntensity));
        }

        // Find and update directional light
        const directionalLight = this.state.scene.children.find(
            child => child instanceof THREE.DirectionalLight
        ); //

        if (directionalLight) {
            directionalLight.intensity = Math.max(0, Math.min(1, directionalIntensity));
        }

        this.options.showNotification(`Lighting updated`, 1000);

        // Track lighting update completion
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('update-lighting');
        }
    }

    /**
     * Export performance data to JSON file
     */
    exportPerformanceData() {
        if (!this.state.performanceTracker) {
            this.options.showNotification('Performance tracking not enabled', 2000);
            return;
        }

        try {
            // Generate report
            const report = this.generatePerformanceReport();

            // Convert to JSON string
            const jsonString = JSON.stringify(report, null, 2);

            // Create download link
            const blob = new Blob([jsonString], { type: 'plain/text' }); //
            const url = URL.createObjectURL(blob); //
            const link = document.createElement('a');

            link.href = url;
            link.download = `ar-performance-${report.sessionId}.json`; //
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.options.showNotification('Performance data exported', 2000);
        } catch (error) {
            console.error('Error exporting performance data:', error);
            this.options.showNotification('Failed to export performance data', 2000);
        }
    }
}

// Export the ARManager class
window.ARManager = ARManager;