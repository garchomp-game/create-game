import type { AutoPilotNavigationPort } from "./autoPilotContracts";
import {
  estimatePointNavigationPath,
  getPointNavigation,
  hasClearNavigationPath,
} from "./navigationField";

export const ROT_AUTO_PILOT_NAVIGATION: AutoPilotNavigationPort = {
  hasClearPath(frame, start, end, clearance) {
    return hasClearNavigationPath(start, end, clearance, frame.world.obstacles);
  },
  navigateTo(frame, target) {
    return this.navigateFrom(
      frame,
      frame.world.player.position,
      target,
      frame.config.player.radius,
    );
  },
  navigateFrom(frame, start, target, radius) {
    return getPointNavigation(
      frame.world,
      start,
      target,
      radius,
      frame.config,
    ).direction;
  },
  estimatePath(frame, start, target, radius) {
    return estimatePointNavigationPath(
      frame.world,
      start,
      target,
      radius,
      frame.config,
    );
  },
};
