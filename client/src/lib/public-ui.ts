import {useTranslation} from 'react-i18next';
import {normalizeLanguage} from '@/i18n/languages';
import i18n from '@/i18n';
import catalog from './public-ui-catalog.json';
type Dictionary=Record<string,Record<string,string>>;
// Add only missing common-resource labels; preserve every existing translation.
for(const [language, dictionary] of Object.entries(catalog as Dictionary)) {
 for(const [key, value] of Object.entries(dictionary)) {
  if(!/^(auth|common|language|toast)\./.test(key) || i18n.getResource(language,'common',key)!==undefined) continue;
  i18n.addResource(language,'common',key,value);
 }
}
export function usePublicUi(){
 const {i18n}=useTranslation();
 const locale=normalizeLanguage(i18n.resolvedLanguage||i18n.language);
 const tl=(key:string,params:Record<string,string>={})=>{
  const dictionaries=catalog as Dictionary;
  const text=dictionaries[locale]?.[key]||dictionaries.en[key]||dictionaries[locale]?.['Failed to process password reset request']||'Request failed';
  return text.replace(/\{([A-Za-z_][\w.]*)\}/g,(token,name)=>params[name]??token);
 };
 return {tl,locale};
}
