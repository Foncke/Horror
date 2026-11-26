import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

export const canvasTexture = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, opts: {repeat?: [number, number]; srgb?: boolean} = {}) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...opts.repeat);
  }
  cache.set(key, tex);
  return tex;
};

export type FaceKind = 'calm' | 'worried' | 'scared' | 'laugh' | 'sleepwalk' | 'grin' | 'blank';

/**
 * Face painted on the front of a sphere head. The texture covers a patch of
 * the sphere (see Character), so x runs left->right across the face and y top->bottom.
 */
export const faceTexture = (kind: FaceKind) =>
  canvasTexture(`face-${kind}`, 1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const eyeY = h * 0.5;
    const ink = '#111114';
    const eye = (x: number, rx: number, ry: number) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(x, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.lineCap = 'round';
    if (kind === 'grin') {
      // glowing eyes and an impossibly wide grin full of teeth
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 120, eyeY - 10, 30, 40, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 120, eyeY - 10, 30, 40, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 300, eyeY + 40);
      ctx.quadraticCurveTo(cx, eyeY + 330, cx + 300, eyeY + 40);
      ctx.quadraticCurveTo(cx, eyeY + 190, cx - 300, eyeY + 40);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 7;
      for (let i = -9; i <= 9; i++) {
        const x = cx + i * 30;
        ctx.beginPath();
        ctx.moveTo(x, eyeY);
        ctx.lineTo(x + i * 1.5, eyeY + 330);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 300, eyeY + 40);
      ctx.quadraticCurveTo(cx, eyeY + 262, cx + 300, eyeY + 40);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (kind === 'blank') return;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 12;
    if (kind === 'sleepwalk') {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * 105, eyeY - 6, 30, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 34, eyeY + 120);
      ctx.lineTo(cx + 34, eyeY + 120);
      ctx.stroke();
      return;
    }
    const r = kind === 'scared' ? 30 : 20;
    eye(cx - 105, r * 0.8, r);
    eye(cx + 105, r * 0.8, r);
    if (kind === 'scared') {
      ctx.fillStyle = '#ffffff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * 105 + 7, eyeY - 10, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.beginPath();
    if (kind === 'calm') {
      ctx.moveTo(cx - 40, eyeY + 118);
      ctx.lineTo(cx + 40, eyeY + 118);
    } else if (kind === 'laugh') {
      ctx.arc(cx, eyeY + 92, 52, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (kind === 'worried') {
      ctx.moveTo(cx - 44, eyeY + 128);
      ctx.bezierCurveTo(cx - 20, eyeY + 108, cx + 20, eyeY + 140, cx + 44, eyeY + 120);
    } else {
      ctx.ellipse(cx, eyeY + 124, 16, 22, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    if (kind === 'worried' || kind === 'scared') {
      // raised brows
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 70, eyeY - 62);
        ctx.lineTo(cx + s * 140, eyeY - 76 + (kind === 'scared' ? -10 : 8));
        ctx.stroke();
      }
    }
  });

export const carpetTexture = () =>
  canvasTexture(
    'carpet',
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#3b1518';
      ctx.fillRect(0, 0, w, h);
      // subtle fibre noise
      const img = ctx.getImageData(0, 0, w, h);
      let seed = 414;
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        const n = (seed / 2147483647 - 0.5) * 22;
        img.data[i] += n;
        img.data[i + 1] += n * 0.6;
        img.data[i + 2] += n * 0.6;
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(196,140,70,0.55)';
      ctx.lineWidth = 6;
      const s = w / 2;
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          const ox = x * s + s / 2;
          const oy = y * s + s / 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy - s * 0.42);
          ctx.lineTo(ox + s * 0.3, oy);
          ctx.lineTo(ox, oy + s * 0.42);
          ctx.lineTo(ox - s * 0.3, oy);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(90,40,30,0.8)';
          ctx.beginPath();
          ctx.arc(ox, oy, s * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    {repeat: [2, 12]},
  );

export const wallpaperTexture = () =>
  canvasTexture(
    'wallpaper',
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#b5a88f';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 === 0 ? 'rgba(255,240,210,0.06)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, 0, 16, h);
      }
    },
    {repeat: [8, 1]},
  );

export const plateTexture = (text: string) =>
  canvasTexture(`plate-${text}`, 256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9a45c');
    g.addColorStop(0.5, '#f2d79a');
    g.addColorStop(1, '#9c7633');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d0c';
    ctx.font = '700 76px Oswald';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });

/** The rule card. `chars` controls the typewriter reveal of the rule text. */
export const drawCard = (ctx: CanvasRenderingContext2D, w: number, h: number, chars: number) => {
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#6b1e1e';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  ctx.fillStyle = '#6b1e1e';
  ctx.textAlign = 'center';
  ctx.font = '400 56px "Special Elite"';
  ctx.fillText('ONE RULE', w / 2, 150);
  ctx.fillRect(w / 2 - 120, 180, 240, 4);
  const rule = 'If someone knocks after midnight, do not answer. We do not have night staff.';
  const shown = rule.slice(0, Math.max(0, Math.floor(chars)));
  ctx.fillStyle = '#1c1714';
  ctx.font = '400 50px "Special Elite"';
  ctx.textAlign = 'left';
  const words = shown.split(' ');
  let line = '';
  let y = 290;
  const x0 = 90;
  const maxW = w - 180;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x0, y);
      line = word;
      y += 74;
    } else line = test;
  }
  ctx.fillText(line, x0, y);
  if (chars < rule.length && Math.floor(chars * 2) % 2 === 0) {
    ctx.fillRect(x0 + ctx.measureText(line).width + 6, y - 40, 26, 48);
  }
};
