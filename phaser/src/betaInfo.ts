import "./beta-info.css";

const appVersion = import.meta.env.VITE_APP_VERSION;
const rulesetVersion = import.meta.env.VITE_RULESET_VERSION;
const buildCommit = import.meta.env.VITE_GIT_COMMIT || "unknown";

setText("app-version", appVersion);
setText("ruleset-version", rulesetVersion);
setText("build-commit", buildCommit);
configureFeedbackLink();
configureLocalDataDeletion();

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function configureFeedbackLink(): void {
  const link = document.getElementById("feedback-link");
  if (!(link instanceof HTMLAnchorElement)) return;

  const body = [
    `- appVersion: ${appVersion}`,
    `- rulesetVersion: ${rulesetVersion}`,
    `- buildCommit: ${buildCommit}`,
    "- seed:",
    "- ブラウザ / OS:",
    "- 問題:",
    "- 再現手順:",
    "- ランJSONまたはリザルト:",
  ].join("\n");
  const url = new URL("https://github.com/garchomp-game/create-game/issues/new");
  url.searchParams.set("labels", "bug");
  url.searchParams.set("title", "[Playtest] ");
  url.searchParams.set("body", body);
  link.href = url.toString();
}

function configureLocalDataDeletion(): void {
  const button = document.getElementById("clear-local-data");
  const status = document.getElementById("clear-local-data-status");
  if (!(button instanceof HTMLButtonElement) || !status) return;

  let confirmationPending = false;
  button.addEventListener("click", () => {
    if (!confirmationPending) {
      confirmationPending = true;
      button.textContent = "もう一度押して削除";
      status.textContent = "このブラウザにあるArena Coreのデータをすべて削除します。";
      return;
    }

    const keys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    ).filter((key): key is string => key?.startsWith("arena-core.") === true);
    for (const key of keys) localStorage.removeItem(key);

    confirmationPending = false;
    button.textContent = "削除済み";
    button.disabled = true;
    status.textContent = `${keys.length}件の端末内データを削除しました。ゲームへ戻ると新しいゲストIDを作成します。`;
  });
}
