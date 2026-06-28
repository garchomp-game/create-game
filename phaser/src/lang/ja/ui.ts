import type { UiText } from "../types";

export const uiText: UiText = {
  libraryLabel: "ライブラリ: Phaser",
  titleScreen: "ARENA CORE\n移動  照準  射撃\n押し寄せる敵を生き延びろ",
  paused: "一時停止",
  upgradeHeading: (level) => `レベル ${level}\n強化を選択`,
  rank: "ランク",
  result: {
    title: "ラン終了",
    scoreTime: (score, time) => `スコア: ${score}   生存: ${time}`,
    levelKills: (level, kills) => `レベル: ${level}   撃破: ${kills}`,
    shotsRecovered: (shots, recovered) => `射撃: ${shots}   回復: ${recovered}`,
    heals: (effective, collected) => `回復取得: ${effective}/${collected}`,
    cause: (cause) => `原因: ${cause}`,
  },
  menu: {
    start: "開始",
    resume: "再開",
    restart: "リスタート",
    title: "タイトルへ",
  },
  damageSource: {
    enemyContact: (enemyName) => `${enemyName}との接触`,
    enemyProjectile: "敵弾",
  },
  enemyNames: {
    chaser: "追跡体",
    brute: "重装体",
    fast: "高速体",
    ranged: "射撃体",
  },
};
