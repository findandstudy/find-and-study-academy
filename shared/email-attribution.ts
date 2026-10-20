export const EMAIL_MESSAGE_IDS = [
  'email_01_en', 'email_02_en', 'email_03_en', 'email_04_en', 'email_05_en',
  'email_01_tr', 'email_02_tr', 'email_03_tr', 'email_04_tr', 'email_05_tr',
] as const;
export type EmailMessageId = typeof EMAIL_MESSAGE_IDS[number];
export const EMAIL_ATTRIBUTION_WINDOW_DAYS = 30;
export const EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH = 1536;
export const EMAIL_CAMPAIGN_UTMS = { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'academy_launch_2026' } as const;
export const isEmailMessageId = (value: unknown): value is EmailMessageId =>
  typeof value === 'string' && (EMAIL_MESSAGE_IDS as readonly string[]).includes(value);

// Read only the finite campaign tuple; never preserve the URL or other fields.
export function parseEmailMessageId(search: string | URLSearchParams): EmailMessageId | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  for (const [key, value] of Object.entries(EMAIL_CAMPAIGN_UTMS)) {
    const values = params.getAll(key);
    if (values.length !== 1 || values[0] !== value) return null;
  }
  const messages = params.getAll('utm_content');
  return messages.length === 1 && isEmailMessageId(messages[0]) ? messages[0] : null;
}

export type EmailAttributionVisitRequest = { messageId: EmailMessageId; visitId: string; consent: true };
export type EmailAttributionVisitResponse = { success: true; token: string; expiresAt: string };
