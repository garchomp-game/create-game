---
title: Operating Model
description: PM、サブエージェント、チケット運用の基本方針。
---

## 方針

PM判断、設計、実装、検証を小さく分けます。

サブエージェントへ渡す前に、次を揃えます。

- ticket id
- purpose
- scope
- non goals
- dependencies
- acceptance criteria
- test strategy
- risk

## 進め方

1. PMが方向性と優先順位を決める。
2. 要件整理チケットで境界を決める。
3. 小さなprototype ticketへ切る。
4. 実装後にunit / E2E / playtest観点を確認する。
5. 結果をroadmapとrisk logへ戻す。

## 原則

- 複数の新要素を同時に増やさない。
- balanceProbeを人間playtestの代替にしない。
- gameplay変更ではdebug exportとresult metricsも見る。
- まず土台を作り、content量産は後に回す。
