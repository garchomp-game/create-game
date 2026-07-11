import type { ArenaRunExport } from "../phaser/ArenaDebugBridge";

export type DevRunExportResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

type FetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

type FetchRunExport = (
  input: string,
  init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<FetchResponse>;

export class DevRunExportClient {
  constructor(
    private readonly fetchRunExport: FetchRunExport = (input, init) => fetch(input, init),
  ) {}

  async submit(runExport: ArenaRunExport): Promise<DevRunExportResult> {
    try {
      const response = await this.fetchRunExport("/__arena/run-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runExport),
      });
      const payload = await response.json();
      if (!isDevRunExportResult(payload)) {
        throw new Error("Run export logging returned an invalid response.");
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Run export logging failed.");
      }
      return payload;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function isDevRunExportResult(value: unknown): value is DevRunExportResult {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.ok === "boolean" &&
    (item.path === undefined || typeof item.path === "string") &&
    (item.error === undefined || typeof item.error === "string")
  );
}
