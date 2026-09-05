import { useEffect, useRef } from "react";

export type Draw2D = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

// 2D 畫布：needs3D 為 low 的模擬用。自動處理 devicePixelRatio 與尺寸變化；frame 改變即重畫。
export function Canvas2D({ draw, frame, className }: { draw: Draw2D; frame: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const parent = c.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    // 畫布絕對定位填滿父容器，尺寸只由父容器決定，不會反過來撐開父容器（學生試用者：iPad 版面卡死）
    const w = parent.clientWidth, h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
  }, [draw, frame]);
  return <canvas ref={ref} className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" }} />;
}
