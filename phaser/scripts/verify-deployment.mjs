import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const CLOUDFLARE_FREE_FILE_LIMIT = 20_000;
const CLOUDFLARE_FILE_SIZE_LIMIT = 25 * 1024 * 1024;
const DIST_DIRECTORY = path.resolve(process.cwd(), "dist");
const FORBIDDEN_FILES = [
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)logs\//,
  /(^|\/)report\d*\.md$/,
  /(^|\/)review\//,
  /\.map$/,
];
const FORBIDDEN_TEXT = [
  "__ARENA_DEBUG__",
  "VITE_ARENA_ENABLE_TEST_HOOKS",
  "applyHudStressFixture",
  "/__arena/run-export",
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".txt"]);

const files = await listFiles(DIST_DIRECTORY);
const relativeFiles = files.map((file) => path.relative(DIST_DIRECTORY, file));
const errors = [];

if (!relativeFiles.includes("index.html")) {
  errors.push("dist/index.html is missing");
}
if (!relativeFiles.includes("beta-info.html")) {
  errors.push("dist/beta-info.html is missing");
}
if (!relativeFiles.includes("third-party-notices.txt")) {
  errors.push("dist/third-party-notices.txt is missing");
}
if (!relativeFiles.includes("_headers")) {
  errors.push("dist/_headers is missing");
}
if (!relativeFiles.some((file) => file.startsWith("assets/") && file.endsWith(".js"))) {
  errors.push("the built JavaScript entry is missing");
}
if (files.length > CLOUDFLARE_FREE_FILE_LIMIT) {
  errors.push(
    `asset count ${files.length} exceeds the Cloudflare Free limit ${CLOUDFLARE_FREE_FILE_LIMIT}`,
  );
}

let totalBytes = 0;
let largestFile = { path: "", bytes: 0 };

for (const [index, file] of files.entries()) {
  const relativePath = relativeFiles[index];
  const fileStat = await stat(file);
  totalBytes += fileStat.size;

  if (fileStat.size > largestFile.bytes) {
    largestFile = { path: relativePath, bytes: fileStat.size };
  }
  if (fileStat.size > CLOUDFLARE_FILE_SIZE_LIMIT) {
    errors.push(`${relativePath} exceeds Cloudflare's 25 MiB per-file limit`);
  }
  if (FORBIDDEN_FILES.some((pattern) => pattern.test(relativePath))) {
    errors.push(`${relativePath} must not be included in the public deployment`);
  }
  if (!TEXT_EXTENSIONS.has(path.extname(relativePath))) continue;

  const content = await readFile(file, "utf8");
  for (const token of FORBIDDEN_TEXT) {
    if (content.includes(token)) {
      errors.push(`${relativePath} contains deployment-only forbidden token ${token}`);
    }
  }
}

if (relativeFiles.includes("index.html") && relativeFiles.includes("beta-info.html")) {
  const [indexHtml, betaInfoHtml] = await Promise.all([
    readFile(path.join(DIST_DIRECTORY, "index.html"), "utf8"),
    readFile(path.join(DIST_DIRECTORY, "beta-info.html"), "utf8"),
  ]);
  const indexIdentity = readReleaseIdentity(indexHtml);
  const betaInfoIdentity = readReleaseIdentity(betaInfoHtml);

  if (!indexIdentity || !betaInfoIdentity) {
    errors.push("release identity meta tags are missing from a public HTML entry");
  } else {
    if (JSON.stringify(indexIdentity) !== JSON.stringify(betaInfoIdentity)) {
      errors.push("index.html and beta-info.html expose different release identities");
    }
    if (indexIdentity.buildCommit === "unknown") {
      errors.push("public buildCommit must not be unknown");
    }
    if (!/^[0-9a-f]{7,40}$/.test(indexIdentity.buildCommit)) {
      errors.push(`public buildCommit is invalid: ${indexIdentity.buildCommit}`);
    }
    if (!/^\d+\.\d+\.\d+$/.test(indexIdentity.appVersion)) {
      errors.push(`public appVersion is invalid: ${indexIdentity.appVersion}`);
    }
    if (!indexIdentity.rulesetVersion.startsWith("phaser-v")) {
      errors.push(`public rulesetVersion is invalid: ${indexIdentity.rulesetVersion}`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`deployment verification failed: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `deployment verified: ${files.length} files, ${formatBytes(totalBytes)} total, ` +
      `largest ${largestFile.path} (${formatBytes(largestFile.bytes)})`,
  );
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat().sort();
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function readReleaseIdentity(html) {
  const readMeta = (name) =>
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`).exec(html)?.[1];
  const appVersion = readMeta("arena-app-version");
  const rulesetVersion = readMeta("arena-ruleset-version");
  const buildCommit = readMeta("arena-build-commit");
  return appVersion && rulesetVersion && buildCommit
    ? { appVersion, rulesetVersion, buildCommit }
    : null;
}
