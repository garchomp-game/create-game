# Arena Core agent contract

## Source of truth

- The main agent acts as PM and game director.
- Before editing, read the single active GitHub Issue and the relevant Starlight product, design, and operation pages.
- Starlight owns durable product concepts, design decisions, and cross-Issue order. The active GitHub Issue owns the current execution contract and progress.
- If the Issue, current state, product concept, or decision log disagree, stop implementation and resolve the contradiction in the main thread.
- Do not silently replace an accepted product decision or present an unverified design target as implemented fact.

## Delegation and ownership

- Keep one active Issue and one adoption decision at a time.
- The main agent owns scope, product decisions, task decomposition, integration, commits, authorized GitHub mutations, and the final report.
- Delegate bounded evidence gathering to `researcher`, implementation to `worker`, and independent review to `auditor`.
- Run independent read-only research and audits in parallel when useful.
- Allow only one workspace writer at a time. While a worker is active, the main agent and every other agent remain read-only across the workspace.
- Every worker brief must name owned files, excluded files, acceptance criteria, tests, and stop conditions.
- Subagents never commit, push, create branches, or mutate Issues, PRs, Projects, or other external resources.
- Nested read-only delegation requires explicit authorization from the main agent.

## Product guardrails

- The product north star is `docs/src/content/docs/product/game-concept.md`.
- Preserve the distinction between implemented facts, adopted direction, and unverified hypotheses.
- Do not add permanent combat stats, material or equipment rarity grinding, or hidden difficulty adjustment.
- Do not promise wholly different builds until exclusive build paths pass human validation.
- Preserve current Endless rulesets, PBs, and rankings when exploring the first campaign or the eleventh-minute concept.
- Automated probes and developer scores do not replace first-time-player or human play evidence.

## Git

- `main` is the normal working branch. Use small semantic commits tied to the active Issue.
- After the worker stops and Checkpoint checks pass, the main agent creates a local candidate commit before independent audit and candidate-level QA.
- Do not create routine task branches, worktrees, or PRs.
- When the operating model explicitly requires a PR, use one short-lived branch and one PR for that Issue, then remove the branch after integration.
- Preserve unrelated user changes and never use destructive reset or checkout to remove them.
- Push and external GitHub changes only when the current user request authorizes that scope. Otherwise stop at the local candidate and report the required authority.

## Quality and completion

- Phaser commands run from `phaser/`; Starlight commands run from `docs/`.
- Follow the Checkpoint, Slice, and Adoption gates in the Starlight quality and Ultra workflow documents.
- Do not repeat an unchanged green result for the same SHA and configuration.
- Work is done only when acceptance criteria, relevant QA, documentation synchronization, independent audit, and commit/CI evidence are complete.
- If a required human or external gate is unavailable, report a candidate as awaiting adoption rather than calling it complete.

## Stop conditions

Stop and return control to the main thread when scope or acceptance criteria must change, a new dependency/schema/public API is required, two design candidates fail, automatic and human evidence conflict, another writer overlaps the assigned files, source-of-truth documents conflict, or external authority is missing.

When stopping, report completed work, evidence, remaining work, the exact decision needed, and a safe resume point.

See `docs/src/content/docs/project-management/codex-autonomous-operation.md` for the full operating loop.
