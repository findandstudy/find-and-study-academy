import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {normalizeLanguage,getLanguageMeta} from '@/i18n/languages';
import catalog from './translation-control-catalog.json';
type Catalog=Record<string,Record<string,string>>;
for(const [language,strings]of Object.entries(catalog as Catalog))i18n.addResource(language,'common','nav.items.translationControl',strings['Translation control']);
export function useControlUi(){const {i18n}=useTranslation();const locale=normalizeLanguage(i18n.resolvedLanguage||i18n.language);return {locale,dir:getLanguageMeta(locale).dir,tr:(key:string)=>(catalog as Catalog)[locale]?.[key]||(catalog as Catalog).en[key]||key};}
