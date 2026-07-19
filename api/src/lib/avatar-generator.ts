// Turns an id into a little SVG constellation  avatar.

type Palette = { bg: string; line: string; node: string; fill: string };

const PALETTES: Palette[] = [
  { bg: "#172554", line: "#60a5fa", node: "#3b82f6", fill: "#1e3a8a" },
  { bg: "#2e1065", line: "#c084fc", node: "#a855f7", fill: "#4c1d95" },
  { bg: "#064e3b", line: "#34d399", node: "#10b981", fill: "#065f46" },
  { bg: "#4c0519", line: "#fb7185", node: "#e11d48", fill: "#881337" },
  { bg: "#28104e", line: "#f472b6", node: "#d946ef", fill: "#4a044e" },
  { bg: "#0f172a", line: "#38bdf8", node: "#0ea5e9", fill: "#1e293b" },
  { bg: "#451a03", line: "#fbbf24", node: "#f59e0b", fill: "#78350f" },
  { bg: "#164e63", line: "#2dd4bf", node: "#14b8a6", fill: "#134e4a" },
];

const SHAPES = ["circle", "square", "triangle"] as const;
type ShapeType = (typeof SHAPES)[number];
type Point = { x: number; y: number };

// Rounds a polygon's corners a bit
const roundedPolygonPath = (points: Point[], radius: number): string => {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];

    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const distPrev = Math.hypot(toPrev.x, toPrev.y);
    const distNext = Math.hypot(toNext.x, toNext.y);
    const r = Math.min(radius, distPrev / 2, distNext / 2);

    const p1 = {
      x: curr.x + (toPrev.x / distPrev) * r,
      y: curr.y + (toPrev.y / distPrev) * r,
    };
    const p2 = {
      x: curr.x + (toNext.x / distNext) * r,
      y: curr.y + (toNext.y / distNext) * r,
    };

    parts.push(
      i === 0
        ? `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
        : `L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
    );
    parts.push(
      `Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    );
  }
  parts.push("Z");
  return parts.join(" ");
};

const shapeMarkup = (
  type: ShapeType,
  cx: number,
  cy: number,
  r: number,
  attrs: string
): string => {
  switch (type) {
    case "square": {
      const s = r * 1.6;
      const x = (cx - s / 2).toFixed(2);
      const y = (cy - s / 2).toFixed(2);
      const corner = (s * 0.24).toFixed(2);
      return `<rect x="${x}" y="${y}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${corner}" ry="${corner}" ${attrs} />`;
    }
    case "triangle": {
      const s = r * 2.2;
      const h = (s * Math.sqrt(3)) / 2;
      const p1 = { x: cx, y: cy - (h * 2) / 3 };
      const p2 = { x: cx - s / 2, y: cy + h / 3 };
      const p3 = { x: cx + s / 2, y: cy + h / 3 };
      const corner = s * 0.2;
      return `<path d="${roundedPolygonPath([p1, p2, p3], corner)}" ${attrs} />`;
    }
    default:
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ${attrs} />`;
  }
};

export const generateAvatarSVG = (seed: string): string => {
  // Use a strictly unsigned 32-bit FNV-1a hash algorithm
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to positive, unsigned 32-bit int to prevent PRNG bugs
  hash = hash >>> 0;

  // LCG Random Number Generator (avoid state 0)
  let rngState = hash === 0 ? 1 : hash;
  const random = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  const { bg, line, node, fill } = PALETTES[hash % PALETTES.length];
  const center = 100,
    maxR = 75,
    minR = 30;
  const pts: Point[] = [];

  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i + (random() - 0.5) * 1.5;
    const r = minR + random() * (maxR - minR);
    pts.push({
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    });
  }

  const poly = `<polygon points="${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}" fill="${fill}" opacity="0.3" />`;
  let paths = "";
  let nodes = "";

  for (let i = 0; i < 8; i++) {
    const nextI = (i + 1) % 8;
    const skipI = (i + 3) % 8;

    paths += `<line x1="${pts[i].x.toFixed(2)}" y1="${pts[i].y.toFixed(2)}" x2="${pts[nextI].x.toFixed(2)}" y2="${pts[nextI].y.toFixed(2)}" stroke="${line}" stroke-width="2" opacity="0.85" />`;
    paths += `<line x1="${pts[i].x.toFixed(2)}" y1="${pts[i].y.toFixed(2)}" x2="${pts[skipI].x.toFixed(2)}" y2="${pts[skipI].y.toFixed(2)}" stroke="${line}" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.5" />`;

    const shapeType = SHAPES[Math.floor(random() * SHAPES.length)];
    const baseR = i % 2 === 0 ? 7.5 : 6;

    nodes += shapeMarkup(
      shapeType,
      pts[i].x,
      pts[i].y,
      baseR + 3,
      `fill="${node}" opacity="0.3"`
    );
    nodes += shapeMarkup(
      shapeType,
      pts[i].x,
      pts[i].y,
      baseR,
      `fill="#ffffff" stroke="${node}" stroke-width="1.5"`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    `<rect width="200" height="200" fill="${bg}" />${poly}` +
    `<circle cx="100" cy="100" r="75" fill="${node}" opacity="0.1" />${paths}${nodes}</svg>`
  );
};
