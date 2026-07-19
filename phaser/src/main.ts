import { applyArenaDomTheme } from "./adapters/dom/applyArenaDomTheme";
import { createPhaserGame } from "./adapters/phaser/createPhaserGame";
import "./arena.css";

applyArenaDomTheme();
createPhaserGame("game");
