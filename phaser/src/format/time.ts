export function formatTime(elapsed: number): string {
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
