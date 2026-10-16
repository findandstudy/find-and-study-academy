# Academy API translation drafts

Offline tools prepared and tested. No paid OpenAI call has been made.

The user approved switching to OpenAI API. A credential, approved spending cap, model and verified current official token prices are required before a paid run. Store credentials through the deployment secret manager or a private server-side environment file; never publish them or place them in browser code.

The runner defaults to offline inventory. Paid execution requires --run and a private configuration based on config.example.json. The endpoint is fixed to the official OpenAI Responses API and store:false is set. Strict structured outputs and independent validation preserve string counts, indices, URLs, numbers and placeholders. Refused, incomplete or malformed outputs are rejected.

A durable ledger reserves a conservative cost bound before each request. Ambiguous failures retain reservations. Use one shared ledger and output directory for the project. A lock prevents concurrent runs. Completed jobs resume without repeated requests. Checkpoint identity includes source, language, model and prompt version.

The runner creates local text drafts only, with no database access or publishing. Review drafts and pass them through existing lesson/quiz packagers, source-hash checks, insert-only importers and public API verification before counting them as complete. Automated checks do not establish linguistic accuracy.

Run tests with node --test translate.test.cjs. Tests use fake responses and make no network requests.

Format reference: https://developers.openai.com/api/docs/guides/structured-outputs
