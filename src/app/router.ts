import { useEffect, useState } from "react";

// 最小 hash 路由：#/ 、#/unit/:id、#/sim/:id、#/fixtures/:name
export interface Route { path: string[]; }
const parse = (): Route => ({ path: location.hash.replace(/^#\/?/, "").split("/").filter(Boolean) });

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener("hashchange", on); window.addEventListener("popstate", on);
    return () => { window.removeEventListener("hashchange", on); window.removeEventListener("popstate", on); };
  }, []);
  return r;
}
export const navigate = (hash: string) => { location.hash = hash; };
