# Academy API translation drafts

The initial API pilot has been generated, published and verified against all public quiz fields. Wider catalog translation remains in progress.

The user approved OpenAI API use and provided a credential and spending cap. Every paid run still requires a configured model and verified official token prices. Store credentials through the deployment secret manager or a private server-side environment file; never publish them or place them in browser code.

The runner defaults to offline inventory. Paid execution requires --run and a private configuration based on config.example.json. The endpoint is fixed to the official OpenAI Responses API and store:false is set. Strict structured outputs and independent validation preserve string counts, indices, URLs, numbers and placeholders. Numbers, language-level codes, URLs and placeholders are masked before generation and restored deterministically. Refused, incomplete or malformed outputs are rejected; rejected drafts are retained privately for review.

A durable ledger reserves a conservative cost bound before each request. Ambiguous failures retain reservations. Use one shared ledger and output directory for the project. A lock prevents concurrent runs. Completed jobs resume without repeated requests. Checkpoint identity includes source, language, model and prompt version.

The runner creates local text drafts only, with no database access or publishing. Review drafts and pass them through existing lesson/quiz packagers, source-hash checks, insert-only importers and public API verification before counting them as complete. Automated checks do not establish linguistic accuracy.

Run tests with node --test translate.test.cjs. Tests use fake responses and make no network requests.

Format reference: https://developers.openai.com/api/docs/guides/structured-outputs
