import { useEffect, useRef } from "react";

export type Draw2D = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

// 2D 畫布：needs3D 為 low 的模擬用。自動處理 devicePixelRatio 與尺寸變化；frame 改變即重畫。
export function Canvas2D({ draw, frame, className }: { draw: Draw2D; frame: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const parent = c.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
  }, [draw, frame]);
  return <canvas ref={ref} className={className} style={{ display: "block", touchAction: "none" }} />;
}
