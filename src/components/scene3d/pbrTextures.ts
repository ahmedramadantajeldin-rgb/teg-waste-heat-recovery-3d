import * as THREE from 'three';

function createPRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function wrapTex(canvas: HTMLCanvasElement, srgb = false, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface PBRMapPair {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface BenchMapTriple extends PBRMapPair {
  map: THREE.CanvasTexture;
}

let brushedMetalCache: PBRMapPair | null = null;
let brushedCopperCache: PBRMapPair | null = null;
let aluminaCache: PBRMapPair | null = null;
let benchCache: BenchMapTriple | null = null;

/**
 * Directional CNC Brushed Aluminum / Steel Micro-Texture Set
 */
export function getBrushedMetalTextures(): PBRMapPair {
  if (brushedMetalCache) return brushedMetalCache;

  const size = 512;
  const rng = createPRNG(104729);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#dcdcdc';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2400; i++) {
    const y = rng() * size;
    const x = rng() * size;
    const len = 40 + rng() * 200;
    const lum = Math.round(108 + rng() * 44);
    bCtx.strokeStyle = `rgba(${lum},${lum},${lum},0.42)`;
    bCtx.lineWidth = 0.7 + rng() * 0.9;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();

    const rLum = Math.round(190 + rng() * 58);
    rCtx.strokeStyle = `rgba(${rLum},${rLum},${rLum},0.35)`;
    rCtx.lineWidth = 0.8 + rng() * 1.1;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  brushedMetalCache = {
    bumpMap: wrapTex(bumpCanvas, false, 2, 2),
    roughnessMap: wrapTex(roughCanvas, false, 2, 2),
  };
  return brushedMetalCache;
}

/**
 * Machined Satin Copper Micro-Texture Set
 */
export function getBrushedCopperTextures(): PBRMapPair {
  if (brushedCopperCache) return brushedCopperCache;

  const size = 512;
  const rng = createPRNG(314159);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  bCtx.fillStyle = '#828282';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#cfcfcf';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2000; i++) {
    const y = rng() * size;
    const x = rng() * size;
    const len = 30 + rng() * 160;
    const lum = Math.round(115 + rng() * 38);
    bCtx.strokeStyle = `rgba(${lum},${lum},${lum},0.36)`;
    bCtx.lineWidth = 0.6 + rng() * 0.8;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();

    const rLum = Math.round(175 + rng() * 60);
    rCtx.strokeStyle = `rgba(${rLum},${rLum},${rLum},0.30)`;
    rCtx.lineWidth = 0.7 + rng() * 0.9;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  brushedCopperCache = {
    bumpMap: wrapTex(bumpCanvas, false, 2, 2),
    roughnessMap: wrapTex(roughCanvas, false, 2, 2),
  };
  return brushedCopperCache;
}

/**
 * Sintered Micro-Granular Alumina (Al2O3) Ceramic Surface
 */
export function getAluminaCeramicTextures(): PBRMapPair {
  if (aluminaCache) return aluminaCache;

  const size = 256;
  const rng = createPRNG(271828);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4500; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const lum = Math.round(112 + rng() * 34);
    bCtx.fillStyle = `rgba(${lum},${lum},${lum},0.45)`;
    bCtx.fillRect(x, y, 1.5, 1.5);

    const rLum = Math.round(190 + rng() * 55);
    rCtx.fillStyle = `rgba(${rLum},${rLum},${rLum},0.35)`;
    rCtx.fillRect(x, y, 2, 2);
  }

  aluminaCache = {
    bumpMap: wrapTex(bumpCanvas, false, 2, 2),
    roughnessMap: wrapTex(roughCanvas, false, 2, 2),
  };
  return aluminaCache;
}

/**
 * Precision Optical/Metrology Stainless Steel Laboratory Workbench Texture Set
 * Includes brushed grain + laser-etched calibration coordinate grid & crosshairs.
 */
export function getMetroBenchTextures(): BenchMapTriple {
  if (benchCache) return benchCache;

  const size = 1024;
  const rng = createPRNG(88421);
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base anodized stainless steel slate tone (slightly brightened studio satin finish)
  const grad = cCtx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#9aa6b4');
  grad.addColorStop(0.5, '#aab6c4');
  grad.addColorStop(1, '#94a0ae');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d0d0d0';
  rCtx.fillRect(0, 0, size, size);

  // Horizontal brushed steel hairline striations
  for (let i = 0; i < 5000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 80 + rng() * 320;
    const shade = rng() > 0.5 ? 'rgba(220,232,244,0.06)' : 'rgba(20,30,45,0.06)';
    cCtx.strokeStyle = shade;
    cCtx.lineWidth = 0.8 + rng() * 1.1;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.lineTo(x + len, y);
    cCtx.stroke();

    const lum = Math.round(115 + rng() * 28);
    bCtx.strokeStyle = `rgba(${lum},${lum},${lum},0.35)`;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();

    const rLum = Math.round(180 + rng() * 55);
    rCtx.strokeStyle = `rgba(${rLum},${rLum},${rLum},0.28)`;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  // Subtle laser-etched laboratory metrology grid (16x16 subdivisions)
  const step = size / 16;
  cCtx.strokeStyle = 'rgba(218, 232, 248, 0.14)';
  cCtx.lineWidth = 1;
  rCtx.strokeStyle = 'rgba(245, 245, 245, 0.45)';
  rCtx.lineWidth = 1.5;
  bCtx.strokeStyle = 'rgba(65, 65, 65, 0.55)';
  bCtx.lineWidth = 1.2;

  for (let g = 0; g <= 16; g++) {
    const p = g * step;
    const isMajor = g % 4 === 0;
    cCtx.strokeStyle = isMajor ? 'rgba(224, 242, 254, 0.24)' : 'rgba(203, 213, 225, 0.10)';
    cCtx.beginPath();
    cCtx.moveTo(p, 0);
    cCtx.lineTo(p, size);
    cCtx.moveTo(0, p);
    cCtx.lineTo(size, p);
    cCtx.stroke();

    if (isMajor) {
      bCtx.beginPath();
      bCtx.moveTo(p, 0);
      bCtx.lineTo(p, size);
      bCtx.moveTo(0, p);
      bCtx.lineTo(size, p);
      bCtx.stroke();

      rCtx.beginPath();
      rCtx.moveTo(p, 0);
      rCtx.lineTo(p, size);
      rCtx.moveTo(0, p);
      rCtx.lineTo(size, p);
      rCtx.stroke();
    }
  }

  // Metrology M6 tapped-grid intersection markers
  for (let gx = 1; gx < 16; gx += 2) {
    for (let gy = 1; gy < 16; gy += 2) {
      const cx = gx * step;
      const cy = gy * step;
      cCtx.fillStyle = 'rgba(30, 41, 59, 0.22)';
      cCtx.beginPath();
      cCtx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      cCtx.fill();

      bCtx.fillStyle = 'rgba(40, 40, 40, 0.65)';
      bCtx.beginPath();
      bCtx.arc(cx, cy, 2.4, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  benchCache = {
    map: wrapTex(colorCanvas, true, 2, 1.4),
    bumpMap: wrapTex(bumpCanvas, false, 2, 1.4),
    roughnessMap: wrapTex(roughCanvas, false, 2, 1.4),
  };
  return benchCache;
}
