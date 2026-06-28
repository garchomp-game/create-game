import type { HudText } from "../types";

export const hudText: HudText = {
  hp: (current, max) => `HP ${current}/${max}`,
  xp: (level, xp, next) => `Lv ${level}  経験値 ${xp}/${next}`,
  meta: (wave, time, score, enemies, maxEnemies) =>
    `波 ${wave}  ${time}  得点 ${score}  敵 ${enemies}/${maxEnemies}`,
  weapon: (weaponName, fireRate, projectileCount, pierce) =>
    `${weaponName}  ${fireRate}/秒  x${projectileCount}  貫通 ${pierce}`,
  weaponNames: {
    pulse: "パルス",
    spread: "拡散",
    pierce: "貫通",
  },
};
