/**
 * WebXR AR Manager
 * Handles the AR experience including surface detection, object placement, and object manipulation
 * using the WebXR API for world-locked AR
 */
class ARManager {
    constructor(options) {
        // Default options
        this.options = Object.assign({
            modelPath: 'models/dog.glb',
            models: [
                { name: '3D Model', type: 'gltf', path: 'models/dog.glb' },
                { name: 'Box', type: 'primitive', primitive: 'box' },
                { name: 'Sphere', type: 'primitive', primitive: 'sphere' },
                { name: 'Cylinder', type: 'primitive', primitive: 'cylinder' }
            ],
            currentModelIndex: 0,
            defaultScale: 1.0,
            showNotification: this._showNotification.bind(this)
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
            xrHitTestResults: []
        };

        // Bind methods
        this._onSelect = this._onSelect.bind(this);
        this._onSessionEnded = this._onSessionEnded.bind(this);
        this._onHitTest = this._onHitTest.bind(this);
        this._updateHitTest = this._updateHitTest.bind(this);
        this._render = this._render.bind(this);
    }

    /**
     * Initialize the WebXR AR experience
     */
    async init() {
        if (this.state.isInitialized) return Promise.resolve();

        return new Promise(async (resolve, reject) => {
            try {
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
                
                // Setup the container for AR UI elements
                this._setupARUI();
                
                this.state.isInitialized = true;
                this.options.showNotification('AR initialized successfully', 2000);
                resolve();
            } catch (error) {
                console.error('AR initialization error:', error);
                this.options.showNotification(`AR Error: ${error.message}`, 3000);
                reject(error);
            }
        });
    }

    /**
     * Set up Three.js scene and renderer
     * @private
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
        document.body.appendChild(this.state.renderer.domElement);

        // Create scene
        this.state.scene = new THREE.Scene();

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.state.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 5, 0);
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
     * Start WebXR AR session
     */
    async startARSession() {
        if (!this.state.isInitialized || !this.state.isArSupported) {
            this.options.showNotification('AR not supported or not initialized', 3000);
            return;
        }

        try {
            // Check if session is already running
            if (this.state.xrSession) {
                console.log('AR session already running');
                return;
            }

            // Define required features
            const requiredFeatures = ['local', 'hit-test'];
            const optionalFeatures = ['dom-overlay'];
            const sessionInit = { requiredFeatures, optionalFeatures };

            // Add DOM overlay if available
            const arOverlay = document.getElementById('ar-overlay');
            if (arOverlay) {
                sessionInit.domOverlay = { root: arOverlay };
                arOverlay.style.display = 'block';
            }

            // Ensure UI controls are visible before entering AR
            this._showUIControls();

            // Request the session
            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.state.xrSession = session;

            // Setup session
            this.state.renderer.xr.setReferenceSpaceType('local');
            await this.state.renderer.xr.setSession(session);

            // Set up reference space and hit testing
            this.state.xrReferenceSpace = await session.requestReferenceSpace('local');
            const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
            
            // Create hit test source
            this.state.xrHitTestSource = await session.requestHitTestSource({
                space: viewerReferenceSpace
            });

            // Add event listeners
            session.addEventListener('end', this._onSessionEnded);
            
            // Set up controller for interactions
            this.state.controller = this.state.renderer.xr.getController(0);
            this.state.controller.addEventListener('select', this._onSelect);
            this.state.scene.add(this.state.controller);

            // Start rendering
            this.state.renderer.setAnimationLoop(this._render);
            this.options.showNotification('AR session started', 2000);
        } catch (error) {
            console.error('Error starting AR session:', error);
            this.options.showNotification(`AR Error: ${error.message}`, 3000);
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
            this.state.xrSession.end();
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
        
        // Keep UI controls visible after exiting AR
        // Don't hide them as this was causing the issue
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
            
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), scale);
            
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
            }
        } else {
            // Hide reticle if no surfaces detected
            this.state.reticle.visible = false;
        }
    }

    /**
     * WebXR render loop
     * @private
     * @param {DOMHighResTimeStamp} timestamp - Current timestamp
     * @param {XRFrame} frame - XR frame
     */
    _render(timestamp, frame) {
        if (!frame) return;
        
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
            }
        }
        
        // Render the scene
        this.state.renderer.render(this.state.scene, this.state.camera);
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
     * Place a 3D object in the AR scene
     * @param {THREE.Vector3} position - Position to place the object
     */
    placeObject(position = null) {
        const modelDef = this.options.models[this.options.currentModelIndex];
        
        // If position not provided and we have reticle, use its position
        if (!position && this.state.reticle && this.state.reticle.visible) {
            position = new THREE.Vector3();
            this.state.reticle.matrixWorld.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
        }
        
        // If still no position, can't place object
        if (!position) {
            this.options.showNotification('Move device to find a surface', 2000);
            return null;
        }
        
        if (modelDef.type === 'gltf') {
            // Create GLTF model
            this.state.gltfLoader.load(modelDef.path, (gltf) => {
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
                if (gltf.animations && gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(model);
                    
                    // Play all animations
                    for (let i = 0; i < gltf.animations.length; i++) {
                        const clip = gltf.animations[i];
                        const action = mixer.clipAction(clip);
                        action.play();
                    }
                    
                    model.userData.mixer = mixer;
                    model.userData.animation = true;
                }
                
                // Add metadata
                model.userData.type = modelDef.name;
                model.userData.scale = this.state.currentScale;
                
                this.options.showNotification(`Placed ${modelDef.name}`, 2000);
                this._updateModelInfo();
                
                return model;
            }, undefined, (error) => {
                console.error('Error loading GLTF model:', error);
                this.options.showNotification('Failed to load 3D model', 2000);
                return null;
            });
        }
        else if (modelDef.type === 'primitive') {
            // Create primitive geometry
            let geometry;
            
            switch (modelDef.primitive) {
                case 'box':
                    geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(0.15, 32, 32);
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 32);
                    break;
                default:
                    geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            }
            
            // Create material
            const material = new THREE.MeshStandardMaterial({
                color: this._getRandomColor(),
                roughness: 0.7,
                metalness: 0.0
            });
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            
            // Set position
            mesh.position.copy(position);
            
            // Apply scale
            mesh.scale.set(
                this.state.currentScale,
                this.state.currentScale,
                this.state.currentScale
            );
            
            // Add to scene
            this.state.scene.add(mesh);
            
            // Track the object
            this.state.placedObjects.push(mesh);
            this.state.activeObject = mesh;
            
            // Add metadata
            mesh.userData.type = modelDef.name;
            mesh.userData.scale = this.state.currentScale;
            
            // Add random rotation animation
            if (modelDef.primitive !== 'sphere') {
                mesh.userData.animation = true;
                mesh.userData.rotationSpeed = {
                    x: Math.random() * 0.01,
                    y: 0.01 + Math.random() * 0.01,
                    z: Math.random() * 0.01
                };
            }
            
            this.options.showNotification(`Placed ${modelDef.name}`, 2000);
            this._updateModelInfo();
            
            return mesh;
        }
    }

    /**
     * Increase the scale of the current or active object
     */
    increaseScale() {
        if (this.state.activeObject) {
            const currentScale = this.state.activeObject.userData.scale || this.state.currentScale;
            const newScale = currentScale * 1.2; // Increase by 20%
            
            if (newScale >= 5.0) {
                this.options.showNotification("Maximum scale reached", 2000);
                return;
            }
            
            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            // Update default scale for next placed object
            this.state.currentScale *= 1.2;
            if (this.state.currentScale >= 5.0) {
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
            
            if (newScale <= 0.1) {
                this.options.showNotification("Minimum scale reached", 2000);
                return;
            }
            
            this.state.activeObject.scale.set(newScale, newScale, newScale);
            this.state.activeObject.userData.scale = newScale;
            this.options.showNotification(`Scale: ${newScale.toFixed(2)}x`, 1000);
        } else {
            // Update default scale for next placed object
            this.state.currentScale *= 0.8;
            if (this.state.currentScale <= 0.1) {
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
        const defaultScale = 1.0;
        
        if (this.state.activeObject) {
            this.state.activeObject.scale.set(defaultScale, defaultScale, defaultScale);
            this.state.activeObject.userData.scale = defaultScale;
            this.options.showNotification(`Scale reset to ${defaultScale.toFixed(1)}x`, 1000);
        } else {
            this.state.currentScale = defaultScale;
            this.options.showNotification(`Default scale reset to ${defaultScale.toFixed(1)}x`, 1000);
        }
        
        this._updateModelInfo();
    }

    /**
     * Remove the current active object
     */
    removeObject() {
        if (this.state.activeObject) {
            // Remove from scene
            this.state.scene.remove(this.state.activeObject);
            
            // Remove from tracked objects
            const index = this.state.placedObjects.indexOf(this.state.activeObject);
            if (index > -1) {
                this.state.placedObjects.splice(index, 1);
            }
            
            this.options.showNotification('Object removed', 2000);
            this.state.activeObject = null;
            
            // Update model info
            this._updateModelInfo();
            
            return true;
        } else if (this.state.placedObjects.length > 0) {
            // If no active object, remove the last placed object
            const lastObject = this.state.placedObjects.pop();
            this.state.scene.remove(lastObject);
            this.options.showNotification('Last object removed', 2000);
            
            // Update model info
            this._updateModelInfo();
            
            return true;
        }
        
        this.options.showNotification('No object to remove', 2000);
        return false;
    }

    /**
     * Clear all placed objects
     */
    clearObjects() {
        // Remove all objects from scene
        for (const obj of this.state.placedObjects) {
            this.state.scene.remove(obj);
        }
        
        this.state.placedObjects = [];
        this.state.activeObject = null;
        this.options.showNotification('All objects cleared', 2000);
        
        // Update model info
        this._updateModelInfo();
    }

    /**
     * Rotate the active object
     * @param {number} degrees - Degrees to rotate around y-axis
     */
    rotateObject(degrees = 45) {
        if (!this.state.activeObject) {
            if (this.state.placedObjects.length > 0) {
                // If no active object, rotate the last placed object
                this.state.activeObject = this.state.placedObjects[this.state.placedObjects.length - 1];
            } else {
                this.options.showNotification('No object to rotate', 2000);
                return;
            }
        }
        
        // Rotate around Y axis
        this.state.activeObject.rotation.y += THREE.MathUtils.degToRad(degrees);
        this.options.showNotification(`Rotated ${degrees}°`, 1000);
    }

    /**
     * Cycle to the next 3D model
     */
    nextModel() {
        this.options.currentModelIndex = 
            (this.options.currentModelIndex + 1) % this.options.models.length;
        
        const modelName = this.options.models[this.options.currentModelIndex].name;
        this.options.showNotification(`Model: ${modelName}`, 2000);
        
        // Update model info
        this._updateModelInfo();
    }

    /**
     * Update the model info display
     * @private
     */
    _updateModelInfo() {
        const modelNameEl = document.getElementById('current-model-name');
        const scaleEl = document.getElementById('current-scale');
        
        if (modelNameEl) {
            modelNameEl.textContent = this.options.models[this.options.currentModelIndex].name;
        }
        
        if (scaleEl) {
            let scale = this.state.currentScale;
            
            if (this.state.activeObject && this.state.activeObject.userData.scale) {
                scale = this.state.activeObject.userData.scale;
            }
            
            scaleEl.textContent = scale.toFixed(1);
        }
    }

    /**
     * Show notification message
     * @private
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    _showNotification(message, duration = 2000) {
        // Use provided notification function if available
        if (this.options && this.options.showNotification !== this._showNotification) {
            this.options.showNotification(message, duration);
            return;
        }
        
        // Fallback to direct DOM manipulation
        let notification = document.getElementById('ar-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'ar-notification';
            notification.style.zIndex = '2000'; // Ensure it's visible on top of AR
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.style.opacity = '1';
        
        setTimeout(() => {
            notification.style.opacity = '0';
        }, duration);
    }

    /**
     * Generate a random color
     * @private
     * @returns {number} Random color as hex number
     */
    _getRandomColor() {
        return Math.random() * 0xffffff;
    }
}

// Export the ARManager class
window.ARManager = ARManager;