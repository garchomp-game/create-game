import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://garchomp-game.github.io/create-game",
  integrations: [
    starlight({
      title: "Arena Core Docs",
      description: "Arena Core Phaser development, roadmap, and project management notes.",
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Current State", slug: "game/current-state" },
            { label: "Development Setup", slug: "development/setup" }
          ]
        },
        {
          label: "Product",
          items: [
            { label: "Game Direction", slug: "product/game-direction" },
            { label: "Core Loop", slug: "product/core-loop" },
            { label: "Long-Term Replayability", slug: "roadmap/long-term-replayability" }
          ]
        },
        {
          label: "Design",
          items: [
            { label: "Controls", slug: "design/controls" },
            { label: "Healing Pickups", slug: "design/healing-pickups" },
            { label: "Item System", slug: "design/item-system" },
            { label: "Stages and Equipment", slug: "design/stages-and-equipment" }
          ]
        },
        {
          label: "Engineering",
          items: [
            { label: "Architecture", slug: "engineering/architecture" },
            { label: "Quality Strategy", slug: "engineering/quality-strategy" }
          ]
        },
        {
          label: "Project Management",
          items: [
            { label: "Operating Model", slug: "project-management/operating-model" },
            { label: "Roadmap", slug: "project-management/roadmap" },
            { label: "Tickets", slug: "project-management/tickets" },
            { label: "Decision Log", slug: "project-management/decision-log" },
            { label: "Risk Log", slug: "project-management/risk-log" }
          ]
        },
        {
          label: "Playtest",
          items: [
            { label: "Playtest Notes", slug: "playtest/playtest-notes" },
            { label: "Balance Probe", slug: "playtest/balance-probe" }
          ]
        },
        {
          label: "Archive",
          items: [{ label: "Legacy Memo Index", slug: "archive/legacy-index" }]
        }
      ]
    })
  ]
});
