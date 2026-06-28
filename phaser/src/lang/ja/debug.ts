import type { DebugText } from "../types";

export const debugText: DebugText = {
  title: "デバッグ",
  delta: (value) => `dt: ${value} ms`,
  p95Delta: (value) => `p95 dt: ${value} ms`,
  enemies: (count) => `敵: ${count}`,
  bullets: (count) => `弾: ${count}`,
};
