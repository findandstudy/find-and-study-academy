import crypto from 'node:crypto';
import {normalize,processSearchWords,type Topic} from './findy-query';
import {findyMessage} from './findy-messages';
export type FindySource={id:string;kind:'lesson'|'apply';title:string;excerpt:string;sourceName:string;updatedAt:string|null;location:string;href:string;revision:string};
export const clean=(s:unknown)=>String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const revision=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
export function catalogEvidence(row:any,language:string):FindySource{
 const labels:Record<string,string>={program_name:'Program',university_name:'University',country:'Country',city:'City',degree:'Study level',language:'Teaching language',duration:'Duration',tuition_fee:'Tuition fee',discounted_fee:'Discounted tuition fee',currency:'Currency',fee_type:'Fee period / type',application_fee:'Application fee',deposit_fee:'Deposit fee',intakes:'Intakes'};
 // Never calculate discounts, annualise a fee, or fill a missing value.
 const excerpt=Object.entries(labels).map(([key,label])=>label+': '+(row[key]===null||row[key]===undefined||row[key]===''?'—':String(row[key]).slice(0,600))).join('\n');
 return{id:String(row.program_id),kind:'apply',title:row.university_name+' — '+row.program_name,excerpt,sourceName:'Apply · '+row.university_name,updatedAt:row.program_updated_at?new Date(row.program_updated_at).toISOString():null,location:'Program #'+row.program_id,href:'/api/findy/evidence/apply/'+row.program_id+'?lang='+language,revision:revision(excerpt)};
}
export function countryLessons(items:any[],countries:any[],topic:Topic){
 return items.filter(c=>{if(c.status!=='published'||c.type!=='lesson')return false;
 if(!topic.country)return true;
 const linked=countries.find(x=>x.id===c.countryId);const code=c.countryCode||linked?.code;
 return topic.countryCode&&code?String(code).toUpperCase()===topic.countryCode:normalize(linked?.name)===normalize(topic.country)||normalize(c.title).includes(normalize(topic.country));});
}
export function selectProcessLessons(items:any[],message:string){
 const words=[...processSearchWords,'application','admission','documents','enrollment','partnership','partnerlik'].map(normalize);const specific=/visa|vize|فيزا|виза|签证/.test(normalize(message))?['visa','vize','فيزا','виза','签证']: /belge|document|مدارک|وثائق|документ/.test(normalize(message))?['document','belge','مدارک','وثائق','документ']:[];
 return items.map(item=>{const title=normalize(item.title),body=normalize(clean(item.content||item.description));const terms=specific.length?specific:words;const score=terms.reduce((n,w)=>n+(title.includes(w)?10:body.includes(w)?1:0),0);return{...item,score};}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);
}
export function lessonEvidence(item:any,language:string,message:string):FindySource{
 const body=clean(item.content||item.description),terms=processSearchWords.map(normalize),text=normalize(body);const at=terms.map(t=>text.indexOf(t)).filter(i=>i>=0);const start=Math.max(0,(at.length?Math.min(...at):0)-100);const excerpt=body.slice(start,start+1600);
 return{id:item.id,kind:'lesson',title:clean(item.title),excerpt,sourceName:clean(item.title),updatedAt:item.updatedAt?new Date(item.updatedAt).toISOString():null,location:'Academy',href:'/api/findy/evidence/lesson/'+encodeURIComponent(item.id)+'?lang='+language,revision:revision(body)};
}
export function formatAnswer(sources:FindySource[],language:string,baseLabels:string[],total?:number){
 const list=sources.map((s,i)=>'['+(i+1)+'] '+s.title+'\n'+s.excerpt).join('\n\n');
 const summary=typeof total==='number'?findyMessage(language,6,{shown:sources.length,total})+'\n\n':'';
 return baseLabels[0]+'\n\n'+summary+list+'\n\n'+baseLabels[4];
}
