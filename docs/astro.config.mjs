import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://garchomp-game.github.io/create-game",
  integrations: [
    starlight({
      title: "Arena Core 開発ドキュメント",
      description: "Arena Coreのゲーム設計、実装方針、開発計画、プレイテスト記録。",
      locales: {
        root: {
          label: "日本語",
          lang: "ja"
        }
      },
      sidebar: [
        {
          label: "はじめに",
          items: [
            { label: "現在地", slug: "game/current-state" },
            { label: "ゲーム方針", slug: "product/game-direction" },
            { label: "基本ゲームループ", slug: "product/core-loop" },
            { label: "開発環境", slug: "development/setup" }
          ]
        },
        {
          label: "ゲームデザイン",
          items: [
            { label: "拡張設計の全体像", slug: "design/gameplay-expansion-blueprint" },
            { label: "操作設計", slug: "design/controls" },
            { label: "ビルドと成長", slug: "design/build-and-progression" },
            { label: "武器アイデンティティ", slug: "design/weapon-identities" },
            { label: "エンドレス後半", slug: "design/endless-escalation" },
            { label: "モードと戦闘展開", slug: "design/encounters-and-modes" },
            { label: "UI/UXとフィードバック", slug: "design/ui-ux" },
            { label: "障害物・敵経路・弾", slug: "design/obstacles-and-projectiles" },
            { label: "回復ピックアップ", slug: "design/healing-pickups" },
            { label: "アイテム", slug: "design/item-system" },
            { label: "ステージと装備", slug: "design/stages-and-equipment" },
            { label: "長期やりこみ方針", slug: "roadmap/long-term-replayability" }
          ]
        },
        {
          label: "技術設計",
          items: [
            { label: "アーキテクチャ", slug: "engineering/architecture" },
            { label: "品質戦略", slug: "engineering/quality-strategy" }
          ]
        },
        {
          label: "計画と運用",
          items: [
            { label: "直近フェーズ", slug: "project-management/next-phase-plan" },
            { label: "v0.5作業計画", slug: "project-management/endless-polish-plan" },
            { label: "v0.5チケット詳細", slug: "project-management/v05-tickets" },
            { label: "v0.6チケット詳細", slug: "project-management/v06-tickets" },
            { label: "中長期作業計画", slug: "project-management/gameplay-expansion-plan" },
            { label: "ロードマップ", slug: "project-management/roadmap" },
            { label: "チケット一覧", slug: "project-management/tickets" },
            { label: "意思決定記録", slug: "project-management/decision-log" },
            { label: "リスク一覧", slug: "project-management/risk-log" },
            { label: "運用方針", slug: "project-management/operating-model" }
          ]
        },
        {
          label: "プレイテスト",
          items: [
            { label: "手動プレイ記録", slug: "playtest/playtest-notes" },
            { label: "バランス回帰テスト", slug: "playtest/balance-probe" }
          ]
        },
        {
          label: "アーカイブ",
          items: [{ label: "旧資料一覧", slug: "archive/legacy-index" }]
        }
      ]
    })
  ]
});
