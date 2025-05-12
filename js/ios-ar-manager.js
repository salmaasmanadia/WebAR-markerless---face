/**
 * iOS AR Implementation
 * Extends the base ARManager for iOS-specific implementation using AR.js
 * This implementation provides AR functionality for iOS devices through WebXR polyfill and AR.js
 */
class ARManagerIOS extends ARManager {
    constructor(options) {
        super(options);
        
        // iOS-specific properties
        this.state.isUsingARKit = true;
        this.state.arjsContext = null;
        
        // Override isInitialized
        this.state.isInitialized = false;
        
        // Add AR.js source
        this.state.arSource = null;
    }
    
    /**
     * Initialize the iOS AR implementation
     */
    async init() {
        if (this.state.isInitialized) return Promise.resolve();
        
        return new Promise(async (resolve, reject) => {
            try {
                // Setup Three.js scene - reuse parent method
                this._setupThreeJs();
                
                // Create the reticle - reuse parent method
                this._createReticle();
                
                // Setup AR.js context for iOS
                this._setupARjs();
                
                // Init GLTF loader
                this.state.gltfLoader = new THREE.GLTFLoader();
                
                // Setup the container for AR UI elements
                this._setupARUI();
                
                this.state.isInitialized = true;
                this.options.showNotification('AR initialized successfully for iOS', 2000);
                resolve();
            } catch (error) {
                console.error('iOS AR initialization error:', error);
                this.options.showNotification(`AR Error: ${error.message}`, 3000);
                reject(error);
            }
        });
    }
    
    /**
     * Setup AR.js for iOS
     * @private
     */
    _setupARjs() {
        // Create AR.js source
        this.state.arSource = new THREEx.ArToolkitSource({
            sourceType: 'webcam',
            sourceWidth: window.innerWidth,
            sourceHeight: window.innerHeight,
            displayWidth: window.innerWidth,
            displayHeight: window.innerHeight
        });
        
        // Handle resize
        this.state.arSource.init(() => {
            setTimeout(() => {
                this.state.arSource.onResizeElement();
                this.state.renderer.setSize(window.innerWidth, window.innerHeight);
            }, 2000);
        });
        
        // Create AR.js context
        this.state.arjsContext = new THREEx.ArToolkitContext({
            cameraParametersUrl: 'data/camera_para.dat',
            detectionMode: 'mono',
            maxDetectionRate: 30,
            canvasWidth: window.innerWidth,
            canvasHeight: window.innerHeight
        });
        
        // Initialize AR.js context
        this.state.arjsContext.init(() => {
            this.state.camera.projectionMatrix.copy(this.state.arjsContext.getProjectionMatrix());
        });
        
        // Create AR.js marker controls for markerless AR
        this.state.markerRoot = new THREE.Group();
        this.state.scene.add(this.state.markerRoot);
        
        // Create markerless controls
        this.state.markerControls = new THREEx.ArMarkerControls(this.state.arjsContext, this.state.markerRoot, {
            type: 'pattern',
            patternUrl: 'data/hiro.patt'
        });
    }
    
    /**
     * Override startARSession for iOS
     */
    async startARSession() {
        if (!this.state.isInitialized) {
            this.options.showNotification('AR not initialized yet', 3000);
            return;
        }
        
        try {
            // Make sure UI controls are visible
            this._showUIControls();
            
            // Start rendering
            this.state.renderer.setAnimationLoop(this._renderAR.bind(this));
            this.options.showNotification('AR session started for iOS', 2000);
        } catch (error) {
            console.error('Error starting iOS AR session:', error);
            this.options.showNotification(`AR Error: ${error.message}`, 3000);
        }
    }
    
    /**
     * iOS-specific render loop
     * @private
     */
    _renderAR() {
        if (this.state.arSource.ready) {
            // Update AR.js
            this.state.arjsContext.update(this.state.arSource.domElement);
            
            // Render the scene
            this.state.renderer.render(this.state.scene, this.state.camera);
        }
    }
    
    /**
     * Override placeObject for iOS
     * @param {THREE.Vector3} position - Position to place the object
     */
    placeObject(position = null) {
        // Create default position at the center for iOS
        if (!position) {
            position = new THREE.Vector3(0, 0, -1);
        }
        
        // Get current model definition
        const modelDef = this.options.models[this.options.currentModelIndex];
        
        if (modelDef.type === 'primitive') {
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
            
            // For iOS/AR.js, add to markerRoot instead of scene
            this.state.markerRoot.add(mesh);
            
            // Track the object
            this.state.placedObjects.push(mesh);
            this.state.activeObject = mesh;
            
            // Add metadata
            mesh.userData.type = modelDef.name;
            mesh.userData.scale = this.state.currentScale;
            
            this.options.showNotification(`Placed ${modelDef.name} (iOS)`, 2000);
            this._updateModelInfo();
            
            return mesh;
        } else if (modelDef.type === 'gltf') {
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
                
                // For iOS/AR.js, add to markerRoot instead of scene
                this.state.markerRoot.add(model);
                
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
                
                this.options.showNotification(`Placed ${modelDef.name} (iOS)`, 2000);
                this._updateModelInfo();
                
                return model;
            }, undefined, (error) => {
                console.error('Error loading GLTF model:', error);
                this.options.showNotification('Failed to load 3D model', 2000);
                return null;
            });
        }
    }
}

// Make the iOS AR Manager available globally
window.ARManagerIOS = ARManagerIOS;