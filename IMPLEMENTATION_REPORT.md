# EX Protocol candidate implementation report

Updated: 2026-07-23

## 1. Outcome

- Implementation status: `candidate complete / release verification in progress`
- Candidate acceptance: `not evaluated`
- Production adoption: `not requested`
- Production deploy performed: `NO`
- Production EX Protocol default: `OFF`
- External push / PR / main merge: `NO`

The six Protocol systems, 24 evolution routes, progression, input, UI, feedback, telemetry, persistence, migration, export, probe, soak, and Final Expedition exposure harness are implemented on an isolated local branch. Automated correctness does not close the hardware or human game-design gates.

## 2. Repository state

- Repository: `garchomp-game/create-game`
- Branch: `feat/v08-ex-protocols-c1`
- Implementation HEAD before documentation: `12a77956d430`
- Base HEAD: `565d401a92f661cff9a4936cee2ebf2c9420d5c3`
- Local implementation commits: 17
- Applicable `AGENTS.md`: user-provided personal Codex notes; no repository-local file
- Dirty files present before work: none in the isolated worktree
- User changes protected: original dirty worktree was not modified

## 3. Baseline

| Command | Before | Latest candidate evidence | Notes |
| --- | --- | --- | --- |
| `npm run typecheck` | PASS | PASS | Re-run after Phase 8 |
| `npm test` | 69 files / 468 passed / 2 skipped | 87 files / 557 passed / 2 skipped | Full re-run pending after final docs / CI edits |
| `npm run build:deploy` | PASS | PASS before Phase 8 | Final re-run pending |
| `npm run test:e2e:release -- --workers=1` | 9 passed | Pending final re-run | Existing release route unchanged with flag OFF |
| docs build | 102 pages PASS | 103 pages PASS | EX Protocol canonical page added |
| `npm run probe:v07` | 1 passed / 1 skipped | Pending final parity re-run | RC6 control must remain unchanged |
| `npm run probe:v07:repair` | 1 passed / 1 skipped | Pending final parity re-run | Candidate A gate must remain unchanged |

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
| Feature-OFF profile and listener boundary | Unit covered; final full parity re-run pending |
| Catalog JSON / schema / runtime validation | PASS |
| 24 routes | 25 passed |
| Typed deterministic replay | 9 passed |
| Record migration / deletion journal | 18 passed |
| Probe policy and smoke balance matrix | 6 passed in latest smoke |
| Representative six-Protocol browser E2E | 12 passed |
| Visual montage inspection | PASS, no incoherent HUD / EX / Protocol / enemy overlap observed |
| Headless paired soak smoke | PASS |
| Final Expedition exposure smoke | PASS: Protocol, E1, E2, Mastery, first Limit Break, boss phase 2, victory |
| Synchronized Starlight build | PASS: 103 pages |
| Full 20-seed balance release matrix | NOT RUN on the finalized configuration |
| Full 90-second headless soak | NOT RUN after final reporting refinement |
| Full 20-seed x 2-weapon Final Expedition exposure | NOT RUN |
| Real-GPU 15-minute soak | NOT RUN |

Exploratory probes showed natural effect opportunities for Rebound, Tidal, Aegis, and some Breakwater cases. Relay and Redline can receive no opportunity under the shared fair aim policy. The report must distinguish insufficient opportunity from ineffective behavior; this is not an automatic balance failure.

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
- [x] No external push, PR, main merge, deploy, or production traffic change

Rollback is the candidate ruleset profile plus `VITE_ARENA_EX_PROTOCOL_CANDIDATE`. OFF restores Core -> existing Limit Break, legacy records, legacy input, and legacy rendering.

## 9. Remaining release work

1. Complete docs and CI synchronization.
2. Re-run the full unit, type, deploy build, release E2E, candidate E2E, docs, and RC6 parity gates.
3. Run the finalized 20-seed balance release matrix and 90-second headless soak.
4. Run the full Final Expedition exposure matrix as release / nightly evidence, or record it as an explicit deferred gate.
5. Run a non-SwiftShader 15-minute hardware soak.
6. Perform the six-Protocol human game-design and readability gate.
7. Only then decide whether to create an external issue / PR and how it relates to #79.

## 10. Final statement

> EX Protocol candidate is functionally implemented and isolated from production. Adoption remains undecided until release-scale automation, hardware evidence, and human game-design gates are complete.
