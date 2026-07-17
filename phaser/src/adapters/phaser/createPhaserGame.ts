import * as Phaser from "phaser";
import { SIMULATION_CONFIG, VIEW_CONFIG } from "../../config/gameConfig";
import { ArenaScene } from "./ArenaScene";

export type PhaserRendererPreference = "canvas" | "webgl";

export function createPhaserGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: resolvePhaserRendererType(import.meta.env.VITE_PHASER_RENDERER),
    parent,
    width: SIMULATION_CONFIG.arena.width,
    height: SIMULATION_CONFIG.arena.height,
    backgroundColor: "#111318",
    render: {
      roundPixels: true,
      preserveDrawingBuffer: shouldPreserveDrawingBuffer(),
    },
    scene: [ArenaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  const game = new Phaser.Game(config);
  game.registry.set("simulationConfig", SIMULATION_CONFIG);
  game.registry.set("viewConfig", VIEW_CONFIG);
  return game;
}

export function resolvePhaserRendererType(preference?: PhaserRendererPreference): number {
  return preference === "canvas" ? Phaser.CANVAS : Phaser.WEBGL;
}

function shouldPreserveDrawingBuffer(): boolean {
  return (
    import.meta.env.VITE_PHASER_PRESERVE_DRAWING_BUFFER === "1" &&
    new URLSearchParams(window.location.search).get("webglReadback") === "1"
  );
}
