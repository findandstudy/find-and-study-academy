# Academy 2026 campaign and email drafts

Current approved campaign and editable English/Turkish drafts, synchronized on
21 November 2026. These files do not send messages or schedule a campaign.

## Approved campaign

- Code: **ACADEMY2026**.
- Redeem by **31 December 2026, 23:59:59 Türkiye time**
  (**20:59:59 UTC**).
- Free access lasts **180 days from registration**.
- Campaign accounts are limited to **two browser profiles/devices**.
- Email verification and administrator approval are required for training access.
- The existing technical limit remains **3,000 registrations**.
- Existing members' access periods and device registrations are preserved.
- Training covers **17 destinations in 23 languages**, including Hungary.
  Academy training coverage and the active Apply university/programme catalogue
  are separate.

[campaign.json](campaign.json) records the approved public conditions. The live
database remains the source of truth; the JSON is not a runtime override or an
automatic database migration. The site's invitation preview reads the same live
campaign record and displays its deadline in all 23 interface languages.

## Drafts

- [Five-message English/Turkish series](email-sequence-work/index.html): ten HTML
  drafts and ten matching TXT alternatives. Download or clone the files and open
  the index locally to preview them.
- [Series manifest](email-sequence-work/manifest.json): subjects, alternatives,
  preview text, CTA URLs and file hashes.
- [English standalone draft](email-launch-work/academy-launch-en.html) and
  [Turkish standalone draft](email-launch-work/academy-launch-tr.html), with TXT
  alternatives and [subject/preview text](email-launch-work/subjects-and-preview.json).
- [Verified series ZIP](academy-email-series-en-tr-2026-11-21.zip).

The ZIP and extracted series files match the approved local delivery package
byte for byte. Existing layout/CSS, the Find And Study brand and message/language
UTM identifiers are retained. The suggested last reminder is **28 December 2026**;
it is a suggestion, not a scheduled send. The current drafts have not been sent.

The copied review notes retain their historical context. Private earlier test
receipts, working directories, screenshots and previous ZIP versions are not
part of this folder. Historical references in those notes are not additional
current deliverables.

## Verification

From the repository root:

```sh
cd marketing/academy-2026
shasum -a 256 -c SHA256SUMS
```

The November update verified the live invitation in 23 languages and checked 24
desktop/mobile email layouts. Subjects, previews, HTML/TXT alternatives, deadline,
180-day/two-device conditions and canonical UTM links were checked. Browser
rendering is not a new inbox-delivery test.

Before a future send, recheck the live code preview, review the selected language
and subject, and use the email provider's unsubscribe/suppression controls.
Registration, partner approval and catalogue availability are not guaranteed by
an invitation or certificate. No credentials, recipient lists, private backups,
budget ledger or paid API responses are included here.
