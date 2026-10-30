import { motion } from "framer-motion";

/** Tiny animated line chart. With no data it renders a flat dotted baseline (an honest empty state). */
export function Sparkline({
  data,
  width = 160,
  height = 44,
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const hasData = data.length >= 2 && data.some((v) => v > 0);
  const pad = 3;

  if (!hasData) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} width={width} height={height} aria-hidden="true">
        <line x1={pad} x2={width - pad} y1={height - pad - 2} y2={height - pad - 2} className="stroke-border" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, height - pad - ((v - min) / range) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} width={width} height={height} aria-hidden="true">
      <path d={area} className="fill-accent/10" />
      <motion.path
        d={line}
        fill="none"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <motion.circle cx={last[0]} cy={last[1]} r="3.2" className="fill-accent" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }} />
    </svg>
  );
}
