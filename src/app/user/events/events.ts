import {
  Component,
  OnInit,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  Input,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';

// ─── Game constants ───
const DESIGN_HEIGHT = 300; // Reference canvas height the game was designed for
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y_OFFSET = 60; // px from bottom of canvas
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;
const MIN_OBSTACLE_GAP = 90;
const INITIAL_SPEED = 3;
const SPEED_BUMP = 0.2;       // speed increase per milestone
const OBSTACLE_MILESTONE = 4; // obstacles between each speed bump
const MAX_SPEED = 12;

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: 'cone' | 'barrier' | 'bricks';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

@Component({
  selector: 'app-events',
  imports: [CommonModule, MatIconModule, MatButtonModule, TranslocoModule],
  templateUrl: './events.html',
  styleUrl: './events.scss',
})
export class Events implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() isActive = false;
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Game state
  gameState: 'idle' | 'running' | 'over' = 'idle';
  score = 0;
  highScore = 0;

  private ctx!: CanvasRenderingContext2D;
  private animFrameId = 0;
  private flickerIntervalId: any = null;
  private canvasW = 0;   // logical width (design coords)
  private canvasH = 0;   // logical height (design coords)
  private groundY = 0;
  private scale = 1;     // pixel-to-design ratio
  private canvasInitialized = false;
  private canvasElement: HTMLCanvasElement | null = null;

  // Player
  private playerX = 60;
  private playerY = 0;
  private velocityY = 0;
  private isOnGround = true;
  private playerFrame = 0;
  private frameCounter = 0;

  // World
  private speed = INITIAL_SPEED;
  private obstacles: Obstacle[] = [];
  private distSinceLastObstacle = 0;
  private obstaclesPassed = 0;
  private particles: Particle[] = [];
  private groundOffset = 0;
  private buildingWindows: { relX: number; relY: number; opacity: number }[][] = [];
  private lastWindowFlicker = 0;

  // Input
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundTouchStart: ((e: TouchEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeStableTimer: any = null;

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.highScore = parseInt(localStorage.getItem('constructionRunnerHigh') || '0', 10);
  }

  ngAfterViewInit() {
    if (this.isActive && !this.canvasInitialized) {
      this.waitForFullSize();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isActive']) {
      if (this.isActive && !this.canvasInitialized) {
        this.waitForFullSize();
      } else if (!this.isActive) {
        this.stopGame();
      }
    }
  }

  ngOnDestroy() {
    this.stopGame();
    this.stopBackgroundFlicker();
    this.removeListeners();
    this.cleanupResizeObserver();
  }

  /**
   * Wait for the cube face to finish morphing to full (brick) size.
   * The cube's animateFaceSize() resizes our host element over ~200ms.
   * We use a ResizeObserver and wait until the size stabilizes for 150ms,
   * guaranteeing the morph animation is complete before we read dimensions.
   */
  private waitForFullSize() {
    this.cdr.detectChanges();
    this.cleanupResizeObserver();

    const host = this.el.nativeElement as HTMLElement;

    this.resizeObserver = new ResizeObserver(() => {
      // Every time the element resizes (during morph), reset the timer
      if (this.resizeStableTimer) clearTimeout(this.resizeStableTimer);
      this.resizeStableTimer = setTimeout(() => {
        // Size has been stable for 150ms — morph is done
        this.cleanupResizeObserver();
        this.tryInitCanvas();
      }, 150);
    });
    this.resizeObserver.observe(host);

    // Fallback: if the element is already at full size (e.g. skip-animation),
    // the ResizeObserver may never fire, so also check after a short delay
    setTimeout(() => {
      if (!this.canvasInitialized) {
        this.cleanupResizeObserver();
        this.tryInitCanvas();
      }
    }, 600);
  }

  private cleanupResizeObserver() {
    if (this.resizeStableTimer) {
      clearTimeout(this.resizeStableTimer);
      this.resizeStableTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Find the canvas element and initialize the game.
   * Uses ElementRef.querySelector as a reliable fallback since
   * Three.js creates components outside Angular's zone.
   */
  private tryInitCanvas() {
    this.cdr.detectChanges();

    let canvas: HTMLCanvasElement | null = this.canvasRef?.nativeElement ?? null;
    if (!canvas) {
      canvas = this.el.nativeElement.querySelector('canvas');
    }

    if (canvas) {
      this.canvasElement = canvas;
      this.initCanvas();
    }
  }

  // ─── Canvas init ───
  private initCanvas() {
    if (this.canvasInitialized || !this.canvasElement) return;
    this.canvasInitialized = true;
    const canvas = this.canvasElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.generateBuildingWindows();
    this.addListeners();
    this.drawIdleScreen();
    this.startBackgroundFlicker();
  }

  private resizeCanvas() {
    const canvas = this.canvasElement!;
    const parent = canvas.parentElement!;
    let actualW = parent.clientWidth || parent.offsetWidth || 400;
    let actualH = parent.clientHeight || parent.offsetHeight || 300;
    if (actualW < 10) actualW = 400;
    if (actualH < 10) actualH = 300;

    // Set pixel buffer to actual screen resolution
    canvas.width = actualW;
    canvas.height = actualH;

    // Calculate scale: how many real pixels per design pixel
    this.scale = actualH / DESIGN_HEIGHT;

    // Store logical (design-space) dimensions — game logic uses these
    this.canvasW = actualW / this.scale;
    this.canvasH = DESIGN_HEIGHT;
    this.groundY = this.canvasH - GROUND_Y_OFFSET;
  }

  // ─── Input ───
  private addListeners() {
    this.removeListeners();
    const canvas = this.canvasElement!;
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this.handleInput();
      }
    };
    this.boundTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      this.handleInput();
    };
    this.boundMouseDown = () => this.handleInput();
    window.addEventListener('keydown', this.boundKeyDown);
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('mousedown', this.boundMouseDown);
  }

  private removeListeners() {
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    const canvas = this.canvasElement;
    if (canvas) {
      if (this.boundTouchStart) canvas.removeEventListener('touchstart', this.boundTouchStart);
      if (this.boundMouseDown) canvas.removeEventListener('mousedown', this.boundMouseDown);
    }
  }

  private handleInput() {
    if (this.gameState === 'idle' || this.gameState === 'over') {
      this.startGame();
    } else if (this.gameState === 'running' && this.isOnGround) {
      this.jump();
    }
  }

  // ─── Game lifecycle ───
  startGame() {
    if (!this.canvasElement) return;
    this.resizeCanvas();
    this.generateBuildingWindows();
    this.gameState = 'running';
    this.score = 0;
    this.speed = INITIAL_SPEED;
    this.playerY = this.groundY - PLAYER_HEIGHT;
    this.velocityY = 0;
    this.isOnGround = true;
    this.obstacles = [];
    this.particles = [];
    this.distSinceLastObstacle = 250; // Spawn first obstacle very soon
    this.obstaclesPassed = 0;
    this.groundOffset = 0;
    this.playerFrame = 0;
    this.frameCounter = 0;
    this.lastWindowFlicker = 0;
    this.stopBackgroundFlicker();
    this.cdr.detectChanges();

    this.ngZone.runOutsideAngular(() => {
      this.gameLoop();
    });
  }

  private stopGame() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
    this.startBackgroundFlicker();
  }

  private startBackgroundFlicker() {
    this.stopBackgroundFlicker();
    this.flickerIntervalId = setInterval(() => {
      this.flickerWindows();
      this.draw();
    }, 700);
  }

  private stopBackgroundFlicker() {
    if (this.flickerIntervalId) {
      clearInterval(this.flickerIntervalId);
      this.flickerIntervalId = null;
    }
  }

  private jump() {
    this.velocityY = JUMP_FORCE;
    this.isOnGround = false;
    // Dust particles on jump
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: this.playerX + PLAYER_WIDTH / 2,
        y: this.groundY,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        life: 20 + Math.random() * 15,
        color: '#8d6e63',
        size: 2 + Math.random() * 3,
      });
    }
  }

  private gameOver() {
    this.gameState = 'over';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('constructionRunnerHigh', String(this.highScore));
    }
    this.stopGame();
    // Crash particles
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.playerX + PLAYER_WIDTH / 2,
        y: this.playerY + PLAYER_HEIGHT / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        life: 30 + Math.random() * 20,
        color: ['#ff5722', '#ffc107', '#ff9800'][Math.floor(Math.random() * 3)],
        size: 3 + Math.random() * 4,
      });
    }
    this.draw(); // Render the final frame with particles
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  // ─── Game loop ───
  private gameLoop() {
    this.update();
    this.draw();
    if (this.gameState === 'running') {
      this.animFrameId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  private update() {
    // Player physics
    this.velocityY += GRAVITY;
    this.playerY += this.velocityY;
    if (this.playerY >= this.groundY - PLAYER_HEIGHT) {
      this.playerY = this.groundY - PLAYER_HEIGHT;
      this.velocityY = 0;
      this.isOnGround = true;
    }

    // Animation frame
    this.frameCounter++;
    if (this.frameCounter % 6 === 0) {
      this.playerFrame = (this.playerFrame + 1) % 4;
    }

    // Ground scroll
    this.groundOffset = (this.groundOffset + this.speed) % 24;

    // Obstacles
    this.distSinceLastObstacle += this.speed;
    const minGap = MIN_OBSTACLE_GAP + (200 - this.speed * 10);
    if (this.distSinceLastObstacle > minGap + Math.random() * 120) {
      this.spawnObstacle();
      this.distSinceLastObstacle = 0;
    }
    for (const obs of this.obstacles) {
      obs.x -= this.speed;
    }
    const before = this.obstacles.length;
    this.obstacles = this.obstacles.filter((o) => o.x + o.width > -50);
    const removed = before - this.obstacles.length;
    if (removed > 0) {
      this.obstaclesPassed += removed;
      // Bump speed every OBSTACLE_MILESTONE obstacles
      const targetSpeed = INITIAL_SPEED + Math.floor(this.obstaclesPassed / OBSTACLE_MILESTONE) * SPEED_BUMP;
      this.speed = Math.min(targetSpeed, MAX_SPEED);
    }

    // Collision
    const px = this.playerX + 6;
    const py = this.playerY + 4;
    const pw = PLAYER_WIDTH - 12;
    const ph = PLAYER_HEIGHT - 4;
    for (const obs of this.obstacles) {
      if (px < obs.x + obs.width && px + pw > obs.x && py + ph > this.groundY - obs.height) {
        this.gameOver();
        return;
      }
    }

    // Score
    this.score++;

    // Particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Flicker building windows every ~40 frames (~0.67s at 60fps)
    this.lastWindowFlicker++;
    if (this.lastWindowFlicker >= 40) {
      this.lastWindowFlicker = 0;
      this.flickerWindows();
    }

    // Update Angular score display periodically
    if (this.score % 50 === 0) {
      this.ngZone.run(() => this.cdr.detectChanges());
    }
  }

  private spawnObstacle() {
    const types: Obstacle['type'][] = ['cone', 'barrier', 'bricks'];
    const type = types[Math.floor(Math.random() * types.length)];
    let width: number, height: number;
    switch (type) {
      case 'cone':
        width = 20;
        height = 30;
        break;
      case 'barrier':
        width = 30;
        height = 40;
        break;
      case 'bricks':
        width = 36;
        height = 24 + Math.floor(Math.random() * 16);
        break;
    }
    this.obstacles.push({ x: this.canvasW + 20, width, height, type });
  }

  // ─── Drawing ───
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.scale(this.scale, this.scale);

    this.drawScene(ctx);

    // Overlay screens
    if (this.gameState === 'idle') {
      this.drawIdleOverlay(ctx);
    } else if (this.gameState === 'over') {
      this.drawOverScreen(ctx);
    }

    ctx.restore();
  }

  private drawScene(ctx: CanvasRenderingContext2D) {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.canvasH);
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(0.6, '#16213e');
    skyGrad.addColorStop(1, '#0f3460');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137.5 + 50) % this.canvasW;
      const sy = (i * 97.3 + 20) % (this.groundY - 40);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Moon
    const moonX = this.canvasW * 0.82;
    const moonY = 38;
    const moonR = 18;
    // Glow
    const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 3);
    glow.addColorStop(0, 'rgba(200,220,255,0.15)');
    glow.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3, 0, Math.PI * 2);
    ctx.fill();
    // Moon disc
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    // Craters
    ctx.fillStyle = 'rgba(180,180,200,0.4)';
    ctx.beginPath();
    ctx.arc(moonX - 5, moonY - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + 6, moonY + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX - 2, moonY + 7, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Background buildings (parallax)
    this.drawBuildings(ctx);

    // Ground
    this.drawGround(ctx);

    // Obstacles
    for (const obs of this.obstacles) {
      this.drawObstacle(ctx, obs);
    }

    // Player
    this.drawPlayer(ctx);

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // HUD
    this.drawHUD(ctx);
  }

  private static readonly BUILDINGS = [
    { x: 40, w: 60, h: 100 },
    { x: 140, w: 45, h: 140 },
    { x: 220, w: 70, h: 90 },
    { x: 340, w: 55, h: 160 },
    { x: 440, w: 80, h: 110 },
    { x: 560, w: 50, h: 130 },
    { x: 660, w: 65, h: 95 },
    { x: 770, w: 55, h: 150 },
  ];

  /** Pre-generate which windows are lit and at what brightness. */
  private generateBuildingWindows() {
    this.buildingWindows = Events.BUILDINGS.map((b) => {
      const windows: { relX: number; relY: number; opacity: number }[] = [];
      for (let wy = 12; wy < b.h - 15; wy += 20) {
        for (let wx = 8; wx < b.w - 8; wx += 16) {
          if (Math.random() > 0.3) {
            windows.push({ relX: wx, relY: wy, opacity: 0.3 + Math.random() * 0.4 });
          }
        }
      }
      return windows;
    });
  }

  /** Randomly toggle a few windows on/off for a gentle city-at-night effect. */
  private flickerWindows() {
    Events.BUILDINGS.forEach((b, i) => {
      const wins = this.buildingWindows[i];
      if (!wins) return;
      // Toggle 1-2 existing windows off (remove) or change opacity
      for (let t = 0; t < 2; t++) {
        if (wins.length > 0 && Math.random() < 0.5) {
          const idx = Math.floor(Math.random() * wins.length);
          wins[idx].opacity = Math.random() < 0.4 ? 0 : 0.3 + Math.random() * 0.4;
        }
      }
      // Occasionally light up a new window
      if (Math.random() < 0.3) {
        const wy = 12 + Math.floor(Math.random() * ((b.h - 27) / 20)) * 20;
        const wx = 8 + Math.floor(Math.random() * ((b.w - 16) / 16)) * 16;
        const exists = wins.some((w) => w.relX === wx && w.relY === wy);
        if (!exists) {
          wins.push({ relX: wx, relY: wy, opacity: 0.3 + Math.random() * 0.4 });
        }
      }
    });
  }

  private drawBuildings(ctx: CanvasRenderingContext2D) {
    const bldgColor = '#0d1b2a';
    const windowColor = '#ffc107';
    Events.BUILDINGS.forEach((b, i) => {
      const bx = b.x;
      ctx.fillStyle = bldgColor;
      ctx.fillRect(bx, this.groundY - b.h, b.w, b.h);
      // Windows (pre-generated)
      ctx.fillStyle = windowColor;
      const wins = this.buildingWindows[i];
      if (wins) {
        for (const win of wins) {
          ctx.globalAlpha = win.opacity;
          ctx.fillRect(bx + win.relX, this.groundY - b.h + win.relY, 6, 8);
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    // Main ground
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(0, this.groundY, this.canvasW, this.canvasH - this.groundY);

    // Asphalt stripe
    ctx.fillStyle = '#616161';
    ctx.fillRect(0, this.groundY, this.canvasW, 4);

    // Dashed line
    ctx.strokeStyle = '#fdd835';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, this.groundY + 2);
    ctx.lineTo(this.canvasW, this.groundY + 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gravel texture
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 40; i++) {
      const gx = (i * 47 + 10) % this.canvasW;
      const gy = this.groundY + 10 + (i * 13) % 40;
      ctx.fillRect(gx, gy, 2, 2);
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const baseY = this.groundY - obs.height;
    switch (obs.type) {
      case 'cone':
        // Traffic cone
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width / 2, baseY);
        ctx.lineTo(obs.x + obs.width - 2, this.groundY);
        ctx.lineTo(obs.x + 2, this.groundY);
        ctx.closePath();
        ctx.fill();
        // White stripes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 5, this.groundY - obs.height * 0.35);
        ctx.lineTo(obs.x + obs.width - 5, this.groundY - obs.height * 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obs.x + 3, this.groundY - obs.height * 0.15);
        ctx.lineTo(obs.x + obs.width - 3, this.groundY - obs.height * 0.15);
        ctx.stroke();
        // Base
        ctx.fillStyle = '#424242';
        ctx.fillRect(obs.x - 2, this.groundY - 4, obs.width + 4, 4);
        break;

      case 'barrier':
        // Construction barrier
        ctx.fillStyle = '#f57f17';
        ctx.fillRect(obs.x, baseY, obs.width, obs.height * 0.6);
        // Diagonal stripes
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 3;
        for (let s = -10; s < obs.width + 10; s += 10) {
          ctx.beginPath();
          ctx.moveTo(obs.x + s, baseY);
          ctx.lineTo(obs.x + s + obs.height * 0.3, baseY + obs.height * 0.6);
          ctx.stroke();
        }
        // Legs
        ctx.fillStyle = '#795548';
        ctx.fillRect(obs.x + 3, baseY + obs.height * 0.6, 4, obs.height * 0.4);
        ctx.fillRect(obs.x + obs.width - 7, baseY + obs.height * 0.6, 4, obs.height * 0.4);
        break;

      case 'bricks':
        // Brick stack
        for (let row = 0; row < obs.height; row += 8) {
          const offset = (row / 8) % 2 === 0 ? 0 : 6;
          for (let col = offset; col < obs.width; col += 12) {
            const bw = Math.min(10, obs.width - col);
            ctx.fillStyle = row / 8 % 3 === 0 ? '#c62828' : '#d84315';
            ctx.fillRect(obs.x + col, baseY + row, bw, 7);
            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(obs.x + col, baseY + row, bw, 7);
          }
        }
        break;
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const x = this.playerX;
    const y = this.playerY;

    // Hard hat
    ctx.fillStyle = '#fdd835';
    ctx.beginPath();
    ctx.ellipse(x + PLAYER_WIDTH / 2, y + 6, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 4, y + 4, PLAYER_WIDTH - 8, 6);
    // Hat brim
    ctx.fillStyle = '#f9a825';
    ctx.fillRect(x + 2, y + 9, PLAYER_WIDTH - 4, 3);

    // Head
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(x + 8, y + 10, 16, 12);
    // Eyes
    ctx.fillStyle = '#212121';
    ctx.fillRect(x + 12, y + 14, 3, 3);
    ctx.fillRect(x + 18, y + 14, 3, 3);

    // Body (vest)
    ctx.fillStyle = '#ff6f00';
    ctx.fillRect(x + 6, y + 22, 20, 14);
    // Vest detail
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(x + 14, y + 22, 4, 14);

    // Legs with animation
    const legOffset = this.isOnGround ? Math.sin(this.playerFrame * Math.PI / 2) * 4 : 0;
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x + 8, y + 36, 7, 12 + (this.isOnGround ? legOffset : -2));
    ctx.fillRect(x + 17, y + 36, 7, 12 + (this.isOnGround ? -legOffset : -2));

    // Boots
    ctx.fillStyle = '#4e342e';
    const bootY1 = y + 46 + (this.isOnGround ? legOffset : -2);
    const bootY2 = y + 46 + (this.isOnGround ? -legOffset : -2);
    ctx.fillRect(x + 6, bootY1, 10, 4);
    ctx.fillRect(x + 16, bootY2, 10, 4);
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    if (this.gameState !== 'running') return;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${Math.floor(this.score / 5)}`, this.canvasW - 16, 28);
    if (this.highScore > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px monospace';
      ctx.fillText(`HI: ${Math.floor(this.highScore / 5)}`, this.canvasW - 16, 46);
    }
  }

  drawIdleScreen() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.scale(this.scale, this.scale);

    // Draw static scene first
    this.playerY = this.groundY - PLAYER_HEIGHT;
    this.drawScene(ctx);

    // Then draw the idle overlay on top
    this.drawIdleOverlay(ctx);

    ctx.restore();
  }

  private drawIdleOverlay(ctx: CanvasRenderingContext2D) {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // Construction icon
    ctx.fillStyle = '#fdd835';
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏗️', this.canvasW / 2, this.canvasH / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Construction Runner', this.canvasW / 2, this.canvasH / 2 + 12);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press Space, Tap, or Click to start', this.canvasW / 2, this.canvasH / 2 + 40);
  }

  private drawOverScreen(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    ctx.fillStyle = '#ff5722';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvasW / 2, this.canvasH / 2 - 20);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Score: ${Math.floor(this.score / 5)}`, this.canvasW / 2, this.canvasH / 2 + 14);

    if (this.score >= this.highScore) {
      ctx.fillStyle = '#fdd835';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('🏆 NEW HIGH SCORE!', this.canvasW / 2, this.canvasH / 2 + 38);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Tap or press Space to retry', this.canvasW / 2, this.canvasH / 2 + 62);
  }
}
