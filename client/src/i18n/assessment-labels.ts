import { legacyLocale } from '@/lib/legacy-ui';

// Complete sentences preserve number order and grammar in every supported locale.
const labels: Record<string, readonly [string, string, string, string]> = {
 en: ['Question {current} of {total}', 'Pass: {percent}%', 'You need {percent}% to pass. Please review the content and try again.', 'Answered: {answered} / {total}'],
 tr: ['Soru {current} / {total}', 'Geçme notu: %{percent}', 'Geçmek için en az %{percent} almalısınız. İçeriği gözden geçirip tekrar deneyin.', 'Yanıtlanan: {answered} / {total}'],
 ar: ['السؤال {current} من {total}', 'درجة النجاح: {percent}٪', 'تحتاج إلى {percent}٪ للنجاح. يرجى مراجعة المحتوى والمحاولة مرة أخرى.', 'تمت الإجابة: {answered} / {total}'],
 fr: ['Question {current} sur {total}', 'Seuil de réussite : {percent} %', 'Vous devez obtenir {percent} % pour réussir. Revoyez le contenu et réessayez.', 'Réponses : {answered} / {total}'],
 ru: ['Вопрос {current} из {total}', 'Проходной балл: {percent}%', 'Для прохождения нужно набрать {percent}%. Повторите материал и попробуйте снова.', 'Отвечено: {answered} / {total}'],
 fa: ['پرسش {current} از {total}', 'حد نصاب قبولی: {percent}٪', 'برای قبولی به {percent}٪ نیاز دارید. مطالب را مرور کنید و دوباره تلاش کنید.', 'پاسخ داده‌شده: {answered} / {total}'],
 zh: ['第 {current} 题，共 {total} 题', '及格分数：{percent}%', '需要达到 {percent}% 才能通过。请复习内容后重试。', '已作答：{answered} / {total}'],
 hi: ['प्रश्न {current}, कुल {total}', 'उत्तीर्ण अंक: {percent}%', 'उत्तीर्ण होने के लिए {percent}% अंक चाहिए। सामग्री की समीक्षा करके फिर प्रयास करें।', 'दिए गए उत्तर: {answered} / {total}'],
 es: ['Pregunta {current} de {total}', 'Mínimo para aprobar: {percent} %', 'Necesitas un {percent} % para aprobar. Repasa el contenido e inténtalo de nuevo.', 'Respondidas: {answered} / {total}'],
 id: ['Pertanyaan {current} dari {total}', 'Nilai kelulusan: {percent}%', 'Anda memerlukan {percent}% untuk lulus. Pelajari kembali materi dan coba lagi.', 'Terjawab: {answered} / {total}'],
 ur: ['سوال {current} از {total}', 'کامیابی کے لیے: {percent}٪', 'کامیاب ہونے کے لیے {percent}٪ درکار ہیں۔ مواد کا جائزہ لے کر دوبارہ کوشش کریں۔', 'دیے گئے جواب: {answered} / {total}'],
 tk: ['Sorag {current} / {total}', 'Geçiş bahasy: {percent}%', 'Geçmek üçin {percent}% gerek. Mazmuny gaýtadan gözden geçirip, täzeden synanyşyň.', 'Jogap berlen: {answered} / {total}'],
 ky: ['Суроо {current} / {total}', 'Өтүү упайы: {percent}%', 'Өтүү үчүн {percent}% керек. Материалды кайталап, кайра аракет кылыңыз.', 'Жооп берилди: {answered} / {total}'],
 kk: ['Сұрақ {current} / {total}', 'Өту балы: {percent}%', 'Өту үшін {percent}% жинау қажет. Материалды қайталап, қайта көріңіз.', 'Жауап берілді: {answered} / {total}'],
 uz: ['{total} ta savoldan {current}-savol', 'O‘tish bali: {percent}%', 'O‘tish uchun {percent}% kerak. Materialni takrorlab, yana urinib ko‘ring.', 'Javob berildi: {answered} / {total}'],
 tg: ['Саволи {current} аз {total}', 'Ҳадди гузариш: {percent}%', 'Барои гузаштан {percent}% лозим аст. Маводро такрор карда, боз кӯшиш кунед.', 'Ҷавоб дода шуд: {answered} / {total}'],
 bn: ['প্রশ্ন {current}, মোট {total}', 'পাস নম্বর: {percent}%', 'পাস করতে {percent}% নম্বর প্রয়োজন। বিষয়বস্তু পর্যালোচনা করে আবার চেষ্টা করুন।', 'উত্তর দেওয়া হয়েছে: {answered} / {total}'],
 pt: ['Pergunta {current} de {total}', 'Nota mínima: {percent}%', 'Precisa de {percent}% para passar. Reveja o conteúdo e tente novamente.', 'Respondidas: {answered} / {total}'],
 ne: ['प्रश्न {current}, जम्मा {total}', 'उत्तीर्ण अङ्क: {percent}%', 'उत्तीर्ण हुन {percent}% चाहिन्छ। सामग्री समीक्षा गरेर फेरि प्रयास गर्नुहोस्।', 'दिइएका उत्तर: {answered} / {total}'],
 vi: ['Câu hỏi {current} trên {total}', 'Điểm đạt: {percent}%', 'Bạn cần đạt {percent}% để vượt qua. Hãy ôn lại nội dung và thử lại.', 'Đã trả lời: {answered} / {total}'],
 ko: ['전체 {total}문항 중 {current}번', '합격 기준: {percent}%', '합격하려면 {percent}% 이상이 필요합니다. 내용을 복습한 후 다시 시도하세요.', '답변 완료: {answered} / {total}'],
 uk: ['Запитання {current} з {total}', 'Прохідний бал: {percent}%', 'Для проходження потрібно набрати {percent}%. Повторіть матеріал і спробуйте ще раз.', 'Відповіді: {answered} / {total}'],
 it: ['Domanda {current} di {total}', 'Soglia di superamento: {percent}%', 'Serve il {percent}% per superare la prova. Ripassa il contenuto e riprova.', 'Risposte: {answered} / {total}'],
};
export function assessmentText(index: 0 | 1 | 2 | 3, values: Record<string, number>) {
 const text = (labels[legacyLocale()] || labels.en)[index];
 const ordered = index === 3 ? text.replace('{answered} / {total}', '\u2066{answered} / {total}\u2069') : text;
 return ordered.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token));
}
