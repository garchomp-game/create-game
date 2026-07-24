import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function canonicalizeStudyDefinition(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeStudyDefinition(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeStudyDefinition(value[key])}`
      )
      .join(",")}}`;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return JSON.stringify(value);
  }
  throw new Error(`unsupported canonical value type: ${typeof value}`);
}

export function digestStudyDefinition(definition) {
  const canonical = canonicalizeStudyDefinition(definition);
  return `sha256:${crypto.createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const definitionPath = process.argv[2];
  if (!definitionPath) {
    console.error("Usage: node scripts/study-definition-digest.mjs <study-definition.json>");
    process.exit(2);
  }
  try {
    const definition = JSON.parse(fs.readFileSync(definitionPath, "utf8"));
    console.log(digestStudyDefinition(definition));
  } catch (error) {
    console.error(`Study definition digest failed: ${error.message}`);
    process.exit(1);
  }
}
