import {useState,useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {brandApi} from './AgencyBranding';
import {brandCopy} from '@/lib/brand-copy';
export default function BrandTemplateManager(){
 const {i18n,t}=useTranslation(),c=brandCopy(i18n.language);const q=useQuery({queryKey:['admin-brand-catalog'],queryFn:async()=>(await brandApi('/api/brand/catalog')).json()});
 const [id,setId]=useState(''),[p,setP]=useState({x:.68,y:.06,width:.25,height:.12,backdrop:'none'}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const items=(q.data?.items||[]).filter((i:any)=>(i.imageUrl||i.documentUrl)?.startsWith('/uploads/')&&(i.contentType||i.type)==='image');const item=items.find((i:any)=>i.id===id);
 useEffect(()=>{setMessage('');const v=item?.template;setP(v?{x:v.x,y:v.y,width:v.width,height:v.height,backdrop:v.backdrop}:{x:.68,y:.06,width:.25,height:.12,backdrop:'none'})},[id]);
 async function save(){setBusy(true);setMessage('');try{await brandApi('/api/admin/brand/template/'+id,p,'PUT');setMessage('✓ '+c.save);await q.refetch()}catch{setMessage(c.error)}finally{setBusy(false)}}
 return <details className="border rounded-lg bg-card p-4 mb-5"><summary className="font-semibold cursor-pointer">{c.placement} · White-label</summary><div className="mt-4 space-y-4"><label className="block">{c.placement}<select aria-label={c.placement} value={id} onChange={e=>setId(e.target.value)} className="border rounded p-2 block w-full"><option value="">—</option>{items.map((i:any)=><option key={i.id} value={i.id}>{i.title}{i.template?' ✓':''}</option>)}</select></label>
 {item&&<div className="grid gap-5 md:grid-cols-2"><div className="relative self-start max-w-md"><img src={item.imageUrl||item.documentUrl} alt={item.title} className="w-full h-auto block"/><div className="absolute flex justify-center items-center border-2 border-dashed border-blue-600 text-blue-900 text-xs overflow-hidden" style={{left:p.x*100+'%',top:p.y*100+'%',width:p.width*100+'%',height:p.height*100+'%',background:p.backdrop==='none'?'#bfdbfe99':p.backdrop,color:p.backdrop==='black'?'white':'#1e3a8a'}}>LOGO</div></div><div className="space-y-4">{(['x','y','width','height'] as const).map(k=><label key={k} className="block">{({x:'X',y:'Y',width:c.width,height:c.height})[k]} · {Math.round(p[k]*100)}%<input type="range" aria-label={k} value={p[k]} min={k==='width'||k==='height'?.03:0} max={k==='width'?.6:k==='height'?.5:1} step={.01} onChange={e=>setP({...p,[k]:Number(e.target.value)})} className="block w-full"/></label>)}
 <label className="block">{c.backdrop}<select value={p.backdrop} onChange={e=>setP({...p,backdrop:e.target.value})} className="block border rounded p-2"><option value="none">{c.none}</option><option value="white">{c.white}</option><option value="black">{c.black}</option></select></label><p className="text-sm text-muted-foreground">{c.review}</p><Button disabled={busy||p.x+p.width>1||p.y+p.height>1} onClick={save}>{busy?c.working:c.save}</Button><p role="status">{message}</p></div></div>}
 </div></details>
}
