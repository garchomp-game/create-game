import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const prototypeDist = path.resolve(process.cwd(), "dist");
const productionDist = path.resolve(process.cwd(), "../phaser/dist");
const prototypeMarkers = ["UI STUDIES", "arena-boss-salvo", "data-prototype-canvas"];

const prototypeFiles = await listFiles(prototypeDist);
const productionFiles = await listFiles(productionDist);
const errors = [];

if (!prototypeFiles.some((file) => path.basename(file) === "index.html")) {
  errors.push("prototype dist/index.html is missing");
}

for (const file of productionFiles) {
  if ((await stat(file)).size > 5 * 1024 * 1024) continue;
  const extension = path.extname(file);
  if (![".html", ".js", ".css", ".json", ".txt"].includes(extension)) continue;
  const content = await readFile(file, "utf8");
  for (const marker of prototypeMarkers) {
    if (content.includes(marker)) {
      errors.push(`${path.relative(productionDist, file)} contains prototype marker ${marker}`);
    }
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`prototype isolation failed: ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `prototype isolation verified: ${prototypeFiles.length} prototype files, ` +
      `${productionFiles.length} production files`,
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
