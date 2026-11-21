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
