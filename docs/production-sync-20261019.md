# Production source synchronization — 2026-10-19

This branch contains the current Academy application source, synchronized from the running deployment. Synchronization does not merge into main or redeploy production.

Included: grounded Findy answers from the read-only Apply catalog and published Academy lessons, account quotas and follow-up context; profile completion gates; campaign registration and two-device limits; administrator-controlled partnership workflow; white-label logo processing; interface localization and admin responsive fixes.

Operational code in `ops/maintenance` records the installed encrypted backup/isolated restore verification, five-minute health monitor and bounded weekly backup queue. `ops/findy/configure-catalog.py` documents the existing read-only catalog setup; review it before using on another installation. Do not run setup or database integration tests on production as part of a routine build.

## Validation

The production source passed TypeScript, the 23-language interface gate and a production build. Nineteen admin main screens were reviewed at mobile/tablet widths; six overflow issues were fixed. Partner Zone metadata publication verified 1,100 records; image artwork was preserved. These database records are operational data and are not exported to this public repository.

Findy fixture tests: `node tests/findy/query.test.cjs` and `node tests/findy/api.test.cjs`. They use isolated in-memory fixtures and make no paid AI calls. The API fixture test opens a localhost listener.

## Excluded data

No `.env`, credentials, database dumps, backup encryption keys, private configuration, uploaded user files or new screenshots are included. Database content and runtime state remain on the server and in private encrypted backups. The shared translation budget ledger is not reset or exported.

## Backup operations

On the current server the backup implementation is installed at `/var/lib/academy-translations/academy-backup-20261019.py`; monitor/scheduler scripts and status live under `/var/lib/academy-maintenance`. The two systemd timers are `academy-health.timer` and `academy-backup.timer`. The latter runs Sundays at 03:30 UTC.

Existing backups are preserved. New backup creation pauses at seven snapshots or less than 5 GiB free; retention then needs review. Alerts go to the local system journal, not email/SMS. Session table data and environment files are excluded. Restore tests use a disposable database and check critical table counts plus uploaded file hashes. Never restore over a live database without a separate recovery plan.

## Setup hardening

The setup helper now requires an explicitly entered 16–128 character administrator password and stops before provisioning when it is absent or invalid. It no longer supplies a fixed default or prints the password. This source-only change does not rotate or change any existing account credentials.
