export function formatTime(elapsed: number): string {
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatTimePrecise(elapsed: number): string {
  const centiseconds = Math.max(0, Math.round(elapsed * 100));
  const minutes = Math.floor(centiseconds / 6000).toString().padStart(2, "0");
  const seconds = Math.floor((centiseconds % 6000) / 100)
    .toString()
    .padStart(2, "0");
  const fraction = (centiseconds % 100).toString().padStart(2, "0");
  return `${minutes}:${seconds}.${fraction}`;
}
