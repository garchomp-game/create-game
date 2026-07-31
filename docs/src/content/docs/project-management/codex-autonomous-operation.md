---
title: Codex PM・サブエージェント運用
description: メインエージェントをPM兼ゲームディレクターとし、調査・実装・独立監査を安全に委譲する実行契約。
---

最終更新日: 2026-07-31

## 結論

Arena CoreのCodex作業は、次の形を標準にします。

> **単一active Issue / 単一採否 / 単一writer / PM統合**

メインエージェントはPM兼ゲームディレクターとして、目的、優先順位、分割、
採否、GitHub操作、最終報告を所有します。サブエージェントは、境界を固定した
調査、実装、独立監査を担当します。

通常のソロ開発では`main`へ小さくcommitする現行方針を維持します。
サブエージェントごとのbranch、PR、worktreeは作りません。

## 正本の分担

| 情報 | 正本 |
| --- | --- |
| 製品コンセプトと長期の設計判断 | Starlight |
| 現在の実装事実 | Starlightの「現在地」 |
| 全体順序とIssue間依存 | Starlightの「課題解決キュー」 |
| 現在着手する一件の実行契約と進捗 | GitHub Issue |
| 実装中の短期事実 | Issueコメントまたは作業メモの一方 |
| 採用・棄却後の永続判断 | Starlightのdecision / risk /対象設計 |
| commit、CI、公開候補の証拠 | Git / GitHub Actions / 配布Version |

IssueとStarlightが競合する場合、実装を始めません。PMが両方を読み、
より新しい採用判断と対象範囲を確認して矛盾を解消します。

## 役割

### メインエージェント: PM兼ゲームディレクター

- active Issueと依存を確認する。
- プレイヤーへ与える変化と、今回の採否を一件に絞る。
- サブエージェントの所有ファイルと対象外を決める。
- 調査結果を統合し、実装する候補を選ぶ。
- 候補を固定し、独立監査の結果から修正または停止を決める。
- 現在の依頼で許可された範囲のcommit、push、GitHub mutation、文書同期、
  完了報告を行う。

実装workerが稼働中はworkerだけがworkspaceへ書きます。PMと他のagentは
非重複ファイルを含めてworkspaceを編集せず、読取調査だけを並行します。

### `researcher`: 調査

- コード経路、現行仕様、テスト、Starlight、必要な一次資料を読む。
- 事実、解釈、選択肢、リスク、未知点を分ける。
- ファイル、symbol、コマンド、Issueなど具体的な根拠を返す。
- 編集、製品判断、GitHub mutationは行わない。

### `worker`: 実装

- PMが固定した一件のGoal Contractだけを実装する。
- 明示されたファイルだけを所有し、関係のない変更を残す。
- 変更中のCheckpoint QAを実行する。
- 受け入れ条件、依存、schema、公開API、製品方針の変更が必要なら停止する。
- commit、push、branch作成、Issue更新は行わない。

### `auditor`: 独立監査

- worker停止後の固定差分を、受け入れ条件、退行、設計境界、テスト不足、
  rollback、文書ずれの観点から読む。
- 重大度順の具体的な指摘と、`pass / changes-required / human-gate-required`
  の判定を返す。
- 自分で修正せず、製品判断やGitHub mutationを行わない。

## Goal Contract

PMはworkerへ渡す前に、次を固定します。

| 項目 | 必須内容 |
| --- | --- |
| プレイヤー課題 | 誰が何に困り、何を変えるか |
| 今回の採否 | 採用、調整、棄却できる一件 |
| baseline | 比較元のSHA、Version、ruleset、fixture |
| 対象 | 変更する責務、画面、モード、ファイル |
| 対象外 | 混ぜない隣接機能と数値 |
| 完了条件 | 観測可能な受け入れ条件 |
| QA段階 | Checkpoint / Slice / Adoptionのどこまで行うか |
| rollback | feature flag、commit、Versionなどの戻し方 |
| 停止条件 | PMまたは人間判断へ戻す条件 |
| 書込権限 | `local-only` / `commit` / `push-main` / `GitHub Issue・Project`の許可範囲 |

この情報がないIssueは、着手可能とみなしません。
利用可能な資格情報やrepository権限は、現在の依頼における書込許可を意味しません。
明示または合理的に含まれる範囲を越える場合、ローカルcandidateで停止して確認します。

## 標準実行ループ

1. PMがgit状態、active Issue、関連Starlight、依存、CIを確認する。
2. PMがGoal Contract、書込権限、単一のwriter範囲を固定する。
3. `researcher`へ独立した読取調査を必要に応じて並行委譲する。
4. PMが証拠を統合し、候補を一件に絞る。
5. `worker`一体だけが実装し、Checkpoint QAを行う。
6. PMがworkerを止め、Checkpoint結果、意図しない差分、必要なcandidate文書を確認する。
7. PMが`main`へローカルcandidate commitを作り、base SHAとcandidate SHAを固定する。
8. `auditor`がその二つのSHAの差分を独立監査する。
9. 重大指摘は同じGoal Contractのworkerへ限定修正として戻し、新candidate SHAで
   Checkpointと監査を繰り返す。
10. PMが監査済みcandidate SHAへSlice / Adoption QAと必要な直接観察を行う。
11. 書込権限に`push-main`が含まれる場合だけpushし、main CIを確認する。
12. 人間gateを含む採否後にStarlight、decision、risk、Issueを必要分だけ同期し、
    許可範囲内で証拠commitをpushする。
13. Issueを閉じる権限がある場合だけ証拠を残して閉じ、次の一件をactiveへ昇格する。

読取調査は並行化できます。workspaceへ書くagentは常に一体です。
worker稼働中はPMも書きません。監査とcandidate QA中はcandidate SHAを変更しません。

## Definition of Ready

- active Issueが一件だけである。
- Goal Contract、依存、非スコープ、停止条件が明確である。
- 正本間に未解決の矛盾がない。
- writerの所有ファイルが宣言されている。
- baselineと最小QAが再現できる。
- 現在の依頼で許可されたlocal / Git / GitHub書込範囲が明確である。

## Definition of Candidate

- 受け入れ条件を満たす実装またはdocs差分がある。
- Checkpoint / Slice QAがgreenである。
- auditorの重大指摘が解消されている。
- 意図しないファイル、生成物、runtime変更がない。
- 比較条件、base SHA、ローカルcandidate commit SHAが固定されている。
- 書込権限が不足する場合、必要な権限と安全な再開点を報告して停止している。

## Definition of Done

- 必要なCandidate / Adoption QAがgreenである。
- ゲーム体験を変えた場合、必要な人間または直接観察を完了している。
- Starlight、decision、riskを必要な範囲だけ同期している。
- 現在の依頼が`push-main`を許可する場合、`main`へpush済みで対象CIがgreenである。
- 現在の依頼がGitHub Issue mutationを許可する場合、証拠を残してIssueをcloseしている。
- 次の`status:next`が一件だけである。

人間プレイが必要で未実施の場合は、`Candidate / awaiting-human`です。
自動テストがgreenでも`Done`とは呼びません。

## 停止条件

次の場合、サブエージェントは編集を止めてPMへ返します。

- 目的、対象、受け入れ条件を変える必要がある。
- 新しい依存、schema、公開API、ruleset変更が必要である。
- 数値またはデザイン候補を2回試しても採用根拠がない。
- 自動結果と人間の観察が矛盾する。
- 別writerが所有ファイルへ変更を始めた。
- ユーザー、外部レビュー、実機、資格情報など新しい権限・判断が必要である。
- Issue、Starlight、実装済み事実が競合する。

停止報告には、完了したこと、証拠、残作業、必要な判断、安全な再開点を含めます。

## Git運用

- 通常は`main`を唯一の常用branchとする。
- active Issueへ紐付く小さな意味単位でcommitする。
- Checkpoint後にローカルcandidate commitを作り、そのSHAへ監査と候補QAを結び付ける。
- push前に対象QA、`git diff --check`、意図しない差分を確認する。
- push後のmain CIを共有証跡とする。
- PRを使う明確な理由がある場合だけ、1 Issue / 1短命branch / 1 PRとする。
- サブエージェントはcommit、push、branch、PR、Issueを操作しない。
- 資格情報が利用可能でも、現在の依頼で許可されていないpushやGitHub mutationは行わない。

詳細は[運用方針](../operating-model/)と
[Ultra自律開発運用](../ultra-workflow/)を参照してください。

## リポジトリ内の構成

- `AGENTS.md`: すべてのCodex実行へ自動読込する耐久ルール。
- `.codex/config.toml`: 同時subagent数などのプロジェクト設定。
- `.codex/agents/researcher.toml`: 読取専用の調査役。
- `.codex/agents/worker.toml`: 単一範囲の実装役。
- `.codex/agents/auditor.toml`: 読取専用の独立監査役。

custom agent設定はローカルCodexクライアント向けです。ChatGPT Workを含む環境差が
あるため、権限設定だけに競合防止を依存せず、`AGENTS.md`の単一writer規則を
常に優先します。

### 有効化確認

project-local `.codex/`は、Codexクライアントでこのrepositoryをtrusted projectとして
開いた場合に使います。設定追加後は新しいCodexセッションを開始し、次を確認します。

1. `codex status`でworkspace rootがこのrepositoryである。
2. project instructionsとしてroot `AGENTS.md`が読み込まれている。
3. `researcher`、`worker`、`auditor`がcustom agentとして列挙される。
4. researcher / auditorがread-only、workerがworkspace-writeとして開始する。

このsmokeができない環境では、TOML構文の合格だけをagent有効化の証拠にせず、
最初のローカルCodexセッションで確認する未完了gateとして残します。

## 最小検証

docsと設定だけを変えた場合:

```bash
git diff --check
cd docs
npm run build
```

TOMLはPython 3.11以降の`tomllib`などで構文確認します。新しいtrusted Codex
セッションでは、rootと`phaser/`の両方から、読み込んだ指示と利用可能なcustom agentを
読取専用で要約させます。

runtimeを変えていないdocs-only候補で、全E2Eや長時間GPU耐久を再実行しません。
