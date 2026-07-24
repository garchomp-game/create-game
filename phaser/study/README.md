# Onboarding Study Contract

This directory contains the local validation contract for onboarding studies.
It is intentionally outside `src/` and is not bundled into the game runtime.

## Boundaries

- Preview/local export only.
- No network transport.
- No `RunRecord`, Profile, ranking, or simulation imports.
- No names, email addresses, free text, raw key logs, or continuous positions.
- A study result never changes product completion state.

The schemas and validators were imported from
`Arena-Core-Onboarding-UX-Flow-Readiness-Pack-20260724` after its bundled
contract self-test passed.

## Commands

```sh
npm run study:contract
npm run study:digest -- study/templates/STUDY_DEFINITION_FULL_TRAINING.example.json
npm run study:validate -- path/to/session.json path/to/candidate-manifest.json
```

`study:contract` covers all four session kinds, both O1 entry arms, and
negative invariant mutations. The full Training definition uses the current
nine product task IDs; a Vitest contract detects drift from `TUTORIAL_STEP_IDS`.

Runtime instrumentation is a separate candidate. Do not import this directory
from production code or connect it to an endpoint without a privacy and
candidate review.
