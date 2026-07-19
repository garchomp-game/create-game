import { toRunCentiseconds } from "../domain/runRecords";

export function formatTime(elapsed: number): string {
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatTimePrecise(elapsed: number): string {
  return formatRunCentiseconds(toRunCentiseconds(elapsed));
}

export function formatRunCentiseconds(centiseconds: number): string {
  const normalized = Math.max(0, Math.round(centiseconds));
  const minutes = Math.floor(normalized / 6000).toString().padStart(2, "0");
  const seconds = Math.floor((normalized % 6000) / 100)
    .toString()
    .padStart(2, "0");
  const fraction = (normalized % 100).toString().padStart(2, "0");
  return `${minutes}:${seconds}.${fraction}`;
}
