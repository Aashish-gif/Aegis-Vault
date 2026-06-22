import { useEffect, useRef, useState } from "react";
import type { ExamQuestion } from "@/lib/questions";

interface Props {
  question: ExamQuestion;
  studentId: string;
  ipAddress: string;
  selected: string | null;
  onSelect: (optionKey: string) => void;
}

interface HitRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ExamCanvas({
  question,
  studentId,
  ipAddress,
  selected,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hitsRef = useRef<HitRect[]>([]);
  const [size, setSize] = useState({ w: 800, h: 520 });

  // Resize observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(320, cr.width), h: Math.max(420, cr.height) });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = 0;
    const FRAME_MS = 100; // 10fps

    const draw = (t: number) => {
      if (t - last >= FRAME_MS) {
        last = t;
        render(ctx, size.w, size.h, question, selected, hitsRef, {
          studentId,
          ipAddress,
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, question, selected, studentId, ipAddress]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const h of hitsRef.current) {
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        onSelect(h.key);
        return;
      }
    }
  };

  return (
    <div
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
      className="relative w-full rounded-lg border border-border bg-card overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="block cursor-pointer"
        aria-label={`Question ${question.id}`}
      />
    </div>
  );
}

function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  q: ExamQuestion,
  selected: string | null,
  hitsRef: React.MutableRefObject<HitRect[]>,
  meta: { studentId: string; ipAddress: string },
) {
  // background
  ctx.fillStyle = "#020617"; // slate-950
  ctx.fillRect(0, 0, w, h);

  // grid lines (military feel)
  ctx.strokeStyle = "rgba(34, 211, 238, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // header chip
  ctx.fillStyle = "rgba(34, 211, 238, 0.12)";
  ctx.fillRect(24, 24, 140, 26);
  ctx.fillStyle = "#22d3ee";
  ctx.font = "600 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(`// ${q.id}`, 36, 42);

  // question text
  ctx.fillStyle = "#e2e8f0"; // slate-200
  ctx.font =
    "600 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  const promptLines = wrapText(ctx, q.prompt, w - 48);
  let y = 88;
  for (const line of promptLines) {
    ctx.fillText(line, 24, y);
    y += 28;
  }

  // options
  const hits: HitRect[] = [];
  const startY = y + 16;
  const optH = 56;
  const gap = 12;
  q.options.forEach((opt, i) => {
    const oy = startY + i * (optH + gap);
    const ox = 24;
    const ow = w - 48;
    const isSel = selected === opt.key;

    ctx.fillStyle = isSel ? "rgba(34, 211, 238, 0.18)" : "rgba(15, 23, 42, 0.8)";
    ctx.strokeStyle = isSel ? "#22d3ee" : "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = isSel ? 2 : 1;
    roundRect(ctx, ox, oy, ow, optH, 8);
    ctx.fill();
    ctx.stroke();

    // key badge
    ctx.fillStyle = isSel ? "#22d3ee" : "rgba(148, 163, 184, 0.35)";
    roundRect(ctx, ox + 12, oy + 12, 32, 32, 6);
    ctx.fill();
    ctx.fillStyle = isSel ? "#020617" : "#e2e8f0";
    ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opt.key, ox + 28, oy + 28);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#e2e8f0";
    ctx.font =
      "500 15px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    const optLines = wrapText(ctx, opt.text, ow - 70);
    ctx.fillText(optLines[0] ?? opt.text, ox + 56, oy + 34);

    hits.push({ key: opt.key, x: ox, y: oy, w: ow, h: optH });
  });
  hitsRef.current = hits;

  // watermark overlay (drawn last so it floats on top)
  drawWatermark(ctx, w, h, meta);
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  meta: { studentId: string; ipAddress: string },
) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#22d3ee";
  ctx.font = "500 11px 'JetBrains Mono', ui-monospace, monospace";
  const text = `${meta.studentId}  •  ${meta.ipAddress}  •  ${Date.now()}ms`;
  const angle = (-28 * Math.PI) / 180;
  const stepX = 260;
  const stepY = 60;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  ctx.translate(-w / 2, -h / 2);
  for (let y = -h; y < h * 2; y += stepY) {
    for (let x = -w; x < w * 2; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
