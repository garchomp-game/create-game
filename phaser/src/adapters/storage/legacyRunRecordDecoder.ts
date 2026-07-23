import {
  runRecordV2Schema,
  type RunRecordV2,
} from "../../domain/runRecords";

export type LegacyCollectionDecode =
  | { status: "missing" }
  | { status: "invalid"; diagnostic: string }
  | {
      status: "partial";
      validRecords: RunRecordV2[];
      rejectedCount: number;
    }
  | {
      status: "complete";
      validRecords: RunRecordV2[];
      orderedIds: string[];
    };

export type LegacyEnvelopeDecodeResult = {
  source: "v1" | "v2";
  history: LegacyCollectionDecode;
  rankings: LegacyCollectionDecode;
};

export function decodeV2EnvelopeRaw(
  raw: string | null,
): LegacyEnvelopeDecodeResult {
  if (raw === null) return missingEnvelope("v2");
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) {
    return invalidEnvelope("v2", envelope.error);
  }
  if (
    envelope.value.schemaVersion !== 2 ||
    !Array.isArray(envelope.value.history) ||
    !Array.isArray(envelope.value.rankings)
  ) {
    return invalidEnvelope(
      "v2",
      "Unsupported or invalid v2 run record envelope.",
    );
  }
  return {
    source: "v2",
    history: decodeCollection(envelope.value.history),
    rankings: decodeCollection(envelope.value.rankings),
  };
}

export function decodeV1EnvelopeRaw(
  raw: string | null,
): LegacyEnvelopeDecodeResult {
  if (raw === null) return missingEnvelope("v1");
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) {
    return invalidEnvelope("v1", envelope.error);
  }
  if (
    envelope.value.schemaVersion !== 1 ||
    !Array.isArray(envelope.value.records)
  ) {
    return invalidEnvelope(
      "v1",
      "Unsupported or invalid v1 run record envelope.",
    );
  }
  const collection = decodeCollection(envelope.value.records);
  return {
    source: "v1",
    history: cloneCollection(collection),
    rankings: cloneCollection(collection),
  };
}

function decodeCollection(candidates: unknown[]): LegacyCollectionDecode {
  const validRecords: RunRecordV2[] = [];
  let rejectedCount = 0;
  for (const candidate of candidates) {
    const parsed = runRecordV2Schema.safeParse(candidate);
    if (parsed.success) validRecords.push(parsed.data);
    else rejectedCount += 1;
  }
  if (rejectedCount > 0) {
    return {
      status: "partial",
      validRecords,
      rejectedCount,
    };
  }
  return {
    status: "complete",
    validRecords,
    orderedIds: validRecords.map((record) => record.id),
  };
}

function parseEnvelope(
  raw: string,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isObject(value)) {
      return {
        ok: false,
        error: "Run record envelope must be an object.",
      };
    }
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function missingEnvelope(
  source: "v1" | "v2",
): LegacyEnvelopeDecodeResult {
  return {
    source,
    history: { status: "missing" },
    rankings: { status: "missing" },
  };
}

function invalidEnvelope(
  source: "v1" | "v2",
  diagnostic: string,
): LegacyEnvelopeDecodeResult {
  return {
    source,
    history: { status: "invalid", diagnostic },
    rankings: { status: "invalid", diagnostic },
  };
}

function cloneCollection(
  collection: LegacyCollectionDecode,
): LegacyCollectionDecode {
  return structuredClone(collection);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
