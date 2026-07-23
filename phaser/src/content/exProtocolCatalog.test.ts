import { describe, expect, it } from "vitest";
import rawCatalog from "./ex-protocols.v1.json" with { type: "json" };
import {
  EX_PROTOCOL_CATALOG,
  getCompatibleExProtocols,
  getExProtocolDefinition,
  parseExProtocolCatalog,
} from "./exProtocolCatalog";

describe("EX Protocol catalog", () => {
  it("parses the handed-off catalog as six closed definitions", () => {
    expect(parseExProtocolCatalog(rawCatalog)).toEqual(EX_PROTOCOL_CATALOG);
    expect(EX_PROTOCOL_CATALOG.protocols).toHaveLength(6);
    expect(getCompatibleExProtocols("pulse")).toHaveLength(3);
    expect(getCompatibleExProtocols("spread")).toHaveLength(3);
    expect(getCompatibleExProtocols("pierce")).toEqual([]);
  });

  it("resolves every catalog ID without introducing a second ID registry", () => {
    for (const protocol of EX_PROTOCOL_CATALOG.protocols) {
      expect(getExProtocolDefinition(protocol.id)).toEqual(protocol);
    }
    expect(getExProtocolDefinition("pulse.unknown")).toBeNull();
  });

  it("rejects unknown fields at every protocol-specific boundary", () => {
    const invalid = structuredClone(rawCatalog) as unknown as {
      protocols: Array<{ signature: Record<string, unknown> }>;
    };
    invalid.protocols[0]?.signature &&
      (invalid.protocols[0].signature.unknownScalar = 1);

    expect(() => parseExProtocolCatalog(invalid)).toThrow();
  });

  it("keeps the fixed offer policy deterministic", () => {
    expect(EX_PROTOCOL_CATALOG.offerPolicy).toEqual({
      initial: "fixed-all-compatible",
      consumeRng: false,
      training: "disabled",
      unsupportedWeapon: "skip-to-limit-break",
    });
    expect(EX_PROTOCOL_CATALOG.progression).toEqual({
      normalCoreRanks: 25,
      signatureExLevel: 0,
      evolutionOneExLevel: 1,
      evolutionTwoExLevel: 2,
      masteryUnlock: "with-evolution-two",
      limitBreakStartsAtExLevel: 3,
    });
  });
});
