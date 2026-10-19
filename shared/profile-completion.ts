import { z } from 'zod';
import { publicSignupSchema } from './signup-validation';
import { COUNTRY_DIAL_CODES } from './country-dial-codes';

const countryNames = new Map<string,string>();
const countryKey=(value:string)=>value.normalize('NFKD').replace(new RegExp('\\p{M}','gu'),'').toLowerCase().trim();
for(const language of ['tr','en']){
 const names=new Intl.DisplayNames([language],{type:'region'});
 for(const {code} of COUNTRY_DIAL_CODES){countryNames.set(countryKey(code),code);countryNames.set(countryKey(names.of(code)||code),code);}
}
countryNames.set('turkey','TR');
// The legacy agency editor stores Turkish country names; user profiles store ISO codes.
export const agencyCountryCode=(value:unknown)=>typeof value==='string'?countryNames.get(countryKey(value)):undefined;

export const completionSchema = publicSignupSchema.pick({name:true, agencyName:true, country:true, phone:true});
export const validEmail = (value: unknown) => z.string().trim().email().safeParse(value).success;
const valid = (key: 'name'|'agencyName'|'country'|'phone', value: unknown) => publicSignupSchema.shape[key].safeParse(value).success;
export function completionState(user: any, agency: any) {
  if (user.role !== 'agent') return { required:false, missing:[] as string[] };
  const missing: string[] = [];
  if (!valid('name',user.name)) missing.push('name');
  if (!validEmail(user.email)) missing.push('email');
  if (!valid('country',user.country)) missing.push('country');
  if (!valid('phone',user.phone)) missing.push('phone');
  if (!agency || !valid('agencyName',agency.name)) missing.push('agencyName');
  if (!agency || !agencyCountryCode(agency.country)) missing.push('agencyCountry');
  if (!agency || !(validEmail(agency.contactEmail)||validEmail(agency.primaryContactEmail))) missing.push('agencyEmail');
  if (!agency || !(valid('phone',agency.contactPhone)||valid('phone',agency.phone))) missing.push('agencyPhone');
  return {required:missing.length>0,missing};
}
export const validCompletionValue = valid;
