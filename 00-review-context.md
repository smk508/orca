# Review Context

## Branch Info

- Base: origin/main
- Current: brennanb2025/fix-session-hydration-data-loss
- Merge base: 8e44541c4c53cfdf6bb149dc7dc4524eff24405a

## Changed Files Summary

- M src/main/persistence.test.ts
- M src/main/persistence.ts
- M src/renderer/src/App.tsx
- M src/renderer/src/lib/workspace-session.test.ts
- M src/renderer/src/lib/workspace-session.ts
- M src/renderer/src/store/slices/terminals-hydration.test.ts
- M src/renderer/src/store/slices/terminals.ts

## Changed Line Ranges (PR Scope)

| File                                                       | Changed Lines                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| src/main/persistence.test.ts                               | 5, 585-796                                                     |
| src/main/persistence.ts                                    | 5-15, 58-69, 94-176, 291-298, 329-336                          |
| src/renderer/src/App.tsx                                   | 31-34, 98, 170-176, 191, 284-291, 294-307, 309-355, 389, 423, 433-437 |
| src/renderer/src/lib/workspace-session.test.ts             | 1-2, 143-243                                                   |
| src/renderer/src/lib/workspace-session.ts                  | 11-27                                                          |
| src/renderer/src/store/slices/terminals-hydration.test.ts  | 269-309                                                        |
| src/renderer/src/store/slices/terminals.ts                 | 98-106, 230-233                                                |

## Review Standards Reference

- Follow /review-code standards
- Focus on: correctness, security, performance, maintainability
- Priority levels: Critical > High > Medium > Low

## File Categories

### Electron/Main (Priority 1)
- src/main/persistence.ts
- src/main/persistence.test.ts

### Frontend/UI (Priority 3)
- src/renderer/src/App.tsx
- src/renderer/src/lib/workspace-session.ts
- src/renderer/src/lib/workspace-session.test.ts
- src/renderer/src/store/slices/terminals.ts
- src/renderer/src/store/slices/terminals-hydration.test.ts

## Skipped Issues (Do Not Re-validate)

<!-- Issues validated but deemed not worth fixing. Do not re-validate these in future iterations. -->

(none yet)

## Iteration State

Current iteration: 1
Last completed phase: Setup
Files fixed this iteration: []
