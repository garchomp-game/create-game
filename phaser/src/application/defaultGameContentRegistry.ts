import { GAME_CONTENT_DEFINITIONS } from "../content/gameContentCatalog";
import { GameContentRegistry } from "./GameContentRegistry";

export const DEFAULT_GAME_CONTENT_REGISTRY = new GameContentRegistry(
  GAME_CONTENT_DEFINITIONS,
);
