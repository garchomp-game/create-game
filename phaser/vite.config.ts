import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { resolveBuildReleaseIdentity } from "./src/config/version";
import {
  createRunSummaryRow,
  serializeRunSummary,
  type RunSummaryRow,
} from "./src/adapters/telemetry/RunSummary";

const RUN_EXPORT_ENDPOINT = "/__arena/run-export";
const MAX_RUN_EXPORT_BYTES = 2 * 1024 * 1024;
const MAX_RUN_EXPORT_FILES = { manual: 200, debug: 100, test: 20 } as const;
const BUILD_COMMIT = readBuildCommit();
const BUILD_RELEASE_IDENTITY = resolveBuildReleaseIdentity(
  process.env.VITE_ARENA_EX_PROTOCOL_CANDIDATE === "1",
);
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

function arenaReleaseIdentityPlugin(): Plugin {
  return {
    name: "arena-release-identity",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            name: "arena-app-version",
            content: BUILD_RELEASE_IDENTITY.appVersion,
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: {
            name: "arena-ruleset-version",
            content: BUILD_RELEASE_IDENTITY.rulesetVersion,
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "arena-build-commit", content: BUILD_COMMIT },
          injectTo: "head",
        },
      ];
    },
  };
}

function arenaRunExportLogPlugin(): Plugin {
  return {
    name: "arena-run-export-log",
    configureServer(server) {
      const manualRunDirectory = path.join(server.config.root, "logs", "runs");
      void writeRunSummaryFiles(manualRunDirectory).catch((error) => {
        server.config.logger.warn(`Run summaries could not be refreshed: ${getErrorMessage(error)}`);
      });

      server.middlewares.use(RUN_EXPORT_ENDPOINT, async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.setHeader("Allow", "POST");
          response.end("Method Not Allowed");
          return;
        }

        try {
          const rawBody = await readRequestBody(request);
          const runExport = validateRunExport(JSON.parse(rawBody) as unknown);
          const filename = createRunExportFilename(runExport);
          const directory =
            runExport.runOrigin === "manual"
              ? "runs"
              : runExport.runOrigin === "debug"
                ? "debug"
                : "tests";
          const relativePath = path.join("logs", directory, filename);
          const outputPath = path.join(server.config.root, relativePath);

          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, `${JSON.stringify(runExport, null, 2)}\n`, "utf8");
          try {
            await pruneRunExportLogs(
              path.dirname(outputPath),
              MAX_RUN_EXPORT_FILES[runExport.runOrigin],
            );
          } catch (error) {
            server.config.logger.warn(
              `Run export saved, but retention cleanup failed: ${getErrorMessage(error)}`,
            );
          }
          if (runExport.runOrigin === "manual") {
            try {
              await writeRunSummaryFiles(path.dirname(outputPath));
            } catch (error) {
              server.config.logger.warn(
                `Run export saved, but summaries could not be refreshed: ${getErrorMessage(error)}`,
              );
            }
          }

          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ ok: true, path: relativePath }));
        } catch (error) {
          response.statusCode = error instanceof PayloadTooLargeError ? 413 : 400;
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify({
              ok: false,
              error: getErrorMessage(error),
            }),
          );
        }
      });
    },
  };
}

function readRequestBody(request: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    request.on("data", (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.byteLength;
      if (size > MAX_RUN_EXPORT_BYTES) {
        rejected = true;
        reject(new PayloadTooLargeError("Run export payload is too large."));
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function createRunExportFilename(runExport: unknown): string {
  const item = isRecord(runExport) ? runExport : {};
  const resultSummary = isRecord(item.resultSummary) ? item.resultSummary : {};
  const capturedAt =
    typeof item.capturedAt === "string" ? item.capturedAt : new Date().toISOString();
  const score = typeof resultSummary.score === "number" ? resultSummary.score : "unknown";
  const elapsed =
    typeof resultSummary.elapsed === "number"
      ? `${Math.round(resultSummary.elapsed)}s`
      : "unknown-elapsed";
  const runOrigin =
    item.runOrigin === "manual" || item.runOrigin === "debug" || item.runOrigin === "test"
      ? item.runOrigin
      : "unknown-origin";
  const safeTimestamp = capturedAt.replace(/[^\dA-Za-z-]/g, "-");

  return `${safeTimestamp}_${runOrigin}_score-${score}_elapsed-${elapsed}.json`;
}

async function pruneRunExportLogs(directory: string, limit: number): Promise<void> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const expired = files.slice(0, Math.max(0, files.length - limit));
  await Promise.all(expired.map((file) => unlink(path.join(directory, file))));
}

async function writeRunSummaryFiles(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const rows: RunSummaryRow[] = [];

  for (const file of files) {
    try {
      const value = JSON.parse(await readFile(path.join(directory, file), "utf8")) as unknown;
      const row = createRunSummaryRow(value);
      if (row) rows.push(row);
    } catch {
      // A damaged historical log must not block new run persistence.
    }
  }

  await Promise.all([
    writeTextFileAtomically(path.join(directory, "summary.csv"), serializeRunSummary(rows, "csv")),
    writeTextFileAtomically(path.join(directory, "summary.tsv"), serializeRunSummary(rows, "tsv")),
  ]);
}

async function writeTextFileAtomically(outputPath: string, content: string): Promise<void> {
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, outputPath);
}

function readBuildCommit(): string {
  if (process.env.VITE_GIT_COMMIT) return process.env.VITE_GIT_COMMIT;

  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type ValidRunExport = Record<string, unknown> & {
  runOrigin: "manual" | "debug" | "test";
};

function validateRunExport(value: unknown): ValidRunExport {
  if (!isRecord(value)) throw new Error("Run export must be an object.");
  if (value.game !== "arena-core-phaser") throw new Error("Unknown game identifier.");
  if (typeof value.appVersion !== "string" || value.appVersion.length === 0) {
    throw new Error("Run export appVersion is required.");
  }
  if (typeof value.rulesetVersion !== "string" || value.rulesetVersion.length === 0) {
    throw new Error("Run export rulesetVersion is required.");
  }
  if (value.runOrigin !== "manual" && value.runOrigin !== "debug" && value.runOrigin !== "test") {
    throw new Error("Run export runOrigin is invalid.");
  }
  if (!isRecord(value.resultSummary)) throw new Error("Run export resultSummary is required.");
  if (
    typeof value.resultSummary.score !== "number" ||
    !Number.isFinite(value.resultSummary.score) ||
    typeof value.resultSummary.elapsed !== "number" ||
    !Number.isFinite(value.resultSummary.elapsed)
  ) {
    throw new Error("Run export score and elapsed must be finite numbers.");
  }
  return value as ValidRunExport;
}

class PayloadTooLargeError extends Error {}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to save run export.";
}

export default defineConfig({
  plugins: [arenaReleaseIdentityPlugin(), arenaRunExportLogPlugin()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      BUILD_RELEASE_IDENTITY.appVersion,
    ),
    "import.meta.env.VITE_RULESET_VERSION": JSON.stringify(
      BUILD_RELEASE_IDENTITY.rulesetVersion,
    ),
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(BUILD_COMMIT),
  },
  build: {
    rollupOptions: {
      input: {
        game: path.join(PROJECT_ROOT, "index.html"),
        betaInfo: path.join(PROJECT_ROOT, "beta-info.html"),
      },
    },
  },
});
