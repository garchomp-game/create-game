import type { HudText } from "../types";

export const hudText: HudText = {
  hp: (current, max) => `HP ${current}/${max}`,
  xp: (level, xp, next) => `Lv ${level}  経験値 ${xp}/${next}`,
  buildComplete: (level) => `Lv ${level}  ビルド完成`,
  meta: (time, score) => `${time}  ${score}点`,
  danger: (wave, enemies, maxEnemies, weaponName) =>
    `危険度 ${wave}  敵 ${enemies}/${maxEnemies}  ${weaponName}`,
  encounterWarning: (seconds) => `危険予告: 射撃体集中まで ${seconds}秒`,
  encounterActive: (seconds) => `危険イベント: 射撃体集中  残り${seconds}秒`,
  encounterRecovery: (seconds) => `危険低下: 回復時間  残り${seconds}秒`,
  overdriveContract: "過負荷契約: 敵速度+12% / スコアx1.3",
  weapon: (weaponName, fireRate, projectileCount, extraPierce) =>
    `${weaponName}  ${fireRate}/秒  x${projectileCount}  追加貫通 ${extraPierce}`,
  weaponNames: {
    pulse: "パルス",
    spread: "拡散",
    pierce: "貫通",
  },
};
