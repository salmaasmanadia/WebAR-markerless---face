/**
 * Enhanced WebXR AR Manager with Performance Tracking
 * Handles AR experience with integrated performance monitoring for
 * surface detection, object placement, and manipulation using WebXR API
 */
class ARManager {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            models: [
                { name: 'Sofa', type: 'gltf', path: 'models/sofa.glb' },
                { name: 'Sofa Merah', type: 'gltf', path: 'models/sofa merah.glb' },
                { name: 'Kursi Biru', type: 'gltf', path: 'models/kursi biru.glb' }
            ],
            currentModelIndex: 0,
            defaultScale: 1.0,
            minScale: 0.1,
            maxScale: 5.0,
            scaleStep: 0.2,
            performanceMonitoring: true,
            performanceOptions: {
                updateInterval: 1000,
                reportInterval: 30000,
                reportURL: 'https://script.google.com/macros/s/AKfycbz0E7QfuE6vwJ6ljqosNuGYncA8HTJcJPzYFIYhdkJDn-CDBdxNkhWPcSCDUCZgWt7C5A/exec',
                maxLatencySamples: 30,
                captureSpectorFrames: 10
            },
            lighting: {
                ambient: { color: 0xffffff, intensity: 0.6 },
                directional: { color: 0xffffff, intensity: 0.8, position: [0, 5, 0] }
            },
            ...options
        };

        // Initialize state
        this.state = this._initializeState();
        
        // Bind methods to maintain context
        this._bindMethods();
        
        // Setup error handling
        this._setupErrorHandling();
    }

    /**
     * Initialize application state
     */
    _initializeState() {
        return {
            // WebXR state
            isInitialized: false,
            isArSupported: false,
            isInAR: false,
            xrSession: null,
            xrReferenceSpace: null,
            xrHitTestSource: null,
            
            // Three.js components
            renderer: null,
            scene: null,
            camera: null,
            
            // AR objects and interaction
            placedObjects: [],
            activeObject: null,
            reticle: null,
            reticleVisible: false,
            controller: null,
            raycaster: new THREE.Raycaster(),
            
            // Model and scaling
            currentScale: this.config.defaultScale,
            modelInfo: {
                name: this.config.models[this.config.currentModelIndex].name,
                scale: this.config.defaultScale
            },
            
            // Loaders and utilities
            gltfLoader: null,
            clock: new THREE.Clock(),
            
            // Hit testing
            xrHitTestResults: [],
            
            // Performance tracking
            performanceTracker: null,
            frameCounter: 0,
            lastRenderTime: 0,
            renderStartTime: 0,
            
            // UI state
            notificationTimeout: null
        };
    }

    /**
     * Bind methods to maintain proper context
     */
    _bindMethods() {
        this._onSelect = this._onSelect.bind(this);
        this._onSessionEnded = this._onSessionEnded.bind(this);
        this._onHitTest = this._onHitTest.bind(this);
        this._updateHitTest = this._updateHitTest.bind(this);
        this._render = this._render.bind(this);
        this._renderNonAR = this._renderNonAR.bind(this);
        this._handleWindowResize = this._handleWindowResize.bind(this);
    }

    /**
     * Setup global error handling
     */
    _setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this._trackError(event.error, 'global');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this._trackError(new Error(event.reason), 'promise-rejection');
        });
    }

    /**
     * Initialize the WebXR AR experience
     */
    async init() {
        if (this.state.isInitialized) {
            console.log('AR Manager already initialized');
            return Promise.resolve();
        }

        const initStartTime = performance.now();

        try {
            // Check WebXR support
            await this._checkWebXRSupport();
            
            // Setup Three.js components
            this._setupThreeJs();
            
            // Create AR elements
            this._createReticle();
            
            // Initialize loaders
            this._initializeLoaders();
            
            // Setup UI
            this._setupUI();
            
            // Setup performance tracking
            if (this.config.performanceMonitoring) {
                await this._setupPerformanceTracking();
            }
            
            // Start in preview mode
            this._startNonARMode();
            
            this.state.isInitialized = true;
            
            const initTime = performance.now() - initStartTime;
            console.log(`AR initialization completed in ${initTime.toFixed(2)}ms`);
            
            this._trackEvent('ar-init', initTime);
            this._showNotification(`AR initialized successfully (${initTime.toFixed(0)}ms)`, 2000);
            
            return Promise.resolve();
            
        } catch (error) {
            this._trackError(error, 'initialization');
            throw error;
        }
    }

    /**
     * Check WebXR support
     */
    async _checkWebXRSupport() {
        if (!navigator.xr) {
            throw new Error('WebXR not supported in this browser');
        }

        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        this.state.isArSupported = isSupported;
        
        if (!isSupported) {
            throw new Error('WebXR AR not supported on this device');
        }
    }

    /**
     * Setup Three.js scene and renderer
     */
    _setupThreeJs() {
        // Create renderer with optimized settings
        this.state.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: window.devicePixelRatio <= 1, // Disable AA on high DPI displays
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        
        this.state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.state.renderer.setSize(window.innerWidth, window.innerHeight);
        this.state.renderer.xr.enabled = true;
        this.state.renderer.setClearColor(0x000000, 0);
        this.state.renderer.shadowMap.enabled = true;
        this.state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Append to DOM
        document.body.appendChild(this.state.renderer.domElement);
        
        // Create scene
        this.state.scene = new THREE.Scene();
        
        // Setup lighting
        this._setupLighting();
        
        // Create camera
        this.state.camera = new THREE.PerspectiveCamera(
            70, 
            window.innerWidth / window.innerHeight, 
            0.01, 
            1000
        );
        this.state.camera.position.set(0, 1.6, 3);
        
        // Handle window resize
        window.addEventListener('resize', this._handleWindowResize);
    }

    /**
     * Setup scene lighting
     */
    _setupLighting() {
        const { ambient, directional } = this.config.lighting;
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
        this.state.scene.add(ambientLight);
        
        // Directional light with shadows
        const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity);
        directionalLight.position.set(...directional.position);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        
        this.state.scene.add(directionalLight);
    }

    /**
     * Handle window resize
     */
    _handleWindowResize() {
        if (!this.state.camera || !this.state.renderer) return;
        
        this.state.camera.aspect = window.innerWidth / window.innerHeight;
        this.state.camera.updateProjectionMatrix();
        this.state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Create reticle for surface indication
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
     * Initialize model loaders
     */
    _initializeLoaders() {
        this.state.gltfLoader = new THREE.GLTFLoader();
        
        // Add Draco decoder if available
        if (window.THREE && window.THREE.DRACOLoader) {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/draco/');
            this.state.gltfLoader.setDRACOLoader(dracoLoader);
        }
    }

    /**
     * Setup UI elements
     */
    _setupUI() {
        this._updateARButton();
        this._updateModelInfo();
        
        // Show control panels
        const controlElements = [
            'control-panel',
            'size-controls',
            'performance-stats'
        ];
        
        controlElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'flex';
                element.style.zIndex = '1000';
            }
        });
    }

    /**
     * Setup performance tracking
     */
    async _setupPerformanceTracking() {
        try {
            if (!window.PerformanceTracker) {
                console.warn('PerformanceTracker not available');
                return;
            }

            const deviceInfo = {
                userAgent: navigator.userAgent,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                devicePixelRatio: window.devicePixelRatio,
                arMode: 'world-locked',
                arVersion: 'WebXR'
            };

            this.state.performanceTracker = new PerformanceTracker({
                ...this.config.performanceOptions,
                deviceInfo,
                showNotification: this._showNotification.bind(this),
                webGLContext: this.state.renderer?.getContext()
            });

            this.state.performanceTracker.start();
            console.log('Performance tracking initialized');
            
        } catch (error) {
            console.error('Failed to initialize performance tracking:', error);
        }
    }

    /**
     * Start AR session
     */
    async startARSession() {
        if (!this.state.isInitialized || !this.state.isArSupported) {
            this._showNotification('AR not supported or not initialized', 3000);
            return;
        }

        if (this.state.xrSession) {
            console.log('AR session already active');
            return;
        }

        const sessionStartTime = performance.now();

        try {
            this._trackEvent('ar-session-start');

            const sessionInit = {
                requiredFeatures: ['local', 'hit-test'],
                optionalFeatures: ['dom-overlay', 'camera-access'],
                environmentIntegration: true
            };

            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.state.xrSession = session;

            // Configure session
            await this._configureARSession(session);

            // Setup event listeners
            session.addEventListener('end', this._onSessionEnded);

            // Setup controller
            this.state.controller = this.state.renderer.xr.getController(0);
            this.state.controller.addEventListener('select', this._onSelect);
            this.state.scene.add(this.state.controller);

            // Enter AR mode
            this._enterARMode();

            const sessionTime = performance.now() - sessionStartTime;
            this._trackEvent('ar-session-ready', sessionTime);
            this._showNotification(`AR session started (${sessionTime.toFixed(0)}ms)`, 2000);

        } catch (error) {
            this._trackError(error, 'ar-session-start');
        }
    }

    /**
     * Configure AR session
     */
    async _configureARSession(session) {
        this.state.renderer.xr.setReferenceSpaceType('local');
        await this.state.renderer.xr.setSession(session);

        this.state.xrReferenceSpace = await session.requestReferenceSpace('local');
        const viewerReferenceSpace = await session.requestReferenceSpace('viewer');

        this.state.xrHitTestSource = await session.requestHitTestSource({
            space: viewerReferenceSpace
        });
    }

    /**
     * Enter AR mode
     */
    _enterARMode() {
        this.state.isInAR = true;
        this.state.renderer.setClearColor(0x000000, 0);
        this.state.renderer.setAnimationLoop(this._render);
        
        // Configure canvas for AR
        const canvas = this.state.renderer.domElement;
        Object.assign(canvas.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: '1'
        });

        document.body.style.backgroundColor = 'transparent';
        this._updateARButton();
        this._showUIControls();
    }

    /**
     * Show UI controls for AR mode
     */
    _showUIControls() {
        const uiElements = [
            'control-panel',
            'size-controls',
            'model-info',
            'instructions',
            'performance-stats'
        ];

        uiElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                Object.assign(element.style, {
                    display: element.id === 'control-panel' || element.id === 'size-controls' ? 'flex' : 'block',
                    zIndex: '1000',
                    pointerEvents: 'auto'
                });
            }
        });
    }

    /**
     * End AR session
     */
    endARSession() {
        if (this.state.xrSession) {
            this._trackEvent('ar-session-end');
            this.state.xrSession.end();
        }
    }

    /**
     * Handle session ended
     */
    _onSessionEnded() {
        this.state.xrSession = null;
        this.state.xrHitTestSource = null;
        this.state.isInAR = false;
        
        this._startNonARMode();
        this._showNotification('AR session ended', 2000);
        
        if (this.state.performanceTracker) {
            this.state.performanceTracker.reportToServer();
        }
    }

    /**
     * Start non-AR preview mode
     */
    _startNonARMode() {
        this.state.isInAR = false;
        this.state.renderer.setClearColor(0x222222, 1);
        this.state.renderer.setAnimationLoop(this._renderNonAR);
        this._updateARButton();
        this._showNotification('Preview mode active', 2000);
    }

    /**
     * Handle select event (tap/click)
     */
    _onSelect() {
        if (this.state.reticle?.visible) {
            const position = new THREE.Vector3();
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
            this.placeObject(position);
        }
    }

    /**
     * Update hit test results
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
                
                this._updateTrackingQuality('Good', 1.0, hitTestResults.length);
            }
        } else {
            this.state.reticle.visible = false;
            this._updateTrackingQuality('Poor', 0.2, 0);
        }
    }

    /**
     * Update tracking quality metrics
     */
    _updateTrackingQuality(quality, confidence, surfaceCount) {
        if (this.state.performanceTracker) {
            this.state.performanceTracker.setTrackingQuality(quality, confidence);
            this.state.performanceTracker.setSurfacesDetected(surfaceCount);
        }
    }

    /**
     * AR render loop
     */
    _render(timestamp, frame) {
        if (!frame) return;

        this.state.renderStartTime = performance.now();
        this._onHitTest(frame);
        this._animateObjects();
        this.state.renderer.render(this.state.scene, this.state.camera);
        this._updatePerformanceMetrics();
    }

    /**
     * Non-AR render loop
     */
    _renderNonAR() {
        this.state.renderStartTime = performance.now();
        this._animateObjects();
        this.state.renderer.render(this.state.scene, this.state.camera);
        this._updatePerformanceMetrics();
    }

    /**
     * Animate placed objects
     */
    _animateObjects() {
        const delta = this.state.clock.getDelta();

        this.state.placedObjects.forEach(obj => {
            if (obj.userData.animation && obj.userData.mixer) {
                obj.userData.mixer.update(delta);
            }

            if (obj.userData.rotationSpeed) {
                obj.rotation.x += obj.userData.rotationSpeed.x;
                obj.rotation.y += obj.userData.rotationSpeed.y;
                obj.rotation.z += obj.userData.rotationSpeed.z;
            }
        });
    }

    /**
     * Update performance metrics
     */
    _updatePerformanceMetrics() {
        const renderTime = performance.now() - this.state.renderStartTime;
        this.state.frameCounter++;

        if (this.state.performanceTracker && this.state.frameCounter % 10 === 0) {
            this.state.performanceTracker.markFrame();
            this.state.performanceTracker.metrics.renderTime = renderTime;
        }
    }

    /**
     * Handle hit test frame
     */
    _onHitTest(frame) {
        if (this.state.xrSession && this.state.xrHitTestSource) {
            this._updateHitTest(frame);
        }
    }

    /**
     * Place object in scene
     */
    async placeObject(position = null) {
        const modelDef = this.config.models[this.config.currentModelIndex];
        const objectId = `${modelDef.name}-${Date.now()}`;

        this._trackEvent('object-placement-start', objectId);

        try {
            // Determine position
            if (!position) {
                position = this._getDefaultPosition();
            }

            // Load and place model
            const model = await this._loadModel(modelDef, position, objectId);
            
            if (model) {
                this._configureModel(model, modelDef, objectId);
                this._trackEvent('object-placement-complete', objectId);
            }

        } catch (error) {
            this._trackError(error, `object-placement-${objectId}`);
        }
    }

    /**
     * Get default object position
     */
    _getDefaultPosition() {
        if (this.state.isInAR && this.state.reticle?.visible) {
            const position = new THREE.Vector3();
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
            return position;
        }
        return new THREE.Vector3(0, 0, -2);
    }

    /**
     * Load 3D model
     */
    _loadModel(modelDef, position, objectId) {
        return new Promise((resolve, reject) => {
            this.state.gltfLoader.load(
                modelDef.path,
                (gltf) => {
                    const model = gltf.scene;
                    model.position.copy(position);
                    model.scale.setScalar(this.state.currentScale);
                    
                    this.state.scene.add(model);
                    this.state.placedObjects.push(model);
                    this.state.activeObject = model;
                    
                    // Setup animations
                    if (gltf.animations?.length > 0) {
                        this._setupModelAnimations(model, gltf.animations);
                    }
                    
                    resolve(model);
                },
                (progress) => {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    if (percent % 20 === 0) {
                        console.log(`Loading ${modelDef.name}: ${percent}%`);
                    }
                },
                (error) => {
                    console.error('Model load error:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Setup model animations
     */
    _setupModelAnimations(model, animations) {
        const mixer = new THREE.AnimationMixer(model);
        
        animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.play();
        });
        
        model.userData.mixer = mixer;
        model.userData.animation = true;
    }

    /**
     * Configure placed model
     */
    _configureModel(model, modelDef, objectId) {
        model.userData = {
            ...model.userData,
            type: modelDef.name,
            scale: this.state.currentScale,
            id: objectId
        };

        const loadTime = this._trackEvent('object-appeared', objectId);
        const message = loadTime ? 
            `Placed ${modelDef.name} (${loadTime.toFixed(0)}ms)` : 
            `Placed ${modelDef.name}`;
            
        this._showNotification(message, 2000);
        this._updateModelInfo();
    }

    /**
     * Scale operations
     */
    increaseScale() {
        this._adjustScale(1 + this.config.scaleStep);
    }

    decreaseScale() {
        this._adjustScale(1 - this.config.scaleStep);
    }

    resetScale() {
        this._setScale(this.config.defaultScale);
        this._trackEvent('scale-reset');
    }

    /**
     * Adjust scale of active object or default scale
     */
    _adjustScale(factor) {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = this._clampScale(currentScale * factor);
            
            if (newScale === currentScale) {
                const limit = factor > 1 ? 'Maximum' : 'Minimum';
                this._showNotification(`${limit} scale reached`, 2000);
                return;
            }
            
            this._setObjectScale(this.state.activeObject, newScale);
        } else {
            this.state.currentScale = this._clampScale(this.state.currentScale * factor);
            this._showNotification(`Default scale: ${this.state.currentScale.toFixed(2)}x`, 1000);
        }
        
        this._updateModelInfo();
    }

    /**
     * Set specific scale value
     */
    _setScale(scale) {
        const clampedScale = this._clampScale(scale);
        
        if (this.state.activeObject) {
            this._setObjectScale(this.state.activeObject, clampedScale);
        } else {
            this.state.currentScale = clampedScale;
            this._showNotification(`Default scale: ${clampedScale.toFixed(2)}x`, 1000);
        }
        
        this._updateModelInfo();
    }

    /**
     * Set object scale
     */
    _setObjectScale(object, scale) {
        object.scale.setScalar(scale);
        object.userData.scale = scale;
        this._showNotification(`Scale: ${scale.toFixed(2)}x`, 1000);
    }

    /**
     * Clamp scale to valid range
     */
    _clampScale(scale) {
        return Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
    }

    /**
     * Model selection
     */
    nextModel() {
        this._trackEvent('model-switch');
        
        this.config.currentModelIndex = (this.config.currentModelIndex + 1) % this.config.models.length;
        const modelName = this.config.models[this.config.currentModelIndex].name;
        
        this._showNotification(`Selected: ${modelName}`, 2000);
        this._updateModelInfo();
    }

    /**
     * Object removal
     */
    removeObject() {
        this._trackEvent('remove-object');
        
        const objectToRemove = this.state.activeObject || this.state.placedObjects[this.state.placedObjects.length - 1];
        
        if (!objectToRemove) {
            this._showNotification('No objects to remove', 2000);
            return;
        }
        
        this.state.scene.remove(objectToRemove);
        this.state.placedObjects = this.state.placedObjects.filter(obj => obj !== objectToRemove);
        
        if (this.state.activeObject === objectToRemove) {
            this.state.activeObject = null;
        }
        
        this._showNotification(`Removed ${objectToRemove.userData.type}`, 2000);
        this._updateModelInfo();
        
        if (this.state.performanceTracker) {
            this.state.performanceTracker.updateMemoryUsage();
        }
    }

    /**
     * Toggle object animation
     */
    toggleAnimation() {
        this._trackEvent('toggle-animation');
        
        if (!this.state.activeObject) {
            this._showNotification('No active object', 2000);
            return;
        }
        
        const isAnimating = this.state.activeObject.userData.animation;
        this.state.activeObject.userData.animation = !isAnimating;
        
        const status = this.state.activeObject.userData.animation ? 'enabled' : 'disabled';
        this._showNotification(`Animation ${status}`, 2000);
    }

    /**
     * Rotate active object
     */
    rotateObject(degrees = 45) {
        if (!this.state.activeObject) {
            this._showNotification('No active object to rotate', 2000);
            return;
        }
        
        const radians = THREE.MathUtils.degToRad(degrees);
        this.state.activeObject.rotateY(radians);
        this._showNotification(`Rotated ${degrees}°`, 1000);
    }

    /**
     * Update AR button state
     */
    _updateARButton() {
        const arButton = document.getElementById('ar-button');
        if (!arButton) return;

        if (this.state.isArSupported) {
            arButton.style.display = 'block';
            arButton.textContent = this.state.isInAR ? 'Exit AR' : 'Enter AR';
            arButton.onclick = () => {
                this.state.isInAR ? this.endARSession() : this.startARSession();
            };
        } else {
            arButton.style.display = 'none';
        }
    }

    /**
     * Update model info display
     */
    _updateModelInfo() {
        const modelInfoElem = document.getElementById('model-info');
        if (!modelInfoElem) return;

        if (!this.config.models?.length) {
            this._updateModelInfoText('None', 0, 0);
            return;
        }

        // Validate model index
        if (this.config.currentModelIndex < 0 || this.config.currentModelIndex >= this.config.models.length) {
            this.config.currentModelIndex = 0;
        }

        const currentModel = this.config.models[this.config.currentModelIndex].name;
        const scale = this.state.activeObject?.userData?.scale || this.state.currentScale;

        this._updateModelInfoText(currentModel, scale, this.state.placedObjects.length);
    }

    /**
     * Update model info text elements
     */
    _updateModelInfoText(modelName, scale, objectCount) {
        const modelNameSpan = document.getElementById('current-model-name');
        const scaleSpan = document.getElementById('current-scale');
        
        if (modelNameSpan) modelNameSpan.textContent = modelName;
        if (scaleSpan) scaleSpan.textContent = `${scale.toFixed(2)}x`;

        // Update state
        this.state.modelInfo = {
            name: modelName,
            scale: scale,
            objectCount: objectCount
        };
    }

   /**
     * Display notification message with improved error handling
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds (default: 2000)
     */
    _showNotification(message, duration = 2000) {
        try {
            // Clear existing timeout
            if (this.state.notificationTimeout) {
                clearTimeout(this.state.notificationTimeout);
                this.state.notificationTimeout = null;
            }

            // Try to use UIManager first if available
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification(message, duration);
                return;
            }

            // Fallback to direct DOM manipulation
            const notificationElem = document.getElementById('ar-notification');
            if (!notificationElem) {
                console.warn('Notification element not found, using console fallback');
                console.log(`AR Notification: ${message}`);
                return;
            }

            // Display notification
            notificationElem.textContent = message;
            notificationElem.style.opacity = '1';
            notificationElem.classList.add('visible');

            // Auto-hide after duration
            this.state.notificationTimeout = setTimeout(() => {
                notificationElem.style.opacity = '0';
                notificationElem.classList.remove('visible');
                this.state.notificationTimeout = null;
            }, duration);

        } catch (error) {
            console.error('Failed to show notification:', error);
            console.log(`AR Notification (fallback): ${message}`);
        }
    }

    /**
     * Track events with performance metrics
     * @param {string} eventName - Name of the event
     * @param {*} data - Additional event data
     * @returns {number|null} - Event duration if applicable
     */
    _trackEvent(eventName, data = null) {
        try {
            if (!this.state.performanceTracker) return null;

            const eventId = `event-${eventName}-${Date.now()}`;
            
            // Start tracking
            this.state.performanceTracker.markObjectLoadStart(eventId);
            
            // Complete tracking
            const duration = this.state.performanceTracker.markObjectAppeared(eventId);
            
            console.log(`Event tracked: ${eventName}`, data ? { data, duration } : { duration });
            return duration;

        } catch (error) {
            console.warn('Failed to track event:', eventName, error);
            return null;
        }
    }

    /**
     * Capture current AR view and save as image
     */
    captureARView() {
        const captureId = 'capture-view';
        
        try {
            // Track capture start
            this._trackEvent('capture-start');

            // Validate renderer
            if (!this.state.renderer?.domElement) {
                throw new Error('Renderer not available');
            }

            // Convert canvas to data URL
            const canvas = this.state.renderer.domElement;
            const dataURL = canvas.toDataURL('image/png', 0.9);
            
            // Create and trigger download
            const link = this._createDownloadLink(dataURL, `ar-capture-${Date.now()}.png`);
            this._triggerDownload(link);

            this._showNotification('AR view captured successfully', 2000);
            this._trackEvent('capture-complete');

        } catch (error) {
            console.error('Failed to capture AR view:', error);
            this._showNotification('Failed to capture AR view', 3000);
            this._trackError(error, 'capture-view');
        }
    }

    /**
     * Create download link element
     * @param {string} dataURL - Data URL of the content
     * @param {string} filename - Desired filename
     * @returns {HTMLElement} - Download link element
     */
    _createDownloadLink(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        link.style.display = 'none';
        return link;
    }

    /**
     * Trigger download and cleanup
     * @param {HTMLElement} link - Download link element
     */
    _triggerDownload(link) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Generate comprehensive performance report
     * @returns {Object} - Detailed performance report
     */
    generatePerformanceReport() {
        try {
            if (!this.state.performanceTracker) {
                return { 
                    error: 'Performance tracking not enabled',
                    timestamp: new Date().toISOString()
                };
            }

            const tracker = this.state.performanceTracker;
            const currentTime = performance.now();

            return {
                metadata: this._generateReportMetadata(tracker),
                hardware: this._generateHardwareInfo(),
                performance: this._generatePerformanceMetrics(tracker),
                arStatus: this._generateARMetrics(),
                objectTimings: tracker.getAllObjectTimings?.() || {},
                session: this._generateSessionInfo(currentTime, tracker)
            };

        } catch (error) {
            console.error('Failed to generate performance report:', error);
            return { 
                error: `Report generation failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Generate report metadata
     * @param {Object} tracker - Performance tracker instance
     * @returns {Object} - Report metadata
     */
    _generateReportMetadata(tracker) {
        return {
            timestamp: new Date().toISOString(),
            sessionId: tracker.metrics?.sessionId || 'unknown',
            version: '1.0.0',
            userAgent: navigator.userAgent
        };
    }

    /**
     * Generate hardware information
     * @returns {Object} - Hardware details
     */
    _generateHardwareInfo() {
        return {
            gpu: this.state.performanceTracker?.metrics?.gpuInfo || 'Unknown',
            devicePixelRatio: window.devicePixelRatio || 1,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            platform: navigator.platform || 'Unknown'
        };
    }

    /**
     * Generate performance metrics
     * @param {Object} tracker - Performance tracker instance
     * @returns {Object} - Performance metrics
     */
    _generatePerformanceMetrics(tracker) {
        const metrics = tracker.metrics || {};
        
        return {
            fps: metrics.fps || 0,
            avgLatency: parseFloat((metrics.latency || 0).toFixed(2)),
            memoryUsage: metrics.memory || 0,
            cpuUsage: parseFloat((metrics.cpuUsage || 0).toFixed(1)),
            gpuUsage: parseFloat((metrics.gpuUsage || 0).toFixed(1)),
            frameCount: metrics.totalFrames || 0,
            droppedFrames: metrics.droppedFrames || 0,
            renderTime: metrics.renderTime || 0
        };
    }

    /**
     * Generate AR-specific metrics
     * @returns {Object} - AR status metrics
     */
    _generateARMetrics() {
        const currentModel = this.config.models?.[this.config.currentModelIndex];
        
        return {
            objectsPlaced: this.state.placedObjects.length,
            activeModel: currentModel?.name || 'None',
            currentScale: this.state.currentScale,
            surfacesDetected: this.state.xrHitTestResults?.length || 0,
            sessionActive: !!this.state.xrSession,
            trackingQuality: this.state.reticle?.visible ? 'Good' : 'Poor',
            isInAR: this.state.isInAR
        };
    }

    /**
     * Generate session information
     * @param {number} currentTime - Current timestamp
     * @param {Object} tracker - Performance tracker instance
     * @returns {Object} - Session information
     */
    _generateSessionInfo(currentTime, tracker) {
        const startTime = tracker.metrics?.startTime || currentTime;
        const elapsedTime = ((currentTime - startTime) / 1000).toFixed(1);
        
        return {
            elapsedTime: parseFloat(elapsedTime),
            startTime: new Date(startTime).toISOString(),
            initialized: this.state.isInitialized,
            arSupported: this.state.isArSupported
        };
    }

    /**
     * Track errors with enhanced context
     * @param {Error} error - Error to track
     * @param {string} context - Error context
     */
    _trackError(error, context = 'unknown') {
        try {
            console.error(`AR Error [${context}]:`, error);

            // Track with performance system
            if (this.state.performanceTracker) {
                const errorId = `error-${context}-${Date.now()}`;
                this.state.performanceTracker.markObjectLoadStart(errorId);
                this.state.performanceTracker.markObjectAppeared(errorId);
            }

            // Show user-friendly notification
            const message = this._getUserFriendlyErrorMessage(error, context);
            this._showNotification(message, 4000);

            // Optional: Report to external service
            this._reportErrorToService(error, context);

        } catch (trackingError) {
            console.error('Failed to track error:', trackingError);
        }
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - Original error
     * @param {string} context - Error context
     * @returns {string} - User-friendly message
     */
    _getUserFriendlyErrorMessage(error, context) {
        const errorMessages = {
            'initialization': 'Failed to initialize AR. Please refresh and try again.',
            'ar-session-start': 'Unable to start AR session. Check camera permissions.',
            'capture-view': 'Screenshot failed. Please try again.',
            'model-load': 'Failed to load 3D model. Check your connection.',
            'permission': 'Camera permission required for AR experience.'
        };

        return errorMessages[context] || `AR Error: ${error.message}`;
    }

    /**
     * Report error to external service (optional)
     * @param {Error} error - Error to report
     * @param {string} context - Error context
     */
    _reportErrorToService(error, context) {
        // Only report in production and if tracking is enabled
        if (this.config.performanceMonitoring && this.config.performanceOptions?.reportURL) {
            try {
                // Prepare error data
                const errorData = {
                    timestamp: new Date().toISOString(),
                    context,
                    message: error.message,
                    stack: error.stack,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                };

                // Send asynchronously without blocking
                fetch(this.config.performanceOptions.reportURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'error', data: errorData })
                }).catch(console.warn); // Silently fail

            } catch (reportError) {
                console.warn('Failed to report error to service:', reportError);
            }
        }
    }

    /**
     * Update lighting with validation and performance tracking
     * @param {number} ambientIntensity - Ambient light intensity (0-1)
     * @param {number} directionalIntensity - Directional light intensity (0-1)
     */
    updateLighting(ambientIntensity = 0.6, directionalIntensity = 0.8) {
        try {
            this._trackEvent('update-lighting-start');

            // Validate inputs
            const ambient = Math.max(0, Math.min(1, ambientIntensity));
            const directional = Math.max(0, Math.min(1, directionalIntensity));

            // Update lights
            const lightsUpdated = this._updateSceneLights(ambient, directional);
            
            if (lightsUpdated > 0) {
                this._showNotification(`Lighting updated (${lightsUpdated} lights)`, 1500);
                this._trackEvent('update-lighting-complete', { ambient, directional, count: lightsUpdated });
            } else {
                this._showNotification('No lights found to update', 2000);
            }

        } catch (error) {
            this._trackError(error, 'update-lighting');
        }
    }

    /**
     * Update scene lights
     * @param {number} ambient - Ambient intensity
     * @param {number} directional - Directional intensity
     * @returns {number} - Number of lights updated
     */
    _updateSceneLights(ambient, directional) {
        let updatedCount = 0;

        if (!this.state.scene?.children) return updatedCount;

        // Update ambient lights
        this.state.scene.children
            .filter(child => child instanceof THREE.AmbientLight)
            .forEach(light => {
                light.intensity = ambient;
                updatedCount++;
            });

        // Update directional lights
        this.state.scene.children
            .filter(child => child instanceof THREE.DirectionalLight)
            .forEach(light => {
                light.intensity = directional;
                updatedCount++;
            });

        return updatedCount;
    }

    /**
     * Export performance data with enhanced error handling
     */
    exportPerformanceData() {
        try {
            if (!this.state.performanceTracker) {
                this._showNotification('Performance tracking disabled', 2000);
                return;
            }

            this._trackEvent('export-start');

            // Generate comprehensive report
            const report = this.generatePerformanceReport();
            
            if (report.error) {
                throw new Error(report.error);
            }

            // Create and download file
            const filename = this._generateExportFilename(report);
            const jsonString = JSON.stringify(report, null, 2);
            
            this._downloadJSON(jsonString, filename);
            
            this._showNotification('Performance data exported successfully', 2000);
            this._trackEvent('export-complete', { filename, size: jsonString.length });

        } catch (error) {
            console.error('Export failed:', error);
            this._showNotification('Export failed. Check console for details.', 3000);
            this._trackError(error, 'export-performance');
        }
    }

    /**
     * Generate export filename
     * @param {Object} report - Performance report
     * @returns {string} - Generated filename
     */
    _generateExportFilename(report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sessionId = report.metadata?.sessionId || 'unknown';
        return `ar-performance-${sessionId}-${timestamp}.json`;
    }

    /**
     * Download JSON data as file
     * @param {string} jsonString - JSON data string
     * @param {string} filename - Desired filename
     */
    _downloadJSON(jsonString, filename) {
        try {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = this._createDownloadLink(url, filename);
            
            this._triggerDownload(link);
            
            // Cleanup URL object
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Cleanup resources and remove event listeners
     */
    dispose() {
        try {
            console.log('Disposing ARManager resources...');

            // Clear timeouts
            if (this.state.notificationTimeout) {
                clearTimeout(this.state.notificationTimeout);
            }

            // End AR session
            if (this.state.xrSession) {
                this.state.xrSession.end();
            }

            // Stop performance tracking
            if (this.state.performanceTracker) {
                this.state.performanceTracker.stop?.();
            }

            // Remove event listeners
            window.removeEventListener('resize', this._handleWindowResize);
            window.removeEventListener('error', this._trackError);
            window.removeEventListener('unhandledrejection', this._trackError);

            // Dispose Three.js resources
            this._disposeThreeJS();

            // Clear state
            this.state.isInitialized = false;
            
            console.log('ARManager disposed successfully');

        } catch (error) {
            console.error('Error during disposal:', error);
        }
    }

    /**
     * Dispose Three.js resources
     */
    _disposeThreeJS() {
        try {
            // Dispose placed objects
            this.state.placedObjects.forEach(obj => {
                this._disposeObject(obj);
            });

            // Dispose renderer
            if (this.state.renderer) {
                this.state.renderer.dispose();
                if (this.state.renderer.domElement?.parentNode) {
                    this.state.renderer.domElement.parentNode.removeChild(
                        this.state.renderer.domElement
                    );
                }
            }

            // Clear scene
            if (this.state.scene) {
                this._disposeScene(this.state.scene);
            }

        } catch (error) {
            console.warn('Error disposing Three.js resources:', error);
        }
    }

    /**
     * Dispose Three.js object and its resources
     * @param {THREE.Object3D} object - Object to dispose
     */
    _disposeObject(object) {
        if (!object) return;

        // Dispose geometry
        if (object.geometry) {
            object.geometry.dispose();
        }

        // Dispose material(s)
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }

        // Dispose children recursively
        if (object.children) {
            object.children.forEach(child => this._disposeObject(child));
        }
    }

    /**
     * Dispose entire scene
     * @param {THREE.Scene} scene - Scene to dispose
     */
    _disposeScene(scene) {
        while (scene.children.length > 0) {
            const child = scene.children[0];
            this._disposeObject(child);
            scene.remove(child);
        }
    }
}

// Export ARManager to global scope
window.ARManager = ARManager;