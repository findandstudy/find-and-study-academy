# Academy agent UX: understanding, impact and implementation plan

## Authority and baseline

- Repository: `findandstudy/find-and-study-academy`, base `4537024a3df4ea488d4a65d16b9138939602aa65`.
- Isolated branch: `codex/academy-agent-ux-fixes-20261030`.
- The migrated production source retains an old Git HEAD (`d4244dd9…`) and dirty files. Eighteen relevant source/lock files were compared read-only using LF-normalized SHA-256; all match the current repository base. This establishes the affected source baseline, not an assertion that every runtime file is identical.
- No production secrets, student records, storage or environment files are development inputs. Sparse checkout excludes uploaded/private files; only three repository brand images are restored for building.
- Before changes: TypeScript check passes; 51 existing pure/unit tests pass. Existing production data stays authoritative.
- Expanded source check: 226 allowlisted tracked source files under client/src, server and shared were hashed read-only against the base. All 225 present files match; only `server/translation-control-core.test.ts` is absent on the server. This does not attest compiled runtime assets, private configuration or uploaded files.

## Codebase map

- React 18 + TypeScript + Vite; Wouter routing; TanStack Query for server data; Zustand retains legacy seed/client state. Radix/shadcn components and Tailwind provide UI primitives.
- Express routes use server-session authentication, role checks and Drizzle/PostgreSQL storage. Agent agency identity comes from the authenticated user, not the request body.
- Published country content creates runtime courses with IDs `course-${country.id}`. The client course directory already knows this; certificate read endpoints currently search only stored courses. This explains null course metadata without altering certificate records.
- Dashboard Continue links discard course identity. Courses initializes from the configured default, then alphabetic fallback. CourseView independently loads the caller's progress and assessment attempts.
- AgentLayout and the fixed legacy Findy launcher have no shared safe content reserve. At the bottom of the dashboard the launcher covers a real primary action.
- Mobile CourseView stacks every destination and lesson before lesson content. Agency has existing country/city database columns but omits them in its form and save payload.
- UI supports 23 languages; existing translations/copy will be reused. Menu visibility IDs and legacy URLs must remain compatible.

## Seven changes and acceptance criteria

| Finding | Implementation / impact | Acceptance |
|---|---|---|
| AG01 Findy covers Continue | Reserve safe bottom space in agent content; account for launcher and device safe area. No global widget disable or AI behavior changes. | At bottom of desktop/mobile dashboard both Continue actions remain independently clickable; chat still opens. |
| AG02 Continue loses course | Add bounded course URL identity, validate against available courses, initialize the first unfinished lesson after progress loads. Preserve an already selected lesson on translation changes. No progress writes from navigation. | Latvia Continue opens Latvia and its first unfinished lesson; reload/back work; invalid/unavailable targets never silently open a different course. |
| AG03 Certificate course missing | Shared exact stored/dynamic course resolver for authenticated certificate list, admin certificate list and public verification. Use resolved metadata for client display/PDF; explicit unavailable state for genuinely unknown IDs. | Exact generated IDs resolve, stored legacy titles win, unknown IDs do not guess another course; list/verification/PDF inputs agree. Certificate IDs/codes/scores/history remain unchanged. |
| AG04 Subscriptions misleading | Render existing localized Notification Preferences copy in navigation. Keep `subscriptions` visibility/config ID and route. | English/Turkish labels describe the actual four notification switches; settings and stored preferences unchanged. |
| AG05 Mobile learning flow | Compact native destination and grouped lesson selectors on small screens; keep full trees on desktop. On user lesson selection, move focus to content without hiding exam controls. | 390px/320px, keyboard and RTL: lesson content is reachable without traversing the entire tree; final-exam gating stays unchanged. |
| AG06 Country/city completion | Expose existing fields using localized country labels; persist through the existing own-agency route with editable-field validation. Preserve untouched legacy values; no schema migration. | Valid changes survive an isolated reload; invalid countries/cities and administrative field injection are rejected; session-derived agency binding is preserved. |
| AG07 Navigation naming | Name open/close/toggle controls with existing localized copy; expose expanded/controls relationship. | Accessible names and expanded state exist for desktop and mobile; no nested action ambiguity. |

## Validation and release limits

1. Add pure regression tests for course routing/resume, course resolution and agency update validation, including unknown/cross-resource inputs.
2. Run TypeScript, existing 51 unit tests, new regressions, translation gate and production build.
3. Exercise the real frontend locally with synthetic responses only, using the in-app browser; inspect before/after desktop/mobile, English/Turkish and RTL states. Local preview must never connect to production DB, send email, start workers or contact AI/payment providers.
4. Review the final diff for auth, data and incidental changes; document remaining test gaps. No schema changes, backfill, role grants or data restores are planned.
5. Production is a separate defined release step: exact commit, current runtime drift, backup, worker impact, health/canary and rollback must be presented before deployment under the workspace production gate. Implementing these fixes does not merge unrelated OS/Control Plane work or replace live data.

## Non-goals

No additional admin audit backlog, credential changes, AI answer-quality testing, exam submission, partnership submission, payment, logo approval, historical certificate reissue or modernization of the whole legacy store.
