export function getProtocolFocusTriggerStacks(
  maximumStacks: number,
  stacksBelowMaximum: number,
): number {
  if (maximumStacks <= 0) return 0;
  return Math.max(1, maximumStacks - stacksBelowMaximum);
}
