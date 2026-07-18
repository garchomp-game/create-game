import type { BossAttackId } from "../domain/types";

export function formatRecordDate(capturedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(capturedAt);
  if (!match) return capturedAt.slice(0, 16);
  return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
}

export function formatModeName(modeId: string | null | undefined): string {
  if (modeId === "expedition") return "最終遠征";
  if (modeId === "endless") return "エンドレス";
  return modeId ?? "未選択";
}

export function formatStageName(stageId: string | null | undefined): string {
  if (stageId === "final-expedition") return "第10ステージ 最終遠征";
  if (stageId === "arena-default") return "標準アリーナ";
  return stageId ?? "未選択";
}

export function formatActName(actId: string | null): string {
  const names: Record<string, string> = {
    "perimeter-watch": "Act 1 四方警戒",
    "first-assault": "Act 2 重装襲来",
    counterattack: "Act 3 反撃",
    breakthrough: "Act 4 包囲突破",
    "command-ship": "Act 5 最終決戦",
  };
  return actId ? (names[actId] ?? actId) : "未到達";
}

export function formatBossAttack(attackId: BossAttackId | null): string {
  if (attackId === "targeted-salvo") return "照準斉射";
  if (attackId === "escort-pincer") return "挟撃護衛";
  if (attackId === "command-pulse") return "制圧衝撃波";
  return "未実行";
}
