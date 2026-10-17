import i18n from '@/i18n';
import catalog from './academy-ui-catalog.json';
const sources={"codeSent": "Verification code sent. Check your email.", "haveCode": "I have an invitation / promo code", "promoCode": "Invitation / promo code", "signupNotice": "An invitation code and email verification are required. Administrator approval is still required. Free access starts on registration.", "sendCode": "Send email verification code", "emailCode": "6-digit email verification code", "codeExpiry": "The code expires in 10 minutes. You can request another after 60 seconds.", "deviceLimit": "Two devices are already registered. Choose one to sign out and continue on this device. Other sessions on the removed device will stop working.", "replaceDevice": "Sign out this device and continue"};
for(const [language,dictionary] of Object.entries(catalog)){
 const d=dictionary as Record<string,string>;
 i18n.addResourceBundle(language,'common',{campaign:Object.fromEntries(Object.entries(sources).map(([key,source])=>[key,d[source]])),nav:{items:{operations:d['Operasyon Merkezi'],campaigns:d['Invitation campaigns']}}},true,true);
}
