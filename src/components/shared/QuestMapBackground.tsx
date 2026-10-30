import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTaskStore } from "@/stores/taskStore";

/**
 * Ambient background: a tilted street map that drifts slowly while quest pins pop up,
 * bob and sink back down. Decorative only (aria-hidden, no pointer events).
 *
 * Performance design ("Mode 7"): instead of asking the browser to warp a huge 3D CSS
 * plane every frame, the map is a small bitmap tile that we sample ourselves onto a
 * LOW-RESOLUTION canvas through a precomputed perspective lookup. A frame is a cheap
 * pixel copy (~100k pixels), capped at 30fps, independent of GPU strength. The edge
 * fade and opacity are baked into the pixels (no CSS mask / offscreen layer), and pins
 * are flat 2D elements moved with plain transforms.
 */

const TILE = 1000; // map tile size in map units
const PERIOD_MS = 110_000; // time for the map to drift one tile
const LIFE_MS = 7200; // how long a pin stays
const FPS = 30;
const TILT_X = 58;
const TILT_Z = -32;
const PERSPECTIVE = 1150;
const PLANE_OFFSET_Y = 160;
const OPACITY = 0.62; // overall strength, baked into the pixels
const LEVELS = [512, 256, 128] as const; // mip sizes: near, mid, far (less shimmer in the distance)

// ---------- seeded rng + map layout ----------
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Block = { x: number; y: number; w: number; h: number; kind: "building" | "park" | "plaza" };
const XS = [0, 210, 470, 640, 880, TILE];
const YS = [0, 170, 400, 690, 850, TILE];
const STREET = 9;

function buildBlocks(): Block[] {
  const r = rng(7);
  const blocks: Block[] = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      const x0 = XS[i] + STREET + 6;
      const x1 = XS[i + 1] - STREET - 6;
      const y0 = YS[j] + STREET + 6;
      const y1 = YS[j + 1] - STREET - 6;
      const roll = r();
      if (roll < 0.14) blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: "park" });
      else if (roll < 0.22) blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: "plaza" });
      else {
        const parts = 1 + Math.floor(r() * 3);
        const horizontal = r() > 0.5;
        const gap = 7;
        for (let p = 0; p < parts; p++) {
          const w = horizontal ? (x1 - x0 - gap * (parts - 1)) / parts : x1 - x0;
          const h = horizontal ? y1 - y0 : (y1 - y0 - gap * (parts - 1)) / parts;
          blocks.push({
            x: horizontal ? x0 + p * (w + gap) : x0,
            y: horizontal ? y0 : y0 + p * (h + gap),
            w,
            h,
            kind: "building",
          });
        }
      }
    }
  }
  return blocks;
}
const BLOCKS = buildBlocks();

// ---------- colours from the current theme ----------
type Rgb = [number, number, number];
function themeColour(cssVar: string, fallback: Rgb): Rgb {
  const el = document.createElement("span");
  el.style.color = `hsl(var(${cssVar}))`;
  el.style.display = "none";
  document.body.appendChild(el);
  const m = getComputedStyle(el).color.match(/[\d.]+/g);
  el.remove();
  return m && m.length >= 3 ? [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])] : fallback;
}
const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Rounded rectangle path; falls back to a plain rectangle on older WebViews without roundRect. */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

/** Draws one seamless tile and returns three mip levels as 32-bit pixel arrays. */
function buildTiles(): Uint32Array[] {
  const ink = themeColour("--foreground", [60, 50, 45]);
  const accent = themeColour("--accent", [30, 130, 90]);
  const primary = themeColour("--primary", [230, 70, 40]);
  const sky: Rgb = [40, 150, 225];

  const base = document.createElement("canvas");
  base.width = base.height = LEVELS[0];
  const g = base.getContext("2d")!;
  g.scale(LEVELS[0] / TILE, LEVELS[0] / TILE);
  g.lineCap = "round";

  // blocks
  for (const b of BLOCKS) {
    if (b.kind === "building") {
      g.beginPath();
      rr(g, b.x, b.y, b.w, b.h, 9);
      g.fillStyle = rgba(ink, 0.05);
      g.fill();
      g.strokeStyle = rgba(ink, 0.07);
      g.lineWidth = 1.5;
      g.stroke();
    } else if (b.kind === "park") {
      g.beginPath();
      rr(g, b.x, b.y, b.w, b.h, 22);
      g.fillStyle = rgba(accent, 0.12);
      g.fill();
      g.fillStyle = rgba(accent, 0.14);
      for (const f of [0.25, 0.5, 0.75]) {
        g.beginPath();
        g.arc(b.x + b.w * f, b.y + b.h * (f === 0.5 ? 0.35 : 0.65), 9, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.beginPath();
      rr(g, b.x, b.y, b.w, b.h, 14);
      g.setLineDash([6, 8]);
      g.strokeStyle = rgba(ink, 0.09);
      g.lineWidth = 1.5;
      g.stroke();
      g.setLineDash([]);
    }
  }

  // river (drawn shifted by +-TILE so it joins across tile edges)
  for (const dx of [-TILE, 0, TILE]) {
    g.beginPath();
    g.moveTo(dx, 430);
    g.bezierCurveTo(dx + 200, 330, dx + 380, 330, dx + 500, 430);
    g.bezierCurveTo(dx + 620, 530, dx + 800, 530, dx + 1000, 430);
    g.strokeStyle = rgba(sky, 0.15);
    g.lineWidth = 46;
    g.stroke();
  }

  // streets (at 0 and TILE so both halves meet across tiles)
  const street = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = rgba(ink, 0.09);
    g.lineWidth = STREET * 2;
    g.stroke();
    g.setLineDash([12, 12]);
    g.strokeStyle = rgba(ink, 0.16);
    g.lineWidth = 1.6;
    g.stroke();
    g.setLineDash([]);
  };
  for (const x of XS) street(x, 0, x, TILE);
  for (const y of YS) street(0, y, TILE, y);

  // diagonal avenue + dashed quest trail (shifted copies make the corners wrap)
  for (const dx of [-TILE, 0, TILE]) {
    for (const dy of [-TILE, 0, TILE]) {
      g.beginPath();
      g.moveTo(dx, dy);
      g.lineTo(dx + TILE, dy + TILE);
      g.strokeStyle = rgba(ink, 0.09);
      g.lineWidth = 26;
      g.stroke();
      g.setLineDash([4, 18]);
      g.strokeStyle = rgba(primary, 0.45);
      g.lineWidth = 3;
      g.stroke();
      g.setLineDash([]);
    }
  }

  // mip chain (smoothing in the distance avoids shimmering thin lines)
  const levels: Uint32Array[] = [];
  let source: HTMLCanvasElement = base;
  for (const size of LEVELS) {
    let c = source;
    if (size !== source.width) {
      c = document.createElement("canvas");
      c.width = c.height = size;
      const cg = c.getContext("2d")!;
      cg.imageSmoothingQuality = "high";
      cg.drawImage(source, 0, 0, size, size);
    }
    const data = c.getContext("2d")!.getImageData(0, 0, size, size);
    levels.push(new Uint32Array(data.data.buffer));
    source = c;
  }
  return levels;
}

// ---------- perspective maths (matches the old CSS rotateX/rotateZ + perspective) ----------
function makeProjector(w: number, h: number) {
  const rz = (TILT_Z * Math.PI) / 180;
  const rx = (TILT_X * Math.PI) / 180;
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const c = Math.cos(rx);
  const s = Math.sin(rx);
  const d = PERSPECTIVE;
  const ox = w / 2;
  const oy = h * 0.28;
  const A = h / 2 + PLANE_OFFSET_Y - oy;
  return {
    /** Plane point (relative to plane centre) -> screen position and scale. */
    forward(cx: number, cy: number) {
      const x1 = cx * cz - cy * sz;
      const y1 = cx * sz + cy * cz;
      const z2 = y1 * s;
      const k = d / (d - z2);
      return { sx: ox + (w / 2 + x1 - ox) * k, sy: oy + (A + y1 * c) * k, k };
    },
    /** Screen pixel -> plane point (relative to plane centre) and scale. */
    inverse(sx: number, sy: number) {
      const dy = sy - oy;
      const den = d * c + dy * s;
      if (den <= 1e-6) return null;
      const y1 = (d * (dy - A)) / den;
      const z2 = y1 * s;
      if (d - z2 <= 1e-6) return null;
      const k = d / (d - z2);
      const x1 = ox + (sx - ox) / k - w / 2;
      return { cx: x1 * cz + y1 * sz, cy: -x1 * sz + y1 * cz, k };
    },
  };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- pins ----------
type Pin = { id: number; mx: number; my: number; tone: "primary" | "sun" | "accent"; price: string };
const TONES = ["primary", "primary", "sun", "accent"] as const;
const FALLBACK_PRICES = ["₹250", "₹450", "₹600", "₹800", "₹1,200", "₹350", "₹900"];
const TONE_FILL = { primary: "fill-primary", sun: "fill-sun", accent: "fill-accent" } as const;
const PLANE_CENTRE = 1800; // plane coordinates are measured from here

function PinGraphic({ tone }: { tone: Pin["tone"] }) {
  return (
    <svg width="46" height="60" viewBox="0 0 34 44" aria-hidden="true" className="drop-shadow-[0_5px_5px_rgba(0,0,0,0.22)]">
      <path d="M17 1C8.7 1 2 7.6 2 15.8 2 27 17 43 17 43S32 27 32 15.8C32 7.6 25.3 1 17 1Z" className={TONE_FILL[tone]} />
      <circle cx="17" cy="16" r="6.5" className="fill-background" />
      <path d="M17 11.5l1.5 3.2 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4L17 11.5Z" className={TONE_FILL[tone]} />
    </svg>
  );
}

export function QuestMapBackground() {
  const reduce = useReducedMotion();
  const tasks = useTaskStore((s) => s.tasks);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const pinsRef = useRef<Pin[]>([]);
  const pinEls = useRef(new Map<number, HTMLDivElement>());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const showHud = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fps");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isPhone = window.innerWidth < 768;
    const pinScale = isPhone ? 1.45 : 1.15;
    const t0 = performance.now();
    const offsetAt = (now: number) => ((now - t0) / PERIOD_MS) * TILE;

    let tiles: Uint32Array[];
    try {
      tiles = buildTiles();
    } catch (err) {
      console.warn("Quest map disabled:", err);
      return;
    }
    let W = 0;
    let H = 0;
    let lw = 0;
    let lh = 0;
    let U: Float32Array, V: Float32Array, LV: Uint8Array, FD: Uint8Array;
    let out32: Uint32Array;
    let image: ImageData;
    const viewW = () => window.innerWidth || 1280;
    const viewH = () => window.innerHeight || 720;
    let proj = makeProjector(viewW(), viewH());

    /** (Re)build the per-pixel perspective lookup for the current window size. */
    const layout = () => {
      W = viewW();
      H = viewH();
      proj = makeProjector(W, H);
      lw = Math.max(160, Math.min(520, Math.round(W / 3)));
      lh = Math.max(100, Math.round((lw * H) / W));
      canvas.width = lw;
      canvas.height = lh;
      const n = lw * lh;
      U = new Float32Array(n);
      V = new Float32Array(n);
      LV = new Uint8Array(n);
      FD = new Uint8Array(n);
      const buf = new ArrayBuffer(n * 4);
      out32 = new Uint32Array(buf);
      image = new ImageData(new Uint8ClampedArray(buf), lw, lh);

      const f = lw / W;
      for (let j = 0; j < lh; j++) {
        for (let i = 0; i < lw; i++) {
          const idx = j * lw + i;
          const sx = (i + 0.5) / f;
          const sy = (j + 0.5) / f;
          const p = proj.inverse(sx, sy);
          if (!p) continue; // fade stays 0
          U[idx] = p.cx + PLANE_CENTRE;
          V[idx] = p.cy + PLANE_CENTRE;
          LV[idx] = p.k > 0.62 ? 0 : p.k > 0.4 ? 1 : 2;
          // Soft elliptical vignette + fade of the far distance, times the overall opacity.
          const r = Math.hypot((sx - W * 0.5) / (W * 0.62), (sy - H * 0.48) / (H * 0.62));
          const fade = (1 - smooth(0.3, 1, r)) * smooth(0.28, 0.5, p.k) * OPACITY;
          FD[idx] = Math.round(fade * 256);
        }
      }
    };

    const draw = (off: number) => {
      const n = lw * lh;
      for (let i = 0; i < n; i++) {
        const f = FD[i];
        if (f === 0) {
          out32[i] = 0;
          continue;
        }
        const lvl = LV[i];
        const size = LEVELS[lvl];
        const sc = size / TILE;
        const tx = ((U[i] + off) * sc) & (size - 1);
        const ty = ((V[i] + off) * sc) & (size - 1);
        const px = tiles[lvl][ty * size + tx];
        const a = ((px >>> 24) * f) >> 8;
        out32[i] = (px & 0x00ffffff) | (a << 24);
      }
      ctx.putImageData(image, 0, 0);
    };

    try {
      layout();
    } catch (err) {
      console.warn("Quest map disabled:", err);
      return;
    }

    // ----- pins: positions are projected every frame (flat 2D transforms) -----
    const placePins = (now: number) => {
      const off = offsetAt(now);
      for (const p of pinsRef.current) {
        const el = pinEls.current.get(p.id);
        if (!el) continue;
        const { sx, sy, k } = proj.forward(p.mx - off - PLANE_CENTRE, p.my - off - PLANE_CENTRE);
        el.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) scale(${(k * pinScale).toFixed(3)})`;
        el.style.visibility = "visible";
      }
    };

    // ----- animation loop, capped at ~30fps, paused when hidden -----
    let raf = 0;
    let last = 0;
    let frames = 0;
    let drawMs = 0;
    let hudAt = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || ts - last < 1000 / FPS - 2) return;
      last = ts;
      const t = performance.now();
      try {
        draw(offsetAt(t));
        placePins(t);
      } catch (err) {
        console.warn("Quest map stopped:", err);
        cancelAnimationFrame(raf);
        return;
      }
      if (hudRef.current) {
        frames++;
        drawMs += performance.now() - t;
        if (t - hudAt >= 500) {
          hudRef.current.textContent = `${Math.round((frames * 1000) / (t - hudAt))} fps | ${(drawMs / frames).toFixed(1)} ms/frame | ${lw}x${lh}`;
          frames = 0;
          drawMs = 0;
          hudAt = t;
        }
      }
    };

    if (reduce) {
      draw(0);
      // A few still pins on a still map.
      const still: Pin[] = [
        { id: -1, mx: PLANE_CENTRE + 150, my: PLANE_CENTRE + 120, tone: "primary", price: "₹450" },
        { id: -2, mx: PLANE_CENTRE + 420, my: PLANE_CENTRE - 60, tone: "sun", price: "₹800" },
        { id: -3, mx: PLANE_CENTRE - 220, my: PLANE_CENTRE + 380, tone: "accent", price: "₹250" },
      ];
      pinsRef.current = still;
      setPins(still);
      requestAnimationFrame(() => placePins(t0));
    } else {
      raf = requestAnimationFrame(loop);
    }

    // ----- spawn pins -----
    const maxPins = isPhone ? 4 : 8;
    const every = isPhone ? 2000 : 1300;
    const rand = rng(Date.now() % 100000);
    let nextId = 1;
    const timeouts = new Set<number>();

    const spawn = () => {
      if (document.hidden || pinsRef.current.length >= maxPins) return;
      const now = performance.now();
      const off = offsetAt(now);
      let cx = 0;
      let cy = 0;
      for (let attempt = 0; attempt < 40; attempt++) {
        const tx = (rand() - 0.5) * 2600;
        const ty = (rand() - 0.5) * 2600;
        const s = proj.forward(tx, ty);
        const onScreen = s.k > 0.3 && s.sx > W * 0.06 && s.sx < W * 0.94 && s.sy > H * (isPhone ? 0.28 : 0.12) && s.sy < H * 0.9;
        const crowded = pinsRef.current.some((o) => {
          const os = proj.forward(o.mx - off - PLANE_CENTRE, o.my - off - PLANE_CENTRE);
          return Math.hypot(os.sx - s.sx, os.sy - s.sy) < 170;
        });
        if (onScreen && !crowded) {
          cx = tx;
          cy = ty;
          break;
        }
      }
      const list = tasksRef.current;
      const price = list.length
        ? `₹${list[Math.floor(rand() * list.length)].budget.toLocaleString("en-IN")}`
        : FALLBACK_PRICES[Math.floor(rand() * FALLBACK_PRICES.length)];
      const id = nextId++;
      const pin: Pin = { id, mx: cx + PLANE_CENTRE + off, my: cy + PLANE_CENTRE + off, tone: TONES[Math.floor(rand() * TONES.length)], price };
      pinsRef.current = [...pinsRef.current, pin];
      setPins(pinsRef.current);
      const to = window.setTimeout(() => {
        timeouts.delete(to);
        pinsRef.current = pinsRef.current.filter((p) => p.id !== id);
        setPins(pinsRef.current);
      }, LIFE_MS);
      timeouts.add(to);
    };

    let spawnTimer = 0;
    if (!reduce) {
      spawn();
      spawnTimer = window.setInterval(spawn, every);
    }

    // ----- keep in sync with resize and theme changes -----
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        layout();
        if (reduce) {
          draw(0);
          placePins(t0);
        }
      }, 200);
    };
    window.addEventListener("resize", onResize);

    const themeObserver = new MutationObserver(() => {
      try {
        tiles = buildTiles();
        if (reduce) draw(0);
      } catch {
        // keep the previous tiles
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(spawnTimer);
      clearTimeout(resizeTimer);
      timeouts.forEach((t) => clearTimeout(t));
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
      pinsRef.current = [];
    };
  }, [reduce]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* The map, drawn at low resolution and scaled up smoothly by the browser. */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Pins: flat 2D elements positioned every frame. */}
      {pins.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) pinEls.current.set(p.id, el);
            else pinEls.current.delete(p.id);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ visibility: "hidden" }}
        >
          {!reduce && <span className="quest-ripple absolute -left-10 -top-10 h-20 w-20 rounded-full border-2 border-primary/40" />}
          <div style={{ transform: "translate(-23px,-60px)" }}>
            <div className={reduce ? "" : "quest-pin"} style={{ transformOrigin: "50% 100%" }}>
              <div className="relative">
                <PinGraphic tone={p.tone} />
                <span className="absolute left-[50px] top-1.5 whitespace-nowrap rounded-md border border-border bg-card/90 px-2 py-0.5 font-mono text-[12px] font-semibold text-foreground">
                  {p.price}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {showHud && <div ref={hudRef} className="fixed bottom-2 left-2 z-[999] rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] text-white">measuring…</div>}
    </div>
  );
}
