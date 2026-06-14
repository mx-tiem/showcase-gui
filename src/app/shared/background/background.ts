import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import * as THREE from 'three';

const GIF_FILES = [
  'akuma.gif',
  'arcade-arcades.gif',
  'batman.gif',
  'bouncy-coin-coin-pixel.gif',
  'capoo-gaming.gif',
  'crash-bandicoot-classic.gif',
  'crash-bandicoot-crash.gif',
  'dancing-venom.gif',
  'desk-job-video-games.gif',
  'donkey-kong-1.gif',
  'donkey-kong.gif',
  'fighitng-game.gif',
  'freakmeaning-fre4k-1.gif',
  'freakmeaning-fre4k.gif',
  'gta-grand-theft-auto.gif',
  "i'm-coming-for-you-batman.gif",
  'iron-man.gif',
  'joker.gif',
  'kong-donkey.gif',
  'locked-in-lock.gif',
  'manidhaya.gif',
  'mario-mario-walking.gif',
  'oacmn.gif',
  'ok.gif',
  'old-mario.gif',
  'pac-man-wewe.gif',
  'pacmn.gif',
  'peter.gif',
  'playstation-controler.gif',
  'puppy-day.gif',
  'pusheen-gaming-me-as-fweak.gif',
  'sonic-dance.gif',
  'spider-man-web.gif',
  'spyro-the-dragon-purple-dragon.gif',
  'suggs.gif',
  'talking-super-mario-animated-stickers-super-mario-2.gif',
  'talking-super-mario-animated-stickers-super-mario.gif',
  'turtle-mario-gaming.gif',
  'twitch-gif.gif',
  'venom.gif',
];

@Component({
  selector: 'app-background',
  standalone: true,
  template: `<canvas #bgCanvas></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9999;
        pointer-events: none;
        overflow: hidden;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class Background implements AfterViewInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private animationId = 0;

  // The single leaf
  private leaf!: THREE.Mesh;
  private leafMaterial!: THREE.MeshBasicMaterial;

  // GIF rendering
  private gifImg!: HTMLImageElement;
  private gifCanvas!: HTMLCanvasElement;
  private gifCtx!: CanvasRenderingContext2D;
  private gifTexture!: THREE.CanvasTexture;
  private gifLoaded = false;
  private gifContainer!: HTMLDivElement;

  private frameCount = 0;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    this.initThreeJS();
    this.loadGif();
    this.createLeaf();
    this.ngZone.runOutsideAngular(() => this.animate());
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.leafMaterial.dispose();
    this.leaf.geometry.dispose();
    this.gifTexture.dispose();
    this.renderer.dispose();
    this.gifContainer.remove();
  }

  private initThreeJS() {
    const canvas = this.canvasRef.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    // Orthographic camera: 1 unit = 1 pixel
    this.camera = new THREE.OrthographicCamera(0, w, h, 0, -10, 10);
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Keep the gif <img> on-screen (tiny, nearly invisible) so the browser keeps decoding frames. */
  private loadGif() {
    this.gifContainer = document.createElement('div');
    this.gifContainer.style.cssText =
      'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none;z-index:-1;';
    document.body.appendChild(this.gifContainer);

    const gifName = GIF_FILES[Math.floor(Math.random() * GIF_FILES.length)];

    this.gifImg = new Image();
    this.gifImg.crossOrigin = 'anonymous';
    this.gifImg.src = `assets/images/background_gifs/${encodeURIComponent(gifName)}`;
    this.gifImg.style.cssText = 'width:64px;height:64px;display:block;';
    this.gifContainer.appendChild(this.gifImg);

    this.gifCanvas = document.createElement('canvas');
    this.gifCanvas.width = 128;
    this.gifCanvas.height = 128;
    this.gifCtx = this.gifCanvas.getContext('2d')!;

    this.gifTexture = new THREE.CanvasTexture(this.gifCanvas);
    this.gifTexture.minFilter = THREE.LinearFilter;
    this.gifTexture.magFilter = THREE.LinearFilter;

    this.gifImg.onload = () => (this.gifLoaded = true);
  }

  private createLeaf() {
    const size = 80;
    const geometry = new THREE.PlaneGeometry(size, size);
    this.leafMaterial = new THREE.MeshBasicMaterial({
      map: this.gifTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.35,
    });
    this.leaf = new THREE.Mesh(geometry, this.leafMaterial);

    // Start at bottom-left
    this.leaf.position.set(0, 0, 0);
    this.scene.add(this.leaf);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.frameCount++;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Update gif texture every 3 frames
    if (this.frameCount % 3 === 0 && this.gifLoaded) {
      this.gifCtx.clearRect(0, 0, 128, 128);
      this.gifCtx.drawImage(this.gifImg, 0, 0, 128, 128);
      this.gifTexture.needsUpdate = true;
    }

    // Simple linear path: bottom-left (0, 0) → top-center (w/2, h)
    // Use a looping progress value
    const speed = 0.0003; // full trip per ~3300 frames
    const progress = (this.frameCount * speed) % 1;

    this.leaf.position.x = progress * (w / 2);
    this.leaf.position.y = progress * h;

    // Reset to bottom-left when it loops
    this.renderer.render(this.scene, this.camera);
  }
}
