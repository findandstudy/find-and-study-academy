import {useMemo,useState,useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useRoute,useLocation,Link} from 'wouter';
import {useTranslation} from 'react-i18next';
import {Folder,Search,Image as ImageIcon,ArrowLeft} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {brandCopy} from '@/lib/brand-copy';
import {SUPPORTED_LANGUAGES} from '@shared/languages';
import {partnershipCopy} from '@/lib/partnership-copy';
import {brandApi,BrandDownloadDialog} from '@/components/AgencyBranding';
export default function PartnerZone(){
 const {i18n,t}=useTranslation(),c=brandCopy(i18n.language),pc=partnershipCopy(i18n.language);const [,params]=useRoute('/agent/partner-zone/:folderId'),[,navigate]=useLocation(),folderId=params?.folderId;
 const [sort,setSort]=useState('newest'),[list,setList]=useState(false);
 const [search,setSearch]=useState(''),[language,setLanguage]=useState('all'),[format,setFormat]=useState('all'),[country,setCountry]=useState('all'),[selected,setSelected]=useState<string[]>([]),[download,setDownload]=useState<any[]|null>(null);
 useEffect(()=>{setSelected([]);setDownload(null)},[folderId]);
 const q=useQuery({queryKey:['brand-catalog'],queryFn:async()=>(await brandApi('/api/brand/catalog')).json()});
 const partnership=useQuery({queryKey:['partner-zone-status'],queryFn:async()=>(await brandApi('/api/partnership')).json(),retry:false});
 const folders:any[]=q.data?.folders||[],items:any[]=q.data?.items||[],byId=new Map(folders.map(f=>[f.id,f])),current=folderId?byId.get(folderId):null;
 const beneath=(i:any,id:string)=>{let f=byId.get(i.folderId);const seen=new Set();while(f){if(f.id===id)return true;if(seen.has(f.id))break;seen.add(f.id);f=byId.get(f.parentFolderId)}return false};
 const countryName=(code:string)=>{try{return new Intl.DisplayNames([i18n.language],{type:'region'}).of(code)||code}catch{return code}};
 const languageName=(code:string)=>SUPPORTED_LANGUAGES.find(l=>l.code===code)?.nativeLabel||code;
 const pretty=(i:any)=>{const f=byId.get(i.folderId),m=i.material;return m&&m.format!=='other'?`${f?.name||m.name} · Instagram ${m.format==='post'?'Post':'Story'} · ${languageName(m.language)}`:i.displayName||i.title};
 const filtered=useMemo(()=>items.filter(i=>{
  if(folderId&&!beneath(i,folderId))return false;const f=byId.get(i.folderId),hay=[pretty(i),i.title,i.description,f?.name].join(' ').toLocaleLowerCase(i18n.language);
  if(search&&!hay.includes(search.toLocaleLowerCase(i18n.language)))return false;
  return (language==='all'||i.material?.language===language)&&(format==='all'||(format==='other'?(i.material?.format==='other'):i.material?.format===format))&&(country==='all'||f?.countryCode===country);
 }),[q.data,folderId,search,language,format,country,i18n.language]);
 const filteredMode=!!search||language!=='all'||format!=='all'||country!=='all';
 const visibleFolders=folders.filter(f=>(f.parentFolderId||null)===(folderId||null)&&items.some(i=>beneath(i,f.id)));
 const direct=(filteredMode?filtered:filtered.filter(i=>i.folderId===folderId)).slice().sort((a,b)=>sort==='az'?pretty(a).localeCompare(pretty(b),i18n.language):sort==='za'?pretty(b).localeCompare(pretty(a),i18n.language):(new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime())*(sort==='oldest'?-1:1));
 function choose(ids:string[]){setSelected(ids.slice(0,40))}
 const chosen=items.filter(i=>selected.includes(i.id));
 return <div className="space-y-5">
 <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">{current?.name||t('agent.partnerZone.title',{defaultValue:'Partner Zone'})}</h1><p className="text-muted-foreground">{t('agent.partnerZone.subtitle',{defaultValue:'White-label resources for your agency'})}</p></div><Link href="/agent/agency" className="underline">{c.logo}</Link></div>
 <section className="rounded-lg border p-4 flex flex-wrap gap-3 items-center justify-between"><div><span>{pc.text(0)}: </span><strong>{partnership.data?.application?pc.status(partnership.data.application.status):pc.text(21)}</strong></div><Link href="/agent/partnership" className="underline">{c.next}</Link></section>
 {folderId&&<Button variant="outline" onClick={()=>{navigate(current?.parentFolderId?'/agent/partner-zone/'+current.parentFolderId:'/agent/partner-zone');setSelected([])}}><ArrowLeft className="h-4 w-4 me-2"/>{t('common.back',{defaultValue:'Back'})}</Button>}
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1"><span className="text-sm">{c.search}</span><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setSelected([])}} className="border rounded p-2 w-full" placeholder={c.search}/></label>
 <label className="space-y-1"><span className="text-sm">{c.language}</span><select aria-label={c.language} className="border rounded p-2 w-full" value={language} onChange={e=>{setLanguage(e.target.value);setSelected([])}}><option value="all">{c.all}</option>{SUPPORTED_LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.nativeLabel}</option>)}</select></label>
 <label className="space-y-1"><span className="text-sm">{c.format}</span><select aria-label={c.format} className="border rounded p-2 w-full" value={format} onChange={e=>{setFormat(e.target.value);setSelected([])}}><option value="all">{c.all}</option><option value="post">Instagram Post</option><option value="story">Instagram Story</option><option value="other">{c.other}</option></select></label>
 <label className="space-y-1"><span className="text-sm">{t('common.country',{defaultValue:'Country'})}</span><select className="border rounded p-2 w-full" value={country} onChange={e=>{setCountry(e.target.value);setSelected([])}}><option value="all">{c.all}</option>{Array.from(new Set(folders.map(f=>f.countryCode).filter(Boolean))).map(code=><option key={code} value={code}>{countryName(code)}</option>)}</select></label></div>
 <div className="flex flex-wrap items-center gap-3"><select aria-label={t('agent.partnerZone.newestFirst',{defaultValue:'Sort'})} className="border rounded p-2" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">{t('agent.partnerZone.newestFirst',{defaultValue:'Newest first'})}</option><option value="oldest">{t('agent.partnerZone.oldestFirst',{defaultValue:'Oldest first'})}</option><option value="az">A → Z</option><option value="za">Z → A</option></select><Button variant={!list?'default':'outline'} aria-pressed={!list} onClick={()=>setList(false)}>{t('agent.partnerZone.gridView',{defaultValue:'Grid view'})}</Button><Button variant={list?'default':'outline'} aria-pressed={list} onClick={()=>setList(true)}>{t('agent.partnerZone.listView',{defaultValue:'List view'})}</Button></div>
 {q.isLoading&&<p role="status">{c.working}</p>}{q.isError&&<div role="alert">{c.error} <Button onClick={()=>q.refetch()}>{c.preview}</Button></div>}
 {!filteredMode&&<div data-testid="partner-folders" data-view={list?"list":"grid"} className={list?"grid gap-3":"grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{visibleFolders.map(f=><button key={f.id} onClick={()=>{navigate('/agent/partner-zone/'+f.id);setSelected([])}} className={"border rounded-lg overflow-hidden text-start bg-card hover:shadow-md "+(list?"flex items-center gap-3":"")}><div className={(list?"h-20 w-28 shrink-0":"h-36")+" bg-muted flex items-center justify-center"}>{f.coverImageUrl?<img src={f.coverImageUrl} alt="" className="w-full h-full object-cover" onError={e=>{e.currentTarget.style.display='none'}}/>:<Folder className="w-14 h-14 text-blue-700"/>}</div><div className="p-4 space-y-1"><h2 className="font-semibold">{f.name}</h2><p className="text-sm text-muted-foreground">{f.countryCode?countryName(f.countryCode)+' · ':''}{items.filter(i=>beneath(i,f.id)).length}</p></div></button>)}</div>}
 {direct.length>0&&<div className="flex flex-wrap gap-3 items-center"><Button variant="outline" onClick={()=>choose(direct.map(i=>i.id))}>{t('agent.partnerZone.selectAll',{defaultValue:'Select all'})} (≤40)</Button><Button disabled={!chosen.length} onClick={()=>setDownload(chosen.map(i=>({...i,displayName:pretty(i)})))}>{c.download} ({chosen.length})</Button></div>}
 <div data-testid="partner-materials" data-view={list?"list":"grid"} className={list?"grid gap-3":"grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{direct.map(i=><article key={i.id} className={"border rounded-lg overflow-hidden bg-card "+(list?"sm:flex sm:items-center":"")}><label className={"flex items-center gap-2 p-3 "+(list?"sm:w-24 sm:shrink-0":"border-b")}><input aria-label={pretty(i)} type="checkbox" checked={selected.includes(i.id)} onChange={e=>choose(e.target.checked?[...selected,i.id]:selected.filter(id=>id!==i.id))}/><span className="text-sm">{languageName(i.material?.language)}</span></label>
 <div className={(list?"h-28 sm:w-40 sm:shrink-0":"h-56")+" bg-muted flex justify-center items-center"}>{i.imageUrl?<img src={i.imageUrl} alt={pretty(i)} className="w-full h-full object-contain"/>:<ImageIcon className="w-12 h-12"/>}</div><div className={"p-4 space-y-3 "+(list?"min-w-0 flex-1":"")}><h2 className="font-medium break-words">{pretty(i)}</h2><p className="text-xs text-muted-foreground">{c.updated}: {i.updatedAt?new Date(i.updatedAt).toLocaleDateString(i18n.language):'—'}</p>{(()=>{const u=i.documentUrl||i.imageUrl||i.videoUrl;return typeof u==='string'&&(/^(https?:\/\/|\/uploads\/)/.test(u))?<a href={u} target="_blank" rel="noopener noreferrer" className="block underline">{t('agent.partnerZone.openFile',{defaultValue:'Open'})}</a>:null})()}<Button className="w-full" onClick={()=>setDownload([{...i,displayName:pretty(i)}])}>{c.download}</Button></div></article>)}</div>
 {!q.isLoading&&!q.isError&&direct.length===0&&(filteredMode||visibleFolders.length===0)&&<p className="border rounded p-8">{c.empty}</p>}
 {download&&<BrandDownloadDialog key={download.map(i=>i.id).join(',')} items={download} onClose={()=>setDownload(null)}/>}
 </div>
}
