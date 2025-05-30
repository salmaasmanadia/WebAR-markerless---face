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
                { name: 'Sofa', type: 'gltf', path: 'models/sofa.glb' },
                { name: 'Sofa merah', type: 'gltf', path: 'models/sofa merah.glb' },
                { name: 'Kursi Biru', type: 'gltf', path: 'models/kursi biru.glb' }
            ],
            currentModelIndex: 0,
            defaultScale: 1.0,
            showNotification: this._showNotification.bind(this),
            performanceMonitoring: true,
            performanceOptions: {
                updateInterval: 1000,
                reportInterval: 30000,
                reportURL: 'https://script.google.com/macros/s/AKfycbz0E7QfuE6vwJ6ljqosNuGYncA8HTJcJPzYFIYhdkJDn-CDBdxNkhWPcSCDUCZgWt7C5A/exec',
                maxLatencySamples: 30,
                captureSpectorFrames: 10
            }
        }, options);

        // State
        this.state = {
            isInitialized: false,
            isArSupported: false,
            isInAR: false,
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
            clock: new THREE.Clock(),
            xrHitTestResults: [],
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
        this._renderNonAR = this._renderNonAR.bind(this);
    }

    /**
     * Initialize the WebXR AR experience
     */
    async init() {
        if (this.state.isInitialized) return Promise.resolve();

        try {
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
            this.state.gltfLoader = new THREE.GLTFLoader();

            // Setup AR UI elements
            this._setupARUI();

            // Setup performance tracking if enabled
            if (this.options.performanceMonitoring) {
                this._setupPerformanceTracking();
            }

            this.state.isInitialized = true;

            const initTime = performance.now() - initStartTime;
            console.log(`AR initialization completed in ${initTime.toFixed(2)}ms`);

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('ar-init');
                this.state.performanceTracker.markObjectAppeared('ar-init');
            }

            this.options.showNotification(`AR initialized successfully (${initTime.toFixed(0)}ms)`, 800);
            
            // Start non-AR render loop
            this._startNonARMode();
            
            return Promise.resolve();
        } catch (error) {
            console.error('AR initialization error:', error);
            this.options.showNotification(`AR Error: ${error.message}`, 3000);
            throw error;
        }
    }

    /**
     * Set up Performance Tracking system
     */
    _setupPerformanceTracking() {
        try {
            if (window.PerformanceTracker) {
                const deviceInfo = {
                    userAgent: navigator.userAgent,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    devicePixelRatio: window.devicePixelRatio,
                    arMode: 'world-locked',
                    arVersion: 'WebXR'
                };

                this.state.performanceTracker = new PerformanceTracker({
                    ...this.options.performanceOptions,
                    deviceInfo: deviceInfo,
                    showNotification: this.options.showNotification,
                    webGLContext: this.state.renderer ? this.state.renderer.getContext() : null
                });

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
     */
    _setupThreeJs() {
        // Create renderer
        this.state.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.state.renderer.setPixelRatio(window.devicePixelRatio);
        this.state.renderer.setSize(window.innerWidth, window.innerHeight);
        this.state.renderer.xr.enabled = true;
        this.state.renderer.setClearColor(0x000000, 0);

        // Append renderer to DOM
        document.body.appendChild(this.state.renderer.domElement);

        // Create scene
        this.state.scene = new THREE.Scene();

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.state.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 5, 0);
        this.state.scene.add(directionalLight);

        // Create camera
        this.state.camera = new THREE.PerspectiveCamera(
            70, window.innerWidth / window.innerHeight, 0.01, 1000
        );
        this.state.camera.position.set(0, 1.6, 3);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.state.camera.aspect = window.innerWidth / window.innerHeight;
            this.state.camera.updateProjectionMatrix();
            this.state.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    /**
     * Create reticle for indicating hit test surface
     */
    _createReticle() {
        const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0x44CC88,
            transparent: true,
            opacity: 0.8
        });

        this.state.reticle = new THREE.Mesh(geometry, material);
        this.state.reticle.matrixAutoUpdate = false;
        this.state.reticle.visible = false;
        this.state.scene.add(this.state.reticle);
    }

    /**
     * Setup AR UI elements
     */
    _setupARUI() {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.zIndex = '1000';
        }

        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.zIndex = '1000';
        }

        const perfStats = document.getElementById('performance-stats');
        if (perfStats) {
            perfStats.style.display = 'block';
            perfStats.style.zIndex = '1000';
        }

        // Show/hide AR button
        this._updateARButton();
    }

    /**
     * Update AR button visibility and text
     */
    _updateARButton() {
        const arButton = document.getElementById('ar-button');
        if (arButton) {
            if (this.state.isArSupported) {
                arButton.style.display = 'block';
                arButton.textContent = this.state.isInAR ? 'Exit AR' : 'Enter AR';
                arButton.onclick = () => {
                    if (this.state.isInAR) {
                        this.endARSession();
                    } else {
                        this.startARSession();
                    }
                };
            } else {
                arButton.style.display = 'none';
            }
        }
    }

    /**
     * Start non-AR mode (preview mode)
     */
    _startNonARMode() {
        this.state.isInAR = false;
        this.state.renderer.setClearColor(0x222222, 1); // Dark gray background
        this.state.renderer.setAnimationLoop(this._renderNonAR);
        this._updateARButton();
        this.options.showNotification('Preview mode active', 2000);
    }

    /**
     * Start WebXR AR session
     */
    async startARSession() {
        if (!this.state.isInitialized || !this.state.isArSupported) {
            this.options.showNotification('AR not supported or not initialized', 3000);
            return;
        }

        try {
            const sessionStartTime = performance.now();

            if (this.state.xrSession) {
                console.log('AR session already running');
                return;
            }

            const requiredFeatures = ['local', 'hit-test'];
            const optionalFeatures = ['dom-overlay', 'camera-access'];
            const sessionInit = {
                requiredFeatures,
                optionalFeatures,
                environmentIntegration: true
            };

            this._showUIControls();

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('ar-session');
            }

            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.state.xrSession = session;

            this.state.renderer.xr.setReferenceSpaceType('local');
            await this.state.renderer.xr.setSession(session);

            this.state.xrReferenceSpace = await session.requestReferenceSpace('local');
            const viewerReferenceSpace = await session.requestReferenceSpace('viewer');

            this.state.xrHitTestSource = await session.requestHitTestSource({
                space: viewerReferenceSpace
            });

            session.addEventListener('end', this._onSessionEnded);

            this.state.controller = this.state.renderer.xr.getController(0);
            this.state.controller.addEventListener('select', this._onSelect);
            this.state.scene.add(this.state.controller);

            // Configure for AR mode
            this.state.isInAR = true;
            this.state.renderer.setClearColor(0x000000, 0);
            document.body.style.backgroundColor = 'transparent';

            const canvas = this.state.renderer.domElement;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = '1';

            const sessionInitTime = performance.now() - sessionStartTime;
            console.log(`AR session started in ${sessionInitTime.toFixed(2)}ms`);

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectAppeared('ar-session');
                this.state.performanceTracker.setTrackingQuality('Initializing', 0);
            }

            this.state.renderer.setAnimationLoop(this._render);
            this._updateARButton();
            this.options.showNotification(`AR session started (${sessionInitTime.toFixed(0)}ms)`, 2000);
        } catch (error) {
            console.error('Error starting AR session:', error);
            this.options.showNotification(`AR Error: ${error.message}`, 3000);
            if (this.state.performanceTracker) {
                this.state.performanceTracker.setTrackingQuality('Failed', 0);
            }
        }
    }

    /**
     * Show UI controls for AR mode
     */
    _showUIControls() {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
            controlPanel.style.zIndex = '1000';
            controlPanel.style.pointerEvents = 'auto';
        }

        const sizeControls = document.getElementById('size-controls');
        if (sizeControls) {
            sizeControls.style.display = 'flex';
            sizeControls.style.zIndex = '1000';
            sizeControls.style.pointerEvents = 'auto';
        }

        const modelInfo = document.getElementById('model-info');
        if (modelInfo) {
            modelInfo.style.display = 'block';
            modelInfo.style.zIndex = '1000';
        }

        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = 'block';
            instructions.style.zIndex = '1000';
        }

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
     */
    _onSessionEnded() {
        this.state.xrSession = null;
        this.state.xrHitTestSource = null;
        this.state.isInAR = false;
        
        // Return to non-AR mode
        this._startNonARMode();
        
        this.options.showNotification('AR session ended', 2000);

        if (this.state.performanceTracker) {
            this.state.performanceTracker.reportToServer();
        }
    }

    /**
     * Handle select event (tap in AR view)
     */
    _onSelect() {
        if (this.state.reticle.visible) {
            const position = new THREE.Vector3();
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

            if (this.state.performanceTracker) {
                this.state.performanceTracker.markObjectLoadStart('object-placement');
            }

            this.placeObject(position);
        }
    }

    /**
     * Process hit test results
     */
    _updateHitTest(frame) {
        if (!this.state.xrHitTestSource) return;

        const hitTestResults = frame.getHitTestResults(this.state.xrHitTestSource);
        this.state.xrHitTestResults = hitTestResults;

        if (hitTestResults.length > 0) {
            const hitPose = hitTestResults[0].getPose(this.state.xrReferenceSpace);

            if (hitPose) {
                this.state.reticle.visible = true;
                this.state.reticle.matrix.fromArray(hitPose.transform.matrix);

                if (this.state.performanceTracker) {
                    this.state.performanceTracker.setTrackingQuality('Good', 1.0);
                    this.state.performanceTracker.setSurfacesDetected(hitTestResults.length);
                }
            }
        } else {
            this.state.reticle.visible = false;

            if (this.state.performanceTracker) {
                this.state.performanceTracker.setTrackingQuality('Poor', 0.2);
                this.state.performanceTracker.setSurfacesDetected(0);
            }
        }
    }

    /**
     * WebXR render loop (AR mode)
     */
    _render(timestamp, frame) {
        if (!frame) return;

        this.state.renderStartTime = performance.now();

        this._onHitTest(frame);

        const delta = this.state.clock.getDelta();

        // Animate placed objects
        for (const obj of this.state.placedObjects) {
            if (obj.userData.animation) {
                if (obj.userData.mixer) {
                    obj.userData.mixer.update(delta);
                }

                if (obj.userData.rotationSpeed) {
                    obj.rotation.x += obj.userData.rotationSpeed.x;
                    obj.rotation.y += obj.userData.rotationSpeed.y;
                    obj.rotation.z += obj.userData.rotationSpeed.z;
                }
            }
        }

        this.state.renderer.render(this.state.scene, this.state.camera);

        const renderTime = performance.now() - this.state.renderStartTime;
        this.state.frameCounter++;

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markFrame();

            if (this.state.frameCounter % 10 === 0) {
                this.state.performanceTracker.metrics.renderTime = renderTime;
                this.state.performanceTracker.metrics.jsExecutionTime = renderTime - this.state.renderer.info.render.frame;
            }
        }
    }

    /**
     * Non-AR render loop (preview mode)
     */
    _renderNonAR() {
        this.state.renderStartTime = performance.now();

        const delta = this.state.clock.getDelta();

        // Animate placed objects
        for (const obj of this.state.placedObjects) {
            if (obj.userData.animation) {
                if (obj.userData.mixer) {
                    obj.userData.mixer.update(delta);
                }

                if (obj.userData.rotationSpeed) {
                    obj.rotation.x += obj.userData.rotationSpeed.x;
                    obj.rotation.y += obj.userData.rotationSpeed.y;
                    obj.rotation.z += obj.userData.rotationSpeed.z;
                }
            }
        }

        this.state.renderer.render(this.state.scene, this.state.camera);

        const renderTime = performance.now() - this.state.renderStartTime;
        this.state.frameCounter++;

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markFrame();

            if (this.state.frameCounter % 10 === 0) {
                this.state.performanceTracker.metrics.renderTime = renderTime;
                this.state.performanceTracker.metrics.jsExecutionTime = renderTime - this.state.renderer.info.render.frame;
            }
        }
    }

    /**
     * Handle hit test results
     */
    _onHitTest(frame) {
        if (!this.state.xrSession || !this.state.xrHitTestSource) return;
        this._updateHitTest(frame);
    }

    /**
     * Place a 3D object in the scene
     */
    placeObject(position = null) {
        const modelDef = this.options.models[this.options.currentModelIndex];
        const objectId = `${modelDef.name}-${Date.now()}`;

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart(objectId);
        }

        // Default position for non-AR mode
        if (!position) {
            if (this.state.isInAR && this.state.reticle && this.state.reticle.visible) {
                position = new THREE.Vector3();
                this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
            } else {
                // Default position in front of camera for non-AR mode
                position = new THREE.Vector3(0, 0, -2);
            }
        }

        if (modelDef.type === 'gltf') {
            this.state.gltfLoader.load(modelDef.path, (gltf) => {
                const model = gltf.scene;

                model.position.copy(position);
                model.scale.set(
                    this.state.currentScale,
                    this.state.currentScale,
                    this.state.currentScale
                );

                this.state.scene.add(model);
                this.state.placedObjects.push(model);
                this.state.activeObject = model;

                if (gltf.animations && gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(model);

                    for (let i = 0; i < gltf.animations.length; i++) {
                        const clip = gltf.animations[i];
                        const action = mixer.clipAction(clip);
                        action.play();
                    }

                    model.userData.mixer = mixer;
                    model.userData.animation = true;
                }

                model.userData.type = modelDef.name;
                model.userData.scale = this.state.currentScale;
                model.userData.id = objectId;

                if (this.state.performanceTracker) {
                    const loadTime = this.state.performanceTracker.markObjectAppeared(objectId);
                    this.options.showNotification(`Placed ${modelDef.name} (${loadTime ? loadTime.toFixed(0) + "ms" : "N/A"})`, 2000);
                } else {
                    this.options.showNotification(`Placed ${modelDef.name}`, 2000);
                }

                this._updateModelInfo();
                return model;
            },
            (progress) => {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                if (percent % 20 === 0) {
                    console.log(`Loading model: ${percent}%`);
                }
            },
            (error) => {
                console.error('Error loading GLTF model:', error);
                this.options.showNotification('Failed to load 3D model', 2000);

                if (this.state.performanceTracker) {
                    this.state.performanceTracker.markObjectLoadStart(`${objectId}-failed`);
                    this.state.performanceTracker.markObjectAppeared(`${objectId}-failed`);
                }
                return null;
            });
        }
    }

    /**
     * Increase scale of current or active object
     */
    increaseScale() {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = Math.min(currentScale * 1.2, 5.0);

            if (newScale >= 5.0) {
                this.options.showNotification("Maximum scale reached", 2000);
                return;
            }

            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            this.state.currentScale = Math.min(this.state.currentScale * 1.2, 5.0);
            this.options.showNotification(`Default scale: ${this.state.currentScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();
    }

    /**
     * Decrease scale of current or active object
     */
    decreaseScale() {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = Math.max(currentScale * 0.8, 0.1);

            if (newScale <= 0.1) {
                this.options.showNotification("Minimum scale reached", 2000);
                return;
            }

            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            this.state.currentScale = Math.max(this.state.currentScale * 0.8, 0.1);
            this.options.showNotification(`Default scale: ${this.state.currentScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();
    }

    /**
     * Reset scale to default
     */
    resetScale() {
        if (this.state.activeObject) {
            this.state.activeObject.scale.set(
                this.options.defaultScale,
                this.options.defaultScale,
                this.options.defaultScale
            );
            this.state.activeObject.userData.scale = this.options.defaultScale;
            this.options.showNotification(`Scale reset to ${this.options.defaultScale.toFixed(2)}x`, 1000);
        } else {
            this.state.currentScale = this.options.defaultScale;
            this.options.showNotification(`Default scale reset to ${this.options.defaultScale.toFixed(2)}x`, 1000);
        }

        this._updateModelInfo();

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('scale-reset');
            this.state.performanceTracker.markObjectAppeared('scale-reset');
        }
    }

    /**
     * Change to next model
     */
    nextModel() {
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('model-switch');
        }

        this.options.currentModelIndex = (this.options.currentModelIndex + 1) % this.options.models.length;
        const modelName = this.options.models[this.options.currentModelIndex].name;
        this.options.showNotification(`Selected model: ${modelName}`, 2000);

        this._updateModelInfo();

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('model-switch');
        }
    }

    /**
     * Remove the active object or last placed object
     */
    removeObject() {
        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectLoadStart('remove-object');
        }

        if (this.state.activeObject) {
            const objectToRemove = this.state.activeObject;
            this.state.scene.remove(objectToRemove);
            this.state.placedObjects = this.state.placedObjects.filter(obj => obj !== objectToRemove);
            
            this.options.showNotification(`Removed ${objectToRemove.userData.type}`, 2000);
            this.state.activeObject = null;

            if (this.state.performanceTracker) {
                this.state.performanceTracker.updateMemoryUsage();
            }
        } else if (this.state.placedObjects.length > 0) {
            const lastObject = this.state.placedObjects.pop();
            this.state.scene.remove(lastObject);
            this.options.showNotification(`Removed ${lastObject.userData.type}`, 2000);

            if (this.state.performanceTracker) {
                this.state.performanceTracker.updateMemoryUsage();
            }
        } else {
            this.options.showNotification('No objects to remove', 2000);
        }

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('remove-object');
        }

        this._updateModelInfo();
    }

    /**
     * Toggle animation for active object
     */
    toggleAnimation() {
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

        if (this.state.performanceTracker) {
            this.state.performanceTracker.markObjectAppeared('toggle-animation');
        }
    }

    /**
     * Rotate the active object
     */
    rotateObject(degrees = 45) {
        if (this.state.activeObject) {
            const radians = THREE.MathUtils.degToRad(degrees);
            this.state.activeObject.rotateY(radians);
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