import type { HudText } from "../types";

export const hudText: HudText = {
  hp: (current, max) => `HP ${current}/${max}`,
  xp: (level, xp, next) => `Lv ${level}  経験値 ${xp}/${next}`,
  meta: (time, score) => `${time}  ${score}点`,
  danger: (wave, enemies, maxEnemies, weaponName) =>
    `危険度 ${wave}  敵 ${enemies}/${maxEnemies}  ${weaponName}`,
  weapon: (weaponName, fireRate, projectileCount, pierce) =>
    `${weaponName}  ${fireRate}/秒  x${projectileCount}  貫通 ${pierce}`,
  weaponNames: {
    pulse: "パルス",
    spread: "拡散",
    pierce: "貫通",
  },
};
