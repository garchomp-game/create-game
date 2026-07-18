import { describe, expect, it } from "vitest";

const coreSources = import.meta.glob(
  ["../domain/**/*.ts", "../simulation/**/*.ts", "!../**/*.test.ts"],
  { eager: true, import: "default", query: "?raw" },
) as Record<string, string>;

const presentationSources = import.meta.glob(
  ["./**/*.ts", "!./**/*.test.ts"],
  { eager: true, import: "default", query: "?raw" },
) as Record<string, string>;

describe("presentation layer boundaries", () => {
  it("keeps domain and simulation independent from UI layers", () => {
    expect(findImports(coreSources, /(?:presentation|adapters)(?:\/|["'])/)).toEqual([]);
  });

  it("keeps presentation independent from Phaser and adapters", () => {
    expect(findImports(presentationSources, /(?:phaser|adapters)(?:\/|["'])/i)).toEqual([]);
  });
});

function findImports(
  sources: Record<string, string>,
  forbiddenPath: RegExp,
): string[] {
  const importPattern = /(?:from\s+|import\s*\()["']([^"']+)["']/g;
  const violations: string[] = [];
  for (const [file, source] of Object.entries(sources)) {
    for (const match of source.matchAll(importPattern)) {
      const importedPath = match[1]!;
      if (forbiddenPath.test(importedPath)) violations.push(`${file} -> ${importedPath}`);
    }
  }
  return violations.sort();
}
