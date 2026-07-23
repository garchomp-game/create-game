# EX Protocol candidate implementation report

Updated: 2026-07-23

## 1. Outcome

- Implementation status: `candidate complete / available automatic gates passed`
- Candidate acceptance: `pending hardware and human gates`
- Production adoption: `not requested`
- Production deploy performed: `NO`
- Version Preview uploaded: `YES`
- Production EX Protocol default: `OFF`
- External push / PR / main merge: `NO`

The six Protocol systems, 24 evolution routes, progression, input, UI, feedback, telemetry, persistence, migration, export, probe, soak, and Final Expedition exposure harness are implemented on an isolated local branch. Automated correctness does not close the hardware or human game-design gates.

## 2. Repository state

- Repository: `garchomp-game/create-game`
- Branch: `feat/v08-ex-protocols-c1`
- Implementation HEAD before documentation: `12a77956d430`
- Preview runtime HEAD: `03805713cf83`
- Base HEAD: `565d401a92f661cff9a4936cee2ebf2c9420d5c3`
- Local implementation commits: 17
- Applicable `AGENTS.md`: user-provided personal Codex notes; no repository-local file
- Dirty files present before work: none in the isolated worktree
- User changes protected: original dirty worktree was not modified

## 3. Baseline

| Command | Before | Latest candidate evidence | Notes |
| --- | --- | --- | --- |
| `npm run typecheck` | PASS | PASS | Final candidate source |
| `npm test` | 69 files / 468 passed / 2 skipped | 87 files / 559 passed / 2 skipped | Full suite |
| `npm run build:deploy` | PASS | PASS | 231 modules、31 files、2.82 MiB |
| `npm run test:e2e:release -- --workers=1` | 9 passed | 9 passed | Chrome landscape / portrait and Firefox |
| docs build | 102 pages PASS | 104 pages PASS | Canonical specification and automatic QA report |
| `npm run probe:v07` | 1 passed / 1 skipped | 1 passed / 1 skipped | RC6 control remains 3/6 victories |
| `npm run probe:v07:repair` | 1 passed / 1 skipped | 1 passed / 1 skipped | Candidate A rejection remains unchanged |

Pre-existing failures:

- None in required baseline commands.
- `npm ci` reported known dependency audit findings at baseline; no dependency changes were made.

## 4. Implemented scope

### Progression

- [x] Core 25 -> Protocol fixed three-choice offer
- [x] Signature at EX Lv0
- [x] Evolution I at EX Lv1
- [x] Evolution II + automatic Mastery at EX Lv2
- [x] Existing Limit Break at EX Lv3+
- [x] Contract arbitration and eight seconds of resumed play
- [x] Training disabled
- [x] Unsupported stage / weapon rejection
- [x] Feature-OFF legacy progression

### Protocols

- [x] Resonance Relay
- [x] Rebound Overdrive
- [x] Redline Core
- [x] Full-span Tidal Sweep
- [x] Breakwater Fan
- [x] Aegis Fan

### Platform

- [x] Coalesced RMB / E semantic special input
- [x] Protocol and evolution DOM choice UI
- [x] HUD, reserved HP, charges, cooldowns, VFX, and waveform SFX
- [x] Player-facing feedback without internal enemy IDs
- [x] Result route display
- [x] RunRecord v3 and RNG schema v2 for candidate profiles
- [x] v1 / v2 non-destructive migration and collection reconciliation
- [x] Explicit deletion journal and retry
- [x] JSON / TSV / CSV / debug export
- [x] Protocol-specific telemetry and performance gauges
- [x] Probe-only policy without product AutoPilot changes
- [x] Canonical Starlight specification and project-state synchronization
- [x] PR-fast and workflow-dispatch release CI split

## 5. Structural differences from the handoff snapshot

| Handoff assumption | Latest-main reality | Resolution |
| --- | --- | --- |
| Training runtime was a separate snapshot | Nine-step Training is merged into main | Preserve Training and keep Protocol disabled there |
| Unit baseline was earlier than Training merge | Baseline is 468 passed / 2 skipped | Compare candidate gates against the latest main |
| Existing EX choices use a shared pending array | True at baseline | Replaced in candidate with a discriminated pending-choice contract |
| RunRecord is v2 and RNG is v1 | True for legacy profiles | Candidate-only v3 / v2; legacy profiles retain v2 / v1 |
| Enemy projectile source is insufficient for Aegis | True at baseline | Added explicit category / interceptibility and candidate-only arbitration |
| Issue #79 describes one branch per weapon | Handoff fixes six Protocols and 24 paths | Track as `PH-V08-027`; do not silently overwrite #79 |

No implementation deviation from the handoff values or semantics was intentionally introduced. `IMPLEMENTATION_DEVIATIONS.md` is absent.

## 6. Candidate verification

| Gate | Result |
| --- | --- |
| Feature-OFF profile and listener boundary | PASS, including RC6 normal / repair parity |
| Catalog JSON / schema / runtime validation | PASS |
| 24 routes | 25 passed |
| Typed deterministic replay | 9 passed |
| Record migration / deletion journal | 18 passed |
| Probe policy and smoke balance matrix | 6 passed in latest smoke |
| Representative six-Protocol browser E2E | 13 passed, including candidate release identity |
| Candidate-enabled nine-step Training E2E | 2 passed |
| Visual montage inspection | PASS, no incoherent HUD / EX / Protocol / enemy overlap observed |
| Headless paired soak smoke | PASS |
| Final Expedition exposure smoke | PASS: Protocol, E1, E2, Mastery, first Limit Break, boss phase 2, victory |
| Synchronized Starlight build | PASS: 104 pages |
| GitHub workflow YAML parse | PASS |
| Full 20-seed balance release matrix | PASS: 2 tests; no automatic dominant / weak trigger |
| Full 90-second headless soak | PASS: all absolute / paired budgets |
| Full 20-seed x 2-weapon Final Expedition exposure | PASS: 40 / 40 Core completion and release exposure gate |
| Real-GPU 15-minute soak | NOT RUN |

The 20-seed matrix found no automatic 15% dominant or 20% weak trigger. Relay and Redline had zero opportunity under the shared fair aim policy, which is insufficient probe coverage rather than evidence that the mechanics failed. Rebound, Tidal, Breakwater, and Aegis produced effects but had median direct damage share below 5%; defensive, capacity, and positioning value must be judged in the human gate instead of being reduced to direct damage.

The 90-second high-pressure soak stayed within every entity, tracker, collision, and step-time budget. The 40-run Final Expedition matrix reached at least 60 seconds of Protocol exposure in 100% of runs, with a 389.13-second median; E1, E2 plus Mastery, and the first Limit Break were reached in every run. Detailed values are in `docs/src/content/docs/playtest/v08-ex-protocol-candidate-report.md`.

## 7. Human gates

| Gate | Status |
| --- | --- |
| Decision changes after Protocol selection | `PENDING` |
| No universally safe pick | `PENDING` |
| Active is not a routine DPS button | `PENDING` |
| Pulse / Spread weakness remains | `PENDING` |
| Dense-combat readability | `PENDING` |
| Evolution choice quality | `PENDING` |
| Redline / Breakwater cost comprehension | `PENDING` |

Automated score, survival, damage share, and effect counts are review triggers. They do not authorize scalar changes or production adoption.

## 8. Production safety

- [x] Candidate app and ruleset versions are separate
- [x] Production default is OFF
- [x] Candidate input listeners are absent when OFF
- [x] Training rejects Protocol progression
- [x] Normal save and automatic reconciliation preserve v1 / v2 keys
- [x] Explicit user deletion is the only legacy synchronization path
- [x] No external backend or telemetry transport was added
- [x] No external push, PR, main merge, or production traffic change
- [x] Candidate-only Cloudflare Version Preview; no traffic allocation

Rollback is the candidate ruleset profile plus `VITE_ARENA_EX_PROTOCOL_CANDIDATE`. OFF restores Core -> existing Limit Break, legacy records, legacy input, and legacy rendering.

## 9. Remaining release work

1. Run a non-SwiftShader 15-minute hardware soak.
2. Perform the six-Protocol human game-design and readability gate.
3. Decide whether each review trigger needs no change or a separately pre-registered candidate.
4. Only then decide whether to create an external issue / PR and how it relates to #79.

## 10. Final statement

> EX Protocol candidate is functionally implemented, isolated from production, and green on every available automatic gate. Adoption remains undecided until hardware evidence and human game-design gates are complete.
