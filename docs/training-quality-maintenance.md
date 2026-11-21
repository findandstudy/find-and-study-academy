# Training integrity and multilingual maintenance

Course finals and certificates resolve by the exact registered course or
destination identity. A default course final cannot appear in another country's
course. Existing earned certificates remain visible after a final is replaced;
their stored course IDs and attempt history are not rewritten. PDF variable
text uses browser Unicode shaping for participant, agency, destination and date.

Translation editing hydrates asynchronous responses without marking them as
edits, retains custom HTML layouts, preserves unsaved changes on refetch, and
blocks writes after an unsuccessful translation read. Source-aligned review
slots handle an isolated English article becoming punctuation in languages
without articles, while rejecting lost headings and changed HTML structure.

The learner view sanitizes and renders authored HTML in its own shadow tree.
Lesson styles cannot change the page body or navigation. App typography,
authored layouts, safe videos and links, local table-of-contents navigation,
RTL direction and horizontal scrolling for wide mobile tables are retained.
This changes rendering only; stored lesson HTML remains unchanged.

Paid translation and paired semantic review share the existing canonical ledger
and exclusive writer lock. Missing accounting fails closed. Charges without a
checkpoint and uncertain reservations require reconciliation; they are never
treated as permission to make the same request again. Proven digit/grouping
equivalents can reuse the retained paid response. Original responses and audit
receipts remain private. Quiz review instructions preserve deliberately false
propositions and incorrect distractors rather than answering the test.

Lock ownership includes the container hostname because process IDs are local to
a container. A general worker must retain foreign or legacy unscoped locks and
defer to an active supervised curriculum controller. Worker credential mounts
are private; the web application's accounting mount remains read-only.

The current maintenance prepares missing section quizzes with three multiple
choice and two boolean questions, and destination finals with eighteen multiple
choice and seven boolean questions. Every final question is copied exactly from
its mini-quiz pool, including answer keys and option order. An existing final is
retained inactive when a reviewed replacement becomes active. Sections that
contain only a Coming Soon placeholder need teaching content before meaningful
questions can be authored.

The translation controller's ordinary behavior remains **draft generation with
manual publication**. Supervised publication of this maintenance is separately
authorized and requires current source/target hashes, a paired review receipt,
dry-run, private backup, exact readback and verification through real HTTPS
agent endpoints. Course data, budget ledgers, credentials, personal records and
private backups are not repository assets.

## Verification

```sh
npm run check
npm run check:translations
node --import tsx --test server/*.test.ts server/*.test.cjs shared/*.test.ts
node scripts/verify-lesson-html.mjs
npm run build
```

The server tests exercise real grading and access middleware with isolated
storage: submitted scores are recalculated, false statements retain their truth
value, invalid answers are rejected, foreign lesson IDs cannot inflate progress,
and finals require this learner's completed lessons and passing mini attempts.
Rendering and public API checks are additional deployment evidence, not a claim
that structural validation certifies every translation's meaning or verifies
every source policy against external authorities.

The HTML browser regression command also accepts `--snapshot=/path/to/export.json`
to render a private read-only export of all published source/translation bodies.
Exports and screenshots stay outside the repository; it makes no application API
writes and blocks external network requests.

## Published maintenance verification

The supervised curriculum pass is complete. Verification used the live database
and authenticated agent endpoints over HTTPS in English and all 22 translation
languages. It did not send email or issue live test certificates.

| Check | Verified result |
| --- | --- |
| Published source lessons | 325 |
| Required non-English lesson/language pairs | 7,150 present; no gaps |
| Sections containing teaching material | 132 of 132 have an active mini quiz |
| Newly added mini quizzes | 53, with 1,166 published translation pairs |
| Destination finals | 17 active replacements, with 374 translation pairs |
| Final question provenance | 425 exact mini-question copies and 9,350 exact localized copies |
| All active assessments | 248, with all 5,456 required translation pairs validated |
| Historical learning records | All 618 previous attempts and 15 certificates unchanged |

New minis contain three multiple-choice and two boolean questions; finals
contain eighteen multiple-choice and seven boolean questions. Both use a 70%
pass threshold. Eleven prior final definitions remain inactive rather than
being deleted. Ten destination sections containing only a Coming Soon message
remain placeholders; questions were not invented for missing teaching content.

Four Latvia/Malta source corrections were published atomically with all 22
translations. Confirmed translation, condition, terminology and answer-key
errors were repaired narrowly from their paired sources. Deliberately false
quiz statements retain their original truth value. An exact review receipt
pins all 1,166 new mini translation values before their activation.

Browser checks rendered every published lesson body: 325 sources and 7,152
translation bodies, including two English overlays. After subsequent content
repairs, the four changed sources and 110 affected translation bodies were
rendered again. No visible markup, missing-text or outer-page style regressions
were found. The final quiz scan checked 135,440 source/translated text fields
without visible markup or template-token findings.

The 99 regression tests, TypeScript check, 23-language UI key gate, production
build and browser isolation checks passed. All existing certificate course IDs
resolve to the correct course title; synthetic PDF checks covered Turkish,
Arabic, Chinese, Korean, Hindi and long text without modifying earned records.

The ordinary worker is running again with automatic draft generation and manual
publication. Its queue was empty and its heartbeat healthy when enabled. The
same USD 100 ledger remains in force: accounted usage was USD 56.4962968,
including the 17 retained historical uncertain reservations. No ledger was
reset, and restoring/enabling the worker incurred no API charge. Credentials,
paid responses, course data and private recovery backups remain outside Git.


## Authored lesson visual repair (21 November 2026)

A manual screenshot review found regressions that the earlier text/isolation
checks did not cover: lesson `:root` variables disappeared in Shadow DOM,
application prose overrode authored typography, and `overflow-wrap:anywhere`
collapsed table labels into individual letters. Full-document body styles were
also lost, and viewport media queries did not reflect the narrower lesson column.

The renderer now keeps a local html/body scope, maps root selectors inside it,
and uses lesson-width container queries for authored width breakpoints. Authored
lessons retain their own typography. Tables scroll independently with readable
cell widths; small-screen callouts stack. Navigation titles wrap fully, and the
lesson header and quiz controls wrap on narrow screens. Selecting another lesson
returns the reader to the content start, including desktop navigation from a
menu item far below a short lesson. Two stored development
filesystem image references now resolve to the bundled original Dorm Booking logo.
No course/quiz HTML rewrite is needed for these rendering corrections.

Review evidence outside Git includes 650 desktop/mobile captures of all 325
source lessons and 92 AZ/DE layout cases across all 23 locales. All 325 source
lesson overviews and all 23 locale comparison boards were inspected visually;
this is not a claim that every line of all 7,152 translated bodies was manually
read. Full-size AZ/DE examples and the Korean correction were checked live.
The browser regression suite renders 7,477 bodies, preserves text and outer-page
isolation, and now checks root variables, body styling, container breakpoints,
cell widths, locale direction, mobile callouts and the repaired image mapping.

The review also found an exact repeated China lesson title (one source and 21
translated titles) and shifted labels/introductory fragments in one Korean AZ
lesson. These were repaired with source/value hashes, successful dry runs,
private backups and publication receipts. The 22 China translation source hashes
were refreshed atomically; the Korean repair changed only 20 reviewed text slots.
Historical attempts and certificates, answer keys and the shared budget ledger
were not edited. The visual repair used zero paid AI requests.

To review an exported snapshot against the real production stylesheet:

```sh
node scripts/review-lesson-layouts.mjs --snapshot=/private/export.json --capture --serve
```

The local fixture is for manual visual review only; it does not read login
sessions, publish translations, submit quizzes or send email. Images/video from
outside the fixture are blocked during automated captures. External image URLs
were checked separately; blocked fixture images are not treated as broken assets.

## Assessment and certificate visual review (21 November 2026)

The active curriculum contains 231 mini quizzes and 17 destination finals (1,580 source questions). The visual review uses a private, read-only exported snapshot and the actual React components/production styles. `scripts/review-assessment-layouts.mjs` mocks all attempt submissions and certificate verification: it cannot issue a real certificate or send email.

- Checked all 36,340 localized question views for answer/navigation/title overflow at 360px; 23 locales also have desktop and mobile state captures.
- Manually inspected each of the 248 source assessment longest-question overviews, and 23 locale sets covering long mini/final dialogs, pass/fail results, certificate cards, empty states and valid/invalid/error verification states. This is visual and focused copy review, not a new native-language certification of every translated question.
- Produced and inspected 23 synthetic PDF certificates and 23 badge PNGs. All 391 destination/language course-title layouts were measured. Synthetic samples have non-valid test codes.
- Preserve all question IDs, order, answer keys and published translations. Eight French typographic entity references are decoded for visible text only. Finals still match their destination's localized mini-question pools; legacy mini destination bindings are resolved through published lesson links.
- Quiz results use the server's saved score/counts. The response now includes saved user/quiz IDs and correct/incorrect counts. Finals refresh the certificate query directly, without resolving against seed courses. Duplicate submission is blocked and a rejected submission cannot create local success state.
- Authored labels use complete localized sentences, with a consistent RTL count ratio. Dialogs trap keyboard focus, close with Escape and place the close button at the logical end. Options, question navigation and certificate controls wrap without shrinking body text.
- PDF labels use Unicode canvas shaping, localized field captions and separate bounded signature/QR/detail regions. Badge names wrap inside the original circle. Course names use committed CLDR display names for Academy destinations, avoiding browser locale-data fallbacks to English.
- The local review made no paid API requests. Deployment requires matching source/bundle hashes, a successful dry run, a private rollback backup and HTTPS asset readback. Existing assets, attempts, issued certificate identities and the single shared USD 100 budget ledger remain protected. Publish the SPA index before restarting: the production server captures its HTML template at startup.

Reproduce with a private snapshot at `../assessment-visual-review/live-assessment-snapshot.json`: run `node scripts/review-assessment-layouts.mjs`, then `node scripts/review-assessment-layouts.mjs --interaction-only --port=4202`. Snapshot data and generated images/PDFs stay outside Git.
