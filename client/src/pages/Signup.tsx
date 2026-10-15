import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '@/i18n/languages';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuthCard } from '@/components/layouts/AuthCard';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { WORLD_COUNTRIES } from '@/lib/world-countries';
import { COUNTRY_DIAL_CODES, getDialCode } from '@shared/country-dial-codes';

const DEFAULT_COUNTRY = 'TR';

export default function Signup() {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    agencyName: '',
    country: DEFAULT_COUNTRY,
    phoneCountry: DEFAULT_COUNTRY,
    phoneNumber: '',
  });
  const { signup, isLoading } = useAuthStore();
  const { initialize: initializeData } = useDataStore();
  const { toast } = useToast();

  const sortedCountries = useMemo(() => {
    const display = new Intl.DisplayNames([language, 'en'], { type: 'region' });
    return WORLD_COUNTRIES.map(country => ({ ...country, name: display.of(country.code) || country.name }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [language]);

  const dialOptions = useMemo(() => {
    const names = new Map(sortedCountries.map(country => [country.code, country.name]));
    return COUNTRY_DIAL_CODES.filter(country => names.has(country.code))
      .map(country => ({ code: country.code, dial: country.dial, name: names.get(country.code)! }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [sortedCountries, language]);

  const selectedDial = getDialCode(formData.phoneCountry) ?? '';

  // When the user picks a country, auto-sync the phone dial code so country and
  // phone number stay semantically consistent by default. The user can still
  // override the dial code afterwards if they need a foreign mobile number.
  const handleCountryChange = (v: string) => {
    setFormData((prev) => ({
      ...prev,
      country: v,
      phoneCountry: getDialCode(v) ? v : prev.phoneCountry,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Normalize the local number toward E.164: strip everything that isn't a
    // digit, then drop a single leading national trunk "0" (common in TR / EU
    // formats like "0532 ..." which becomes "+90 532 ...").
    let localDigits = formData.phoneNumber.replace(/\D+/g, '');
    if (localDigits.startsWith('0')) {
      localDigits = localDigits.replace(/^0+/, '');
    }
    if (!localDigits || localDigits.length < 4) {
      toast({
        title: t('registration.failedTitle'),
        description: t('registration.invalidPhone'),
        variant: 'destructive',
      });
      return;
    }
    if (!selectedDial) {
      toast({
        title: t('registration.failedTitle'),
        description: t('registration.invalidDial'),
        variant: 'destructive',
      });
      return;
    }
    const fullPhone = `+${selectedDial}${localDigits}`;
    if (!/^\+[1-9]\d{5,17}$/.test(fullPhone)) {
      toast({ title: t('registration.failedTitle'), description: t('registration.invalidPhone'), variant: 'destructive' });
      return;
    }

    const result = await signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      agencyName: formData.agencyName,
      country: formData.country,
      phone: fullPhone,
      languagePreference: language,
    });
    if (result?.session) {
      initializeData();
      toast({ title: t('registration.readyTitle'), description: t('registration.readyMessage') });
      setLocation('/agent/dashboard');
    } else if (result?.pending) {
      toast({ title: t('registration.pendingTitle'), description: t('registration.pendingMessage'), duration: 8000 });
      setLocation('/login');
    } else {
      toast({
        title: t('registration.failedTitle'),
        description: result?.message === 'Email already registered' ? t('registration.duplicateEmail') : t('registration.failedMessage'),
        variant: 'destructive',
      });
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AuthCard
      title={t('registration.title')}
      description={t('registration.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t('registration.fullName')}</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t('registration.fullNamePlaceholder')}
            required
            autoComplete="name"
            minLength={2}
            maxLength={120}
            data-testid="input-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            required
            autoComplete="email"
            maxLength={254}
            data-testid="input-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder={t('registration.createPassword')}
            required
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            aria-describedby="password-hint"
            data-testid="input-password"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">{t('registration.passwordHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agencyName">{t('registration.agencyName')}</Label>
          <Input
            id="agencyName"
            type="text"
            value={formData.agencyName}
            onChange={(e) => updateField('agencyName', e.target.value)}
            placeholder={t('registration.agencyPlaceholder')}
            required
            autoComplete="organization"
            minLength={2}
            maxLength={180}
            data-testid="input-agency"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">{t('registration.country')}</Label>
          <Select
            value={formData.country}
            onValueChange={handleCountryChange}
          >
            <SelectTrigger id="country" data-testid="select-country">
              <SelectValue placeholder={t('registration.selectCountry')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {sortedCountries.map((c) => (
                <SelectItem key={c.code} value={c.code} data-testid={`option-country-${c.code}`}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumber">{t('registration.mobilePhone')}</Label>
          <div className="flex gap-2">
            <Select
              value={formData.phoneCountry}
              onValueChange={(v) => updateField('phoneCountry', v)}
            >
              <SelectTrigger
                className="w-[110px] shrink-0"
                dir="ltr"
                aria-label={t('registration.phoneCountryCode')}
                data-testid="select-phone-country"
              >
                <SelectValue>
                  {selectedDial ? `+${selectedDial}` : '+'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {dialOptions.map((opt) => (
                  <SelectItem
                    key={opt.code}
                    value={opt.code}
                    data-testid={`option-phone-country-${opt.code}`}
                  >
                    <span className="tabular-nums text-muted-foreground mr-2">
                      +{opt.dial}
                    </span>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="phoneNumber"
              type="tel"
              dir="ltr"
              inputMode="tel"
              value={formData.phoneNumber}
              onChange={(e) => updateField('phoneNumber', e.target.value)}
              placeholder="5xx xxx xx xx"
              required
              autoComplete="tel-national"
              data-testid="input-phone"
              className="flex-1"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          data-testid="button-submit"
        >
          {t(isLoading ? 'registration.creating' : 'registration.createAccount')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t('registration.alreadyAccount')}{' '}
          <Link href="/login">
            <span className="text-primary hover:underline cursor-pointer">
              {t('auth.signIn')}
            </span>
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
