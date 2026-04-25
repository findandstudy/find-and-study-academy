import { useMemo, useState } from 'react';
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

  // Sorted list of all world countries (Turkish names) for the Country dropdown.
  const sortedCountries = useMemo(
    () => [...WORLD_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [],
  );

  // For the dial-code selector we want every country that has a dial code, sorted by Turkish name.
  const dialOptions = useMemo(() => {
    const nameByCode = new Map(WORLD_COUNTRIES.map((c) => [c.code, c.name]));
    return COUNTRY_DIAL_CODES
      .filter((c) => nameByCode.has(c.code))
      .map((c) => ({
        code: c.code,
        dial: c.dial,
        name: nameByCode.get(c.code) ?? c.code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, []);

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
        title: 'Geçersiz Telefon Numarası',
        description: 'Lütfen geçerli bir cep telefonu numarası girin.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedDial) {
      toast({
        title: 'Geçersiz Ülke Kodu',
        description: 'Lütfen geçerli bir telefon ülke kodu seçin.',
        variant: 'destructive',
      });
      return;
    }
    const fullPhone = `+${selectedDial}${localDigits}`;

    const result = await signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      agencyName: formData.agencyName,
      country: formData.country,
      phone: fullPhone,
    });
    if (result?.pending) {
      // Closed system: account is created but pending admin/staff approval — do NOT auto-login.
      // Refresh data store so admins viewing the page see the new agency on next load.
      initializeData();

      toast({
        title: 'Başvurunuz Alındı',
        description:
          result.message ||
          'Hesabınız yöneticilerimiz tarafından onaylandıktan sonra giriş yapabileceksiniz. Onay e-postası adresinize gönderilecektir.',
        duration: 8000,
      });
      setLocation('/login');
    } else {
      toast({
        title: 'Kayıt Başarısız',
        description: 'Hesap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AuthCard
      title="Create Agent Account"
      description="Join Find And Study as a certified agent"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
            data-testid="input-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="Your email address"
            required
            autoComplete="email"
            data-testid="input-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="Create a password"
            required
            autoComplete="new-password"
            data-testid="input-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agencyName">Agency Name</Label>
          <Input
            id="agencyName"
            type="text"
            value={formData.agencyName}
            onChange={(e) => updateField('agencyName', e.target.value)}
            placeholder="Your education agency name"
            required
            autoComplete="organization"
            data-testid="input-agency"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select
            value={formData.country}
            onValueChange={handleCountryChange}
          >
            <SelectTrigger id="country" data-testid="select-country">
              <SelectValue placeholder="Ülke seçin" />
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
          <Label htmlFor="phoneNumber">Mobile Phone</Label>
          <div className="flex gap-2">
            <Select
              value={formData.phoneCountry}
              onValueChange={(v) => updateField('phoneCountry', v)}
            >
              <SelectTrigger
                className="w-[110px] shrink-0"
                aria-label="Telefon ülke kodu"
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
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login">
            <span className="text-primary hover:underline cursor-pointer">
              Sign In
            </span>
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
