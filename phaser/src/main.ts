import {
  readDesktopDeviceSignals,
  shouldBlockGameDevice,
  showDesktopOnlyGate,
} from "./adapters/dom/DesktopOnlyGate";
import "./arena.css";

const gameRoot = document.querySelector<HTMLElement>("#game");

if (!gameRoot) {
  throw new Error("Arena Core game root was not found");
}

if (shouldBlockGameDevice(readDesktopDeviceSignals())) {
  showDesktopOnlyGate(gameRoot);
} else {
  void import("./adapters/phaser/createPhaserGame").then(({ createPhaserGame }) => {
    createPhaserGame(gameRoot.id);
  });
}
