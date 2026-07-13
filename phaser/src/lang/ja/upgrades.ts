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
    pulseFocus: {
      title: "集束共鳴",
      description: "同じ敵への連続命中で威力が上昇",
    },
    piercingRounds: {
      title: "貫通弾",
      description: "1発あたりの命中可能数を1増加",
    },
    pulseRicochet: {
      title: "反響回路",
      description: "パルス弾が障害物で1回跳弾する",
    },
    spreadSweep: {
      title: "掃射循環",
      description: "3体以上への同時命中で次の射撃を加速",
    },
  },
  extraDefinitions: {
    limitPower: {
      title: "限界出力",
      description: "弾の基礎ダメージを8%加算",
    },
    limitCycle: {
      title: "過給サイクル",
      description: "基礎連射速度を10%加算（最大5段階）",
    },
    limitDrive: {
      title: "超過駆動",
      description: "基礎移動速度を6%加算（最大5段階）",
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
  capstoneAcquired: (name) => `最終強化: ${name} 取得済み`,
  preview: {
    labels: {
      fireRate: "連射",
      moveSpeed: "移動速度",
      shotSpeed: "弾速",
      maxHp: "最大HP",
      projectiles: "弾数",
      hitCapacity: "命中可能数",
      ricochets: "跳弾回数",
      focusStacks: "集束上限",
      nextVolleyReduction: "次射撃短縮",
    },
    perSecond: "/秒",
    separator: " -> ",
  },
};
