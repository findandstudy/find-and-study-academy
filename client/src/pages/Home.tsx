import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Award,
  Trophy,
  Package,
  ArrowRight,
  Mail,
  Phone,
  Globe,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { I18N_STORAGE_KEY } from '@/i18n';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';

const BRAND_NAVY = '#143591';
const BRAND_RED = '#ED1C24';
// Slightly darker red used for surfaces that carry white text — needed to meet
// WCAG AA contrast (4.5:1) which the lighter brand red just misses.
const BRAND_RED_DEEP = '#C8161D';

export default function Home() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, role } = useAuthStore();

  // The public landing page defaults to English unless the visitor has already
  // picked a language (persisted in localStorage). Their choice always wins.
  useEffect(() => {
    try {
      if (!localStorage.getItem(I18N_STORAGE_KEY) && i18n.resolvedLanguage !== 'en') {
        i18n.changeLanguage('en');
      }
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [i18n]);

  // Logged-in users go straight to their dashboard.
  useEffect(() => {
    if (user && role) {
      const path = role === 'admin' || role === 'staff' ? '/admin/dashboard' : '/agent/dashboard';
      setLocation(path);
    }
  }, [user, role, setLocation]);

  const features = [
    { icon: BookOpen, title: t('home.f1Title'), description: t('home.f1Desc') },
    { icon: Award, title: t('home.f2Title'), description: t('home.f2Desc') },
    { icon: Package, title: t('home.f3Title'), description: t('home.f3Desc') },
    { icon: Trophy, title: t('home.f4Title'), description: t('home.f4Desc') },
  ];
  const heroBullets = [
    t('home.heroBullet1'),
    t('home.heroBullet2'),
    t('home.heroBullet3'),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link
            href="/"
            className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1"
            data-testid="link-home-logo"
          >
            <img src={logoImage} alt="Find And Study" className="h-9 w-auto object-contain" />
          </Link>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher variant="inline" />
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-nav-login">
                {t('home.navLogin')}
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" data-testid="link-nav-signup">
                {t('home.navSignup')}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: BRAND_NAVY }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-32 w-[26rem] h-[26rem] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: BRAND_RED }}
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <Badge
                variant="outline"
                className="mb-5 bg-white border-slate-200 text-slate-700"
                data-testid="badge-hero-tag"
              >
                <GraduationCap className="w-3 h-3 mr-1" style={{ color: BRAND_RED }} />
                {t('home.heroBadge')}
              </Badge>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-4 tracking-tight"
                style={{ color: BRAND_NAVY }}
                data-testid="text-hero-title"
              >
                Find And Study
                <span
                  className="block text-2xl sm:text-3xl lg:text-4xl font-semibold mt-3 text-slate-700"
                  data-testid="text-hero-subtitle"
                >
                  {t('home.heroSubtitle')}
                </span>
              </h1>
              <p
                className="text-base sm:text-lg text-slate-600 mb-7 max-w-2xl leading-relaxed"
                data-testid="text-hero-description"
              >
                {t('home.heroDescription')}
              </p>

              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-8 max-w-2xl">
                {heroBullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-slate-700"
                    data-testid={`text-hero-bullet-${i}`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: BRAND_NAVY }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button size="lg" data-testid="button-cta-signup">
                    {t('home.ctaStart')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" data-testid="button-cta-login">
                    {t('home.ctaLoginPortal')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero side card */}
            <div className="hidden lg:block lg:col-span-5">
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-2xl opacity-20 blur-2xl"
                  style={{ background: `linear-gradient(135deg, ${BRAND_NAVY}, ${BRAND_RED})` }}
                  aria-hidden="true"
                />
                <Card className="relative overflow-hidden border-slate-200 shadow-sm">
                  <div className="h-2 w-full" style={{ background: BRAND_NAVY }} />
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-12 h-12 rounded-md flex items-center justify-center text-white"
                        style={{ background: BRAND_NAVY }}
                      >
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                          Find And Study Academy
                        </p>
                        <p className="text-lg font-bold" style={{ color: BRAND_NAVY }}>
                          {t('home.cardTitle')}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <FeatureRow icon={BookOpen} label={t('home.cardRow1')} />
                      <FeatureRow icon={Award} label={t('home.cardRow2')} />
                      <FeatureRow icon={Package} label={t('home.cardRow3')} />
                      <FeatureRow icon={Trophy} label={t('home.cardRow4')} />
                    </div>
                    <div
                      className="mt-6 rounded-md p-3 text-sm font-semibold text-white text-center"
                      style={{ background: BRAND_RED_DEEP }}
                    >
                      {t('home.cardCta')}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight"
              style={{ color: BRAND_NAVY }}
            >
              {t('home.featuresTitle')}
            </h2>
            <p className="text-slate-600">{t('home.featuresSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <Card
                key={i}
                className="hover-elevate border-slate-200"
                data-testid={`card-feature-${i}`}
              >
                <CardContent className="p-6">
                  <div
                    className="w-11 h-11 rounded-md flex items-center justify-center mb-4 text-white"
                    style={{ background: BRAND_NAVY }}
                  >
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: BRAND_NAVY }}>
                    {f.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 sm:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight"
            style={{ color: BRAND_NAVY }}
          >
            {t('home.ctaBottomTitle')}
          </h2>
          <p className="text-slate-600 mb-7 max-w-2xl mx-auto leading-relaxed">
            {t('home.ctaBottomDesc')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" data-testid="button-cta-signup-bottom">
                {t('home.ctaBottomSignup')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" data-testid="button-cta-login-bottom">
                {t('home.ctaBottomLogin')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-sm">
            <div className="md:col-span-5">
              <img
                src={logoImage}
                alt="Find And Study"
                className="h-10 w-auto object-contain mb-4"
              />
              <p className="text-slate-600 leading-relaxed max-w-sm">{t('home.footerTagline')}</p>
            </div>

            <div className="md:col-span-3">
              <h4
                className="font-semibold mb-4 text-xs uppercase tracking-wider"
                style={{ color: BRAND_NAVY }}
              >
                {t('home.footerLinksHead')}
              </h4>
              <ul className="space-y-1 text-slate-600">
                <li>
                  <Link
                    href="/login"
                    className="inline-block rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-login"
                  >
                    {t('home.footerLoginLink')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="inline-block rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-signup"
                  >
                    {t('home.footerSignupLink')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/verify"
                    className="inline-block rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-verify"
                  >
                    {t('home.footerVerifyLink')}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <h4
                className="font-semibold mb-4 text-xs uppercase tracking-wider"
                style={{ color: BRAND_NAVY }}
              >
                {t('home.footerContactHead')}
              </h4>
              <ul className="space-y-1 text-slate-600">
                <li>
                  <a
                    href="mailto:info@findandstudy.com"
                    className="flex items-center gap-2.5 rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-email"
                  >
                    <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>info@findandstudy.com</span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+905416898515"
                    className="flex items-center gap-2.5 rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-phone"
                  >
                    <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>+90 541 689 85 15</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://findandstudy.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-md px-2 -mx-2 py-1 hover-elevate"
                    data-testid="link-footer-website"
                  >
                    <Globe className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>findandstudy.com</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} Find And Study Academy. {t('home.footerRights')}</span>
            <span className="text-slate-400">{t('home.footerLocated')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-slate-700 font-medium">{label}</span>
    </div>
  );
}
