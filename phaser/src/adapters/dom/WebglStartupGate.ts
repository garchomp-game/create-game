export type WebglStartupFailureReason =
  | "webgl-unavailable"
  | "initialization-failed";

interface WebglProbeCanvas {
  getContext(contextId: "webgl2" | "webgl"): unknown;
}

export function canStartWebgl(
  createCanvas: () => WebglProbeCanvas = createWebglProbeCanvas,
): boolean {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function showWebglStartupGate(
  root: HTMLElement,
  reason: WebglStartupFailureReason,
): void {
  const unavailable = reason === "webgl-unavailable";
  const screen = document.createElement("main");
  screen.className = "arena-device-gate";
  screen.dataset.startupGate = reason;
  screen.setAttribute("aria-labelledby", "arena-startup-gate-title");

  const content = document.createElement("div");
  content.className = "arena-device-gate__content";

  const brand = document.createElement("p");
  brand.className = "arena-device-gate__brand";
  brand.textContent = "ARENA CORE";

  const title = document.createElement("h1");
  title.id = "arena-startup-gate-title";
  title.className = "arena-device-gate__title";
  title.tabIndex = -1;
  title.textContent = unavailable
    ? "WebGLを利用できません"
    : "ゲームを起動できませんでした";

  const lead = document.createElement("p");
  lead.className = "arena-device-gate__lead";
  lead.textContent = unavailable
    ? "ブラウザのグラフィック機能が無効です。"
    : "ゲームの初期化中に問題が発生しました。";

  const description = document.createElement("p");
  description.className = "arena-device-gate__description";
  description.textContent = unavailable
    ? "ブラウザのハードウェア アクセラレーションを有効にしてください。"
    : "ページを再読み込みしても解決しない場合は、ブラウザを再起動してください。";

  const instruction = document.createElement("p");
  instruction.className = "arena-device-gate__instruction";
  instruction.textContent = unavailable
    ? "設定を変更した後、このページを再読み込みしてください。"
    : "問題が続く場合は、最新版のChromeまたはFirefoxで開いてください。";

  const requirements = document.createElement("p");
  requirements.className = "arena-device-gate__requirements";
  requirements.textContent = "必要なもの：WebGL対応ブラウザ・キーボード・マウス";

  content.append(brand, title, lead, description, instruction, requirements);
  screen.append(content);
  root.replaceChildren(screen);
  document.title = `${title.textContent} | Arena Core`;
  title.focus();
}

function createWebglProbeCanvas(): WebglProbeCanvas {
  return document.createElement("canvas");
}
