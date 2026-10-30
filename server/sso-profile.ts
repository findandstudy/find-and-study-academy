import crypto from 'node:crypto';
import { agencyCountryCode, validCompletionValue as valid, validEmail } from '../shared/profile-completion';

type Connection = {query(sql: string, values?: any[]): Promise<{rows: any[]}>; release(): void};
type Pool = {connect(): Promise<Connection>};
const blank = (v: unknown) => v == null || (typeof v === 'string' && !v.trim());

export function ssoProfileFields(payload: Record<string, unknown>) {
  const company = [payload.company, payload.companyName, payload.agencyName]
    .find(v => typeof v === 'string' && valid('agencyName', v));
  return {
    companyName: typeof company === 'string' ? company.trim() : null,
    country: agencyCountryCode(payload.country) ?? null,
    phone: valid('phone', payload.phone) ? String(payload.phone).trim() : null,
  };
}

// Fill gaps only on the exact already-linked active agent. Never rewrite a
// completed profile, infer an agency relationship by name, or mutate a shared agency.
export async function fillSsoProfile(pool: Pool, userId: string, externalId: string | null, payload: Record<string, unknown>) {
  if (!externalId) return;
  const fields = ssoProfileFields(payload);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL statement_timeout = '5s'");
    const user = (await c.query('SELECT id,name,email,role,status,external_id AS "externalId",agency_id AS "agencyId",company_name AS "companyName",country,phone FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
    if (!user || user.role !== 'agent' || user.status !== 'active' || user.externalId !== externalId) {
      await c.query('ROLLBACK');
      return;
    }
    const companyName = blank(user.companyName) ? fields.companyName : user.companyName;
    const country = blank(user.country) ? fields.country : user.country;
    const phone = blank(user.phone) ? fields.phone : user.phone;
    let agencyId = user.agencyId;
    if (!agencyId && valid('agencyName', companyName) && valid('country', country) && valid('phone', phone) && valid('name', user.name) && validEmail(user.email)) {
      agencyId = 'agency-' + crypto.randomUUID();
      await c.query('INSERT INTO agencies(id,name,status,country,contact_email,contact_phone,primary_contact_name,primary_contact_email) VALUES($1,$2,$3,$4,$5,$6,$7,$5)', [agencyId,companyName,'active',country,user.email,phone,user.name]);
    }
    if (companyName !== user.companyName || country !== user.country || phone !== user.phone || agencyId !== user.agencyId) {
      await c.query('UPDATE users SET company_name=$2,country=$3,phone=$4,agency_id=$5 WHERE id=$1', [user.id,companyName,country,phone,agencyId]);
    }
    await c.query('COMMIT');
  } catch (error) {
    await c.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { c.release(); }
}
