import type { RunOrigin, SeedCategory } from "../domain/runRecords";

export function resolveRunOrigin(search: string, automated: boolean): RunOrigin {
  if (automated) return "test";
  const requestedOrigin = new URLSearchParams(search).get("runOrigin");
  if (requestedOrigin === "debug" || requestedOrigin === "test") return requestedOrigin;
  return "manual";
}

export function resolveSeedCategory(fixedSeed: number | null): SeedCategory {
  return fixedSeed === null ? "random" : "fixed";
}
