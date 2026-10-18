import {useAcademyUi} from '@/lib/academy-ui';
import '@/lib/campaign-i18n';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const { t } = useTranslation();
  const {message,locale,dir}=useAcademyUi();
  const [, setLocation] = useLocation();
  const [devices,setDevices]=useState<{id:string;label:string;lastSeen:string}[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const { toast } = useToast();

  const complete = async () => {await useAuthStore.getState().initialize();setLocation(useAuthStore.getState().role==='admin'?'/admin/dashboard':'/agent/dashboard');};
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();setBusy(true);setError('');setDevices([]);
    try {const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json();
      if(data.code==='DEVICE_LIMIT'){setDevices(data.devices);return;}
      if(!response.ok)throw new Error(data.pending?'ACCOUNT_PENDING':(data.code||data.message||'Login failed'));await complete();
    }catch(e){setError(e instanceof Error?e.message:'Login failed')}finally{setBusy(false)}
  };
  const replaceDevice=async(deviceId:string)=>{setBusy(true);setError('');try{const response=await fetch('/api/auth/replace-device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId})});const data=await response.json();if(!response.ok)throw new Error(data.code||'Login failed');await complete()}catch(e){setError(e instanceof Error?e.message:'Login failed')}finally{setBusy(false)}};

  return (
    <AuthCard
      title={t('auth.welcomeBack')}
      description={t('auth.signInSubtitle')}
    >
      {error&&<p role="alert" className="text-destructive">{/^[A-Z_]+$/.test(error)?message(error):t('registration.failedMessage')}</p>}
      {devices.length>0&&<section className="space-y-3" dir={dir} aria-label={t('campaign.deviceLimit')}><p>{t('campaign.deviceLimit',{defaultValue:'Two devices are already registered. Choose one to sign out and continue on this device. Other sessions on the removed device will stop working.'})}</p>{devices.map(d=><div key={d.id}><span>{d.label} · {new Date(d.lastSeen).toLocaleString(locale)}</span><Button disabled={busy} variant="outline" onClick={()=>replaceDevice(d.id)}>{t('campaign.replaceDevice',{defaultValue:'Sign out this device and continue'})}</Button></div>)}<Button variant="ghost" onClick={()=>setDevices([])}>{t('common.cancel',{defaultValue:'Cancel'})}</Button></section>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            required
            autoComplete="email"
            data-testid="input-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            required
            autoComplete="current-password"
            data-testid="input-password"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading||busy}
          data-testid="button-submit"
        >
          {isLoading ? t('common.loading') : t('auth.signIn')}
        </Button>
      </form>

      <div className="mt-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('auth.newAgent')}{' '}
          <Link href="/signup">
            <span className="text-primary hover:underline cursor-pointer">
              {t('auth.signUp')}
            </span>
          </Link>
        </p>

        <p className="text-sm text-muted-foreground">
          <Link href="/forgot-password">
            <span className="text-primary hover:underline cursor-pointer">
              {t('auth.forgotPassword')}
            </span>
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
