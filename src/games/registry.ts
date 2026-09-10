import type { ComponentType } from "react";
import type { Text, UnitId } from "@/shell/types";

// 遊戲目錄：首頁「遊戲」部分與 #/games 頁由此取資料；有 load 的才可按，其餘標「即將推出」。
export interface GameDef {
  id: string;
  unit: UnitId;                  // 所屬單元（決定主色）
  topic: Text;                   // 課題（卡片上的小字）
  title: Text;
  summary: Text;
  load?: () => Promise<{ default: ComponentType }>;
}

export const GAMES: GameDef[] = [
  {
    id: "projectile-siege", unit: "c2", topic: { zh: "拋體運動", en: "Projectile motion" },
    title: { zh: "拋體攻城", en: "Projectile Siege" },
    summary: { zh: "調校初速與投射角，越過高牆、穿過缺口、射中山上的城。十關，每關一個公式。", en: "Set the speed and angle to clear walls, thread gaps and hit the castle. Ten levels, one formula each." },
    load: () => import("./projectile-siege/ProjectileSiege"),
  },
  {
    id: "graph-chase", unit: "c2", topic: { zh: "運動圖線", en: "Motion graphs" },
    title: { zh: "v–t 圖追車", en: "Graph Chase" },
    summary: { zh: "用鍵盤控制一架車，令自己的 v–t 圖與目標圖線重疊。", en: "Drive a car so that your v–t graph matches the target curve." },
  },
  {
    id: "laser-maze", unit: "c3", topic: { zh: "光的折射", en: "Refraction" },
    title: { zh: "激光迷宮", en: "Laser Maze" },
    summary: { zh: "放置鏡、稜鏡與透鏡，令激光繞過障礙射中目標。", en: "Place mirrors, prisms and lenses to guide a laser round obstacles to the target." },
  },
  {
    id: "circuit-escape", unit: "c4", topic: { zh: "電路", en: "Circuits" },
    title: { zh: "電路逃脫", en: "Circuit Escape" },
    summary: { zh: "用有限的電阻串並聯，令燈泡達到指定亮度。", en: "Combine a limited set of resistors in series and parallel to light the bulb at the right brightness." },
  },
];
export const gameOf = (id: string) => GAMES.find(g => g.id === id);
export const isGameLive = (g: GameDef) => !!g.load;
