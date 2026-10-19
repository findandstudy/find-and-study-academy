import './campaign-i18n';
import {useTranslation} from 'react-i18next';
import {normalizeLanguage,getLanguageMeta} from '@/i18n/languages';
import catalog from './academy-ui-catalog.json';
type Dictionary=Record<string,Record<string,string>>;
export function useAcademyUi(){
 const {i18n}=useTranslation();const locale=normalizeLanguage(i18n.resolvedLanguage||i18n.language);
 const tl=(source:string,params:Record<string,string>={})=>{
  const text=(catalog as Dictionary)[locale]?.[source]||(catalog as Dictionary).en?.[source]||source;
  return text.replace(/\{([A-Za-z_][\w.]*)\}/g,(token,key)=>params[key]??token);
 };
 const message=(raw:string)=>{
  let value=raw.replace(/^\d+:\s*/, '');try{const parsed=JSON.parse(value);value=parsed.message||parsed.error||value;}catch{}
  const codes:Record<string,string>={INVALID_INPUT:'Invalid input. Check the form.',PROMO_INVALID_OR_EXPIRED:'This campaign code is invalid or expired.',PROMO_LIMIT_REACHED:'This campaign has reached its registration limit.',EMAIL_CODE_INVALID:'The email verification code is invalid or expired.',WAIT_BEFORE_RESEND:'Wait before requesting another email code.',EMAIL_DELIVERY_FAILED:'Email could not be delivered. Try again later.',ACCESS_EXPIRED:'Your access period has ended.',LOGIN_REQUIRED:'Sign in again to continue.',DEVICE_LIST_CHANGED:'The device list changed. Sign in again.',NOT_FOUND:'User not found.',ACCOUNT_PENDING:'Your account is awaiting approval.'};value=codes[value]||value;
  return tl((catalog as Dictionary).en?.[value]?value:'Request failed');
 };
 return {tl,locale,dir:getLanguageMeta(locale).dir,message};
}
