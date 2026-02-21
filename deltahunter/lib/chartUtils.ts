// Shared Canvas drawing utilities for DeltaHunter

export const COLORS = {
  bg: "#090b0f",
  surface: "#11141a",
  surface2: "#191d26",
  border: "#252a38",
  txt: "#e0e4ed",
  txtDim: "#6a7288",
  user: "#4499ff",
  ref: "#ff6633",
  gain: "#00cc88",
  loss: "#ff3355",
  grid: "rgba(37, 42, 56, 0.5)",
};

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PADDING: Padding = {
  top: 30,
  right: 16,
  bottom: 36,
  left: 56,
};

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}

export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, w, h);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: Padding,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  xLabel: string,
  yLabel: string,
  xTicks?: number,
  yTicks?: number
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const nx = xTicks ?? 6;
  const ny = yTicks ?? 5;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.txtDim;

  // Y grid + labels
  for (let i = 0; i <= ny; i++) {
    const y = pad.top + plotH - (i / ny) * plotH;
    const val = yMin + (i / ny) * (yMax - yMin);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(formatNum(val), pad.left - 6, y);
  }

  // X grid + labels
  for (let i = 0; i <= nx; i++) {
    const x = pad.left + (i / nx) * plotW;
    const val = xMin + (i / nx) * (xMax - xMin);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(formatNum(val), x, h - pad.bottom + 6);
  }

  // Axis labels
  ctx.fillStyle = COLORS.txtDim;
  ctx.font = '10px "Outfit", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(xLabel, pad.left + plotW / 2, h - 4);

  ctx.save();
  ctx.translate(12, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  ys: number[],
  w: number,
  h: number,
  pad: Padding,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  color: string,
  lineWidth: number = 1.5
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";

  let started = false;
  for (let i = 0; i < xs.length; i++) {
    const px = pad.left + ((xs[i] - xMin) / (xMax - xMin)) * plotW;
    const py =
      pad.top + plotH - ((ys[i] - yMin) / (yMax - yMin)) * plotH;
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

export function drawFilledLine(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  ys: number[],
  w: number,
  h: number,
  pad: Padding,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  color: string,
  alpha: number = 0.1
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const baseline = pad.top + plotH;

  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const px = pad.left + ((xs[i] - xMin) / (xMax - xMin)) * plotW;
    const py =
      pad.top + plotH - ((ys[i] - yMin) / (yMax - yMin)) * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  // Close to baseline
  const lastX =
    pad.left +
    ((xs[xs.length - 1] - xMin) / (xMax - xMin)) * plotW;
  const firstX = pad.left + ((xs[0] - xMin) / (xMax - xMin)) * plotW;
  ctx.lineTo(lastX, baseline);
  ctx.lineTo(firstX, baseline);
  ctx.closePath();

  ctx.fillStyle = hexToRgba(color, alpha);
  ctx.fill();
}

export function drawSectorBands(
  ctx: CanvasRenderingContext2D,
  sectors: { start: number; end: number; name: string }[],
  activeSector: number | null,
  w: number,
  h: number,
  pad: Padding,
  xMin: number,
  xMax: number
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  for (const s of sectors) {
    if (s.start > xMax || s.end < xMin) continue;
    const x1 = pad.left + Math.max(0, ((s.start - xMin) / (xMax - xMin)) * plotW);
    const x2 =
      pad.left +
      Math.min(plotW, ((s.end - xMin) / (xMax - xMin)) * plotW);
    ctx.fillStyle = "rgba(68, 153, 255, 0.04)";
    ctx.fillRect(x1, pad.top, x2 - x1, plotH);

    // Label at top
    ctx.fillStyle = COLORS.txtDim;
    ctx.font = '9px "Outfit", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(s.name, (x1 + x2) / 2, pad.top - 4);
  }
}

export function speedToColor(speed: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (speed - min) / (max - min)));
  // Red (slow) -> Yellow (mid) -> Green (fast)
  if (t < 0.5) {
    const s = t * 2;
    const r = 255;
    const g = Math.round(s * 255);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) * 2;
    const r = Math.round(255 * (1 - s));
    const g = 255;
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return Math.round(v).toString();
  if (Math.abs(v) >= 10) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

export function getSliceIndices(
  dist: number[],
  start: number,
  end: number
): [number, number] {
  let i0 = 0;
  let i1 = dist.length - 1;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] >= start) {
      i0 = i;
      break;
    }
  }
  for (let i = dist.length - 1; i >= 0; i--) {
    if (dist[i] <= end) {
      i1 = i;
      break;
    }
  }
  return [i0, i1 + 1];
}

export function findHoverIndex(
  dist: number[],
  mouseX: number,
  w: number,
  pad: Padding,
  xMin: number,
  xMax: number
): number {
  const plotW = w - pad.left - pad.right;
  const d = xMin + ((mouseX - pad.left) / plotW) * (xMax - xMin);
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < dist.length; i++) {
    const dd = Math.abs(dist[i] - d);
    if (dd < minDist) {
      minDist = dd;
      closest = i;
    }
  }
  return closest;
}

export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: string[],
  w: number,
  h: number
) {
  ctx.font = '11px "JetBrains Mono", monospace';
  const lineH = 16;
  const padX = 8;
  const padY = 6;
  let maxW = 0;
  for (const l of lines) {
    const m = ctx.measureText(l);
    if (m.width > maxW) maxW = m.width;
  }
  const boxW = maxW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;

  let tx = x + 12;
  let ty = y - boxH / 2;
  if (tx + boxW > w - 4) tx = x - boxW - 12;
  if (ty < 4) ty = 4;
  if (ty + boxH > h - 4) ty = h - boxH - 4;

  ctx.fillStyle = "rgba(17, 20, 26, 0.92)";
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx, ty, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.txt;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], tx + padX, ty + padY + i * lineH);
  }
}
