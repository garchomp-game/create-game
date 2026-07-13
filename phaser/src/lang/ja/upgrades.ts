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
      description: "1発あたりの命中可能数を1増加",
    },
    pulseRicochet: {
      title: "反響回路",
      description: "パルス弾が障害物で1回跳弾する",
    },
  },
  extraDefinitions: {
    limitPower: {
      title: "限界出力",
      description: "弾の基礎ダメージを8%加算",
    },
    limitCycle: {
      title: "過給サイクル",
      description: "上限付きで連射速度を上昇",
    },
    limitDrive: {
      title: "超過駆動",
      description: "上限付きで移動速度を上昇",
    },
    limitCore: {
      title: "増設コア",
      description: "最大HPを8上昇",
    },
  },
  extraCategoryLabel: "限界強化",
  categoryLabels: {
    weapon: "武器",
    mobility: "機動",
    survival: "生存",
    support: "補助",
    capstone: "最終強化",
  },
  capstoneProgress: (current, required) => `最終強化の解放: 武器強化 ${current}/${required}`,
  capstoneAcquired: "最終強化: 反響回路 取得済み",
  preview: {
    labels: {
      fireRate: "連射",
      moveSpeed: "移動速度",
      shotSpeed: "弾速",
      maxHp: "最大HP",
      projectiles: "弾数",
      hitCapacity: "命中可能数",
      ricochets: "跳弾回数",
    },
    perSecond: "/秒",
    separator: " -> ",
  },
};
