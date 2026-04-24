import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Award,
  Trophy,
  Package,
  ArrowRight,
  Bell,
  Mail,
  Phone,
  Globe,
  GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { announcementTypeStyles } from '@/lib/announcement-helpers';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import dayjs from 'dayjs';

interface PublicAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  publishedAt: string | null;
  createdAt: string;
}

const features = [
  {
    icon: BookOpen,
    title: 'Kapsamlı Eğitimler',
    description:
      'Ülke bazlı, modüller halinde hazırlanmış kurslar ile eğitim danışmanlığında uzmanlaşın.',
  },
  {
    icon: Award,
    title: 'Doğrulanabilir Sertifika',
    description:
      'Her kursu tamamladığınızda QR kodlu, kamuya açık doğrulanabilir bir sertifika alın.',
  },
  {
    icon: Package,
    title: 'Partner Zone',
    description:
      'Üniversite katalogları, broşürler ve materyallere tek noktadan erişin.',
  },
  {
    icon: Trophy,
    title: 'Liderlik Tablosu',
    description:
      'Rozetler, puanlar ve liderlik tablosuyla acentenizin gelişimini ölçün.',
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, role } = useAuthStore();

  // If logged in, take user straight to their dashboard.
  useEffect(() => {
    if (user && role) {
      const path = role === 'admin' || role === 'staff' ? '/admin/dashboard' : '/agent/dashboard';
      setLocation(path);
    }
  }, [user, role, setLocation]);

  const { data, isLoading } = useQuery<{ success: boolean; announcements: PublicAnnouncement[] }>({
    queryKey: ['/api/announcements/public'],
  });
  const announcements = data?.announcements ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link href="/" className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1" data-testid="link-home-logo">
            <img src={logoImage} alt="Find And Study" className="h-9 w-auto object-contain" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-nav-login">Giriş</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" data-testid="link-nav-signup">
                Acente Kaydı
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Brand-colored background with subtle gradient wash */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(135deg, hsl(224 76% 18%) 0%, hsl(224 76% 28%) 50%, hsl(224 70% 38%) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-black/30" aria-hidden="true" />
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, hsl(224 80% 60% / 0.4), transparent 50%)',
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl text-white">
            <Badge variant="outline" className="mb-4 bg-white/10 border-white/30 text-white backdrop-blur">
              <GraduationCap className="w-3 h-3 mr-1" />
              Eğitim Danışmanları İçin
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4" data-testid="text-hero-title">
              Find And Study
              <span className="block text-white/90 text-2xl sm:text-3xl lg:text-4xl font-medium mt-2">
                Acenteler için modern eğitim portalı
              </span>
            </h1>
            <p className="text-base sm:text-lg text-white/85 mb-8 max-w-2xl" data-testid="text-hero-subtitle">
              Yurt dışı eğitim danışmanlığında uzmanlaşmanızı sağlayan kurslar, sertifikalar,
              partner kaynakları ve performans takibi — hepsi tek bir platformda.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-primary hover:bg-white" data-testid="button-cta-signup">
                  Hemen Başla
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 border-white/40 text-white backdrop-blur hover:bg-white/20"
                  data-testid="button-cta-login"
                >
                  Portala Giriş Yap
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Acentenize değer katan özellikler
            </h2>
            <p className="text-muted-foreground">
              Eğitimden raporlamaya kadar tüm süreçleriniz için ihtiyacınız olan araçlar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="hover-elevate" data-testid={`card-feature-${f.title}`}>
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Latest announcements */}
      <section className="py-12 sm:py-16 bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Son Duyurular</h2>
              </div>
              <p className="text-muted-foreground">Platformdan en güncel haberler.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-empty-announcements">
                Şu anda gösterilecek bir duyuru bulunmuyor.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.map((a) => {
                const style = announcementTypeStyles[a.type] || announcementTypeStyles.info;
                const Icon = style.icon;
                const dateStr = a.publishedAt || a.createdAt;
                return (
                  <Card
                    key={a.id}
                    className={`${style.bg} ${style.border} border hover-elevate`}
                    data-testid={`card-public-announcement-${a.id}`}
                  >
                    <CardContent className="p-5">
                      <div className={`flex items-center gap-2 mb-3 ${style.iconColor}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-semibold">
                          {dayjs(dateStr).format('DD MMM YYYY')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{a.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">{a.content}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Acentenizi Find And Study ailesine katın
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Eğitimleri tamamlayın, sertifikalarınızı kazanın ve danışmanlık süreçlerinizi
            uçtan uca yönetin.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" data-testid="button-cta-signup-bottom">Acente Kaydı</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" data-testid="button-cta-login-bottom">
                Giriş Yap
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <img src={logoImage} alt="Find And Study" className="h-10 w-auto object-contain mb-3" />
              <p className="text-muted-foreground">
                Yurt dışı eğitim danışmanları için modern eğitim ve sertifikasyon platformu.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Bağlantılar</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/login" className="hover:text-foreground" data-testid="link-footer-login">
                    Acente Girişi
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-foreground" data-testid="link-footer-signup">
                    Acente Kaydı
                  </Link>
                </li>
                <li>
                  <Link href="/verify" className="hover:text-foreground" data-testid="link-footer-verify">
                    Sertifika Doğrula
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">İletişim</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:info@findandstudy.com" className="hover:text-foreground">
                    info@findandstudy.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <a href="https://findandstudy.com" target="_blank" rel="noreferrer" className="hover:text-foreground">
                    findandstudy.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>+90 (212) 000 00 00</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-6 pt-6 text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Find And Study Academy. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
