import {parseTopic,matchesProgram,normalize} from './findy-query';
import {findyMessage,usageLabel,newChatLabel} from './findy-messages';
import {catalogDimensions,livePrograms,liveProgramById,findyUsage,reserveFindy,finishFindy,FindyLimitError} from './findy-live-data';
import {catalogEvidence,countryLessons,selectProcessLessons,lessonEvidence,formatAnswer} from './findy-answer';
import type {Express,RequestHandler} from 'express';
import crypto from 'crypto';
import {pool} from './db';
import {storage,expandTurkishQueryTerms} from './storage';
import {normalizeLanguage} from '@shared/languages';
const pg:any=pool;
const norm=(s:unknown)=>String(s??'').normalize('NFKD').replace(new RegExp('\\p{M}','gu'),'').replace(/ı/g,'i').toLowerCase();
export const plain=(s:unknown)=>String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const fields=['Universities','University','Course','Program','Country','City','Study Level','Duration','Language','Intake','Tuition Fee','Fee Type','Application Status'];
const generic=new Set('what which how much is are the a an of in at for about tell me please university universities program programs course courses fee fees tuition price cost information available list and or to ne nedir kadar hangi bilgi ver bana hakkinda universitesi universiteleri universite program programi programlar kurs ucreti ucret ucretleri fiyat fiyatlari yillik ogrenim'.split(' '));
const aliases:Record<string,string[]>={medicine:['medicine','tip','tıp','طب','медицина','医学'],engineering:['engineering','muhendislik','هندسة','инженерия'],tuition:['tuition','fee','fees','ucret','fiyat','ücret','رسوم','стоимость','学费','शुल्क','هزینه','tarifa'],program:['program','programs','bolum','bölüm','программа','تخصص','课程','कार्यक्रम']};
export function catalogFields(metadata:any){const out:Record<string,string>={};if(!metadata||typeof metadata!=='object')return out;for(const key of fields){const value=metadata[key];if(typeof value==='string'||typeof value==='number')out[key]=String(value).slice(0,500);}return out;}
const copy:Record<string,string[]>={
 tr:['İzinli kaynaklarda bulunan bilgiler:','Bu bilgi şu anda yayımlanmış derslerde veya aktif katalogda bulunamadı. Lütfen Find And Study ekibiyle iletişime geçin.','Kaynak','Kaynağın güncelleme tarihi','Aşağıdaki metin kaynaktan aktarılmıştır; dosyanın güncelleme tarihi, ücretin geçerlilik tarihi anlamına gelmez.'],
 en:['Information found in approved sources:','This information was not found in published lessons or the active catalogue. Please contact Find And Study.','Source','Source updated','The text below is quoted from the source. The file update date is not a fee validity date.'],
 ar:['المعلومات الموجودة في المصادر المسموح بها:','لم تُعثر على هذه المعلومات في الدروس المنشورة أو الكتالوج النشط. تواصل مع Find And Study.','المصدر','تحديث المصدر','النص أدناه منقول من المصدر. تاريخ تحديث الملف لا يعني تاريخ صلاحية الرسوم.'],
 fr:['Informations des sources autorisées :','Information introuvable dans les cours publiés ou le catalogue actif. Contactez Find And Study.','Source','Mise à jour de la source','Le texte est cité de la source. La date de mise à jour du fichier ne garantit pas la validité des frais.'],
 ru:['Информация из разрешённых источников:','Данные не найдены в опубликованных уроках или действующем каталоге. Обратитесь в Find And Study.','Источник','Обновление источника','Ниже приведён текст источника. Дата обновления файла не означает срок действия стоимости.'],
 fa:['اطلاعات یافت‌شده در منابع مجاز:','این اطلاعات در درس‌های منتشرشده یا کاتالوگ فعال یافت نشد. با Find And Study تماس بگیرید.','منبع','به‌روزرسانی منبع','متن زیر از منبع نقل شده است. تاریخ به‌روزرسانی فایل به معنی اعتبار شهریه نیست.'],
 zh:['授权来源中的信息：','已发布课程或有效目录中未找到此信息。请联系Find And Study。','来源','来源更新日期','以下文字引自来源。文件更新日期不代表学费有效日期。'],
 hi:['अनुमत स्रोतों में मिली जानकारी:','प्रकाशित पाठों या सक्रिय कैटलॉग में यह जानकारी नहीं मिली। Find And Study से संपर्क करें।','स्रोत','स्रोत अद्यतन','नीचे स्रोत का पाठ है। फ़ाइल अद्यतन तिथि शुल्क की वैधता तिथि नहीं है।'],
 es:['Información de fuentes autorizadas:','No se encontró esta información en las lecciones publicadas ni en el catálogo activo. Contacta con Find And Study.','Fuente','Actualización de la fuente','El texto se cita de la fuente. La fecha del archivo no indica la vigencia de las tarifas.'],
 id:['Informasi dari sumber yang diizinkan:','Informasi ini tidak ditemukan dalam pelajaran terbit atau katalog aktif. Hubungi Find And Study.','Sumber','Pembaruan sumber','Teks dikutip dari sumber. Tanggal pembaruan berkas bukan tanggal berlaku biaya.'],
 ur:['مجاز ذرائع میں موجود معلومات:','یہ معلومات شائع شدہ اسباق یا فعال کیٹلاگ میں نہیں ملیں۔ Find And Study سے رابطہ کریں۔','ماخذ','ماخذ کی تازہ کاری','ذیل کا متن ماخذ سے لیا گیا ہے۔ فائل کی تازہ کاری کی تاریخ فیس کی میعاد نہیں ہے۔'],
 tk:['Rugsat berlen çeşmelerdäki maglumatlar:','Bu maglumat çap edilen sapaklarda ýa-da işjeň katalogda tapylmady. Find And Study bilen habarlaşyň.','Çeşme','Çeşmäniň täzelenişi','Aşakdaky tekst çeşmeden alyndy. Faýlyň täzeleniş senesi tölegiň güýjüni görkezmeýär.'],
 ky:['Уруксат берилген булактардагы маалымат:','Бул маалымат жарыяланган сабактардан же активдүү каталогдон табылган жок. Find And Study менен байланышыңыз.','Булак','Булактын жаңыртылышы','Текст булактан алынган. Файлдын жаңыртылган күнү төлөмдүн жарактуулук күнү эмес.'],
 kk:['Рұқсат етілген дереккөздердегі мәлімет:','Мәлімет жарияланған сабақтардан немесе белсенді каталогтан табылмады. Find And Study компаниясына хабарласыңыз.','Дереккөз','Дереккөз жаңартылды','Мәтін дереккөзден алынған. Файлдың жаңартылған күні төлемнің жарамдылық күні емес.'],
 uz:['Ruxsat etilgan manbalardagi maʼlumot:','Bu maʼlumot chop etilgan darslar yoki faol katalogda topilmadi. Find And Study bilan bogʻlaning.','Manba','Manba yangilangan','Matn manbadan olingan. Fayl yangilangan sana toʻlov amal qilish sanasi emas.'],
 tg:['Маълумот аз манбаъҳои иҷозатшуда:','Ин маълумот дар дарсҳои нашршуда ё каталоги фаъол ёфт нашуд. Бо Find And Study тамос гиред.','Манбаъ','Навсозии манбаъ','Матн аз манбаъ гирифта шудааст. Санаи навсозии файл муҳлати эътибори пардохт нест.'],
 bn:['অনুমোদিত উৎসের তথ্য:','প্রকাশিত পাঠ বা সক্রিয় ক্যাটালগে এই তথ্য পাওয়া যায়নি। Find And Study-এর সঙ্গে যোগাযোগ করুন।','উৎস','উৎস হালনাগাদ','নিচের লেখা উৎস থেকে নেওয়া। ফাইলের হালনাগাদের তারিখ ফি কার্যকর থাকার তারিখ নয়।'],
 pt:['Informações de fontes autorizadas:','Informação não encontrada nas aulas publicadas ou no catálogo ativo. Contacte Find And Study.','Fonte','Atualização da fonte','O texto é citado da fonte. A data do ficheiro não é a data de validade dos valores.'],
 ne:['अनुमति प्राप्त स्रोतका जानकारी:','प्रकाशित पाठ वा सक्रिय सूचीमा यो जानकारी भेटिएन। Find And Study लाई सम्पर्क गर्नुहोस्।','स्रोत','स्रोत अद्यावधिक','तलको पाठ स्रोतबाट लिइएको हो। फाइल अद्यावधिक मिति शुल्कको मान्य मिति होइन।'],
 vi:['Thông tin từ nguồn được phép:','Không tìm thấy thông tin trong bài học đã xuất bản hoặc danh mục đang hoạt động. Hãy liên hệ Find And Study.','Nguồn','Cập nhật nguồn','Văn bản được trích từ nguồn. Ngày cập nhật tệp không phải ngày hiệu lực của học phí.'],
 ko:['허용된 출처의 정보:','게시된 강의나 활성 카탈로그에서 정보를 찾지 못했습니다. Find And Study에 문의하세요.','출처','출처 업데이트','아래는 출처의 인용문입니다. 파일 업데이트 날짜는 학비 유효 기간이 아닙니다.'],
 uk:['Інформація з дозволених джерел:','Інформацію не знайдено в опублікованих уроках або активному каталозі. Зверніться до Find And Study.','Джерело','Оновлення джерела','Текст наведено з джерела. Дата оновлення файлу не є датою чинності вартості.'],
 it:['Informazioni dalle fonti consentite:','Informazione non trovata nelle lezioni pubblicate o nel catalogo attivo. Contatta Find And Study.','Fonte','Aggiornamento della fonte','Il testo è citato dalla fonte. La data del file non è la data di validità delle tariffe.']};
export function findyCopy(lang:string){return copy[lang]||copy.en;}
export type Evidence={id:string;kind:'lesson'|'catalog';title:string;excerpt:string;sourceName:string;updatedAt:string|null;location:string;href:string;revision:string};
const revision=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
export function rankEvidence(message:string,lessons:any[],catalog:any[],language:string,expanded:string[]=[]):Evidence[]{
 const raw=norm(message).split(new RegExp('[^\\p{L}\\p{N}]+','gu')).filter(s=>s.length>2);const terms=new Set([...raw,...expanded.map(norm)]);for(const [canonical,words]of Object.entries(aliases))if(words.some(w=>norm(message).includes(norm(w)))){terms.add(canonical);words.forEach(w=>terms.add(norm(w)));}
 const significant=raw.filter(t=>!generic.has(t)&&!Object.values(aliases).flat().some(w=>norm(w)===t));
 const candidates:any[]=[];
 for(const c of lessons.filter(c=>c.status==='published'&&c.type==='lesson')){const body=plain(c.content||c.description),title=plain(c.title);if(!body)continue;candidates.push({id:c.id,kind:'lesson',title,text:body,sourceName:title,updatedAt:c.updatedAt||null,location:'lesson',search:title+' '+body});}
 for(const row of catalog){if(row.source_status!=='active'||row.source_type!=='file'||row.file_type!=='excel')continue;const f=catalogFields(row.metadata);if(!(f.Universities||f.University)||!(f.Course||f.Program))continue;const body=Object.entries(f).map(([k,v])=>k+': '+v).join('\n');candidates.push({id:row.id,kind:'catalog',title:(f.Universities||f.University)+' — '+(f.Course||f.Program),text:body,sourceName:row.source_name,updatedAt:row.source_updated_at||null,university:f.Universities||f.University,program:f.Course||f.Program,location:[row.metadata?.sheet,row.metadata?.rowIndex!=null?'#'+row.metadata.rowIndex:null].filter(Boolean).join(' · '),search:body});}
 const meaningful=significant.filter(t=>candidates.some(c=>norm(c.search).includes(t)));const unknown=significant.filter(t=>!meaningful.includes(t));
 // Never answer an unknown named university using unrelated generic fee matches.
 const entity=new RegExp('([\\p{L}\\p{N}-]+)\\s+(?:university|universitesi|universite)','iu').exec(message);if(entity&&!generic.has(norm(entity[1]))&&!candidates.some(c=>norm(c.search).includes(norm(entity[1]))))return [];
 const intentOnly=raw.every(t=>generic.has(t)||Object.values(aliases).flat().some(w=>norm(w)===t));if(!meaningful.length&&!intentOnly&&unknown.length)return [];
 const universityNames=Array.from(new Set(candidates.filter(c=>c.kind==='catalog').map(c=>c.university as string)));
 const named=universityNames.filter(name=>{const parts=norm(name).split(/[^a-z0-9]+/).filter(t=>t.length>2&&!generic.has(t)&&!['istanbul','ankara'].includes(t));return parts.length>0&&parts.every(t=>norm(message).includes(t));}).sort((a,b)=>b.length-a.length);
 const finance=Array.from(terms).some(t=>aliases.tuition.some(w=>norm(w)===t));
 let eligibleCandidates=candidates;
 if(named.length){const selected=named.filter(n=>norm(n)===norm(named[0]));eligibleCandidates=eligibleCandidates.filter(c=>c.kind!=='catalog'||selected.includes(c.university));if(finance&&unknown.length)return [];}
 const requestedPrograms=Object.entries(aliases).filter(([key,words])=>!['tuition','program'].includes(key)&&words.some(w=>norm(message).includes(norm(w))));
 if(requestedPrograms.length)eligibleCandidates=eligibleCandidates.filter(c=>c.kind!=='catalog'||requestedPrograms.every(([_,words])=>words.some(w=>norm(c.program).includes(norm(w)))));
 if(finance)eligibleCandidates=eligibleCandidates.filter(c=>c.kind==='catalog');
 const programTerms=meaningful.filter(t=>candidates.some(c=>c.kind==='catalog'&&norm(c.program).includes(t)));
 if(programTerms.length)eligibleCandidates=eligibleCandidates.filter(c=>c.kind!=='catalog'||programTerms.every(t=>norm(c.program).includes(t)));
 return eligibleCandidates.map(c=>{const hay=norm(c.search);let score=0;for(const t of Array.from(terms))if(t.length>2&&hay.includes(t))score+=norm(c.title).includes(t)?5:1;const hits=meaningful.filter(t=>hay.includes(t));if(meaningful.length&&!hits.length)score=0;return {...c,score};}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,4).map(c=>{let start=0;if(c.kind==='lesson'){const hay=norm(c.text);const at=Array.from(terms).map(t=>hay.indexOf(t)).filter(i=>i>=0);start=Math.max(0,(at.length?Math.min(...at):0)-150);}const excerpt=c.kind==='catalog'?c.text:c.text.slice(start,start+1400);return {id:c.id,kind:c.kind,title:c.title,excerpt,sourceName:c.sourceName,updatedAt:c.updatedAt?new Date(c.updatedAt).toISOString():null,location:c.location,href:`/api/findy/evidence/${c.kind}/${encodeURIComponent(c.id)}?lang=${language}`,revision:revision(c.text)};});
}
export function registerGroundedFindy(app:Express,auth:RequestHandler){
 app.get('/api/findy/usage',auth,async(req,res)=>{try{const language=normalizeLanguage(String(req.query.lang||(req as any).user?.languagePreference||'en'));res.set('Cache-Control','no-store').json({usage:await findyUsage(pg,(req as any).user),labels:{usage:usageLabel(language),newChat:newChatLabel(language)}});}catch{res.status(503).json({code:'FINDY_UNAVAILABLE'});}});
 app.post('/api/chat',auth,async(req,res)=>{
 const b=req.body??{},user=(req as any).user,language=normalizeLanguage(b.language||user?.languagePreference||'en'),labels=findyCopy(language);
 if(typeof b.message!=='string'||!b.message.trim()||b.message.length>2000||typeof b.sessionId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(b.sessionId))return res.status(400).json({code:'INVALID_MESSAGE'});
 let slot:any;let topic:any;let refund=false;
 const reply=(message:string,sources:any[]=[],extra:any={})=>res.set('Cache-Control','no-store').json({success:true,message,data:{message},mode:'verified-source-excerpts',sources,labels:{source:labels[2],updated:labels[3],usage:usageLabel(language),newChat:newChatLabel(language)},usage:slot.usage,...extra});
 try{
  slot=await reserveFindy(pg,user,b.sessionId);
  const preliminary=parseTopic(b.message,slot.topic);
  if(!preliminary.inScope)return reply(findyMessage(language,0));
  if(preliminary.reason==='ambiguous')return reply(findyMessage(language,5));
  // Resolve university names against the same allowlisted live view. A process
  // question can still use Academy while Apply is down; catalogue facts cannot.
  let dimensions:any[]=[];
  if(preliminary.topic.intent==='catalog')dimensions=await catalogDimensions();
  const parsed=parseTopic(b.message,slot.topic,dimensions);topic=parsed.topic;
  if(topic.intent==='catalog'){
   if(!topic.country&&!topic.universityId&&!topic.program)return reply(findyMessage(language,5));
   const all=(await livePrograms(topic)).filter(row=>matchesProgram(row,topic));
   const selected=all.slice(topic.offset||0,(topic.offset||0)+6);const sources=selected.map(row=>catalogEvidence(row,language));
   if(!sources.length)return reply(findyMessage(language,4),[],{filters:topic,total:all.length});
   return reply(formatAnswer(sources,language,labels,all.length),sources,{filters:topic,total:all.length});
  }
  if(!topic.country&&!/partner|academy|hesap|account|kampanya|campaign/i.test(b.message))return reply(findyMessage(language,5),[],{filters:topic});
  const [all,countries]=await Promise.all([storage.getContents(),storage.getCountries()]);
  const eligible=countryLessons(all,countries,topic).filter(item=>topic.country||(!item.countryId&&!item.countryCode));
  const scoped=topic.universityName?eligible.filter(item=>{const hay=normalize(item.title+' '+plain(item.content||item.description));const words=normalize(topic.universityName).replace(/university|college|institute/g,'').trim().split(/\s+/).filter((word:string)=>word.length>2);return words.length>0&&words.every((word:string)=>hay.includes(word));}):eligible;
  const selected=selectProcessLessons(scoped,b.message);const sources=[];
  for(const item of selected){let localized=item;
   if(language!=='en'){const translated=await storage.getContentTranslation(item.id,language);if(translated?.status==='published'&&translated.content)localized={...item,title:translated.title||item.title,content:translated.content};}
   sources.push(lessonEvidence(localized,language,b.message));
  }
  return reply(sources.length?formatAnswer(sources,language,labels):findyMessage(language,7),sources,{filters:topic});
 }catch(error){
  if(error instanceof FindyLimitError)return res.set('Retry-After',String(error.retryAfter)).status(error.status).json({code:error.code,message:findyMessage(language,error.code==='FINDY_DAILY_LIMIT'?1:2),usage:error.usage,labels:{usage:usageLabel(language)}});
  refund=true;return res.status(503).json({code:'SOURCE_LOOKUP_UNAVAILABLE',message:findyMessage(language,3)});
 }finally{if(slot)try{await finishFindy(pg,user.id,b.sessionId,slot,topic,refund);}catch{console.error('Findy usage/context finalization failed');}}
 });
 app.get('/api/findy/evidence/:kind/:id',auth,async(req,res)=>{try{
  const language=normalizeLanguage(String(req.query.lang||'en'));let source:any;
  if(req.params.kind==='apply'&&/^\d{1,12}$/.test(req.params.id)){const row=await liveProgramById(Number(req.params.id));if(row)source=catalogEvidence(row,language);}
  if(req.params.kind==='lesson'){const item=await storage.getContentById(req.params.id);if(item?.status==='published'&&item.type==='lesson'){const t=language!=='en'?await storage.getContentTranslation(item.id,language):null;source=lessonEvidence(t?.status==='published'?{...item,title:t.title||item.title,content:t.content}:item,language,'');}}
  if(!source)return res.sendStatus(404);res.set('Cache-Control','no-store').json({source});
 }catch{res.status(503).json({code:'SOURCE_LOOKUP_UNAVAILABLE'});}});
}
