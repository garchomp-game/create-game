import { describe, expect, it, vi } from "vitest";
import type { ArenaRunExport } from "../phaser/ArenaDebugBridge";
import { DevRunExportClient } from "./DevRunExportClient";

describe("DevRunExportClient", () => {
  it("posts the run export as JSON", async () => {
    const fetchRunExport = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, path: "logs/runs/run.json" }),
    }));
    const client = new DevRunExportClient(fetchRunExport);
    const runExport = { game: "arena-core-phaser" } as ArenaRunExport;

    await expect(client.submit(runExport)).resolves.toEqual({
      ok: true,
      path: "logs/runs/run.json",
    });
    expect(fetchRunExport).toHaveBeenCalledWith("/__arena/run-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runExport),
    });
  });

  it("returns a stable failure result for HTTP and transport errors", async () => {
    const rejected = new DevRunExportClient(async () => ({
      ok: false,
      json: async () => ({ ok: false, error: "invalid run" }),
    }));
    await expect(rejected.submit({} as ArenaRunExport)).resolves.toEqual({
      ok: false,
      error: "invalid run",
    });

    const failed = new DevRunExportClient(async () => {
      throw new Error("offline");
    });
    await expect(failed.submit({} as ArenaRunExport)).resolves.toEqual({
      ok: false,
      error: "offline",
    });
  });

  it("rejects malformed response payloads", async () => {
    const client = new DevRunExportClient(async () => ({
      ok: true,
      json: async () => ({ path: 42 }),
    }));

    await expect(client.submit({} as ArenaRunExport)).resolves.toEqual({
      ok: false,
      error: "Run export logging returned an invalid response.",
    });
  });
});
