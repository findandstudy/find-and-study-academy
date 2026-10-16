const labels: Record<string, string[]> = {
fr: ["Formation des agents","Progression globale","{{done}} leçons sur {{total}}","Terminé","Examen final","Terminez toutes les leçons","Terminez tous les quiz","Quiz rapide","Vérifiez vos connaissances avant de continuer","Commencer le quiz","Marquer comme terminée","Terminez le quiz d’abord","Sélectionnez une leçon pour commencer","À propos de {{country}}","Enseignement supérieur et programmes","Candidatures et documents","Visa et séjour","Logement et coûts","Travail et carrière","Offres de services","Outils et ressources","Pages des établissements"],
it: ["Formazione per agenti","Avanzamento complessivo","{{done}} lezioni su {{total}}","Completato","Esame finale","Completa tutte le lezioni","Completa tutti i quiz","Quiz breve","Verifica le tue conoscenze prima di continuare","Inizia il quiz","Segna come completata","Completa prima il quiz","Seleziona una lezione per iniziare","Informazioni su {{country}}","Istruzione superiore e programmi","Domande e documenti","Visto e soggiorno","Alloggio e costi","Lavoro e carriera","Pacchetti di servizi","Strumenti e risorse","Pagine degli istituti"],
pt: ["Formação de agentes","Progresso geral","{{done}} de {{total}} lições","Concluído","Exame final","Conclua todas as lições","Conclua todos os questionários","Questionário breve","Teste os seus conhecimentos antes de continuar","Iniciar questionário","Marcar como concluída","Conclua primeiro o questionário","Selecione uma lição para começar","Sobre {{country}}","Ensino superior e programas","Candidaturas e documentos","Visto e residência","Alojamento e custos","Trabalho e carreira","Pacotes de serviços","Ferramentas e recursos","Páginas das instituições"],
ru: ["Обучение агентов","Общий прогресс","{{done}} из {{total}} уроков","Завершено","Итоговый экзамен","Завершите все уроки","Пройдите все тесты","Краткий тест","Проверьте знания перед продолжением","Начать тест","Отметить как завершённый","Сначала пройдите тест","Выберите урок, чтобы начать обучение","О стране: {{country}}","Высшее образование и программы","Подача заявок и документы","Виза и проживание","Жильё и расходы","Работа и карьера","Пакеты услуг","Инструменты и ресурсы","Страницы учебных заведений"],
uk: ["Навчання агентів","Загальний прогрес","{{done}} із {{total}} уроків","Завершено","Підсумковий іспит","Завершіть усі уроки","Пройдіть усі тести","Короткий тест","Перевірте знання перед продовженням","Розпочати тест","Позначити як завершений","Спочатку пройдіть тест","Виберіть урок, щоб розпочати навчання","Про країну: {{country}}","Вища освіта та програми","Подання заяв і документи","Віза та проживання","Житло й витрати","Робота та кар’єра","Пакети послуг","Інструменти та ресурси","Сторінки навчальних закладів"],
zh: ["代理培训","总体进度","已完成 {{done}} / {{total}} 节课","已完成","期末考试","请完成所有课程","请完成所有测验","小测验","继续学习前，请检验所学知识","开始测验","标记为已完成","请先完成测验","请选择一节课开始学习","关于{{country}}","高等教育与专业","申请与材料","签证与居留","住宿与费用","工作与职业发展","服务套餐","工具与资源","院校页面"],
ar: ["تدريب الوكلاء","التقدم الإجمالي","{{done}} من أصل {{total}} درسًا","مكتمل","الاختبار النهائي","أكمل جميع الدروس","أكمل جميع الاختبارات","اختبار قصير","اختبر معلوماتك قبل المتابعة","ابدأ الاختبار","وضع علامة كمكتمل","أكمل الاختبار أولًا","اختر درسًا لبدء التعلم","نبذة عن {{country}}","التعليم العالي والبرامج","التقديم والمستندات","التأشيرة والإقامة","السكن والتكاليف","العمل والمسار المهني","باقات الخدمات","الأدوات والموارد","صفحات المؤسسات التعليمية"],
fa: ["آموزش نمایندگان","پیشرفت کلی","{{done}} از {{total}} درس","تکمیل‌شده","آزمون نهایی","همه درس‌ها را تکمیل کنید","همه آزمون‌ها را تکمیل کنید","آزمون کوتاه","پیش از ادامه، دانش خود را بسنجید","شروع آزمون","علامت‌گذاری به‌عنوان تکمیل‌شده","ابتدا آزمون را تکمیل کنید","برای شروع یادگیری، یک درس انتخاب کنید","درباره {{country}}","آموزش عالی و برنامه‌ها","درخواست‌ها و مدارک","ویزا و اقامت","مسکن و هزینه‌ها","کار و مسیر شغلی","بسته‌های خدمات","ابزارها و منابع","صفحات مؤسسات آموزشی"],
hi: ["एजेंट प्रशिक्षण","कुल प्रगति","{{total}} में से {{done}} पाठ","पूर्ण","अंतिम परीक्षा","सभी पाठ पूरे करें","सभी प्रश्नोत्तरी पूरी करें","छोटी प्रश्नोत्तरी","आगे बढ़ने से पहले अपना ज्ञान जाँचें","प्रश्नोत्तरी शुरू करें","पूर्ण के रूप में चिह्नित करें","पहले प्रश्नोत्तरी पूरी करें","सीखना शुरू करने के लिए एक पाठ चुनें","{{country}} के बारे में","उच्च शिक्षा और कार्यक्रम","आवेदन और दस्तावेज़","वीज़ा और निवास","आवास और खर्च","काम और करियर","सेवा पैकेज","उपकरण और संसाधन","शिक्षण संस्थानों के पृष्ठ"],
id: ["Pelatihan Agen","Kemajuan Keseluruhan","{{done}} dari {{total}} pelajaran","Selesai","Ujian Akhir","Selesaikan semua pelajaran","Selesaikan semua kuis","Kuis Singkat","Uji pengetahuan Anda sebelum melanjutkan","Mulai Kuis","Tandai sebagai Selesai","Selesaikan kuis terlebih dahulu","Pilih pelajaran untuk mulai belajar","Tentang {{country}}","Pendidikan Tinggi dan Program","Pendaftaran dan Dokumen","Visa dan Izin Tinggal","Akomodasi dan Biaya","Pekerjaan dan Karier","Paket Layanan","Alat dan Sumber Daya","Halaman Institusi Pendidikan"],
en: ['Agent Training','Overall Progress','{{done}} of {{total}} lessons','Completed','Final Exam','Complete all lessons','Complete all quizzes','Mini Quiz','Test your knowledge before moving forward','Start Quiz','Mark as Complete','Complete quiz first','Select a lesson to start learning','About {{country}}','Higher Education & Programs','Applications & Documents','Visa & Residence','Housing & Costs','Work & Career','Packages (Services)','Tools & Resources','School Pages'],
es: ['Formación de agentes','Progreso general','{{done}} de {{total}} lecciones','Completado','Examen final','Completa todas las lecciones','Completa todos los cuestionarios','Cuestionario breve','Comprueba tus conocimientos antes de continuar','Iniciar cuestionario','Marcar como completada','Completa primero el cuestionario','Selecciona una lección para empezar','Acerca de {{country}}','Educación superior y programas','Solicitudes y documentos','Visado y residencia','Alojamiento y costes','Trabajo y carrera profesional','Paquetes de servicios','Herramientas y recursos','Páginas de centros educativos'],
tr: ['Acente Eğitimi','Genel ilerleme','{{total}} dersin {{done}} tanesi','Tamamlandı','Final sınavı','Tüm dersleri tamamlayın','Tüm sınavları tamamlayın','Kısa sınav','Devam etmeden önce bilginizi sınayın','Sınavı başlat','Tamamlandı olarak işaretle','Önce sınavı tamamlayın','Başlamak için bir ders seçin','{{country}} hakkında','Yükseköğretim ve programlar','Başvurular ve belgeler','Vize ve oturum','Konaklama ve maliyetler','Çalışma ve kariyer','Hizmet paketleri','Araçlar ve kaynaklar','Okul sayfaları']
};
export function courseText(language:string,index:number,values:Record<string,string|number>={}) {let text=(labels[language.split('-')[0]]||labels.en)[index];for(const [key,value] of Object.entries(values))text=text.replaceAll('{{'+key+'}}',String(value));return text;}
export function countryLabel(language:string,code:string,fallback:string){try{const region=({UK:'GB',USA:'US'} as Record<string,string>)[code.toUpperCase()]||code.toUpperCase();return new Intl.DisplayNames([language],{type:'region'}).of(region)||fallback;}catch{return fallback;}}
const sectionDetails: Record<string,string[]> = {
  "en": [
    "English Courses & Schools",
    "Applications & Funding",
    "Preparing Students & Applications",
    "Registration & Documents",
    "Visa & Stay",
    "Visas & Immigration",
    "Student Experience: Housing & Costs",
    "Student Employability",
    "Work & Lifestyle",
    "Introduction",
    "Ecosystem",
    "Partnership Model",
    "Services",
    "Find And Study Pathway Program",
    "Education system: {{country}}",
    "Post-secondary education: {{country}}",
    "Higher education system: {{country}}"
  ],
  "es": [
    "Cursos de inglés y centros de idiomas",
    "Solicitudes y financiación",
    "Preparación de estudiantes y solicitudes",
    "Inscripción y documentos",
    "Visado y estancia",
    "Visados e inmigración",
    "Experiencia estudiantil: alojamiento y costes",
    "Empleabilidad estudiantil",
    "Trabajo y estilo de vida",
    "Introducción",
    "Ecosistema",
    "Modelo de colaboración",
    "Servicios",
    "Programa de acceso de Find And Study",
    "Sistema educativo: {{country}}",
    "Educación postsecundaria: {{country}}",
    "Sistema de educación superior: {{country}}"
  ],
  "tr": [
    "İngilizce kursları ve okullar",
    "Başvurular ve finansman",
    "Öğrenci hazırlığı ve başvurular",
    "Kayıt ve belgeler",
    "Vize ve kalış",
    "Vizeler ve göçmenlik",
    "Öğrenci deneyimi: konaklama ve maliyetler",
    "Öğrencilerin istihdam olanakları",
    "Çalışma ve yaşam tarzı",
    "Giriş",
    "Ekosistem",
    "İş ortaklığı modeli",
    "Hizmetler",
    "Find And Study geçiş programı",
    "Eğitim sistemi: {{country}}",
    "Ortaöğretim sonrası eğitim: {{country}}",
    "Yükseköğretim sistemi: {{country}}"
  ],
  "fr": [
    "Cours d’anglais et écoles de langues",
    "Candidatures et financement",
    "Préparation des étudiants et candidatures",
    "Inscription et documents",
    "Visa et séjour",
    "Visas et immigration",
    "Expérience étudiante : logement et coûts",
    "Employabilité des étudiants",
    "Travail et mode de vie",
    "Introduction",
    "Écosystème",
    "Modèle de partenariat",
    "Services",
    "Programme passerelle Find And Study",
    "Système éducatif : {{country}}",
    "Enseignement postsecondaire : {{country}}",
    "Système d’enseignement supérieur : {{country}}"
  ],
  "it": [
    "Corsi di inglese e scuole di lingua",
    "Domande e finanziamenti",
    "Preparazione degli studenti e domande",
    "Iscrizione e documenti",
    "Visto e permanenza",
    "Visti e immigrazione",
    "Esperienza studentesca: alloggio e costi",
    "Occupabilità degli studenti",
    "Lavoro e stile di vita",
    "Introduzione",
    "Ecosistema",
    "Modello di collaborazione",
    "Servizi",
    "Programma di accesso Find And Study",
    "Sistema educativo: {{country}}",
    "Istruzione postsecondaria: {{country}}",
    "Sistema di istruzione superiore: {{country}}"
  ],
  "pt": [
    "Cursos de inglês e escolas de línguas",
    "Candidaturas e financiamento",
    "Preparação de estudantes e candidaturas",
    "Inscrição e documentos",
    "Visto e estadia",
    "Vistos e imigração",
    "Experiência estudantil: alojamento e custos",
    "Empregabilidade dos estudantes",
    "Trabalho e estilo de vida",
    "Introdução",
    "Ecossistema",
    "Modelo de parceria",
    "Serviços",
    "Programa de acesso Find And Study",
    "Sistema educativo: {{country}}",
    "Ensino pós-secundário: {{country}}",
    "Sistema de ensino superior: {{country}}"
  ],
  "ru": [
    "Курсы английского языка и языковые школы",
    "Подача заявок и финансирование",
    "Подготовка студентов и подача заявок",
    "Регистрация и документы",
    "Виза и пребывание",
    "Визы и иммиграция",
    "Студенческая жизнь: жильё и расходы",
    "Трудоустройство студентов",
    "Работа и образ жизни",
    "Введение",
    "Экосистема",
    "Модель партнёрства",
    "Услуги",
    "Подготовительная программа Find And Study",
    "Система образования: {{country}}",
    "Послешкольное образование: {{country}}",
    "Система высшего образования: {{country}}"
  ],
  "uk": [
    "Курси англійської мови та мовні школи",
    "Подання заяв і фінансування",
    "Підготовка студентів і подання заяв",
    "Реєстрація та документи",
    "Віза та перебування",
    "Візи й імміграція",
    "Студентське життя: житло й витрати",
    "Працевлаштування студентів",
    "Робота та спосіб життя",
    "Вступ",
    "Екосистема",
    "Модель партнерства",
    "Послуги",
    "Підготовча програма Find And Study",
    "Система освіти: {{country}}",
    "Післяшкільна освіта: {{country}}",
    "Система вищої освіти: {{country}}"
  ],
  "zh": [
    "英语课程与语言学校",
    "申请与资助",
    "学生准备与申请",
    "注册与材料",
    "签证与停留",
    "签证与移民",
    "学生体验：住宿与费用",
    "学生就业能力",
    "工作与生活方式",
    "介绍",
    "生态体系",
    "合作模式",
    "服务",
    "Find And Study 衔接课程",
    "{{country}}教育体系",
    "{{country}}中学后教育",
    "{{country}}高等教育体系"
  ],
  "ar": [
    "دورات اللغة الإنجليزية ومدارس اللغات",
    "التقديم والتمويل",
    "إعداد الطلاب وطلبات التقديم",
    "التسجيل والمستندات",
    "التأشيرة والبقاء",
    "التأشيرات والهجرة",
    "تجربة الطالب: السكن والتكاليف",
    "قابلية توظيف الطلاب",
    "العمل ونمط الحياة",
    "مقدمة",
    "المنظومة",
    "نموذج الشراكة",
    "الخدمات",
    "برنامج Find And Study التمهيدي",
    "نظام التعليم: {{country}}",
    "التعليم بعد المرحلة الثانوية: {{country}}",
    "نظام التعليم العالي: {{country}}"
  ],
  "fa": [
    "دوره‌های انگلیسی و آموزشگاه‌های زبان",
    "درخواست‌ها و تأمین مالی",
    "آماده‌سازی دانشجویان و درخواست‌ها",
    "ثبت‌نام و مدارک",
    "ویزا و مدت اقامت",
    "ویزا و مهاجرت",
    "تجربه دانشجویی: مسکن و هزینه‌ها",
    "اشتغال‌پذیری دانشجویان",
    "کار و سبک زندگی",
    "معرفی",
    "زیست‌بوم",
    "مدل همکاری",
    "خدمات",
    "برنامه آمادگی ورود به دانشگاه Find And Study",
    "نظام آموزشی: {{country}}",
    "آموزش پس از متوسطه: {{country}}",
    "نظام آموزش عالی: {{country}}"
  ],
  "hi": [
    "अंग्रेज़ी पाठ्यक्रम और भाषा विद्यालय",
    "आवेदन और वित्तीय सहायता",
    "छात्रों की तैयारी और आवेदन",
    "पंजीकरण और दस्तावेज़",
    "वीज़ा और ठहराव",
    "वीज़ा और आप्रवासन",
    "छात्र अनुभव: आवास और खर्च",
    "छात्रों की रोजगार क्षमता",
    "काम और जीवनशैली",
    "परिचय",
    "पारिस्थितिकी तंत्र",
    "साझेदारी मॉडल",
    "सेवाएँ",
    "Find And Study प्रवेश तैयारी कार्यक्रम",
    "शिक्षा प्रणाली: {{country}}",
    "माध्यमिक शिक्षा के बाद की शिक्षा: {{country}}",
    "उच्च शिक्षा प्रणाली: {{country}}"
  ],
  "id": [
    "Kursus Bahasa Inggris dan Sekolah Bahasa",
    "Pendaftaran dan Pendanaan",
    "Persiapan Mahasiswa dan Pendaftaran",
    "Registrasi dan Dokumen",
    "Visa dan Masa Tinggal",
    "Visa dan Imigrasi",
    "Pengalaman Mahasiswa: Akomodasi dan Biaya",
    "Kesiapan Kerja Mahasiswa",
    "Pekerjaan dan Gaya Hidup",
    "Pengantar",
    "Ekosistem",
    "Model Kemitraan",
    "Layanan",
    "Program Persiapan Masuk Find And Study",
    "Sistem Pendidikan: {{country}}",
    "Pendidikan Pascasekolah Menengah: {{country}}",
    "Sistem Pendidikan Tinggi: {{country}}"
  ]
};
export function sectionLabel(language:string,title:string,country:string){
 const lang=language.split('-')[0];if(!labels[lang]||lang==='en')return title;
 const details=sectionDetails[lang]||sectionDetails.en;
 const detail=(i:number)=>details[i].replaceAll('{{country}}',country);
 if(title==='Find And Study Pathway Program')return detail(13);
 const match=title.match(/^([AG]\d+)\s*[—–-]\s*(.+)$/);if(!match)return title;
 const [,code,name]=match;
 let text:string|undefined;
 if(code==='G1'&&name==='Introduction')text=detail(9);
 else if(code==='G2'&&name==='Ecosystem')text=detail(10);
 else if(code==='G3'&&name==='Partnership Model')text=detail(11);
 else if(code==='G4'&&name==='Services')text=detail(12);
 else if(code==='A1'&&name.startsWith('About '))text=courseText(lang,13,{country});
 else if(code==='A2'&&name==='English Courses & Schools')text=detail(0);
 else if(code==='A2'&&name.includes('Post-Secondary System'))text=detail(15);
 else if(code==='A2'&&name.includes('Higher Education System'))text=detail(16);
 else if(code==='A2'&&name.endsWith('Education System'))text=detail(14);
 else {
  const special:Record<string,number>={'Applications & Funding':1,'Preparing Students & Applications':2,'Registration & Documents':3,'Visa & Stay':4,'Visas & Immigration':5,'Student Experience: Housing & Costs':6,'Student Employability':7,'Work & Lifestyle':8};
  const generic:Record<string,number>={'Higher Education & Programs':14,'Applications & Documents':15,'Visa & Residence':16,'Housing & Costs':17,'Work & Career':18,'Packages (Services)':19,'Tools & Resources':20,'School Pages':21};
  if(name in special)text=detail(special[name]);else if(name in generic)text=courseText(lang,generic[name]);
 }
 return text?code+' — '+text:title;
}
