---
title: GitHub mutation dry-run台帳
description: Issue、PR、branch、Cloudflareへ予定する外部変更を、実行前に一件ずつ固定する台帳。
---

最終整理日: 2026-07-24

## 実行前header

| 項目 | 値 |
| --- | --- |
| observed at | 2026-07-24 JST |
| repository | `garchomp-game/create-game` |
| default branch | `main` |
| default branch SHA | `565d401a92f661cff9a4936cee2ebf2c9420d5c3` |
| operator | active account `garchomp-game` |
| scope | #113修復、旧PR整理計画、C2 / UI source保全 |
| explicitly authorized actions | ローカル調査、実装、テスト、文書更新 |
| excluded actions | push、PR / Issue更新、close、merge、deploy、traffic変更 |
| dirty worktree | 元worktreeはdirty。専用repair worktreeで分離 |
| local-only source | #113 repair tested HEAD `f35cb1227d3b`、EX C2、C2 UI |

この台帳は予定であり、実行指示ではありません。対象ごとの明示承認、前提、exact SHAを再確認するまで全行`pending`です。

## Mutation一覧

| ID | 対象 | 予定操作 | 前提 | rollback / recovery | 状態 |
| --- | --- | --- | --- | --- | --- |
| M-001 | branch `agent/v08-observation-control-integration` | tested HEAD `f35cb1227d3b`以降のevidence-sync HEADをfast-forward push | T2 / T3合格、旧headがancestor、承認 | 旧head `87d117e`を記録し、追加commitをrevert | pending |
| M-002 | PR #113 | 本文へbase、repair SHA、QA、Preview、人間gateを同期 | M-001、current HEAD証拠 | 更新前本文を保存 | pending |
| M-003 | PR #113 | Draft解除 / review依頼 | CI、T3 / T4、人間gate、P0 / P1なし | Draftへ戻す | pending |
| M-004 | PR #113 | mainへmerge | review承認、latest main、required checks | merge commitをrevertし、productionは維持 | pending |
| M-005 | PR #105 | superseded close | M-004と機能trace | branchとPR履歴を保持しreopen可能 | pending |
| M-006 | PR #106 | superseded close | M-004と機能trace | 同上 | pending |
| M-007 | PR #107 | superseded close | M-004とRun Outcome接続確認 | 同上 | pending |
| M-008 | PR #108 | superseded close | M-004とchoice queue確認 | 同上 | pending |
| M-009 | PR #109 | superseded close | M-004とBoss shadow確認 | 同上 | pending |
| M-010 | PR #111 | superseded close | M-004とrelief shadow確認 | 同上 | pending |
| M-011 | Issue #110 | completed close | #113 merge、export、test、人間gate | reopenし残scopeを分離 | pending |
| M-012 | Issue #112 | completed close | #113 merge、canonical evidence | 同上 | pending |
| M-013 | branch `feat/v08-ex-protocols-c1` | post-#113 mainへ統合してpush | M-004、C2 T2、schema / PB確認 | local source `3c449688`を保持 | pending |
| M-014 | C2本体PR | main向けDraft PR作成 | M-013、UI差分なし | PR close、branch保持 | pending |
| M-015 | branch `feat/v08-ex-protocols-c2-ui` | C2をbaseにUI差分をpush | M-014、`b453d82636c7`再現、UI-only証拠 | local sourceとartifact hashを保持 | pending |
| M-016 | C2 UI PR | C2向けstacked Draft PR作成 | M-015、#70受入条件、fresh Preview | PR close、branch保持 | pending |
| M-017 | PR #84 | superseded close | M-016と有効な履歴移植 | reopen可能、branch保持 | pending |
| M-018 | PR #69 | historical close | ADRと責務境界を新正本から参照 | reopen可能、branch保持 | pending |
| M-019 | PR #71 | historical close | 比較prototypeと画像を参照可能 | 同上 | pending |
| M-020 | Issue #68 | Presenter / token残scopeへ更新 | M-016の責務境界確定 | 更新前本文を保存 | pending |
| M-021 | Issue #70 | 新Choice UI PRと採否gateへ更新 | M-016 | 同上 | pending |
| M-022 | Issue #77 | Phase 0完了と残scopeを分離 | M-004 | 同上 | pending |
| M-023 | Issue #79 | 通常武器DoctrineとC2 overlapを記録 | M-014のexact diff | 同上 | pending |
| M-024 | Issue #92 | 通常offer偏りとEX進化の境界を記録 | M-014のexact diff | 同上 | pending |
| M-025 | Issue #100 | release train判断材料だけを更新 | ownerがv0.7 / v0.8を判断 | production変更なし、本文復元可能 | pending |
| M-026 | Cloudflare observation Version | #113 exact sourceをVersion upload | T2 / T3準備、承認、marker一致 | traffic 0%、Versionを破棄 | pending |
| M-027 | Cloudflare production traffic | 変更しない | 別の明示的release承認まで禁止 | 現行v0.6.8を維持 | excluded |

## 実行前check

- canonical source、old head、new head、merge-baseをfull SHAで記録する。
- dirty tree、local-only commit、Preview sourceを保全する。
- force pushを使わない。fast-forwardできない場合は停止する。
- PR close前に受入条件、テスト、artifact、後継PRを参照可能にする。
- Issue close前にruntime接続、current HEAD QA、必要な人間gateを確認する。
- merge前にDraft解除、review、required checks、latest base、P0 / P1、rollbackを確認する。
- Cloudflare Versionはsource SHA、Version ID、marker、artifact digestを一組で記録する。

## 実行結果

まだ外部変更は実行していません。承認後、各IDへ実行時刻、実行者、URL / SHA、予定との差、recoveryを追記します。
