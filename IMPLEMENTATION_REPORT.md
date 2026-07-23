# EX Protocol candidate implementation report

## 1. Outcome

- Status: `partial`
- Candidate acceptance: `not evaluated`
- Production adoption: `not requested`
- Production deploy performed: `NO`
- Production EX Protocol default: `OFF`

## 2. Repository state

- Repository: `garchomp-game/create-game`
- Branch: `feat/v08-ex-protocols-c1`
- HEAD: work in progress
- Base HEAD: `565d401a92f661cff9a4936cee2ebf2c9420d5c3`
- Applicable `AGENTS.md`: user-provided personal Codex notes; no repository-local file
- Dirty files present before work: none in the isolated worktree
- User changes protected: original dirty worktree was not modified
- Local commits: pending

## 3. Baseline

| Command | Before | After | Notes / artifact |
|---|---|---|---|
| `npm run typecheck` | PASS | pending | TypeScript 6.0.3 |
| `npm test` | 69 files / 468 passed / 2 skipped | pending | single worker |
| `npm run build:deploy` | PASS | pending | 27 files, 2.69 MiB |
| `npm run test:e2e:release -- --workers=1` | 9 passed | pending | Chrome landscape/portrait and Firefox |
| docs build | 102 pages PASS | pending | Astro telemetry disabled |
| `npm run probe:v07` | 1 passed / 1 skipped | pending | RC6 control: Pulse 1 victory, Spread 2 victories |
| `npm run probe:v07:repair` | 1 passed / 1 skipped | pending | Candidate A gate `false / true / true / true` |

Pre-existing failures:

- None in required baseline commands.
- `npm ci` reported known dependency audit findings (Phaser: 1 low / 3 high, docs: 3 high); no dependency changes were made.

## 4. Implemented scope

### Progression

- [ ] Core 25 -> Protocol fixed 3択
- [ ] Signature EX Lv0
- [ ] E1 EX Lv1
- [ ] E2 + Mastery EX Lv2
- [ ] Limit Break EX Lv3+
- [ ] contract arbitration
- [ ] Training disabled
- [ ] unsupported weapon skip

### Protocols

- [ ] Resonance Relay
- [ ] Rebound Overdrive
- [ ] Redline Core
- [ ] Full-span Tidal Sweep
- [ ] Breakwater Fan
- [ ] Aegis Fan

### Platform

- [ ] RMB / E special
- [ ] Choice UI
- [ ] HUD / VFX / SFX
- [ ] RunRecord v3
- [ ] v1 / v2 non-destructive migration and collection reconciliation
- [ ] explicit deletion journal and retry
- [ ] Export / summary
- [ ] AutoPilot / probes
- [ ] docs synchronization

## 5. Structural differences from the handoff snapshot

| Handoff assumption | Latest-main reality | Resolution |
|---|---|---|
| Training runtime was a separate snapshot | Nine-step Training is merged into main | Preserve Training and keep Protocol disabled there |
| Unit baseline was earlier than Training merge | Baseline is now 468 passed / 2 skipped | Use the latest count and compare after every phase |
| Existing EX choices use a shared pending array | Still true on latest main | Replace with a discriminated pending-choice contract |
| RunRecord is v2 and RNG is v1 | Still true on latest main | Candidate-only v3 and RNG v2; legacy profiles retain v2/v1 |
| Enemy projectile source is insufficient for Aegis | Still true on latest main | Add candidate classification before Aegis arbitration |
| Issue #79 describes one branch per weapon | The handoff fixes six Protocols and 24 paths | Record the handoff as the superseding candidate design |

## 6. Verification status

| Gate | Result |
|---|---|
| Flag OFF parity | pending |
| Catalog | pending |
| Unit | pending |
| 24 paths | pending |
| Determinism | pending |
| Record migration | pending |
| E2E | pending |
| Visual | pending |
| Headless soak | pending |
| Hardware soak | NOT RUN |
| Docs build | pending |

## 7. Human gates

| Gate | Status |
|---|---|
| Decision change after selection | `PENDING` |
| No universal safe pick | `PENDING` |
| Active is not a routine DPS button | `PENDING` |
| Weapon weakness remains | `PENDING` |
| Dense combat readability | `PENDING` |
| Evolution choice quality | `PENDING` |

## 8. Deviations

- `IMPLEMENTATION_DEVIATIONS.md` absent.
- No deviations approved or introduced.

## 9. Production safety

- [x] No external push performed
- [x] No PR created
- [x] No production deploy performed
- [ ] Candidate ruleset separated
- [ ] Production default OFF
- [ ] automatic migration / reconciliation / normal save preserves v1 / v2 keys bit-for-bit
- [ ] explicit user delete / clear is the only operation that synchronizes matching legacy history
- [x] Remote backend / telemetry not added

## 10. Final statement

> EX Protocol candidateは実装中です。production採用は未判断です。
