import type { HudText } from "../types";

export const hudText: HudText = {
  hp: (current, max) => `HP ${current}/${max}`,
  xp: (level, xp, next) => `Lv ${level}  経験値 ${xp}/${next}`,
  buildComplete: (level) => `Lv ${level}  ビルド完成`,
  extraXp: (extraLevel, cycle, xp, next) =>
    `EX Lv ${extraLevel} / C${cycle}  経験値 ${xp}/${next}`,
  meta: (time, score) => `${time}  ${score}点`,
  danger: (threatTier, enemies, maxEnemies, weaponName) =>
    `脅威 ${threatTier}  敵 ${enemies}/${maxEnemies}  ${weaponName}`,
  encounterWarning: (encounterName, seconds) => `危険予告: ${encounterName}まで ${seconds}秒`,
  encounterActive: (encounterName, seconds) => `危険イベント: ${encounterName}  残り${seconds}秒`,
  encounterRecovery: (encounterName, seconds) => `危険低下: ${encounterName}  残り${seconds}秒`,
  collapseWarning: (seconds) => `崩壊予告: 安全領域縮小まで ${seconds}秒`,
  collapseActive: (stage) => `アリーナ崩壊 ${stage}段階`,
  overdriveContract: "過負荷契約: 敵速度+12% / スコアx1.3",
  weapon: (weaponName, fireRate, projectileCount, extraPierce) =>
    `${weaponName}  ${fireRate}/秒  x${projectileCount}  追加貫通 ${extraPierce}`,
  weaponNames: {
    pulse: "パルス",
    spread: "拡散",
    pierce: "貫通",
  },
  encounterNames: {
    rangedSurge: "射撃体集中",
    swarmRush: "高速群襲来",
    bruteSiege: "重装包囲",
  },
};
