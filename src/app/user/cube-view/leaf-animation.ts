/**
 * LeafAnimation — animated GIF "leafs" floating inside each cube-face.
 *
 * Uses DOM <div> elements with background-image (blob URLs) instead of
 * <canvas>.  This is necessary because canvas elements inside CSS3DRenderer's
 * preserve-3d compositing layers get cached as GPU textures and don't
 * visually update when redrawn.  DOM property changes (backgroundImage,
 * transform) always trigger a browser repaint.
 *
 * GIF frames are decoded from raw binary (GIF87a / GIF89a) so animation
 * works in every browser without relying on <img> animation hacks or the
 * ImageDecoder API.
 */

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

/* ================================================================== */
/*  Minimal GIF binary parser  →  blob-URL per frame                   */
/* ================================================================== */

interface ParsedFrame {
  url: string;       // blob URL
  duration: number;  // ms
}

function canvasToBlobUrl(cvs: HTMLCanvasElement): Promise<string> {
  return new Promise(resolve => {
    cvs.toBlob(blob => resolve(URL.createObjectURL(blob!)));
  });
}

async function parseGif(buffer: ArrayBuffer): Promise<ParsedFrame[]> {
  const d = new Uint8Array(buffer);
  let pos = 0;

  const u8  = (): number => d[pos++];
  const u16 = (): number => { const v = d[pos] | (d[pos + 1] << 8); pos += 2; return v; };

  /* ---- Header --------------------------------------------------- */
  pos = 6; // skip "GIF87a" / "GIF89a"

  const screenW = u16();
  const screenH = u16();
  const packed  = u8();
  u8(); // bg colour index
  u8(); // pixel aspect ratio

  const gctFlag = (packed >> 7) & 1;
  const gctSize = 3 * (1 << ((packed & 7) + 1));

  let globalCT: Uint8Array | null = null;
  if (gctFlag) { globalCT = d.slice(pos, pos + gctSize); pos += gctSize; }

  /* ---- Compose canvas ------------------------------------------- */
  const cvs = document.createElement('canvas');
  cvs.width = screenW; cvs.height = screenH;
  const ctx = cvs.getContext('2d')!;

  const frames: ParsedFrame[] = [];
  let delay = 100, disposal = 0, transIndex = -1;

  const skipSub = () => { let s; while ((s = u8()) !== 0) pos += s; };

  /* ---- Block loop ----------------------------------------------- */
  while (pos < d.length) {
    const id = u8();
    if (id === 0x3b) break; // trailer

    if (id === 0x21) { // extension
      const label = u8();
      if (label === 0xf9) {
        u8(); // block size
        const gce = u8();
        disposal  = (gce >> 2) & 7;
        const tf  = gce & 1;
        delay     = u16() * 10;
        if (delay <= 0) delay = 100;
        transIndex = tf ? u8() : (u8(), -1);
        u8(); // terminator
      } else { skipSub(); }
      continue;
    }

    if (id !== 0x2c) continue; // not image block

    const left = u16(), top = u16(), fw = u16(), fh = u16();
    const fpk = u8();
    const lctFlag  = (fpk >> 7) & 1;
    const interlace = (fpk >> 6) & 1;
    const lctSz    = 3 * (1 << ((fpk & 7) + 1));

    let ct = globalCT!;
    if (lctFlag) { ct = d.slice(pos, pos + lctSz); pos += lctSz; }

    const prevData = disposal === 3 ? ctx.getImageData(0, 0, screenW, screenH) : null;

    /* LZW decompress */
    const minCode = u8();
    const compressed: number[] = [];
    let bsz: number;
    while ((bsz = u8()) !== 0) { for (let i = 0; i < bsz; i++) compressed.push(d[pos++]); }
    const pixels = lzwDecode(minCode, compressed);

    /* Write pixels */
    const imgData = ctx.getImageData(left, top, fw, fh);
    const rows = interlace ? interlaceOrder(fh) : null;
    let pi = 0;
    for (let r = 0; r < fh; r++) {
      const row = rows ? rows[r] : r;
      for (let c = 0; c < fw; c++) {
        if (pi >= pixels.length) break;
        const ci = pixels[pi++];
        if (ci === transIndex) continue;
        const di = (row * fw + c) * 4;
        const ti = ci * 3;
        imgData.data[di]     = ct[ti];
        imgData.data[di + 1] = ct[ti + 1];
        imgData.data[di + 2] = ct[ti + 2];
        imgData.data[di + 3] = 255;
      }
    }
    ctx.putImageData(imgData, left, top);

    /* Capture composed frame as blob URL */
    const url = await canvasToBlobUrl(cvs);
    frames.push({ url, duration: delay });

    /* Disposal */
    if (disposal === 2) ctx.clearRect(left, top, fw, fh);
    else if (disposal === 3 && prevData) ctx.putImageData(prevData, 0, 0);

    delay = 100; disposal = 0; transIndex = -1;
  }

  return frames;
}

/* ---- LZW decompressor ------------------------------------------- */

function lzwDecode(minCodeSize: number, data: number[]): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode   = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const table: (number[] | null)[] = new Array(4096).fill(null);
  for (let i = 0; i < clearCode; i++) table[i] = [i];

  const out: number[] = [];
  let bitPos = 0;
  let prev: number[] | null = null;

  const readCode = (): number => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byteI = (bitPos + i) >> 3;
      const bitI  = (bitPos + i) & 7;
      if (byteI < data.length) code |= ((data[byteI] >> bitI) & 1) << i;
    }
    bitPos += codeSize;
    return code;
  };

  while (bitPos + codeSize <= data.length * 8) {
    const code = readCode();
    if (code === clearCode) {
      codeSize = minCodeSize + 1; nextCode = eoiCode + 1;
      for (let i = eoiCode + 1; i < 4096; i++) table[i] = null;
      prev = null; continue;
    }
    if (code === eoiCode) break;

    let entry: number[];
    if (table[code] !== null) entry = table[code]!;
    else if (code === nextCode && prev) entry = [...prev, prev[0]];
    else break;

    for (let i = 0; i < entry.length; i++) out.push(entry[i]);
    if (prev && nextCode < 4096) {
      table[nextCode] = [...prev, entry[0]];
      nextCode++;
      if (nextCode >= (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return new Uint8Array(out);
}

/* ---- Interlace row order ---------------------------------------- */

function interlaceOrder(h: number): number[] {
  const order: number[] = new Array(h);
  let dest = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as [number, number][]) {
    for (let i = start; i < h; i += step) order[dest++] = i;
  }
  return order;
}

/* ================================================================== */
/*  Particle type                                                      */
/* ================================================================== */

interface LeafParticle {
  x: number; y: number; baseX: number;
  vy: number; vx: number; size: number;
  rotation: number; rotationSpeed: number;
  wobblePhase: number; wobbleFreq: number; wobbleAmp: number;
  opacity: number; gifIndex: number;
  active: boolean;
}

/* ================================================================== */
/*  Main class                                                         */
/* ================================================================== */

export class LeafAnimation {
  /* Per-gif decoded data — one entry per loaded GIF (all of them) */
  private gifFrameUrls: string[][] = [];
  private gifDurations:  number[][] = [];
  private gifCurFrame:   number[] = [];
  private gifLastAdv:    number[] = [];
  private gifReady:      boolean[] = [];
  private totalGifs = GIF_FILES.length;

  /* Pool of gif indices — each particle draws from here so no duplicates */
  private gifPool: number[] = [];

  /* Per-face DOM */
  private faceData = new Map<number, { container: HTMLDivElement; divs: HTMLDivElement[] }>();

  /* Particles (shared across all faces) */
  private particles: LeafParticle[] = [];

  /* Emission */
  private maxParticles = 30;
  private lastEmitTime = 0;

  /* Only render on this face */
  private activeFace = 0;
  private paused = false;

  private animationId = 0;
  private running = false;

  constructor() {
    for (let i = 0; i < this.totalGifs; i++) {
      this.gifFrameUrls.push([]);
      this.gifDurations.push([]);
      this.gifCurFrame.push(0);
      this.gifLastAdv.push(0);
      this.gifReady.push(false);
    }
    this.loadGifs();
    // Pre-create particle slots (all inactive)
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({ x: 0, y: 0, baseX: 0, vy: 0, vx: 0, size: 0,
        rotation: 0, rotationSpeed: 0, wobblePhase: 0, wobbleFreq: 0,
        wobbleAmp: 0, opacity: 0, gifIndex: 0, active: false });
    }
  }

  /* ---- public API ----------------------------------------------- */

  /**
   * Create a particle container + child divs inside the face element.
   * Call this instead of the old registerCanvas.
   */
  registerFace(faceIndex: number, parentElement: HTMLElement): void {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'absolute',
      top: '0', left: '0',
      width: '100%', height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '0',
    });

    const divs: HTMLDivElement[] = [];
    for (let i = 0; i < this.maxParticles; i++) {
      const d = document.createElement('div');
      Object.assign(d.style, {
        position: 'absolute',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
      });
      container.appendChild(d);
      divs.push(d);
    }

    // Insert container before the first child (so it sits behind content)
    parentElement.insertBefore(container, parentElement.firstChild);
    this.faceData.set(faceIndex, { container, divs });
  }

  unregisterFace(faceIndex: number): void {
    const fd = this.faceData.get(faceIndex);
    if (fd) { fd.container.remove(); this.faceData.delete(faceIndex); }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastEmitTime = performance.now();
    this.animate();
  }

  stop(): void {
    this.running = false;
    if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = 0; }
  }

  /** Switch active face — pauses emission & clears particles until resume(). */
  setActiveFace(faceIndex: number): void {
    this.paused = true;
    // Hide the old face's container
    const oldFd = this.faceData.get(this.activeFace);
    if (oldFd) oldFd.container.style.display = 'none';
    // Deactivate all particles so the new face starts fresh
    for (const p of this.particles) p.active = false;
    this.activeFace = faceIndex;
  }

  /** Resume emission on the current active face (call after rotation ends). */
  resume(): void {
    this.paused = false;
    this.lastEmitTime = performance.now();
  }

  destroy(): void {
    this.stop();
    this.faceData.forEach(fd => fd.container.remove());
    this.faceData.clear();
    // Revoke all blob URLs
    for (const urls of this.gifFrameUrls) {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.length = 0;
    }
  }

  /* ---- gif loading ---------------------------------------------- */

  private async loadGifs(): Promise<void> {
    // Load ALL gifs so every particle can get a unique one
    await Promise.all(GIF_FILES.map((name, i) => this.loadOne(i, name)));
  }

  private async loadOne(index: number, fileName: string): Promise<void> {
    try {
      const url  = `assets/images/background_gifs/${encodeURIComponent(fileName)}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const buf    = await resp.arrayBuffer();
      const frames = await parseGif(buf);
      if (frames.length === 0) return;

      this.gifFrameUrls[index] = frames.map(f => f.url);
      this.gifDurations[index] = frames.map(f => f.duration);
      this.gifLastAdv[index]   = performance.now();
      this.gifReady[index]     = true;
    } catch (e) {
      console.warn('[LeafAnimation] Failed to decode', fileName, e);
    }
  }

  /* ---- particles ------------------------------------------------ */

  /** Pull a unique gif index from the pool; refills when empty. */
  private drawFromPool(): number {
    if (this.gifPool.length === 0) {
      const ready: number[] = [];
      for (let i = 0; i < this.totalGifs; i++) {
        if (this.gifReady[i]) ready.push(i);
      }
      if (ready.length === 0) return 0;
      // Fisher-Yates shuffle
      for (let i = ready.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ready[i], ready[j]] = [ready[j], ready[i]];
      }
      this.gifPool = ready;
    }
    return this.gifPool.pop()!;
  }

  /** Emit 1 or 2 new particles into inactive slots. */
  private emit(): void {
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let n = 0; n < count; n++) {
      const slot = this.particles.find(p => !p.active);
      if (!slot) return; // all slots in use
      this.initParticle(slot);
    }
  }

  /** Initialise (or re-initialise) a particle in-place. */
  private initParticle(p: LeafParticle): void {
    const fromLeft = Math.random() > 0.5;

    let startX: number, targetX: number;
    if (fromLeft) {
      startX  = Math.random() * 0.35;            // 0 % – 35 %
      targetX = 0.20 + Math.random() * 0.15;     // 20 % – 35 %
    } else {
      startX  = 0.65 + Math.random() * 0.35;     // 65 % – 100 %
      targetX = 0.65 + Math.random() * 0.15;     // 65 % – 80 %
    }

    const vy = -(0.0006 + Math.random() * 0.001);
    // Drift from startX → targetX over the full vertical travel (~1.15 norm units)
    const vx = (targetX - startX) * Math.abs(vy) / 1.15;

    p.x             = startX;
    p.y             = 1.0 + Math.random() * 0.03; // just barely below bottom edge
    p.baseX         = startX;
    p.vy            = vy;
    p.vx            = vx;
    p.size          = 0.08 + Math.random() * 0.04;
    p.rotation      = (Math.random() - 0.5) * Math.PI; // -90° to +90°
    p.rotationSpeed = (Math.random() - 0.5) * 0.015;
    p.wobblePhase   = Math.random() * Math.PI * 2;
    p.wobbleFreq    = 0.015 + Math.random() * 0.025;
    p.wobbleAmp     = 0.012 + Math.random() * 0.018;
    p.opacity       = 0.18 + Math.random() * 0.22;
    p.gifIndex      = this.drawFromPool();
    p.active        = true;
  }

  /* ---- animation loop ------------------------------------------- */

  private animate = (): void => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.animate);
    const now = performance.now();

    // ── skip when paused (face is rotating) ──
    if (this.paused) return;

    // ── emit new particles every ~1 second ──
    if (now - this.lastEmitTime >= 1000) {
      this.lastEmitTime = now;
      this.emit();
    }

    // ── advance gif frames (only those used by active particles) ──
    const usedGifs = new Set<number>();
    for (const p of this.particles) { if (p.active) usedGifs.add(p.gifIndex); }
    for (const gi of usedGifs) {
      if (!this.gifReady[gi] || this.gifFrameUrls[gi].length <= 1) continue;
      if (now - this.gifLastAdv[gi] >= this.gifDurations[gi][this.gifCurFrame[gi]]) {
        this.gifCurFrame[gi] = (this.gifCurFrame[gi] + 1) % this.gifFrameUrls[gi].length;
        this.gifLastAdv[gi] = now;
      }
    }

    // ── update active particles ──
    for (const p of this.particles) {
      if (!p.active) continue;
      p.y     += p.vy;
      p.baseX += p.vx;
      p.wobblePhase += p.wobbleFreq;
      p.x = p.baseX + Math.sin(p.wobblePhase) * p.wobbleAmp;
      p.rotation += p.rotationSpeed;
      // Clamp to ±90° so leaves never appear upside down
      const HALF_PI = Math.PI / 2;
      if (p.rotation > HALF_PI)  { p.rotation = HALF_PI;  p.rotationSpeed = -Math.abs(p.rotationSpeed); }
      if (p.rotation < -HALF_PI) { p.rotation = -HALF_PI; p.rotationSpeed =  Math.abs(p.rotationSpeed); }
      // Deactivate when off-screen
      if (p.y < -0.15 || p.x < -0.15 || p.x > 1.15) {
        p.active = false;
      }
    }

    // ── render particles only on the active face ──
    this.faceData.forEach(({ container, divs }, faceIndex) => {
      const parent = container.parentElement;
      if (!parent) return;
      if (faceIndex !== this.activeFace) { container.style.display = 'none'; return; }
      container.style.display = '';

      const pw = parseInt(parent.style.width, 10) || parent.clientWidth;
      const ph = parseInt(parent.style.height, 10) || parent.clientHeight;
      if (pw <= 0 || ph <= 0) return;

      for (let i = 0; i < this.maxParticles; i++) {
        const p   = this.particles[i];
        const div = divs[i];

        if (!p.active || !this.gifReady[p.gifIndex]) {
          div.style.display = 'none';
          continue;
        }
        div.style.display = '';

        const gi = p.gifIndex;
        const sz = Math.round(p.size * Math.min(pw, ph));
        const px = Math.round(p.x * pw - sz / 2);
        const py = Math.round(p.y * ph - sz / 2);

        div.style.width  = `${sz}px`;
        div.style.height = `${sz}px`;
        div.style.transform = `translate(${px}px,${py}px) rotate(${p.rotation}rad)`;
        div.style.opacity   = String(p.opacity);

        const frameKey = `${gi}-${this.gifCurFrame[gi]}`;
        if (div.dataset['fk'] !== frameKey) {
          div.style.backgroundImage = `url(${this.gifFrameUrls[gi][this.gifCurFrame[gi]]})`;
          div.dataset['fk'] = frameKey;
        }
      }
    });
  };
}
