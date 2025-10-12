import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Common
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.submit': 'Submit',
      'common.search': 'Search',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.confirm': 'Confirm',
      
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.courses': 'Courses',
      'nav.certificates': 'Certificates',
      'nav.leaderboard': 'Leaderboard',
      'nav.myAgency': 'My Agency',
      'nav.examsOrders': 'Exams/Orders',
      'nav.subscriptions': 'Subscriptions',
      'nav.profile': 'Profile',
      'nav.agentPortal': 'Agent Portal',
      'nav.dormBooking': 'Dorm Booking',
      'nav.signOut': 'Sign out',
      
      // Auth
      'auth.login': 'Login',
      'auth.signup': 'Sign Up',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.name': 'Full Name',
      'auth.agencyName': 'Agency Name',
      'auth.forgotPassword': 'Forgot Password?',
      'auth.noAccount': "Don't have an account?",
      'auth.hasAccount': 'Already have an account?',
      'auth.welcome': 'Welcome to Find And Study Academy',
      'auth.signInDescription': 'Sign in to access your courses and certificates',
      'auth.signUpDescription': 'Create your agent account to get started',
      'auth.invalidCredentials': 'Invalid email or password. Please try again.',
      
      // Dashboard
      'dashboard.welcome': 'Welcome back',
      'dashboard.totalCourses': 'Total Courses',
      'dashboard.certificates': 'Certificates',
      'dashboard.avgScore': 'Average Score',
      'dashboard.inProgress': 'In Progress',
      'dashboard.completed': 'Completed',
      'dashboard.recentActivity': 'Recent Activity',
      'dashboard.weeklyActivity': 'Weekly Activity',
      'dashboard.progressChart': 'Course Progress Over Time',
      'dashboard.recentAchievements': 'Recent Achievements',
      'dashboard.earnedCertificate': 'Earned Certificate',
      'dashboard.completedCourse': 'Completed Course',
      
      // Courses
      'courses.title': 'Courses',
      'courses.description': 'Browse and enroll in courses',
      'courses.allCourses': 'All Courses',
      'courses.myCourses': 'My Courses',
      'courses.startCourse': 'Start Course',
      'courses.continueCourse': 'Continue Course',
      'courses.viewCertificate': 'View Certificate',
      'courses.lessons': 'Lessons',
      'courses.quizzes': 'Quizzes',
      'courses.progress': 'Progress',
      'courses.notStarted': 'Not Started',
      
      // Certificates
      'certificates.title': 'Certificates',
      'certificates.description': 'View your earned certificates',
      'certificates.download': 'Download PDF',
      'certificates.verify': 'Verify Certificate',
      'certificates.issuedOn': 'Issued on',
      'certificates.score': 'Score',
      'certificates.noCertificates': 'No certificates earned yet',
      
      // Agency
      'agency.title': 'My Agency',
      'agency.description': 'Manage your agency information and profile',
      'agency.basicInfo': 'Basic Information',
      'agency.contactInfo': 'Contact Information',
      'agency.location': 'Location',
      'agency.agencyName': 'Agency Name',
      'agency.agencyLogo': 'Agency Logo',
      'agency.uploadLogo': 'Upload Logo',
      'agency.staffSize': 'Staff Size',
      'agency.annualStudents': 'Annual Students',
      'agency.website': 'Website',
      'agency.phone': 'Phone',
      'agency.primaryContactName': 'Primary Contact Name',
      'agency.primaryContactEmail': 'Primary Contact Email',
      'agency.address': 'Address',
      'agency.googleMapLink': 'Google Map Link',
      'agency.yandexMapLink': 'Yandex Map Link',
      'agency.saveChanges': 'Save Changes',
      'agency.updated': 'Agency Updated',
      'agency.updateSuccess': 'Agency information updated successfully',
      'agency.updateFailed': 'Update Failed',
      
      // Leaderboard
      'leaderboard.title': 'Leaderboard',
      'leaderboard.description': 'Top performing agents',
      'leaderboard.rank': 'Rank',
      'leaderboard.agent': 'Agent',
      'leaderboard.points': 'Points',
      'leaderboard.certificates': 'Certificates',
      'leaderboard.progress': 'Progress',
      'leaderboard.you': 'You',
      'leaderboard.pointsExplained': 'Points = Certificates × 100 + Progress %',
      
      // Profile
      'profile.title': 'Profile',
      'profile.editProfile': 'Edit Profile',
      'profile.uploadPicture': 'Upload Picture',
      'profile.emailNotifications': 'Email Notifications',
      'profile.courseCompletion': 'Course Completion',
      'profile.certificateEarned': 'Certificate Earned',
      'profile.announcements': 'Announcements',
      
      // Admin
      'admin.dashboard': 'Admin Dashboard',
      'admin.users': 'Users',
      'admin.courses': 'Courses',
      'admin.countries': 'Countries',
      'admin.content': 'Content',
      'admin.agencies': 'Agencies',
      'admin.certificates': 'Certificates',
      'admin.reports': 'Reports',
      'admin.settings': 'Settings',
      'admin.menuManagement': 'Menu Management',
      
      // Chat
      'chat.findyAssistant': 'Findy Assistant',
      'chat.askQuestion': 'Ask me anything...',
      'chat.send': 'Send',
      'chat.typing': 'Findy is typing...',
      
      // Error Pages
      'error.404.title': 'Page Not Found',
      'error.404.message': "Sorry, we couldn't find the page you're looking for.",
      'error.404.goHome': 'Go Home',
      'error.404.signIn': 'Sign In',
      'error.403.title': 'Access Forbidden',
      'error.403.message': "You don't have permission to access this page.",
      'error.403.goToPanel': 'Go to My Panel',
    }
  },
  tr: {
    translation: {
      // Ortak
      'common.save': 'Kaydet',
      'common.cancel': 'İptal',
      'common.delete': 'Sil',
      'common.edit': 'Düzenle',
      'common.submit': 'Gönder',
      'common.search': 'Ara',
      'common.loading': 'Yükleniyor...',
      'common.error': 'Hata',
      'common.success': 'Başarılı',
      'common.confirm': 'Onayla',
      
      // Navigasyon
      'nav.dashboard': 'Gösterge Paneli',
      'nav.courses': 'Kurslar',
      'nav.certificates': 'Sertifikalar',
      'nav.leaderboard': 'Lider Tablosu',
      'nav.myAgency': 'Ajansım',
      'nav.examsOrders': 'Sınavlar/Siparişler',
      'nav.subscriptions': 'Abonelikler',
      'nav.profile': 'Profil',
      'nav.agentPortal': 'Acente Portalı',
      'nav.dormBooking': 'Yurt Rezervasyonu',
      'nav.signOut': 'Çıkış Yap',
      
      // Kimlik Doğrulama
      'auth.login': 'Giriş Yap',
      'auth.signup': 'Kayıt Ol',
      'auth.email': 'E-posta',
      'auth.password': 'Şifre',
      'auth.name': 'Ad Soyad',
      'auth.agencyName': 'Ajans Adı',
      'auth.forgotPassword': 'Şifremi Unuttum?',
      'auth.noAccount': 'Hesabınız yok mu?',
      'auth.hasAccount': 'Zaten hesabınız var mı?',
      'auth.welcome': 'Find And Study Academy\'ye Hoş Geldiniz',
      'auth.signInDescription': 'Kurslarınıza ve sertifikalarınıza erişmek için giriş yapın',
      'auth.signUpDescription': 'Başlamak için acente hesabınızı oluşturun',
      'auth.invalidCredentials': 'Geçersiz e-posta veya şifre. Lütfen tekrar deneyin.',
      
      // Kontrol Paneli
      'dashboard.welcome': 'Tekrar hoş geldiniz',
      'dashboard.totalCourses': 'Toplam Kurslar',
      'dashboard.certificates': 'Sertifikalar',
      'dashboard.avgScore': 'Ortalama Puan',
      'dashboard.inProgress': 'Devam Eden',
      'dashboard.completed': 'Tamamlanan',
      'dashboard.recentActivity': 'Son Aktiviteler',
      'dashboard.weeklyActivity': 'Haftalık Aktivite',
      'dashboard.progressChart': 'Zaman İçinde Kurs İlerlemesi',
      'dashboard.recentAchievements': 'Son Başarılar',
      'dashboard.earnedCertificate': 'Kazanılan Sertifika',
      'dashboard.completedCourse': 'Tamamlanan Kurs',
      
      // Kurslar
      'courses.title': 'Kurslar',
      'courses.description': 'Kurslara göz atın ve kaydolun',
      'courses.allCourses': 'Tüm Kurslar',
      'courses.myCourses': 'Kurslarım',
      'courses.startCourse': 'Kursa Başla',
      'courses.continueCourse': 'Kursa Devam Et',
      'courses.viewCertificate': 'Sertifikayı Görüntüle',
      'courses.lessons': 'Dersler',
      'courses.quizzes': 'Sınavlar',
      'courses.progress': 'İlerleme',
      'courses.notStarted': 'Başlanmadı',
      
      // Sertifikalar
      'certificates.title': 'Sertifikalar',
      'certificates.description': 'Kazandığınız sertifikaları görüntüleyin',
      'certificates.download': 'PDF İndir',
      'certificates.verify': 'Sertifikayı Doğrula',
      'certificates.issuedOn': 'Düzenlenme tarihi',
      'certificates.score': 'Puan',
      'certificates.noCertificates': 'Henüz kazanılmış sertifika yok',
      
      // Ajans
      'agency.title': 'Ajansım',
      'agency.description': 'Ajans bilgilerinizi ve profilinizi yönetin',
      'agency.basicInfo': 'Temel Bilgiler',
      'agency.contactInfo': 'İletişim Bilgileri',
      'agency.location': 'Konum',
      'agency.agencyName': 'Ajans Adı',
      'agency.agencyLogo': 'Ajans Logosu',
      'agency.uploadLogo': 'Logo Yükle',
      'agency.staffSize': 'Personel Sayısı',
      'agency.annualStudents': 'Yıllık Öğrenci Sayısı',
      'agency.website': 'Website',
      'agency.phone': 'Telefon',
      'agency.primaryContactName': 'Birincil İletişim Adı',
      'agency.primaryContactEmail': 'Birincil İletişim E-posta',
      'agency.address': 'Adres',
      'agency.googleMapLink': 'Google Map Linki',
      'agency.yandexMapLink': 'Yandex Map Linki',
      'agency.saveChanges': 'Değişiklikleri Kaydet',
      'agency.updated': 'Ajans Güncellendi',
      'agency.updateSuccess': 'Ajans bilgileri başarıyla güncellendi',
      'agency.updateFailed': 'Güncelleme Başarısız',
      
      // Lider Tablosu
      'leaderboard.title': 'Lider Tablosu',
      'leaderboard.description': 'En başarılı acenteler',
      'leaderboard.rank': 'Sıralama',
      'leaderboard.agent': 'Acente',
      'leaderboard.points': 'Puan',
      'leaderboard.certificates': 'Sertifikalar',
      'leaderboard.progress': 'İlerleme',
      'leaderboard.you': 'Siz',
      'leaderboard.pointsExplained': 'Puan = Sertifikalar × 100 + İlerleme %',
      
      // Profil
      'profile.title': 'Profil',
      'profile.editProfile': 'Profili Düzenle',
      'profile.uploadPicture': 'Resim Yükle',
      'profile.emailNotifications': 'E-posta Bildirimleri',
      'profile.courseCompletion': 'Kurs Tamamlama',
      'profile.certificateEarned': 'Kazanılan Sertifika',
      'profile.announcements': 'Duyurular',
      
      // Admin
      'admin.dashboard': 'Admin Paneli',
      'admin.users': 'Kullanıcılar',
      'admin.courses': 'Kurslar',
      'admin.countries': 'Ülkeler',
      'admin.content': 'İçerik',
      'admin.agencies': 'Ajanslar',
      'admin.certificates': 'Sertifikalar',
      'admin.reports': 'Raporlar',
      'admin.settings': 'Ayarlar',
      'admin.menuManagement': 'Menü Yönetimi',
      
      // Sohbet
      'chat.findyAssistant': 'Findy Asistan',
      'chat.askQuestion': 'Bana bir şey sor...',
      'chat.send': 'Gönder',
      'chat.typing': 'Findy yazıyor...',
      
      // Hata Sayfaları
      'error.404.title': 'Sayfa Bulunamadı',
      'error.404.message': 'Üzgünüz, aradığınız sayfa bulunamadı.',
      'error.404.goHome': 'Ana Sayfaya Dön',
      'error.404.signIn': 'Giriş Yap',
      'error.403.title': 'Erişim Engellendi',
      'error.403.message': 'Bu sayfaya erişim izniniz yok.',
      'error.403.goToPanel': 'Panelime Git',
    }
  },
  ar: {
    translation: {
      // مشترك
      'common.save': 'حفظ',
      'common.cancel': 'إلغاء',
      'common.delete': 'حذف',
      'common.edit': 'تعديل',
      'common.submit': 'إرسال',
      'common.search': 'بحث',
      'common.loading': 'جاري التحميل...',
      'common.error': 'خطأ',
      'common.success': 'نجح',
      'common.confirm': 'تأكيد',
      
      // التنقل
      'nav.dashboard': 'لوحة التحكم',
      'nav.courses': 'الدورات',
      'nav.certificates': 'الشهادات',
      'nav.leaderboard': 'لوحة المتصدرين',
      'nav.myAgency': 'وكالتي',
      'nav.examsOrders': 'الامتحانات/الطلبات',
      'nav.subscriptions': 'الاشتراكات',
      'nav.profile': 'الملف الشخصي',
      'nav.agentPortal': 'بوابة الوكيل',
      'nav.dormBooking': 'حجز السكن',
      'nav.signOut': 'تسجيل الخروج',
      
      // المصادقة
      'auth.login': 'تسجيل الدخول',
      'auth.signup': 'التسجيل',
      'auth.email': 'البريد الإلكتروني',
      'auth.password': 'كلمة المرور',
      'auth.name': 'الاسم الكامل',
      'auth.agencyName': 'اسم الوكالة',
      'auth.forgotPassword': 'هل نسيت كلمة المرور؟',
      'auth.noAccount': 'ليس لديك حساب؟',
      'auth.hasAccount': 'هل لديك حساب بالفعل؟',
      'auth.welcome': 'مرحباً بك في أكاديمية Find And Study',
      'auth.signInDescription': 'قم بتسجيل الدخول للوصول إلى دوراتك وشهاداتك',
      'auth.signUpDescription': 'أنشئ حساب وكيل للبدء',
      'auth.invalidCredentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.',
      
      // لوحة التحكم
      'dashboard.welcome': 'مرحباً بعودتك',
      'dashboard.totalCourses': 'إجمالي الدورات',
      'dashboard.certificates': 'الشهادات',
      'dashboard.avgScore': 'متوسط ​​النقاط',
      'dashboard.inProgress': 'قيد التقدم',
      'dashboard.completed': 'مكتمل',
      'dashboard.recentActivity': 'النشاط الأخير',
      'dashboard.weeklyActivity': 'النشاط الأسبوعي',
      'dashboard.progressChart': 'تقدم الدورة مع مرور الوقت',
      'dashboard.recentAchievements': 'الإنجازات الأخيرة',
      'dashboard.earnedCertificate': 'شهادة مكتسبة',
      'dashboard.completedCourse': 'دورة مكتملة',
      
      // الدورات
      'courses.title': 'الدورات',
      'courses.description': 'تصفح والتسجيل في الدورات',
      'courses.allCourses': 'جميع الدورات',
      'courses.myCourses': 'دوراتي',
      'courses.startCourse': 'ابدأ الدورة',
      'courses.continueCourse': 'متابعة الدورة',
      'courses.viewCertificate': 'عرض الشهادة',
      'courses.lessons': 'الدروس',
      'courses.quizzes': 'الاختبارات',
      'courses.progress': 'التقدم',
      'courses.notStarted': 'لم تبدأ',
      
      // الشهادات
      'certificates.title': 'الشهادات',
      'certificates.description': 'عرض شهاداتك المكتسبة',
      'certificates.download': 'تحميل PDF',
      'certificates.verify': 'التحقق من الشهادة',
      'certificates.issuedOn': 'صدرت في',
      'certificates.score': 'النقاط',
      'certificates.noCertificates': 'لا توجد شهادات مكتسبة حتى الآن',
      
      // الوكالة
      'agency.title': 'وكالتي',
      'agency.description': 'إدارة معلومات وكالتك وملفك الشخصي',
      'agency.basicInfo': 'المعلومات الأساسية',
      'agency.contactInfo': 'معلومات الاتصال',
      'agency.location': 'الموقع',
      'agency.agencyName': 'اسم الوكالة',
      'agency.agencyLogo': 'شعار الوكالة',
      'agency.uploadLogo': 'تحميل الشعار',
      'agency.staffSize': 'عدد الموظفين',
      'agency.annualStudents': 'الطلاب السنويين',
      'agency.website': 'الموقع الإلكتروني',
      'agency.phone': 'الهاتف',
      'agency.primaryContactName': 'اسم جهة الاتصال الأساسية',
      'agency.primaryContactEmail': 'البريد الإلكتروني لجهة الاتصال الأساسية',
      'agency.address': 'العنوان',
      'agency.googleMapLink': 'رابط خريطة جوجل',
      'agency.yandexMapLink': 'رابط خريطة ياندكس',
      'agency.saveChanges': 'حفظ التغييرات',
      'agency.updated': 'تم تحديث الوكالة',
      'agency.updateSuccess': 'تم تحديث معلومات الوكالة بنجاح',
      'agency.updateFailed': 'فشل التحديث',
      
      // لوحة المتصدرين
      'leaderboard.title': 'لوحة المتصدرين',
      'leaderboard.description': 'أفضل الوكلاء أداءً',
      'leaderboard.rank': 'الترتيب',
      'leaderboard.agent': 'الوكيل',
      'leaderboard.points': 'النقاط',
      'leaderboard.certificates': 'الشهادات',
      'leaderboard.progress': 'التقدم',
      'leaderboard.you': 'أنت',
      'leaderboard.pointsExplained': 'النقاط = الشهادات × 100 + التقدم %',
      
      // الملف الشخصي
      'profile.title': 'الملف الشخصي',
      'profile.editProfile': 'تعديل الملف الشخصي',
      'profile.uploadPicture': 'تحميل صورة',
      'profile.emailNotifications': 'إشعارات البريد الإلكتروني',
      'profile.courseCompletion': 'إتمام الدورة',
      'profile.certificateEarned': 'شهادة مكتسبة',
      'profile.announcements': 'الإعلانات',
      
      // الإدارة
      'admin.dashboard': 'لوحة الإدارة',
      'admin.users': 'المستخدمون',
      'admin.courses': 'الدورات',
      'admin.countries': 'الدول',
      'admin.content': 'المحتوى',
      'admin.agencies': 'الوكالات',
      'admin.certificates': 'الشهادات',
      'admin.reports': 'التقارير',
      'admin.settings': 'الإعدادات',
      'admin.menuManagement': 'إدارة القائمة',
      
      // الدردشة
      'chat.findyAssistant': 'مساعد Findy',
      'chat.askQuestion': 'اسألني أي شيء...',
      'chat.send': 'إرسال',
      'chat.typing': 'Findy يكتب...',
      
      // صفحات الخطأ
      'error.404.title': 'الصفحة غير موجودة',
      'error.404.message': 'عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.',
      'error.404.goHome': 'الذهاب للرئيسية',
      'error.404.signIn': 'تسجيل الدخول',
      'error.403.title': 'الوصول محظور',
      'error.403.message': 'ليس لديك إذن للوصول إلى هذه الصفحة.',
      'error.403.goToPanel': 'الذهاب إلى لوحتي',
    }
  },
  ru: {
    translation: {
      // Общее
      'common.save': 'Сохранить',
      'common.cancel': 'Отмена',
      'common.delete': 'Удалить',
      'common.edit': 'Редактировать',
      'common.submit': 'Отправить',
      'common.search': 'Поиск',
      'common.loading': 'Загрузка...',
      'common.error': 'Ошибка',
      'common.success': 'Успешно',
      'common.confirm': 'Подтвердить',
      
      // Навигация
      'nav.dashboard': 'Панель управления',
      'nav.courses': 'Курсы',
      'nav.certificates': 'Сертификаты',
      'nav.leaderboard': 'Таблица лидеров',
      'nav.myAgency': 'Мое агентство',
      'nav.examsOrders': 'Экзамены/Заказы',
      'nav.subscriptions': 'Подписки',
      'nav.profile': 'Профиль',
      'nav.agentPortal': 'Портал агента',
      'nav.dormBooking': 'Бронирование общежития',
      'nav.signOut': 'Выйти',
      
      // Авторизация
      'auth.login': 'Войти',
      'auth.signup': 'Регистрация',
      'auth.email': 'Электронная почта',
      'auth.password': 'Пароль',
      'auth.name': 'Полное имя',
      'auth.agencyName': 'Название агентства',
      'auth.forgotPassword': 'Забыли пароль?',
      'auth.noAccount': 'Нет аккаунта?',
      'auth.hasAccount': 'Уже есть аккаунт?',
      'auth.welcome': 'Добро пожаловать в Find And Study Academy',
      'auth.signInDescription': 'Войдите, чтобы получить доступ к курсам и сертификатам',
      'auth.signUpDescription': 'Создайте учетную запись агента, чтобы начать',
      'auth.invalidCredentials': 'Неверный email или пароль. Попробуйте еще раз.',
      
      // Панель управления
      'dashboard.welcome': 'С возвращением',
      'dashboard.totalCourses': 'Всего курсов',
      'dashboard.certificates': 'Сертификаты',
      'dashboard.avgScore': 'Средний балл',
      'dashboard.inProgress': 'В процессе',
      'dashboard.completed': 'Завершено',
      'dashboard.recentActivity': 'Последняя активность',
      'dashboard.weeklyActivity': 'Недельная активность',
      'dashboard.progressChart': 'Прогресс курса со временем',
      'dashboard.recentAchievements': 'Последние достижения',
      'dashboard.earnedCertificate': 'Полученный сертификат',
      'dashboard.completedCourse': 'Завершенный курс',
      
      // Курсы
      'courses.title': 'Курсы',
      'courses.description': 'Просмотр и регистрация на курсы',
      'courses.allCourses': 'Все курсы',
      'courses.myCourses': 'Мои курсы',
      'courses.startCourse': 'Начать курс',
      'courses.continueCourse': 'Продолжить курс',
      'courses.viewCertificate': 'Посмотреть сертификат',
      'courses.lessons': 'Уроки',
      'courses.quizzes': 'Тесты',
      'courses.progress': 'Прогресс',
      'courses.notStarted': 'Не начато',
      
      // Сертификаты
      'certificates.title': 'Сертификаты',
      'certificates.description': 'Просмотр полученных сертификатов',
      'certificates.download': 'Скачать PDF',
      'certificates.verify': 'Проверить сертификат',
      'certificates.issuedOn': 'Выдан',
      'certificates.score': 'Оценка',
      'certificates.noCertificates': 'Пока нет полученных сертификатов',
      
      // Агентство
      'agency.title': 'Мое агентство',
      'agency.description': 'Управление информацией об агентстве и профиле',
      'agency.basicInfo': 'Основная информация',
      'agency.contactInfo': 'Контактная информация',
      'agency.location': 'Местоположение',
      'agency.agencyName': 'Название агентства',
      'agency.agencyLogo': 'Логотип агентства',
      'agency.uploadLogo': 'Загрузить логотип',
      'agency.staffSize': 'Количество сотрудников',
      'agency.annualStudents': 'Студентов в год',
      'agency.website': 'Веб-сайт',
      'agency.phone': 'Телефон',
      'agency.primaryContactName': 'Имя основного контакта',
      'agency.primaryContactEmail': 'Email основного контакта',
      'agency.address': 'Адрес',
      'agency.googleMapLink': 'Ссылка на Google Maps',
      'agency.yandexMapLink': 'Ссылка на Яндекс.Карты',
      'agency.saveChanges': 'Сохранить изменения',
      'agency.updated': 'Агентство обновлено',
      'agency.updateSuccess': 'Информация об агентстве успешно обновлена',
      'agency.updateFailed': 'Не удалось обновить',
      
      // Таблица лидеров
      'leaderboard.title': 'Таблица лидеров',
      'leaderboard.description': 'Лучшие агенты',
      'leaderboard.rank': 'Ранг',
      'leaderboard.agent': 'Агент',
      'leaderboard.points': 'Баллы',
      'leaderboard.certificates': 'Сертификаты',
      'leaderboard.progress': 'Прогресс',
      'leaderboard.you': 'Вы',
      'leaderboard.pointsExplained': 'Баллы = Сертификаты × 100 + Прогресс %',
      
      // Профиль
      'profile.title': 'Профиль',
      'profile.editProfile': 'Редактировать профиль',
      'profile.uploadPicture': 'Загрузить фото',
      'profile.emailNotifications': 'Уведомления по email',
      'profile.courseCompletion': 'Завершение курса',
      'profile.certificateEarned': 'Получение сертификата',
      'profile.announcements': 'Объявления',
      
      // Админ
      'admin.dashboard': 'Панель администратора',
      'admin.users': 'Пользователи',
      'admin.courses': 'Курсы',
      'admin.countries': 'Страны',
      'admin.content': 'Контент',
      'admin.agencies': 'Агентства',
      'admin.certificates': 'Сертификаты',
      'admin.reports': 'Отчеты',
      'admin.settings': 'Настройки',
      'admin.menuManagement': 'Управление меню',
      
      // Чат
      'chat.findyAssistant': 'Помощник Findy',
      'chat.askQuestion': 'Спросите меня о чем-нибудь...',
      'chat.send': 'Отправить',
      'chat.typing': 'Findy печатает...',
      
      // Страницы ошибок
      'error.404.title': 'Страница не найдена',
      'error.404.message': 'Извините, мы не смогли найти страницу, которую вы ищете.',
      'error.404.goHome': 'На главную',
      'error.404.signIn': 'Войти',
      'error.403.title': 'Доступ запрещен',
      'error.403.message': 'У вас нет разрешения на доступ к этой странице.',
      'error.403.goToPanel': 'Перейти в мою панель',
    }
  }
};

i18n
  .use(LanguageDetector) // Detect browser language automatically
  .use(initReactI18next) // Pass i18n down to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Fallback to English if translation not found
    supportedLngs: ['en', 'tr', 'ar', 'ru'],
    
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18n_language', // Custom localStorage key
    },
    
    interpolation: {
      escapeValue: false // React already escapes values
    },
    
    // RTL languages
    react: {
      useSuspense: false
    }
  });

export default i18n;
