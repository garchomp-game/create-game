export type UiCatalogBackgroundCandidateId =
  | "baseline"
  | "orbital"
  | "altitude"
  | "surface";

export type UiCatalogBackgroundCandidate = {
  id: UiCatalogBackgroundCandidateId;
  marker: "CONTROL" | "A" | "B" | "C";
  title: string;
  premise: string;
  spatialCue: string;
  risk: string;
};

export const UI_CATALOG_BACKGROUND_CANDIDATES = [
  {
    id: "baseline",
    marker: "CONTROL",
    title: "現行・戦術グリッド",
    premise: "抽象的な戦術表示だけを置いた、現在の可読性基準。",
    spatialCue: "格子と中央座標",
    risk: "ゲーム固有の場所や目的を説明しにくい",
  },
  {
    id: "orbital",
    marker: "A",
    title: "軌道回収プラットフォーム",
    premise: "全方位から接近する敵機を、軌道上の回収拠点で迎撃する。",
    spatialCue: "外周軌道、回収床、進入航路",
    risk: "宇宙の装飾が敵弾やXPより前へ出ないこと",
  },
  {
    id: "altitude",
    marker: "B",
    title: "高高度防衛プラットフォーム",
    premise: "雲海上の浮遊基地を、包囲する航空戦力から防衛する。",
    spatialCue: "地平線、高度帯、離着陸誘導",
    risk: "明るい空と雲がPickupの輪郭を弱めないこと",
  },
  {
    id: "surface",
    marker: "C",
    title: "惑星調査・回収区画",
    premise: "採掘拠点の外周防衛線を維持し、資源を回収して継戦する。",
    spatialCue: "調査区画、防衛線、警告塗装",
    risk: "地形表現が障害物や移動可能領域と競合しないこと",
  },
] as const satisfies ReadonlyArray<UiCatalogBackgroundCandidate>;

export function getUiCatalogBackgroundCandidate(
  id: UiCatalogBackgroundCandidateId,
): UiCatalogBackgroundCandidate {
  const candidate = UI_CATALOG_BACKGROUND_CANDIDATES.find(
    (entry) => entry.id === id,
  );
  if (!candidate) {
    throw new Error(`Unknown UI catalog background candidate: ${id}`);
  }
  return candidate;
}
