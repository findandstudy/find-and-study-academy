import { partnershipCopy } from '@/lib/partnership-copy';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { normalizeLanguage } from '@/i18n/languages';
// Navigation only: learning access does not imply approved partnership.
const copy:Record<string,string[]>={
 en:['Start here','Explore a destination, study its training and review the partner resources.','Learn about destinations','Review partner resources'],
 tr:['Buradan başlayın','Bir destinasyon seçin, eğitimini inceleyin ve partner kaynaklarına göz atın.','Destinasyonları öğrenin','Partner kaynaklarını inceleyin'],
 ar:['ابدأ هنا','اختر وجهة وادرس موادها التدريبية واطلع على موارد الشركاء.','تعرّف على الوجهات','اطلع على موارد الشركاء'],
 fr:['Commencez ici','Choisissez une destination, suivez sa formation et consultez les ressources partenaires.','Découvrir les destinations','Consulter les ressources partenaires'],
 ru:['Начните здесь','Выберите направление, изучите учебные материалы и ресурсы для партнёров.','Изучить направления','Ресурсы для партнёров'],
 fa:['از اینجا شروع کنید','یک مقصد انتخاب کنید، آموزش آن را مطالعه کنید و منابع همکاران را ببینید.','آشنایی با مقصدها','بررسی منابع همکاران'],
 zh:['从这里开始','选择留学目的地，学习相关课程并查看合作伙伴资源。','了解留学目的地','查看合作伙伴资源'],
 hi:['यहाँ से शुरू करें','एक गंतव्य चुनें, उसका प्रशिक्षण पढ़ें और साझेदार संसाधन देखें।','गंतव्यों के बारे में जानें','साझेदार संसाधन देखें'],
 es:['Empieza aquí','Elige un destino, estudia su formación y consulta los recursos para socios.','Conocer los destinos','Consultar recursos para socios'],
 id:['Mulai di sini','Pilih destinasi, pelajari pelatihannya, dan lihat sumber daya mitra.','Pelajari destinasi','Lihat sumber daya mitra'],
 ur:['یہاں سے شروع کریں','ایک منزل منتخب کریں، اس کی تربیت پڑھیں اور پارٹنر وسائل دیکھیں۔','منزلوں کے بارے میں جانیں','پارٹنر وسائل دیکھیں'],
 tk:['Şu ýerden başlaň','Bir ugur saýlaň, onuň okuwyny öwreniň we hyzmatdaş çeşmelerine serediň.','Ugurlary öwreniň','Hyzmatdaş çeşmelerine serediň'],
 ky:['Бул жерден баштаңыз','Багытты тандап, анын окуу материалдарын жана өнөктөштөр үчүн ресурстарын караңыз.','Багыттар менен таанышыңыз','Өнөктөштөр үчүн ресурстар'],
 kk:['Осы жерден бастаңыз','Бағытты таңдап, оқу материалдарын және серіктестерге арналған ресурстарды қараңыз.','Бағыттармен танысу','Серіктестерге арналған ресурстар'],
 uz:['Shu yerdan boshlang','Yoʻnalishni tanlang, uning oʻquv materiallarini va hamkor resurslarini koʻrib chiqing.','Yoʻnalishlar bilan tanishing','Hamkor resurslarini koʻring'],
 tg:['Аз ин ҷо оғоз кунед','Самтро интихоб карда, маводи омӯзишӣ ва захираҳои шариконро бинед.','Бо самтҳо шинос шавед','Захираҳои шариконро бинед'],
 bn:['এখান থেকে শুরু করুন','একটি গন্তব্য বেছে নিন, প্রশিক্ষণ পড়ুন এবং অংশীদারদের উপকরণ দেখুন।','গন্তব্য সম্পর্কে জানুন','অংশীদারদের উপকরণ দেখুন'],
 pt:['Comece aqui','Escolha um destino, estude a formação e consulte os recursos para parceiros.','Conhecer os destinos','Consultar recursos para parceiros'],
 ne:['यहाँबाट सुरु गर्नुहोस्','गन्तव्य छान्नुहोस्, त्यसको प्रशिक्षण पढ्नुहोस् र साझेदार स्रोतहरू हेर्नुहोस्।','गन्तव्यबारे जान्नुहोस्','साझेदार स्रोतहरू हेर्नुहोस्'],
 vi:['Bắt đầu tại đây','Chọn điểm đến, học nội dung đào tạo và xem tài liệu dành cho đối tác.','Tìm hiểu các điểm đến','Xem tài liệu đối tác'],
 ko:['여기서 시작하세요','유학 목적지를 선택하고 교육 내용을 학습한 뒤 파트너 자료를 확인하세요.','유학 목적지 알아보기','파트너 자료 보기'],
 uk:['Почніть тут','Виберіть напрямок, вивчіть навчальні матеріали та ресурси для партнерів.','Дізнатися про напрямки','Ресурси для партнерів'],
 it:['Inizia da qui','Scegli una destinazione, studia la formazione e consulta le risorse per i partner.','Scopri le destinazioni','Consulta le risorse per i partner']
};
export function AgentStartGuide(){const {i18n}=useTranslation();const language=normalizeLanguage(i18n.resolvedLanguage||i18n.language);const r=copy[language]||copy.en;return <Card data-testid="agent-start-guide" className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>{r[0]}</CardTitle><p className="text-sm text-muted-foreground">{r[1]}</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Link href="/agent/courses" className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{r[2]}</Link><Link href="/agent/partner-zone" className="rounded-md border bg-background px-4 py-3 font-medium text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{r[3]}</Link><Link href="/agent/partnership" className="rounded-md border bg-background px-4 py-3 font-medium text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{partnershipCopy(language).text(0)}</Link></CardContent></Card>}
