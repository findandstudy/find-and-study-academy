import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { normalizeLanguage } from '@/i18n/languages';
import { completionCopy } from '@/lib/completion-copy';
import { WORLD_COUNTRIES } from '@/lib/world-countries';
import { AuthCard } from '@/components/layouts/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Completion = {required:boolean;emailNeedsReview:boolean;profile:{name:string;email:string;agencyName:string;country:string;phone:string;agencyNameLocked:boolean;countryLocked:boolean}};
async function status():Promise<Completion>{
 const r=await fetch('/api/me/completion',{cache:'no-store',credentials:'include'});
 if(!r.ok)throw new Error('Completion unavailable');
 const data=await r.json();
 if(typeof data?.required!=='boolean'||(data.required&&(
  typeof data.emailNeedsReview!=='boolean'||!data.profile||
  ['name','email','agencyName','country','phone'].some(key=>typeof data.profile[key]!=='string')||
  typeof data.profile.agencyNameLocked!=='boolean'||typeof data.profile.countryLocked!=='boolean'
 )))throw new Error('Invalid completion response');
 return data;
}
export function ProfileCompletionGate({children}:{children:React.ReactNode}){
 const user=useAuthStore(s=>s.user);const [location]=useLocation();
 const {t,i18n}=useTranslation();const copy=completionCopy(normalizeLanguage(i18n.language));
 // Route-specific key prevents a previously complete cached response opening a
 // newly visited course after required information was cleared elsewhere.
 const q=useQuery({queryKey:['profile-completion',user?.id,location],queryFn:status,staleTime:0,refetchOnMount:'always',retry:1});
 if(q.isPending || (q.isFetching&&!q.data?.required))return <div role="status" className="min-h-screen grid place-items-center">{t('common.loading')}</div>;
 if(q.isError)return <AuthCard variant="signup" title={copy.title} description={copy.description}><p role="alert">{copy.error}</p><Button onClick={()=>q.refetch()}>{copy.retry}</Button><Button variant="ghost" onClick={()=>useAuthStore.getState().logout()}>{t('common.logout')}</Button></AuthCard>;
 if(q.data?.required)return <CompletionForm data={q.data}/>;
 return <>{children}</>;
}
function CompletionForm({data}:{data:Completion}){
 const {t,i18n}=useTranslation();const language=normalizeLanguage(i18n.language);const copy=completionCopy(language);
 const [form,setForm]=useState({name:data.profile.name,agencyName:data.profile.agencyName,country:data.profile.country,phone:data.profile.phone});
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const names=new Intl.DisplayNames([language,'en'],{type:'region'});
 const countries=WORLD_COUNTRIES.map(c=>({...c,label:names.of(c.code)||c.name})).sort((a,b)=>a.label.localeCompare(b.label,language));
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setSaving(true);try{
  if(form.name.trim().length<2||form.agencyName.trim().length<2||!form.country||!/^\+[1-9]\d{5,17}$/.test(form.phone.replace(/\s/g,'')))throw new Error('Invalid fields');
  const r=await fetch('/api/me/completion',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
  if(!r.ok)throw new Error('Save failed');const saved=await r.json();
  if(saved?.success!==true||saved?.required!==false)throw new Error('Incomplete save response');
  window.location.assign('/agent/dashboard');
 }catch{setError(copy.error);}finally{setSaving(false);}};
 return <AuthCard variant="signup" title={copy.title} description={copy.description}>
  <form onSubmit={submit} className="space-y-4" dir={['ar','fa','ur'].includes(language)?'rtl':'ltr'}>
   <div><Label htmlFor="completion-name">{t('registration.fullName')} *</Label><Input id="completion-name" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
   <div><Label htmlFor="completion-email">{t('auth.email')}</Label><Input id="completion-email" type="email" readOnly value={data.profile.email} autoComplete="email"/>{data.emailNeedsReview&&<p role="alert">{copy.emailReview}</p>}</div>
   <div><Label htmlFor="completion-agency">{t('registration.agencyName')} *</Label><Input id="completion-agency" required minLength={2} maxLength={180} readOnly={data.profile.agencyNameLocked} autoComplete="organization" value={form.agencyName} onChange={e=>setForm({...form,agencyName:e.target.value})}/></div>
   <div><Label htmlFor="completion-country">{t('registration.country')} *</Label><select id="completion-country" required disabled={data.profile.countryLocked} value={form.country} onChange={e=>setForm({...form,country:e.target.value})} className="w-full rounded-md border bg-background px-3 py-2 text-base"><option value="">{t('registration.selectCountry')}</option>{countries.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
   <div><Label htmlFor="completion-phone">{t('registration.mobilePhone')} *</Label><Input id="completion-phone" required type="tel" maxLength={40} autoComplete="tel" dir="ltr" placeholder="+90 532 123 45 67" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
   {error&&<p role="alert" className="text-destructive">{error}</p>}
   <Button className="w-full" type="submit" disabled={saving||data.emailNeedsReview}>{saving?t('common.loading'):copy.save}</Button>
   <Button className="w-full" variant="ghost" type="button" disabled={saving} onClick={()=>useAuthStore.getState().logout()}>{t('common.logout')}</Button>
  </form>
 </AuthCard>;
}
