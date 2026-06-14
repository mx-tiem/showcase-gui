import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Type, ApplicationRef, EnvironmentInjector, ViewContainerRef, createComponent, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { LeafAnimation } from './leaf-animation';
import { Home } from '../../user/home/home';
import { Reservations } from '../../user/reservations/reservations';
import { Events } from '../../user/events/events';
import { Friends } from '../../user/friends/friends';
import { Hours } from '../../user/hours/hours';
import { Settings } from '../../user/settings/settings';
import { LoginService } from '../../login/login.service';
import { InternalApiService } from '../../shared/internal-api.service';
import { Notification } from '../../interfaces/notification.interface';

// Constants
const ANIMATION_CONFIG = {
  CAMERA_DISTANCE: 5000, // Increased from 1000 to reduce perspective scaling
  MORPH_DURATION: 200,
  ROTATION_LERP: 0.1,
  ROTATION_THRESHOLD: 0.001,
  OPACITY_DURATION: 0.5,
  RESIZE_DELAY: 500,
  ROTATION_CHECK_INTERVAL: 50,
} as const;

// Debug flag - set to false for production
const DEBUG = false;

const COLORS = {
  FRONT: '#FF5252',
  RIGHT: '#448AFF',
  BACK: '#69F0AE',
  LEFT: '#FFD740',
  TOP: '#E040FB',
  BOTTOM: '#FF6E40',
} as const;

// Interfaces
interface FaceConfig {
  rotation: [number, number, number];
  color: string;
  label: string;
  component?: Type<any>;
}

interface ComponentStyle {
  width: string;
  height: string;
  display: string;
  overflow: string;
  pointerEvents: string;
  transformOrigin: string;
}

@Component({
  selector: 'app-cube-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, MatDividerModule, TranslocoModule],
  templateUrl: './cube-view.html',
  styleUrl: './cube-view.scss',
})
export class CubeView implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: false }) containerRef!: ElementRef<HTMLDivElement>;

  constructor(
    private injector: EnvironmentInjector,
    private viewContainerRef: ViewContainerRef,
    private appRef: ApplicationRef,
    private router: Router,
    private route: ActivatedRoute,
    private loginService: LoginService,
    private internalApi: InternalApiService
  ) {}

  // Notification & Account signals
  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);
  userName = signal<string>('');
  private userSub?: Subscription;
  private routerSub?: Subscription;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer!: CSS3DRenderer;
  private cube!: THREE.Object3D;
  private animationId: number = 0;
  private isRotating = false;
  private targetRotation = { x: 0, y: 0 };
  private diceRollDuration = 0;
  private diceRollStartTime = 0;
  private faceSize = { width: 300, height: 300 };
  private isBrick = false;
  private initialCubeSize: { width: number; height: number } | null = null;
  private homeKey = 0;
  private activeFaceIndex = 0;
  private isVisible = true;

  // Leaf background animation embedded in cube faces
  private leafAnimation: LeafAnimation | null = null;

  // Route to face mapping
  private routeToFaceMap: { [key: string]: number } = {
    'home': 0,        // front
    'reservations': 1, // right
    'reservations/new': 1, // right (same as reservations)
    'events': 2,      // back
    'friends': 3,     // left
    'hours': 4,       // top
    'settings': 5     // bottom
  };

  // Cached container dimensions to avoid repeated DOM queries
  private cachedContainerDimensions: { width: number; height: number } | null = null;

  // Helper for conditional debug logging
  private debugLog = (...args: any[]) => DEBUG && console.log(...args);

  // Get the active route based on current URL
  get activeRoute(): string {
    const currentPath = this.route.snapshot.url[0]?.path;
    return currentPath || 'home';
  }

  private readonly faceConfigs: FaceConfig[] = [
    {
      rotation: [0, 0, 0],
      color: COLORS.FRONT,
      label: 'Front',
      component: Home
    },
    {
      rotation: [0, Math.PI / 2, 0],
      color: COLORS.RIGHT,
      label: 'Right',
      component: Reservations
    },
    {
      rotation: [0, Math.PI, 0],
      color: COLORS.BACK,
      label: 'Back',
      component: Events
    },
    {
      rotation: [0, -Math.PI / 2, 0],
      color: COLORS.LEFT,
      label: 'Left',
      component: Friends
    },
    {
      rotation: [-Math.PI / 2, 0, 0],
      color: COLORS.TOP,
      label: 'Top',
      component: Hours
    },
    {
      rotation: [Math.PI / 2, 0, 0],
      color: COLORS.BOTTOM,
      label: 'Bottom',
      component: Settings
    },
  ];

  private readonly componentStyle: ComponentStyle = {
    width: '100%',
    height: '100%',
    display: 'block',
    overflow: 'auto',
    pointerEvents: 'auto', // This will be overridden based on isActive
    transformOrigin: 'center center' // Ensure components scale from center
  };

  ngAfterViewInit(): void {
    // Initialize notifications and account info
    this.userSub = this.loginService.user.subscribe(user => {
      this.userName.set(user?.name || '');
      if (user) {
        this.loadDropdownNotifications();
      } else {
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.userName()) {
          this.loadDropdownNotifications();
        }
      });

    // Check for animation flags
    const skipAnimation = sessionStorage.getItem('skipCubeAnimation') === 'true';
    const animateNavigation = sessionStorage.getItem('animateNavigation') === 'true';
    
    // Clear flags
    if (skipAnimation) sessionStorage.removeItem('skipCubeAnimation');
    if (animateNavigation) sessionStorage.removeItem('animateNavigation');
    
    // Set active face based on current route FIRST, before creating faces
    const currentPath = this.route.snapshot.url[0]?.path;
    this.debugLog('Current route path:', currentPath);
    this.debugLog('Skip animation:', skipAnimation);
    this.debugLog('Animate navigation:', animateNavigation);
    this.debugLog('Route to face map:', this.routeToFaceMap);
    if (currentPath && this.routeToFaceMap[currentPath] !== undefined) {
      this.activeFaceIndex = this.routeToFaceMap[currentPath];
      this.debugLog('Setting active face from route:', currentPath, '-> face index:', this.activeFaceIndex);
    } else {
      this.debugLog('No matching route found for path:', currentPath, 'defaulting to face 0');
      this.activeFaceIndex = 0;
    }

    this.debugLog('=== CubeView Initialization ===');
    this.debugLog('Screen dimensions:', { width: screen.width, height: screen.height });
    this.debugLog('Window dimensions:', { width: window.innerWidth, height: window.innerHeight });
    this.debugLog('Device pixel ratio:', window.devicePixelRatio);

    this.initThreeJS();
    this.setFaceSizeFromContainer();
    // Create the leaf animation before faces so canvases can be registered
    this.leafAnimation = new LeafAnimation();
    this.leafAnimation.setActiveFace(this.activeFaceIndex);
    this.createCubeFaces(); // Now called after activeFaceIndex is set
    this.leafAnimation.start();
    this.leafAnimation.resume(); // No rotation on init — start emitting immediately
    this.animate();

    if (skipAnimation) {
      // Skip the full animation sequence - just set to correct orientation and expand
      this.debugLog('Skipping animation - going straight to target face');
      
      // Start in cube mode
      this.isBrick = false;
      this.setFaceSizeFromContainer();
      this.cube.children.forEach((child: any, idx: number) => {
        const element = child.element as HTMLElement;
        element.style.opacity = idx === this.activeFaceIndex ? '1' : '0.3';
        element.style.pointerEvents = idx === this.activeFaceIndex ? 'auto' : 'none';
        element.style.width = `${this.faceSize.width}px`;
        element.style.height = `${this.faceSize.height}px`;
        const componentElement = element.querySelector('.cube-face-component') as HTMLElement;
        if (componentElement) {
          componentElement.style.width = `${this.faceSize.width}px`;
          componentElement.style.height = `${this.faceSize.height}px`;
        }
      });
      // Position faces for cube mode
      this.cube.children.forEach((child: any, index: number) => {
        let position: [number, number, number];
        position = [
          index === 1 ? this.faceSize.width / 2 : index === 3 ? -this.faceSize.width / 2 : 0,
          index === 4 ? this.faceSize.height / 2 : index === 5 ? -this.faceSize.height / 2 : 0,
          index === 0 ? this.faceSize.height / 2 : index === 2 ? -this.faceSize.height / 2 : 0
        ];
        child.position.set(...position);
      });

      // Set cube to correct orientation instantly
      let targetRot = { x: 0, y: 0 };
      const faceNames: ('front' | 'right' | 'back' | 'left' | 'top' | 'bottom')[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
      const targetFace = faceNames[this.activeFaceIndex];
      switch (targetFace) {
        case 'front': targetRot = { x: 0, y: 0 }; break;
        case 'right': targetRot = { x: 0, y: -Math.PI / 2 }; break;
        case 'back': targetRot = { x: 0, y: Math.PI }; break;
        case 'left': targetRot = { x: 0, y: Math.PI / 2 }; break;
        case 'top': targetRot = { x: Math.PI / 2, y: 0 }; break;
        case 'bottom': targetRot = { x: -Math.PI / 2, y: 0 }; break;
      }
      this.cube.rotation.x = targetRot.x;
      this.cube.rotation.y = targetRot.y;

      // Directly morph to brick mode
      this.morphToBrick();
      
    } else if (animateNavigation) {
      // Do the full animation sequence for button navigation
      // Manually establish brick mode state with low opacity
      this.isBrick = true;
      this.setFaceSizeFromContainer(); // Set faceSize for brick mode
      this.cube.children.forEach((child: any, idx: number) => {
        const element = child.element as HTMLElement;
        // Set brick mode properties
        element.style.opacity = idx === this.activeFaceIndex ? '0.1' : '0'; // Low opacity for active face
        element.style.pointerEvents = 'none';
        element.style.width = `${this.faceSize.width}px`;
        element.style.height = `${this.faceSize.height}px`;
        const componentElement = element.querySelector('.cube-face-component') as HTMLElement;
        if (componentElement) {
          componentElement.style.width = `${this.faceSize.width}px`;
          componentElement.style.height = `${this.faceSize.height}px`;
        }
        // Position at center for brick mode
        child.position.set(0, 0, 0);
      });
      
      // Now morph to cube like the play button does
      setTimeout(() => {
        this.morphToCube(); // This should shrink from brick size to cube size
        
        // Wait for morph animation, then dice roll
        setTimeout(() => {
          this.startDiceRoll();
          const checkDiceRoll = () => {
            if (!this.isRotating) {
              // Get the target face name from the route
              const faceNames: ('front' | 'right' | 'back' | 'left' | 'top' | 'bottom')[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
              const targetFace = faceNames[this.activeFaceIndex];
              this.rotateTo(targetFace);
              // Wait for rotation to finish
              const checkRotation = () => {
                if (!this.isRotating) {
                  this.morphToBrick(); // Expand to show content
                } else {
                  setTimeout(checkRotation, 50);
                }
              };
              checkRotation();
            } else {
              setTimeout(checkDiceRoll, 50);
            }
          };
          setTimeout(checkDiceRoll, 100);
        }, 500); // Wait for morphToCube animation
      }, 100);
    } else {
      // Direct URL access - do the full animation sequence like navigation buttons
      this.debugLog('Direct URL access - doing full animation sequence');
      
      // Manually establish brick mode state with low opacity
      this.isBrick = true;
      this.setFaceSizeFromContainer(); // Set faceSize for brick mode
      this.cube.children.forEach((child: any, idx: number) => {
        const element = child.element as HTMLElement;
        // Set brick mode properties
        element.style.opacity = idx === this.activeFaceIndex ? '0.1' : '0'; // Low opacity for active face
        element.style.pointerEvents = 'none';
        element.style.width = `${this.faceSize.width}px`;
        element.style.height = `${this.faceSize.height}px`;
        const componentElement = element.querySelector('.cube-face-component') as HTMLElement;
        if (componentElement) {
          componentElement.style.width = `${this.faceSize.width}px`;
          componentElement.style.height = `${this.faceSize.height}px`;
        }
        // Position at center for brick mode
        child.position.set(0, 0, 0);
      });
      
      // Now morph to cube like the play button does
      setTimeout(() => {
        this.morphToCube(); // This should shrink from brick size to cube size
        
        // Wait for morph animation, then dice roll
        setTimeout(() => {
          this.startDiceRoll();
          const checkDiceRoll = () => {
            if (!this.isRotating) {
              // Get the target face name from the route
              const faceNames: ('front' | 'right' | 'back' | 'left' | 'top' | 'bottom')[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
              const targetFace = faceNames[this.activeFaceIndex];
              this.rotateTo(targetFace);
              // Wait for rotation to finish
              const checkRotation = () => {
                if (!this.isRotating) {
                  this.morphToBrick(); // Expand to show content
                } else {
                  setTimeout(checkRotation, 50);
                }
              };
              checkRotation();
            } else {
              setTimeout(checkDiceRoll, 50);
            }
          };
          setTimeout(checkDiceRoll, 100);
        }, 500); // Wait for morphToCube animation
      }, 100);
    }

    // Add visibility detection for performance
    const observer = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(this.containerRef.nativeElement);

    // Subscribe to router events to update activeFaceIndex when route changes
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const currentPath = this.route.snapshot.url[0]?.path;
        if (currentPath && this.routeToFaceMap[currentPath] !== undefined) {
          this.activeFaceIndex = this.routeToFaceMap[currentPath];
          this.leafAnimation?.setActiveFace(this.activeFaceIndex);
          this.leafAnimation?.resume(); // Direct navigation — no rotation involved
          this.debugLog('Updated active face from route change:', currentPath, '-> face index:', this.activeFaceIndex);
        }
      }
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.debugLog('=== Initialization Complete ===');
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer?.domElement) {
      this.renderer.domElement.remove();
    }
    if (this.leafAnimation) {
      this.leafAnimation.destroy();
      this.leafAnimation = null;
    }
  }

  private initThreeJS(): void {
    const container = this.containerRef.nativeElement;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.debugLog('=== Three.js Initialization ===');
    this.debugLog('Container element:', {
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight
    });
    this.debugLog('Renderer size:', { width, height });
    this.debugLog('Camera distance:', ANIMATION_CONFIG.CAMERA_DISTANCE);

    this.scene = new THREE.Scene();
    // Use OrthographicCamera with frustum sized to match container for exact pixel mapping
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    this.debugLog('Setting orthographic camera frustum:', {
      containerWidth,
      containerHeight,
      left: -containerWidth / 2,
      right: containerWidth / 2,
      top: containerHeight / 2,
      bottom: -containerHeight / 2
    });
    
    this.camera = new THREE.OrthographicCamera(
      -containerWidth / 2, containerWidth / 2,  // Left, Right
      containerHeight / 2, -containerHeight / 2, // Top, Bottom
      1, 10000
    );
    this.camera.position.z = ANIMATION_CONFIG.CAMERA_DISTANCE;
    this.camera.zoom = 1; // Initialize zoom
    this.camera.updateProjectionMatrix();

    this.renderer = new CSS3DRenderer();
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.pointerEvents = 'auto';
    container.appendChild(this.renderer.domElement);

    this.debugLog('Renderer DOM element added to container');
    const rendererComputed = window.getComputedStyle(this.renderer.domElement);
    this.debugLog('Renderer final size:', {
      clientWidth: this.renderer.domElement.clientWidth,
      clientHeight: this.renderer.domElement.clientHeight,
      style: {
        width: this.renderer.domElement.style.width,
        height: this.renderer.domElement.style.height,
        position: this.renderer.domElement.style.position,
        perspective: this.renderer.domElement.style.perspective
      },
      computed: {
        maxWidth: rendererComputed.maxWidth,
        maxHeight: rendererComputed.maxHeight,
        overflow: rendererComputed.overflow,
        transform: rendererComputed.transform,
        position: rendererComputed.position,
        width: rendererComputed.width,
        height: rendererComputed.height
      }
    });

    this.cube = new THREE.Object3D();
    this.scene.add(this.cube);

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.debugLog('Three.js initialization complete');
    this.debugLog('========================');
  }

  private setFaceSizeFromContainer(): void {
    this.debugLog('=== Face Size Calculation START ===', Date.now());
    this.debugLog('Call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
    const container = this.containerRef.nativeElement;

    // Cache container dimensions to avoid repeated DOM queries
    this.cachedContainerDimensions = {
      width: container.clientWidth,
      height: container.clientHeight
    };

    this.debugLog('Container dimensions:', this.cachedContainerDimensions);
    this.debugLog('Window dimensions:', { innerWidth: window.innerWidth, innerHeight: window.innerHeight });
    this.debugLog('Device pixel ratio:', window.devicePixelRatio);
    this.debugLog('Screen dimensions:', { width: screen.width, height: screen.height });

    if (this.isBrick) {
      // Brick mode: faces should fill the container fully
      this.faceSize = {
        width: this.cachedContainerDimensions.width,
        height: this.cachedContainerDimensions.height
      };
      this.debugLog('Brick mode face size:', this.faceSize);
    } else {
      // Cube mode: faces should be smaller for navigation
      if (!this.initialCubeSize) {
        const smallerDimension = Math.min(this.cachedContainerDimensions.width, this.cachedContainerDimensions.height);
        // Cube faces should be smaller than brick faces for navigation
        let cubeRatio: number;
        if (smallerDimension < 600) {
          cubeRatio = 0.35; // Small faces on phones
        } else if (smallerDimension < 900) {
          cubeRatio = 0.40; // Medium faces on tablets
        } else if (smallerDimension < 1200) {
          cubeRatio = 0.45; // Larger faces on small laptops
        } else {
          cubeRatio = 0.50; // Good size for desktops
        }

        const cubeSize = Math.floor(smallerDimension * cubeRatio);
        this.initialCubeSize = { width: cubeSize, height: cubeSize };
        this.debugLog('Calculated cube size:', { cubeRatio, cubeSize, finalSize: this.initialCubeSize });
      }
      this.faceSize = { ...this.initialCubeSize };
      this.debugLog('Using cached cube size:', this.faceSize);
    }
    this.debugLog('=== Face Size Calculation END ===');
  }

  private componentRefs: any[] = []; // Store component references to update inputs

  private createComponentElement(componentType: Type<any>, isActive: boolean): HTMLElement {
    this.debugLog('Creating component:', componentType.name, 'with isActive:', isActive);
    const componentRef = createComponent(componentType, {
      environmentInjector: this.injector,
      elementInjector: this.viewContainerRef.injector
    });

    // Set isActive input if the component has it
    if (componentRef.instance && 'isActive' in componentRef.instance) {
      componentRef.instance.isActive = isActive;
      this.debugLog('Set isActive to', isActive, 'for component', componentType.name);
    } else {
      this.debugLog('Component', componentType.name, 'does not have isActive input');
    }

    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();

    // Store component ref for later updates
    this.componentRefs.push(componentRef);
    
    // Mark that ngOnInit hasn't been called yet
    componentRef.instance._ngOnInitCalled = false;

    const hostElement = componentRef.location.nativeElement;
    const componentStyleWithPointerEvents = {
      ...this.componentStyle,
      pointerEvents: isActive ? 'auto' : 'none'
    };
    Object.assign(hostElement.style, componentStyleWithPointerEvents);
    this.debugLog('Component created and attached:', componentType.name);

    return hostElement;
  }

  private updateComponentInputs(): void {
    this.debugLog('=== Updating Component Inputs ===');
    this.debugLog('Active face index:', this.activeFaceIndex);
    this.debugLog('Total component refs:', this.componentRefs.length);
    
    this.componentRefs.forEach((componentRef, index) => {
      const shouldBeActive = index === this.activeFaceIndex;
      if (componentRef.instance && 'isActive' in componentRef.instance) {
        const currentIsActive = componentRef.instance.isActive;
        if (currentIsActive !== shouldBeActive) {
          componentRef.instance.isActive = shouldBeActive;
          
          // Update component element pointer events
          const hostElement = componentRef.location.nativeElement;
          hostElement.style.pointerEvents = shouldBeActive ? 'auto' : 'none';
          
          // Try to call lifecycle methods manually if they exist
          if (shouldBeActive && componentRef.instance.ngOnChanges) {
            const changes = {
              isActive: {
                currentValue: true,
                previousValue: false,
                firstChange: false,
                isFirstChange: () => false
              }
            };
            componentRef.instance.ngOnChanges(changes);
          }
          
          componentRef.changeDetectorRef.detectChanges();
        } else {
          // Even if it's already correct, if it should be active, make sure lifecycle methods are called
          if (shouldBeActive && componentRef.instance.ngOnInit && !componentRef.instance._ngOnInitCalled) {
            componentRef.instance.ngOnInit();
            componentRef.instance._ngOnInitCalled = true;
          }
        }
      }
    });
    this.debugLog('Component inputs updated');
  }

  private createFaceElement(face: FaceConfig, index: number): HTMLElement {
    const element = document.createElement('div');

    this.debugLog(`Creating face element ${index} with size:`, this.faceSize);

    // Base styles — use theme surface colour instead of debug colours
    Object.assign(element.style, {
      width: `${this.faceSize.width}px`,
      height: `${this.faceSize.height}px`,
      background: 'var(--mat-sys-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.1rem',
      lineHeight: '1.2',
      padding: '0',
      margin: '0',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      transformOrigin: 'center center',
      position: 'relative',          // stacking context for canvas + component
      overflow: 'hidden',
    });

    this.debugLog(`Face element ${index} style set:`, {
      width: element.style.width,
      height: element.style.height,
      background: element.style.background
    });

    // --- Leaf-animation particles (DOM divs behind content, z-index 0) ---
    if (this.leafAnimation) {
      this.leafAnimation.registerFace(index, element);
    }

    // Add component or label
    if (face.component) {
      const isActiveForThisFace = index === this.activeFaceIndex;
      this.debugLog(`Face ${index} (${face.label}) getting component:`, face.component.name, 'isActive:', isActiveForThisFace, 'activeFaceIndex:', this.activeFaceIndex);
      const componentElement = this.createComponentElement(face.component, isActiveForThisFace);
      // Ensure component sits above the canvas
      componentElement.style.position = 'relative';
      componentElement.style.zIndex = '1';
      componentElement.classList.add('cube-face-component');
      element.appendChild(componentElement);
      this.debugLog(`Face ${index} component attached`);
    } else {
      const label = document.createElement('b');
      label.textContent = face.label;
      label.style.position = 'relative';
      label.style.zIndex = '1';
      label.classList.add('cube-face-component');
      element.appendChild(label);
      this.debugLog(`Face ${index} getting label: ${face.label}`);
    }

    return element;
  }

  private createCubeFaces(): void {
    this.debugLog('=== Creating Cube Faces ===');
    this.debugLog('Mode:', this.isBrick ? 'BRICK' : 'CUBE');
    this.debugLog('Face size for creation:', this.faceSize);

    // Clear existing faces
    while (this.cube.children.length) {
      this.cube.remove(this.cube.children[0]);
    }

    this.setFaceSizeFromContainer();

    this.faceConfigs.forEach((face, index) => {
      // Calculate position based on mode
      let position: [number, number, number];

      if (this.isBrick) {
        // In brick mode, all faces stack at center
        position = [0, 0, 0];
        this.debugLog(`Brick mode: Face ${index} at center position`);
      } else {
        // Cube mode positioning - keep faces close to camera to minimize perspective effects
        const closeDistance = 10; // Much closer to camera to reduce perspective effects
        position = [
          index === 1 ? closeDistance : index === 3 ? -closeDistance : 0,
          index === 4 ? closeDistance : index === 5 ? -closeDistance : 0,
          index === 0 ? closeDistance : index === 2 ? -closeDistance : 0
        ];
        this.debugLog(`Cube mode: Face ${index} position (close to camera):`, position);
      }

      const element = this.createFaceElement(face, index);

      // Log element dimensions
      this.debugLog(`Face ${index} element created:`, {
        styleWidth: element.style.width,
        styleHeight: element.style.height,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight
      });

      const object = new CSS3DObject(element);
      object.position.set(...position);
      object.rotation.set(...face.rotation);
      object.userData = { faceIndex: index };

      this.cube.add(object);
    });

    this.debugLog('Total faces created:', this.cube.children.length);
    this.debugLog('==========================');

    // Don't call setFaceVisibility here - it will be called by morphToBrick()
  }

  public morphToCube(): void {
    this.debugLog('=== Morphing to Cube Mode ===');
    this.isBrick = false;
    this.setFaceSizeFromContainer();

    // In cube mode, ensure only the active face is fully visible during transition
    this.cube.children.forEach((child: any, idx: number) => {
      const element = child.element as HTMLElement;
      if (idx === this.activeFaceIndex) {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      } else {
        // Keep other faces visible but slightly transparent during cube mode
        element.style.opacity = '0.3';
        element.style.pointerEvents = 'none';
      }
    });

    this.animateMorph();
    // Note: setFaceVisibility() is not called here to maintain custom visibility during transition
  }

  public morphToBrick(): void {
    this.debugLog('=== Morphing to Brick Mode ===');
    this.debugLog('Active face index:', this.activeFaceIndex);
    this.isBrick = true;

    // Immediately hide all non-active faces before starting the expansion
    this.cube.children.forEach((child: any, idx: number) => {
      const element = child.element as HTMLElement;
      if (idx !== this.activeFaceIndex) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        this.debugLog(`Face ${idx} hidden immediately before brick morph`);
      } else {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
        this.debugLog(`Face ${idx} will be expanded (ACTIVE FACE)`);
      }
    });

    this.setFaceSizeFromContainer();
    this.animateMorph();
    this.setFaceVisibility();
  }

  private setFaceVisibility(): void {
    if (!this.cube) return;

    this.debugLog('=== Setting Face Visibility ===');
    this.debugLog('Mode:', this.isBrick ? 'BRICK' : 'CUBE');
    this.debugLog('Active face index:', this.activeFaceIndex);

    this.cube.children.forEach((child: any, idx: number) => {
      const element = child.element as HTMLElement;
      const isVisible = !this.isBrick || idx === this.activeFaceIndex;

      this.debugLog(`Face ${idx} visibility:`, {
        isVisible,
        currentOpacity: element.style.opacity,
        currentPointerEvents: element.style.pointerEvents,
        willBeVisible: isVisible
      });

      // Preserve existing transitions but add opacity transition
      const existingTransitions = element.style.transition.split(',').filter(t =>
        !t.trim().startsWith('opacity')
      ).join(', ');

      Object.assign(element.style, {
        opacity: isVisible ? '1' : '0',
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: existingTransitions + (existingTransitions ? ', ' : '') + `opacity ${ANIMATION_CONFIG.OPACITY_DURATION}s cubic-bezier(0.4,0,0.2,1)`
      });

      this.debugLog(`Face ${idx} after visibility update:`, {
        opacity: element.style.opacity,
        pointerEvents: element.style.pointerEvents,
        transition: element.style.transition
      });
    });

    this.debugLog('Face visibility updated');
    this.debugLog('========================');
    
    // Update component inputs when visibility changes
    this.updateComponentInputs();
  }

  private animateMorph(): void {
    if (!this.cube) return;

    this.debugLog('=== Animating Morph ===');
    this.debugLog('Target face size:', this.faceSize);
    this.debugLog('Current mode:', this.isBrick ? 'BRICK' : 'CUBE');

    this.cube.children.forEach((child: any, index: number) => {
      const element = child.element as HTMLElement;

      // Immediately hide non-active faces in brick mode to prevent flashing
      if (this.isBrick && index !== this.activeFaceIndex) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        this.debugLog(`Face ${index} hidden immediately (non-active in brick mode)`);
      }

      this.debugLog(`Face ${index} before animation:`, {
        currentWidth: element.clientWidth,
        currentHeight: element.clientHeight,
        styleWidth: element.style.width,
        styleHeight: element.style.height
      });

      // Update position based on mode
      let position: [number, number, number];
      if (this.isBrick) {
        // In brick mode, all faces stack at center
        position = [0, 0, 0];
      } else {
        // Cube mode positioning
        position = [
          index === 1 ? this.faceSize.width / 2 : index === 3 ? -this.faceSize.width / 2 : 0,
          index === 4 ? this.faceSize.height / 2 : index === 5 ? -this.faceSize.height / 2 : 0,
          index === 0 ? this.faceSize.height / 2 : index === 2 ? -this.faceSize.height / 2 : 0
        ];
      }
      child.position.set(...position);

      // Use controlled animation instead of CSS transitions for consistent behavior
      this.animateFaceSize(element, this.faceSize.width, this.faceSize.height);
    });

    this.debugLog('Morph animation started');
    this.debugLog('========================');
  }

  private animateFaceSize(element: HTMLElement, targetWidth: number, targetHeight: number): void {
    const startWidth = element.clientWidth || parseInt(element.style.width);
    const startHeight = element.clientHeight || parseInt(element.style.height);
    const duration = ANIMATION_CONFIG.MORPH_DURATION;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

      const currentWidth = startWidth + (targetWidth - startWidth) * easeProgress;
      const currentHeight = startHeight + (targetHeight - startHeight) * easeProgress;

      element.style.width = `${Math.round(currentWidth)}px`;
      element.style.height = `${Math.round(currentHeight)}px`;

      // Also update component inside (skip the canvas, target the component)
      const componentElement = element.querySelector('.cube-face-component') as HTMLElement;
      if (componentElement) {
        componentElement.style.width = `${Math.round(currentWidth)}px`;
        componentElement.style.height = `${Math.round(currentHeight)}px`;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Only animate if component is visible for performance
    if (!this.isVisible) return;

    if (this.isRotating) {
      if (this.diceRollDuration > 0) {
        // Dice roll mode
        const elapsed = Date.now() - this.diceRollStartTime;
        const settlingTime = 300; // Start settling 300ms before end
        const timeToSettle = this.diceRollDuration - settlingTime;
        
        if (elapsed < timeToSettle) {
          // Random spinning phase
          this.cube.rotation.x += 0.05;
          this.cube.rotation.y += 0.08;
        } else if (elapsed < this.diceRollDuration) {
          // Settling phase - lerp to target
          const lerpFactor = 0.15; // Faster lerp for settling
          this.cube.rotation.x += (this.targetRotation.x - this.cube.rotation.x) * lerpFactor;
          this.cube.rotation.y += (this.targetRotation.y - this.cube.rotation.y) * lerpFactor;
        } else {
          // Dice roll finished - snap to exact target
          this.cube.rotation.x = this.targetRotation.x;
          this.cube.rotation.y = this.targetRotation.y;
          this.diceRollDuration = 0;
          this.isRotating = false;
          this.leafAnimation?.resume();
        }
      } else {
        // Normal rotation to target
        const lerpFactor = 0.1;
        this.cube.rotation.x += (this.targetRotation.x - this.cube.rotation.x) * lerpFactor;
        this.cube.rotation.y += (this.targetRotation.y - this.cube.rotation.y) * lerpFactor;
        if (Math.abs(this.targetRotation.x - this.cube.rotation.x) < 0.001 &&
            Math.abs(this.targetRotation.y - this.cube.rotation.y) < 0.001) {
          this.cube.rotation.x = this.targetRotation.x;
          this.cube.rotation.y = this.targetRotation.y;
          this.isRotating = false;
          this.leafAnimation?.resume();
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  rotateTo(face: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'): void {
    if (this.isRotating) return;
    let targetRot = { x: 0, y: 0 };
    let faceIndex = 0;
    switch (face) {
      case 'front': targetRot = { x: 0, y: 0 }; faceIndex = 0; break;
      case 'right': targetRot = { x: 0, y: -Math.PI / 2 }; faceIndex = 1; break;
      case 'back': targetRot = { x: 0, y: Math.PI }; faceIndex = 2; break;
      case 'left': targetRot = { x: 0, y: Math.PI / 2 }; faceIndex = 3; break;
      case 'top': targetRot = { x: Math.PI / 2, y: 0 }; faceIndex = 4; break;
      case 'bottom': targetRot = { x: -Math.PI / 2, y: 0 }; faceIndex = 5; break;
    }
    this.targetRotation = targetRot;
    this.activeFaceIndex = faceIndex;
    this.leafAnimation?.setActiveFace(faceIndex);
    this.isRotating = true;
  }

  private rotateToFace(faceIndex: number): void {
    if (this.isRotating) return;
    let targetRot = { x: 0, y: 0 };
    switch (faceIndex) {
      case 0: targetRot = { x: 0, y: 0 }; break; // front
      case 1: targetRot = { x: 0, y: -Math.PI / 2 }; break; // right
      case 2: targetRot = { x: 0, y: Math.PI }; break; // back
      case 3: targetRot = { x: 0, y: Math.PI / 2 }; break; // left
      case 4: targetRot = { x: Math.PI / 2, y: 0 }; break; // top
      case 5: targetRot = { x: -Math.PI / 2, y: 0 }; break; // bottom
    }
    this.targetRotation = targetRot;
    this.activeFaceIndex = faceIndex;
    this.leafAnimation?.setActiveFace(faceIndex);
    this.isRotating = true;
  }

  private startDiceRoll(): void {
    if (this.isRotating) return;
    // Random duration between 0.8s (800ms) and 1.5s (1500ms) to allow time for settling
    this.diceRollDuration = 800 + Math.random() * 700;
    this.diceRollStartTime = Date.now();
    this.isRotating = true;
  }

  public handleFaceButton(face: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom', targetFace?: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'): void {
    const finalFace = targetFace || face;
    this.activeFaceIndex = this.getFaceIndex(finalFace); // Highlight the final destination face
    this.leafAnimation?.setActiveFace(this.activeFaceIndex);
    this.morphToCube();

    // Set target rotation for the final face
    let targetRot = { x: 0, y: 0 };
    switch (finalFace) {
      case 'front': targetRot = { x: 0, y: 0 }; break;
      case 'right': targetRot = { x: 0, y: -Math.PI / 2 }; break;
      case 'back': targetRot = { x: 0, y: Math.PI }; break;
      case 'left': targetRot = { x: 0, y: Math.PI / 2 }; break;
      case 'top': targetRot = { x: Math.PI / 2, y: 0 }; break;
      case 'bottom': targetRot = { x: -Math.PI / 2, y: 0 }; break;
    }
    this.targetRotation = targetRot;

    // Wait for resize animation to finish (500ms)
    setTimeout(() => {
      // Start dice roll with random duration (0.5s to 1.5s)
      this.startDiceRoll();
      
      // Wait for dice roll to finish
      const checkDiceRoll = () => {
        if (!this.isRotating) {
          // For play button, morph to brick mode
          // For navigation, navigation happens separately, so stay in cube mode
          if (!targetFace) {
            this.morphToBrick();
          }
        } else {
          setTimeout(checkDiceRoll, 50);
        }
      };
      checkDiceRoll();
    }, 500);
  }

  public navigateToFace(route: string): void {
    // Navigate to the route - this will create a new CubeView instance with the correct face
    this.router.navigate([route]);
  }

  public rollToFace(route: string): void {
    // Check if we're already on the target face
    const targetFaceIndex = this.routeToFaceMap[route];
    if (targetFaceIndex === this.activeFaceIndex) {
      return; // No need to rotate, already on the correct face
    }

    // Do random dice roll on current component
    const faces: ('front' | 'right' | 'back' | 'left' | 'top' | 'bottom')[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
    const randomFace = faces[Math.floor(Math.random() * faces.length)];
    
    // Get target face for the route
    const targetFace = faces[targetFaceIndex];
    
    // Trigger the dice roll animation to random face, but land on target face
    this.handleFaceButton(randomFace, targetFace);
    
    // Mark that this navigation should be animated
    sessionStorage.setItem('animateNavigation', 'true');
    
    // After animation completes (approximately 2-3 seconds), navigate to target route with skip animation flag
    setTimeout(() => {
      sessionStorage.setItem('skipCubeAnimation', 'true');
      this.router.navigate([route]);
    }, 2500);
  }

  public rollDice(): void {
    // Get all face names
    const faces: ('front' | 'right' | 'back' | 'left' | 'top' | 'bottom')[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
    // Select a random face
    const randomFace = faces[Math.floor(Math.random() * faces.length)];
    // Trigger the dice roll animation to that face
    this.handleFaceButton(randomFace);
  }

  private getFaceIndex(face: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'): number {
    switch (face) {
      case 'front': return 0;
      case 'right': return 1;
      case 'back': return 2;
      case 'left': return 3;
      case 'top': return 4;
      case 'bottom': return 5;
      default: return 0;
    }
  }

  // In onWindowResize, update sizes and positions without recreating faces
  private onWindowResize(): void {
    this.debugLog('=== Window Resize Event ===');
    const oldSize = { width: this.renderer.domElement.clientWidth, height: this.renderer.domElement.clientHeight };
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.debugLog('Old renderer size:', oldSize);
    this.debugLog('New window size:', { width: window.innerWidth, height: window.innerHeight });
    this.debugLog('New renderer size:', { width, height });
    this.debugLog('Current mode:', this.isBrick ? 'BRICK' : 'CUBE');

    // For orthographic camera, update the frustum bounds to match container
    const container = this.containerRef.nativeElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    (this.camera as THREE.OrthographicCamera).left = -containerWidth / 2;
    (this.camera as THREE.OrthographicCamera).right = containerWidth / 2;
    (this.camera as THREE.OrthographicCamera).top = containerHeight / 2;
    (this.camera as THREE.OrthographicCamera).bottom = -containerHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // Clear cached dimensions to force recalculation
    this.cachedContainerDimensions = null;
    this.initialCubeSize = null;

    this.homeKey++;
    this.debugLog('Home key incremented to:', this.homeKey);

    // Update face sizes and positions without recreating faces
    this.setFaceSizeFromContainer();
    this.animateMorph();

    this.debugLog('Resize handling complete');
    this.debugLog('========================');
  }

  // === Notification methods ===

  onNotificationMenuOpened(): void {
    if (this.unreadCount() > 0) {
      const token = this.loginService.getToken();
      this.internalApi.user.notifications.markAllAsRead(token).subscribe({
        next: () => {
          this.notifications.set(this.notifications().map(n => ({ ...n, read: true })));
          this.unreadCount.set(0);
        }
      });
    }
  }

  onViewAllNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  private loadDropdownNotifications(): void {
    const token = this.loginService.getToken();
    this.internalApi.user.notifications.getDropdown(token).subscribe({
      next: (response: any) => {
        this.notifications.set(response.notifications || []);
        this.unreadCount.set(response.unread_count || 0);
      },
      error: () => {
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });
  }

  // === Account methods ===

  onLogout(): void {
    this.loginService.logout();
  }
}
