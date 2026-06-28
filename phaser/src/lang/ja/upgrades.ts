import type { UpgradeText } from "../types";

export const upgradeText: UpgradeText = {
  definitions: {
    rapidFire: {
      title: "連射強化",
      description: "射撃間隔を15%短縮",
    },
    swiftStep: {
      title: "軽快な足取り",
      description: "移動速度を12%上昇",
    },
    vitalCore: {
      title: "生命コア",
      description: "最大HPを20上昇",
    },
    overdriveRounds: {
      title: "加速弾",
      description: "弾速を15%上昇",
    },
    splitShot: {
      title: "分裂射撃",
      description: "弾を1発追加",
    },
    piercingRounds: {
      title: "貫通弾",
      description: "貫通数を1追加",
    },
  },
  preview: {
    labels: {
      fireRate: "連射",
      moveSpeed: "移動速度",
      shotSpeed: "弾速",
      maxHp: "最大HP",
      projectiles: "弾数",
      pierce: "貫通",
    },
    perSecond: "/秒",
    separator: " -> ",
  },
};
