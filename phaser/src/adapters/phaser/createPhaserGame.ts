import Phaser from "phaser";
import { SIMULATION_CONFIG, VIEW_CONFIG } from "../../config/gameConfig";
import { ArenaScene } from "./ArenaScene";

export function createPhaserGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    parent,
    width: SIMULATION_CONFIG.arena.width,
    height: SIMULATION_CONFIG.arena.height,
    backgroundColor: "#111318",
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
