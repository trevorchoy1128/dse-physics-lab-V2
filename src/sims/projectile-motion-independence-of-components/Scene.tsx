import { useLayoutEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { InstancedMesh, Object3D, Vector3, type PerspectiveCamera } from "three";
import { VectorArrow } from "@/components";
import { sig, withUnit } from "@/shell/format";
import { useLang } from "@/i18n/lang";
import type { SceneProps, BodyPlan, Vec3 } from "@/shell/types";

// 3D 場景：只畫 plan 的結果，加固定幾何（地面、側視投影牆、發射器、比例尺）。沒有物理、沒有 if 判斷方向。
// 座標：x 向右、y 向上、z 指向觀眾（右手系）。第二顆球在 z = −zOff（向裏），投影牆在 z = sideZ。

const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); const f = m / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
const fmt = (x: number) => sig(x).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const GREY = "#6b7480";

/** 一批相同形狀、相同顏色的小物體（頻閃影像、影子）用 InstancedMesh 畫，數量可達數百。disc 預設平放（法線 +y）；wall 為貼牆（法線 +z） */
function Instances({ items, color, opacity, shape }: { items: BodyPlan[]; color: string; opacity: number; shape: "sphere" | "disc" | "wall" }) {
  const ref = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const n = items.length;
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    items.forEach((b, i) => {
      tmp.position.set(b.position[0], b.position[1], b.position[2]);
      tmp.rotation.set(shape === "wall" ? Math.PI / 2 : 0, 0, 0);
      tmp.scale.setScalar(b.size[0]);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }, [items, n, tmp, shape]);
  if (n === 0) return null;
  return (
    <instancedMesh key={n} ref={ref} args={[undefined, undefined, Math.max(n, 1)]} frustumCulled={false}>
      {shape === "sphere" ? <sphereGeometry args={[1, 12, 12]} /> : <cylinderGeometry args={[1, 1, 0.08, 16]} />}
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </instancedMesh>
  );
}

/** 取景：把發射器（含塔頂）、整條路徑與落點都放進畫面。只在場景範圍或發射高度改變時重設相機與軌道控制的目標；學生自己旋轉縮放時不干預。 */
function Framing({ top, world }: { top: number; world: number }) {
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const controls = useThree(s => s.controls) as unknown as { target: Vector3; minDistance: number; maxDistance: number; maxPolarAngle: number; minPolarAngle: number; update: () => void } | null;
  const size = useThree(s => s.size);
  useLayoutEffect(() => {
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = Math.max(0.5, size.width / Math.max(1, size.height));
    // 包圍盒連標籤與比例尺：x 由 y 標籤（−3.6）到 world + 1，y 由地面到 top，z 由牆到比例尺標籤（+4.4）；再留約 8% 邊距
    const halfH = top / 2 + 3.5, halfW = (world + 6) / 2;
    const d = Math.max(halfH / Math.tan(fov / 2), halfW / (Math.tan(fov / 2) * aspect)) * 1.08;
    const target = new Vector3(world * 0.42 - 1.2, top / 2 - 0.5, -1);
    camera.position.set(target.x - d * 0.1, target.y + d * 0.24, target.z + d * 0.97);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target); controls.minDistance = d * 0.3; controls.maxDistance = d * 3;
      controls.maxPolarAngle = 1.45;   // 約 83°：視線不會轉到地面以下（老師：視覺不要穿越地面）
      controls.minPolarAngle = 0.15;
      controls.update();
    }
  }, [top, world, camera, controls, size.width, size.height]);
  return null;
}

/** 場景內即時讀數標籤：數值在 R3F 每幀的 useFrame 內直接寫入 DOM，與 3D 物件同一幀更新（drei Html 的子樹經另一個 React root 非同步渲染，會落後一至兩幀） */
function LiveLabel({ position, symbol, text }: { position: Vec3; symbol: string; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const latest = useRef(text); latest.current = text;
  useFrame(() => { const el = ref.current; if (el && el.textContent !== latest.current) el.textContent = latest.current; });
  return (
    <Html position={position} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
      <span className="slabel"><i>{symbol}</i> = <span ref={ref}>{text}</span></span>
    </Html>
  );
}

/** 發射器（學校常用的管式拋體發射器）：底板、兩塊支架、橫軸、發射管（口徑比球大，有炮口環與尾蓋）、裝在軸側的半圓量角器與紅色指針。
 *  橫軸（樞軸）就在發射點；發射管由樞軸向前伸出 B_FWD，球在管內已具初速、由管口離開。整台器材永遠在平台／地面之上。 */
const B_FWD = 0.75, B_BACK = 0.25, BORE = 0.42, R_PROT = 1.0;
function Launcher({ launchY, thetaDeg, z, hk }: { launchY: number; thetaDeg: number; z: number; hk: number }) {
  const th = (thetaDeg * Math.PI) / 180;
  const dx = Math.cos(th), dy = Math.sin(th);
  const px = 0, py = launchY;                                       // 樞軸 = 發射點
  const len = B_FWD + B_BACK;
  const bc: Vec3 = [px + dx * (B_FWD - B_BACK) / 2, py + dy * (B_FWD - B_BACK) / 2, z];   // 管中心
  const rot: Vec3 = [0, 0, th - Math.PI / 2];
  const ticks = [-30, -15, 0, 15, 30, 45, 60, 75, 90];
  const steel = "#5b6675", frame = "#8b95a3";   // 管身淺鋼灰、支架更淺，與深色底板分得開
  const yokeH = Math.max(0.2, py - hk - 0.12) + 0.2;
  return (
    <group>
      {/* 底板 */}
      <mesh position={[px - 0.15, hk + 0.06, z]} castShadow>
        <boxGeometry args={[1.5, 0.12, 1.2]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* 兩塊支架與橫軸 */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[px, hk + 0.12 + yokeH / 2 - 0.1, z + s * 0.5]} castShadow>
          <boxGeometry args={[0.4, yokeH, 0.1]} />
          <meshStandardMaterial color={frame} />
        </mesh>
      ))}
      <mesh position={[px, py, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 1.2, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* 發射管、炮口環、尾蓋 */}
      <mesh position={bc} rotation={rot} castShadow>
        <cylinderGeometry args={[BORE, BORE + 0.03, len, 24]} />
        <meshStandardMaterial color={steel} metalness={0.3} roughness={0.5} transparent opacity={0.62} />   {/* 半透明：t = 0 時球在管內仍看得見 */}
      </mesh>
      <mesh position={[px + dx * B_FWD, py + dy * B_FWD, z]} rotation={rot}>
        <torusGeometry args={[BORE + 0.02, 0.06, 12, 32]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[px - dx * B_BACK, py - dy * B_BACK, z]} rotation={rot}>
        <cylinderGeometry args={[BORE + 0.04, BORE + 0.04, 0.12, 24]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* 量角器：裝在 +z 側支架外，圓心在橫軸；紅色指針沿管軸指向管口 */}
      <mesh position={[px, py, z + 0.58]}>
        <circleGeometry args={[R_PROT, 40, -Math.PI / 6, (2 * Math.PI) / 3]} />
        <meshStandardMaterial color="#f8fafc" side={2} transparent opacity={0.72} />
      </mesh>
      {ticks.map(d => {
        const a = (d * Math.PI) / 180, r0 = d % 45 === 0 ? R_PROT * 0.7 : R_PROT * 0.84;
        return <Line key={d} points={[[px + Math.cos(a) * r0, py + Math.sin(a) * r0, z + 0.59], [px + Math.cos(a) * R_PROT, py + Math.sin(a) * R_PROT, z + 0.59]]} color="#1b2530" lineWidth={d % 45 === 0 ? 1.6 : 1} />;
      })}
      <Line points={[[px, py, z + 0.6], [px + dx * R_PROT, py + dy * R_PROT, z + 0.6]]} color="#d62828" lineWidth={2.5} />
      {z === 0 && (
        <Html position={[px - 0.3, py + R_PROT + 0.45, z + 0.6]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <span className="slabel"><i>θ</i> = {fmt(thetaDeg)}°</span>
        </Html>
      )}
    </group>
  );
}

export default function Scene({ plan }: SceneProps) {
  const lang = useLang(s => s.lang);
  const m = plan.meta!;
  const bodies = plan.bodies ?? [];
  const balls = bodies.filter(b => b.key.startsWith("ball-"));
  const group = (prefix: string) => bodies.filter(b => b.key.startsWith(prefix));
  const trail = (key: string) => plan.trails?.find(t => t.key === key);
  const ghosts = plan.trails?.filter(t => t.key.startsWith("ghost-")) ?? [];

  const hk = m.h * m.k;
  const launchY = hk + m.r;
  const barM = nice(m.L / 5);
  const barW = barM * m.k;
  const barX = m.world * 0.3;   // 場景前段的地面；落點的 x 標籤在中後段，不會重疊
  const top = Math.max(launchY + R_PROT + 1.2, m.yMax * m.k + m.r);   // 畫面要放進的最高點：塔頂量角器或路徑最高點
  const wallH = Math.max(5, top + 2.5);
  const wallW = m.world * 1.6;

  return (
    <>
      <Framing top={top} world={m.world} />
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.world * 0.5, -0.002, -1]} receiveShadow>
        <planeGeometry args={[m.world * 2.6, m.world * 1.4]} />
        <meshStandardMaterial color="#d8e6cf" />
      </mesh>
      {/* 側視投影牆（x–y 平面）：高度隨本次運行的最高點調整；不受光照，保持淺色 */}
      <mesh position={[wallW / 2 - 2.5, wallH / 2, m.sideZ - 0.05]}>
        <planeGeometry args={[wallW, wallH]} />
        <meshBasicMaterial color="#e9eef5" />
      </mesh>
      <Html position={[-1.2, wallH - 0.4, m.sideZ]} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <span className="slabel">{lang === "zh" ? "側視投影（垂直運動）" : "Side projection (vertical motion)"}</span>
      </Html>
      <Html position={[m.world * 0.3, 0.05, 1.8]} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <span className="slabel">{lang === "zh" ? "俯視投影：地面影子（水平運動）" : "Top projection: ground shadows (horizontal motion)"}</span>
      </Html>
      {m.dropB === 0 && (
        <Html position={[-1.6, top + 0.9, m.sideZ]} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <span className="slabel">{lang === "zh" ? "高度（每 0.1 s）" : "Height (every 0.1 s)"}</span>
        </Html>
      )}

      {/* 發射器（第二顆球有自己的一台；「同時自由下落」的球只有夾持座） */}
      <Launcher launchY={launchY} thetaDeg={m.theta} z={0} hk={hk} />
      {m.hasB === 1 && m.dropB === 0 && <Launcher launchY={launchY} thetaDeg={m.theta} z={-m.zOff} hk={hk} />}
      {m.hasB === 1 && m.dropB === 1 && (
        <group>
          {/* 夾持座：塔身向後退（x ≤ −0.5），夾臂伸到發射點上方，球懸在塔邊之外，釋放後不被塔頂遮住 */}
          {hk > 0.05 && (
            <mesh position={[-1.3, hk / 2, -m.zOff]} castShadow>
              <boxGeometry args={[1.6, hk, 1.4]} />
              <meshStandardMaterial color="#9aa5b1" />
            </mesh>
          )}
          <mesh position={[-0.65, launchY + 0.55, -m.zOff]} castShadow>
            <boxGeometry args={[1.5, 0.12, 0.5]} />
            <meshStandardMaterial color="#4b5563" />
          </mesh>
          <mesh position={[0, launchY + 0.3, -m.zOff]}>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        </group>
      )}

      {/* 比例尺：放在場景右半的地面前方 */}
      <Line points={[[barX, 0.02, 3.8], [barX + barW, 0.02, 3.8]]} color="#1b2530" lineWidth={2} />
      <Line points={[[barX, 0.02, 3.6], [barX, 0.02, 4.0]]} color="#1b2530" lineWidth={2} />
      <Line points={[[barX + barW, 0.02, 3.6], [barX + barW, 0.02, 4.0]]} color="#1b2530" lineWidth={2} />
      <Html position={[barX + barW / 2, 0.05, 4.4]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <span className="slabel">{fmt(barM)} m</span>
      </Html>

      {/* 球的地面影子（永遠有，落地後可見球已貼地） */}
      {group("gshadow-").map(b => (
        <mesh key={b.key} position={b.position} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[b.size[0], 24]} />
          <meshBasicMaterial color="#3b4350" transparent opacity={0.35} />
        </mesh>
      ))}
      {/* 球 */}
      {balls.map(b => (
        <mesh key={b.key} position={b.position} castShadow>
          <sphereGeometry args={[b.size[0], 32, 32]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
      {/* 頻閃影像（球色、半透明）與其投影（灰色扁平圓點：地面 = 俯視、牆 = 側視、牆左緣 = 高度） */}
      <Instances items={group("strobe-a-")} color="#e0891c" opacity={0.45} shape="sphere" />
      <Instances items={group("strobe-b-")} color="#4a6fa5" opacity={0.45} shape="sphere" />
      <Instances items={group("shadow-a-")} color={GREY} opacity={0.7} shape="disc" />
      <Instances items={group("shadow-b-")} color={GREY} opacity={0.7} shape="disc" />
      <Instances items={group("wall-a-")} color={GREY} opacity={0.7} shape="wall" />
      <Instances items={group("ycol-a-")} color={GREY} opacity={0.7} shape="wall" />

      {/* 路徑與投影線 */}
      {trail("path-a") && trail("path-a")!.points.length > 1 && <Line points={trail("path-a")!.points} color="#e0891c" lineWidth={2} />}
      {trail("path-b") && trail("path-b")!.points.length > 1 && <Line points={trail("path-b")!.points} color="#4a6fa5" lineWidth={2} />}
      {trail("proj-top-a") && trail("proj-top-a")!.points.length > 1 && <Line points={trail("proj-top-a")!.points} color={GREY} lineWidth={1} />}
      {trail("proj-side-a") && trail("proj-side-a")!.points.length > 1 && <Line points={trail("proj-side-a")!.points} color={GREY} lineWidth={1} />}
      {trail("drop-a") && <Line points={trail("drop-a")!.points} color="#7a8592" lineWidth={1} dashed dashSize={0.2} gapSize={0.12} />}
      {trail("sync") && <Line points={trail("sync")!.points} color="#1b2530" lineWidth={1.5} dashed dashSize={0.25} gapSize={0.15} />}
      {ghosts.map(g => (
        <group key={g.key}>
          <Line points={g.points} color={g.key === "ghost-45" ? "#0e6f6a" : "#8a94a0"} lineWidth={g.key === "ghost-45" ? 2 : 1.2} dashed dashSize={0.3} gapSize={0.18} />
          <Html position={g.points[Math.floor(g.points.length / 2)]} center style={{ pointerEvents: "none" }}>
            <span className="slabel">{g.key.slice(6)}°</span>
          </Html>
        </group>
      ))}

      {plan.arrows.map((a, i) => (
        <VectorArrow key={`${a.layer}-${a.origin[2]}-${i}`} kind={a.kind} origin={a.origin} vector={a.vector} scale={plan.scales[a.kind] ?? 1} label={a.label} />
      ))}
      {plan.labels.map((l, i) => <LiveLabel key={i} position={l.position} symbol={l.symbol} text={withUnit(l.value, l.unit)} />)}
    </>
  );
}
