import {legacyLocale,legacyUi} from '@/lib/legacy-ui';
import publicCatalog from '@/lib/public-ui-catalog.json';
// PDF prose uses browser Unicode shaping, just like recipient and course names.
const labels:Record<string,readonly string[]>={
 "en": [
  "Date of Issue",
  "Scan to verify",
  "Independent Agent"
 ],
 "tr": [
  "Düzenlenme tarihi",
  "Doğrulamak için tarayın",
  "Bağımsız danışman"
 ],
 "ar": [
  "تاريخ الإصدار",
  "امسح للتحقق",
  "وكيل مستقل"
 ],
 "fr": [
  "Date de délivrance",
  "Scannez pour vérifier",
  "Agent indépendant"
 ],
 "ru": [
  "Дата выдачи",
  "Сканируйте для проверки",
  "Независимый агент"
 ],
 "fa": [
  "تاریخ صدور",
  "برای تأیید اسکن کنید",
  "نماینده مستقل"
 ],
 "zh": [
  "签发日期",
  "扫码验证",
  "独立代理"
 ],
 "hi": [
  "जारी करने की तिथि",
  "सत्यापन के लिए स्कैन करें",
  "स्वतंत्र एजेंट"
 ],
 "es": [
  "Fecha de expedición",
  "Escanea para verificar",
  "Agente independiente"
 ],
 "id": [
  "Tanggal penerbitan",
  "Pindai untuk verifikasi",
  "Agen independen"
 ],
 "ur": [
  "اجراء کی تاریخ",
  "تصدیق کے لیے اسکین کریں",
  "آزاد ایجنٹ"
 ],
 "tk": [
  "Berlen senesi",
  "Barlamak üçin skanirläň",
  "Garaşsyz agent"
 ],
 "ky": [
  "Берилген күнү",
  "Текшерүү үчүн сканерлеңиз",
  "Көз карандысыз агент"
 ],
 "kk": [
  "Берілген күні",
  "Тексеру үшін сканерлеңіз",
  "Тәуелсіз агент"
 ],
 "uz": [
  "Berilgan sana",
  "Tekshirish uchun skanerlang",
  "Mustaqil agent"
 ],
 "tg": [
  "Санаи додан",
  "Барои санҷиш скан кунед",
  "Агенти мустақил"
 ],
 "bn": [
  "প্রদানের তারিখ",
  "যাচাই করতে স্ক্যান করুন",
  "স্বতন্ত্র এজেন্ট"
 ],
 "pt": [
  "Data de emissão",
  "Digitalize para verificar",
  "Agente independente"
 ],
 "ne": [
  "जारी मिति",
  "प्रमाणीकरणका लागि स्क्यान गर्नुहोस्",
  "स्वतन्त्र एजेन्ट"
 ],
 "vi": [
  "Ngày cấp",
  "Quét để xác minh",
  "Đại lý độc lập"
 ],
 "ko": [
  "발급일",
  "스캔하여 확인",
  "독립 에이전트"
 ],
 "uk": [
  "Дата видачі",
  "Скануйте для перевірки",
  "Незалежний агент"
 ],
 "it": [
  "Data di rilascio",
  "Scansiona per verificare",
  "Agente indipendente"
 ]
};
export function certificateLabel(index:number){
 const locale=legacyLocale();
 if(index===0)return (publicCatalog as Record<string,Record<string,string>>)[locale]['Recipient:'];
 if(index===1)return legacyUi('Agency');
 if(index===2)return legacyUi('Course');
 return (labels[locale]||labels.en)[index-3];
}
