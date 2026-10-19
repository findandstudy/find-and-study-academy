import stepLabels from '@/lib/signup-steps.json';
import {useAcademyUi} from '@/lib/academy-ui';
import '@/lib/campaign-i18n';
import { useMemo, useState, useRef, useEffect } from 'react';
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
  const {message, dir}=useAcademyUi();
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  const language = normalizeLanguage(i18n.language);
  const steps = stepLabels[language as keyof typeof stepLabels] || stepLabels.en;
  const [formData, setFormData] = useState({
    promoCode: new URLSearchParams(window.location.search).get('promo') || '',
    verificationCode: '',
    name: '',
    email: '',
    password: '',
    agencyName: '',
    country: '',
    phoneCountry: DEFAULT_COUNTRY,
    phoneNumber: '',
  });
  const [campaignMode,setCampaignMode]=useState(new URLSearchParams(window.location.search).has('promo'));
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
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

    // HTML minLength alone accepts whitespace. Validate the same trimmed names
    // that the server stores before allowing the user to leave a step.
    for (const id of ['name', 'agencyName']) {
      const input = formRef.current?.querySelector<HTMLInputElement>(`#${id}`);
      input?.setCustomValidity(input.value.trim().length < 2 ?
        t(id === 'name' ? 'registration.fullName' : 'registration.agencyName') : '');
    }
    const phoneInput = formRef.current?.querySelector<HTMLInputElement>('#phoneNumber');
    const digits = formData.phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
    phoneInput?.setCustomValidity(
      digits.length < 4 || !/^[\d\s().-]+$/.test(formData.phoneNumber) ||
      !/^\+[1-9]\d{5,17}$/.test(`+${selectedDial}${digits}`)
        ? t('registration.invalidPhone') : '');
    if (step >= 1 && !formData.country) {
      setStep(1);
      toast({ title: t('registration.failedTitle'), description: t('registration.selectCountry'), variant: 'destructive' });
      return;
    }

    const target = step < 2 ? step : [0, 1, 2].find(index => {
      const fields = formRef.current?.querySelectorAll<HTMLInputElement>(`[data-step="${index}"] input`);
      return fields && Array.from(fields).some(field => !field.checkValidity());
    });
    if (target !== undefined) {
      const fields = formRef.current?.querySelectorAll<HTMLInputElement>(`[data-step="${target}"] input`);
      const invalid = fields && Array.from(fields).find(field => !field.checkValidity());
      if (invalid) {
        setStep(target);
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return;
      }
      if (step < 2) { setStep(step + 1); return; }
    }

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
      setStep(1);
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
      setStep(1);
      return;
    }

    const result = await signup({
      promoCode: campaignMode?formData.promoCode:undefined,
      verificationCode: campaignMode?formData.verificationCode:undefined,
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
        description: result?.message === 'Email already registered' ? t('registration.duplicateEmail') : (campaignMode?message(result?.message||'Request failed'):t('registration.failedMessage')),
        variant: 'destructive',
      });
    }
  };

  const requestCode = async () => {
    setSendingCode(true);
    try {
      const response = await fetch('/api/signup/email-code', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:formData.email,promoCode:formData.promoCode})});
      const result = await response.json();
      if(!response.ok) throw new Error(result.code || 'EMAIL_DELIVERY_FAILED');
      setCodeSent(true);
      toast({title:t('campaign.codeSent',{defaultValue:'Verification code sent. Check your email.'})});
    } catch(e) { toast({title:t('common.error'),description:message(e instanceof Error?e.message:'Request failed'),variant:'destructive'}); }
    finally {setSendingCode(false);}
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    if (field === 'email' || field === 'promoCode') {
      setCodeSent(false);
      setFormData(prev => ({ ...prev, [field]: value, verificationCode: '' }));
    } else setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AuthCard
      variant="signup"
      title={t('registration.title')}
      description={t('registration.subtitle')}
    >
      <form ref={formRef} noValidate onSubmit={handleSubmit} dir={dir} className="space-y-3">
        <ol className="grid grid-cols-3 gap-2" aria-label={t('registration.title')}>
          {steps.map((label, index) => (
            <li key={index} aria-current={step === index ? 'step' : undefined} className={`rounded-lg border px-2 py-2 text-sm break-words ${step === index ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground'}`}>
              <span className="block font-semibold">{index + 1}. {label}</span>
            </li>
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className="sr-only">{steps[step]}</h2>
        <fieldset data-step="0" hidden={step !== 0} className="space-y-3 min-w-0">
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

        </fieldset>
        <fieldset data-step="1" hidden={step !== 1} className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 [&[hidden]]:hidden">
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
              className="flex-1 min-w-0"
            />
          </div>
        </div>

        </fieldset>
        <fieldset data-step="2" hidden={step !== 2} className="space-y-3 min-w-0">
          <dl className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs break-words">
            {[[t('registration.fullName'), formData.name], [t('auth.email'), formData.email], [t('registration.agencyName'), formData.agencyName], [t('registration.country'), sortedCountries.find(c => c.code === formData.country)?.name]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium break-all">{value}</dd></div>)}
          </dl>
        <label className="flex gap-2"><input type="checkbox" checked={campaignMode} onChange={e=>setCampaignMode(e.target.checked)}/>{t('campaign.haveCode',{defaultValue:'I have an invitation / promo code'})}</label>
        {campaignMode&&<div className="space-y-2"><Label htmlFor="promoCode">{t('campaign.promoCode',{defaultValue:'Invitation / promo code'})}</Label><Input id="promoCode" required maxLength={64} autoComplete="off" value={formData.promoCode} onChange={e=>updateField('promoCode',e.target.value)}/></div>}
        {campaignMode&&<p className="text-sm text-muted-foreground">{t('campaign.signupNotice',{defaultValue:'An invitation code and email verification are required. Administrator approval is still required. Free access starts on registration.'})}</p>}
        {campaignMode&&<div className="space-y-2"><Button type="button" variant="outline" disabled={sendingCode||!formData.email||!formData.promoCode} onClick={requestCode}>{t('campaign.sendCode',{defaultValue:'Send email verification code'})}</Button><Label className="block" htmlFor="verificationCode">{t('campaign.emailCode',{defaultValue:'6-digit email verification code'})}</Label><Input id="verificationCode" value={formData.verificationCode} onChange={e=>updateField('verificationCode',e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code"/>{codeSent&&<p>{t('campaign.codeExpiry',{defaultValue:'The code expires in 10 minutes. You can request another after 60 seconds.'})}</p>}</div>}
        </fieldset>
        <div className="flex gap-3 border-t pt-4">
          {step > 0 && <Button type="button" variant="outline" disabled={isLoading || sendingCode} onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || sendingCode}
          data-testid="button-submit"
        >
          {step < 2 ? t('common.continue') : t(isLoading ? 'registration.creating' : 'registration.createAccount')}
        </Button>
        </div>
      </form>

      <div className="mt-3 text-center">
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

