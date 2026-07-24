export interface DesktopDeviceSignals {
  userAgent: string;
  mobileHint: boolean;
  platform: string;
  maxTouchPoints: number;
  coarsePrimaryPointer: boolean;
  primaryPointerCanHover: boolean;
  finePointerAvailable: boolean;
}

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile/i;

export function shouldBlockGameDevice(signals: DesktopDeviceSignals): boolean {
  const isIpadUsingDesktopUserAgent =
    signals.platform === "MacIntel" && signals.maxTouchPoints > 1;
  const isExplicitMobileDevice =
    signals.mobileHint ||
    MOBILE_USER_AGENT_PATTERN.test(signals.userAgent) ||
    isIpadUsingDesktopUserAgent;
  const isTouchOnlyDevice =
    signals.maxTouchPoints > 0 &&
    signals.coarsePrimaryPointer &&
    !signals.primaryPointerCanHover &&
    !signals.finePointerAvailable;

  return isExplicitMobileDevice || isTouchOnlyDevice;
}

export function readDesktopDeviceSignals(): DesktopDeviceSignals {
  const browserNavigator = navigator as NavigatorWithUserAgentData;

  return {
    userAgent: browserNavigator.userAgent,
    mobileHint: browserNavigator.userAgentData?.mobile === true,
    platform: browserNavigator.platform,
    maxTouchPoints: browserNavigator.maxTouchPoints,
    coarsePrimaryPointer: window.matchMedia("(pointer: coarse)").matches,
    primaryPointerCanHover: window.matchMedia("(hover: hover)").matches,
    finePointerAvailable: window.matchMedia("(any-pointer: fine)").matches,
  };
}

export function showDesktopOnlyGate(root: HTMLElement): void {
  const screen = document.createElement("main");
  screen.className = "arena-device-gate";
  screen.dataset.deviceGate = "unsupported";
  screen.setAttribute("aria-labelledby", "arena-device-gate-title");

  const content = document.createElement("div");
  content.className = "arena-device-gate__content";

  const brand = document.createElement("p");
  brand.className = "arena-device-gate__brand";
  brand.textContent = "ARENA CORE";

  const title = document.createElement("h1");
  title.id = "arena-device-gate-title";
  title.className = "arena-device-gate__title";
  title.setAttribute("aria-label", "パソコンで開き直してください");
  title.tabIndex = -1;
  const titlePrefix = document.createElement("span");
  titlePrefix.className = "arena-device-gate__title-prefix";
  titlePrefix.textContent = "パソコンで開き直して";
  title.append(titlePrefix, "ください");

  const lead = document.createElement("p");
  lead.className = "arena-device-gate__lead";
  lead.textContent = "このゲームはパソコン専用です。";

  const description = document.createElement("p");
  description.className = "arena-device-gate__description";
  const descriptionPrimary = document.createElement("span");
  descriptionPrimary.className = "arena-device-gate__description-line";
  descriptionPrimary.textContent = "キーボードとマウスを使ってプレイします。";
  description.append(
    descriptionPrimary,
    "スマートフォンやタブレットでは起動できません。",
  );

  const instruction = document.createElement("p");
  instruction.className = "arena-device-gate__instruction";
  instruction.textContent = "パソコンから同じURLを開いてください。";

  const requirements = document.createElement("p");
  requirements.className = "arena-device-gate__requirements";
  requirements.setAttribute("aria-label", "必要な操作機器");
  requirements.textContent = "必要なもの：キーボード・マウス";

  content.append(brand, title, lead, description, instruction, requirements);
  screen.append(content);
  root.replaceChildren(screen);
  document.title = "パソコンで開いてください | Arena Core";
  title.focus();
}
