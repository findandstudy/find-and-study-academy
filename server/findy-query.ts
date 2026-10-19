// Only interpret user filters. No generated facts, external search, or user-controlled URLs.
export const normalize=(s:unknown)=>String(s??'').normalize('NFKD').replace(new RegExp("\\p{M}","gu"),'').replace(/ı/g,'i').toLowerCase().replace(/[’']/g,' ');
export type Topic={country?:string;countryCode?:string;program?:string;language?:string;universityId?:number;universityName?:string;degree?:string;intent?:'catalog'|'process';offset?:number;programText?:string;unknownEntity?:boolean;terms?:string[]};
export const concepts:Record<string,string[]>={
 computerEngineering:['computer engineering','bilgisayar muhendis','biligsayr','muhendligi','计算机工程','هندسة الحاسوب','مهندسی کامپیوتر','компьютерная инженер','комп ютерна інженер','ingenieria informatica','genie informatique','informatik muhendis','компьютердик инженер','компьютерлік инженер','kompyuter muhandis','муҳандисии компютер','কম্পিউটার ইঞ্জিনিয়ার','कंप्यूटर इंजीनियर','कम्प्युटर इन्जिनियर','teknik komputer','engenharia de computacao','ky thuat may tinh','컴퓨터공학','ingegneria informatica'],
 computerScience:['computer science','bilgisayar bilim','informatyka','informatique','informatik','علوم الحاسوب','علوم کامپیوتر','информатика','ciencias de la computacion','ilmu komputer','компьютер илим','компьютер ғылым','kompyuter fan','илми компютер','কম্পিউটার বিজ্ঞান','कंप्यूटर विज्ञान','कम्प्युटर विज्ञान','ciencia da computacao','khoa hoc may tinh','컴퓨터과학','informatica'],
 medicine:['medicine','tip','tıp','طب','педиатрия медицина','медицина','医学','medecine','medicina','kedokteran','चिकित्सा','চিকিৎসা','y khoa','의학','lukmançylyk','tibbiyot'],
 dentistry:['dentistry','dis hekim','dental','dentisterie','odontologia','طب الاسنان','стоматология','दंत','দন্ত','치의학','nha khoa','diş lukman','stomatologiya'],
 business:['business administration','isletme','business management','gestion des entreprises','ادارة الاعمال','مدیریت بازرگانی','бизнес','ব্যবসা','व्यवसाय','경영','quan tri kinh doanh','gestione aziendale'],
 law:['law','hukuk','droit','derecho','قانون','право','আইন','कानून','법학','luat'],
 psychology:['psychology','psikoloji','psychologie','psicologia','علم النفس','روانشناسی','психология','মনোবিজ্ঞান','मनोविज्ञान','심리학','tam ly'],
};
export const programTerms:Record<string,string[]>={computerEngineering:['computer engineering','bilgisayar mühendis'],computerScience:['computer science','informatics','bilgisayar bilim','informatyka'],medicine:['medicine','tıp','tip'],dentistry:['dentistry','dental','diş hekim'],business:['business administration','business management','işletme'],law:['law','hukuk'],psychology:['psychology','psikoloji']};
const languageWords:Record<string,string[]>={English:['english','ingiliz','ingliz','انجليزي','الإنجليزية','بالإنجليزية','انگلیسی','англий','англій','anglais','ingles','inggris','अंग्रेज','ইংরেজ','अंग्रेजी','англис','ағылшын','ingliz','англисӣ','tieng anh','영어','انگریزی','iňlis','italiano inglese','英语'],Turkish:['turkish','turkce','türkçe','تركي','ترکی','турец','turc','turco','bahasa turki','तुर्की','তুর্কি','tieng tho','터키어','土耳其语'],German:['german','almanca','deutsch','allemand','aleman','alemao','немец','ألماني','آلمانی','德语','독일어'],French:['french','fransizca','francais','frances','француз','فرنسي','法语','프랑스어']};
const countryExtras:Record<string,string[]>={PL:['polonya','poland','polska','pologne','polonia','полша','polsha','polen'],TR:['turkiye','turkey','türkiye','turkiya','турция','туркия'],US:['usa','united states','amerika'],GB:['uk','united kingdom','ingiltere','britain'],AE:['uae','bae','dubai']};
const codes=['TR','PL','US','GB','DE','FR','IT','ES','PT','CA','AU','NZ','IE','NL','BE','CH','AT','CZ','HU','SK','LT','LV','EE','FI','SE','NO','DK','RO','BG','GR','CY','MT','AE','QA','SA','CN','JP','KR','MY','SG','IN','PK','KZ','KG','UZ','TJ','TM','AZ','GE','RU','UA','BY','EG','ZA','MA','TN','ID','VN','TH','BD','NP','BR','MX','AR'];
const locales=['en','tr','ar','fr','ru','fa','zh','hi','es','id','ur','tk','ky','kk','uz','tg','bn','pt','ne','vi','ko','uk','it'];
const countries=codes.map(code=>{const names=new Set(countryExtras[code]||[]);for(const lang of locales){try{const name=new Intl.DisplayNames([lang],{type:'region'}).of(code);if(name&&name!==code)names.add(name);}catch{}}return{code,name:code==='TR'?'Turkey':new Intl.DisplayNames(['en'],{type:'region'}).of(code)!,aliases:Array.from(names).map(normalize).sort((a,b)=>b.length-a.length)};});
function contains(text:string,word:string){const n=normalize(word);if(!n)return false;if(new RegExp('\\p{Script=Han}','u').test(n))return text.includes(n);const i=text.indexOf(n);if(i<0)return false;return i===0||!new RegExp("\\p{L}","u").test(text[i-1]);}
function containsCountry(text:string,word:string){const n=normalize(word);if(new RegExp('\\p{Script=Han}','u').test(n))return text.includes(n);const i=text.indexOf(n);if(i<0||!contains(text,n))return false;const tail=text.slice(i+n.length);return !tail||!new RegExp('\\p{L}','u').test(tail[0])||/^(da|de|dan|den|ya|ye|nin|nun|nda|nde|daki|deki)(?:[^a-z]|$)/.test(tail);}
const processWords=['registration','enrol','application process','apply process','admission process','documents required','how to apply','kayit','basvuru','belge','surec','kayıt','başvuru','سجل','تسجيل','اجراءات','قبول','مدارک','ثبت نام','поступ','регистрац','документ','inscription','candidature','procedura','iscrizione','matricula','inscripcion','pendaftaran','подача','каттоо','тіркел','ro yxat','hujjat','ثبت','ভর্তি','নিবন্ধন','दाखिला','पंजीकरण','भर्ना','dang ky','ho so','등록','입학','resminama'];
const blocked=['ignore previous','ignore all','system prompt','reveal prompt','jailbreak','talimatlari yok say','sistem talimat','google','browse the web','search the internet','hava durumu','weather','bitcoin','crypto','kripto','recipe','yemek tarifi','write code','python code','javascript code','şiir yaz','siir yaz','tell a joke','futbol','football','horoscope','burc','election','seçim tahmin','secim tahmin'];
const follow=['orada','oradaki','peki','bunlar','bunlarin','onlar','onlarin','diger','daha fazla','there','these','those','what about','more','next','continue','else','devam','а там','там','ещё','там же','هناك','المزيد','وما','et la','la bas','y alli','entonces','e la','e em','那','那里','और','वहाँ','সেখানে','وہاں','di sana','disana','그곳','거기','o do'];
export function parseTopic(message:string,previous:Topic={},universities:Array<{id:number;name:string;country:string}>=[]){
 const text=normalize(message);if(blocked.some(w=>contains(text,w)))return{topic:{...previous},inScope:false,reason:'off_topic'};
 let topic:Topic={...previous,offset:0};delete topic.unknownEntity;let explicit=false;
 const matchedCountries=countries.filter(c=>c.aliases.some(a=>containsCountry(text,a)));
 if(matchedCountries.length>1)return{topic:{...previous},inScope:true,reason:'ambiguous'};
 for(const country of countries)if(country.aliases.some(a=>containsCountry(text,a))){topic.country=country.name;topic.countryCode=country.code;delete topic.universityId;delete topic.universityName;explicit=true;break;}
 const university=universities.filter(u=>contains(text,u.name)||(u.name.replace(/\b(university|college|institute)\b/gi,'').trim().length>3&&contains(text,u.name.replace(/\b(university|college|institute)\b/gi,'').trim()))).sort((a,b)=>b.name.length-a.name.length)[0];
 if(university){topic.universityId=university.id;topic.universityName=university.name;if(!matchedCountries.length){topic.country=university.country;topic.countryCode=countries.find(c=>normalize(c.name)===normalize(university.country))?.code;}explicit=true;}
 for(const [key,words]of Object.entries(concepts))if(words.some(w=>contains(text,w))){topic.program=key;delete topic.programText;delete topic.terms;explicit=true;break;}
 const unknownUniversity=new RegExp("([\\p{L}\\p{N}-]+)\\s+(?:university|universitesi|universite)\\b","iu").exec(text);
 if(!university&&unknownUniversity&&!['which','what','the','a','any','available','hangi','olan','butun','tum'].includes(unknownUniversity[1]))topic.unknownEntity=true;
 // Unsupported specifically named programmes must not fall back to all programmes.
 const namedProgram=new RegExp("([\\p{L}-]+(?:\\s+[\\p{L}-]+)?)\\s+(engineering|muhendisligi|muhendislik)\\b","iu").exec(text);
 if(namedProgram&&!Object.values(concepts).some(words=>words.some(w=>contains(text,w)))){topic.programText=namedProgram[0];delete topic.program;explicit=true;}
 const detectedLanguages=Object.entries(languageWords).filter(([key,words])=>words.some(w=>contains(text,w)));
 if(detectedLanguages.length>1)return{topic:{...previous},inScope:true,reason:'ambiguous'};
 for(const [key,words]of Object.entries(languageWords))if(words.some(w=>contains(text,w))){topic.language=key;explicit=true;break;}
 for(const [key,words]of Object.entries({Bachelor:['bachelor','lisans','undergraduate','licence','licenciatura','бакалавр','学士'],Master:['master','yuksek lisans','yüksek lisans','магистр','硕士'],PhD:['phd','doctorate','doktora','докторант','博士']}))if(words.some(w=>contains(text,w))){topic.degree=key;explicit=true;break;}
 // Longer degrees must win over the "lisans" substring in "yüksek lisans".
 if(/yuksek lisans/.test(text))topic.degree='Master';
 const process=processWords.some(w=>contains(text,w));const continuation=Object.keys(previous).length>0&&follow.some(w=>contains(text,w));
 const domain=/university|universit|program|tuition|fee|price|ucret|fiyat|egitim|egitimi|ders|course|academy|partner|find and study|destinasyon|vize|visa|scholarship|burs|стоимость|универс|学费|大学|رسوم|جامعة|कार्यक्रम|विश्वविद्यालय|বিশ্ববিদ্যাল|프로그램|대학교/.test(text);
 const inScope=explicit||process||domain||continuation;
 topic.intent=process?'process':explicit||/fee|price|ucret|fiyat|program|tuition|ne kadar|how much|seçenek|secenek|options/.test(text)?'catalog':previous.intent||'process';
 if(topic.intent==='catalog'&&(explicit||domain)&&!continuation){
  const selectedCountry=countries.find(c=>c.code===topic.countryCode);
  const covered=[...(selectedCountry?.aliases||[]),topic.country||'',topic.universityName||'',...(topic.program?concepts[topic.program]||[]:[]),...(topic.language?languageWords[topic.language]||[]:[]),topic.degree||''];
  const known=covered.flatMap(x=>normalize(x).split(new RegExp("[^\\p{L}\\p{N}]+","u"))).filter(w=>w.length>2);
  const stop=new Set('what which how much does cost costs price prices fee fees tuition study studying programme program programs programmes university universities college available list show find options option please tell want need information annual year english teaching language country bachelor master phd ne kadar nekdar nedir hangi kac fiyat fiyatlar fiyatlari ucret ucreti ucretleri yillik egitim egitimi program programi programlar programlari universite universitesi universiteler universiteleri bolum bolumu secenek secenekler bana lutfen goster var olan nedir icin nasil how many there all and the are for from with ile olarak istiyorum dilinde lisans yuksek kayıt kayit basvuru surec computer combien cout frais universite universites programme programmes anglais quels quelle quelles des les pour dans une que cual cuanto cuesta universidad universidades programa programas ingles del los las para quanto costa universita corso programmi quali quale por dos das uma olan'.split(' ').map(normalize));
  for(const word of 'сколько стоит стоимость цены какие есть обучение сколько стоят цена сколько будет какие программы плата сколько коштує вартість які є навчання цена скільки رسوم دراسة تكلفة تكاليف كم متاح برامج جامعات باللغة شهریه هزینه چقدر کدام موجود دانشگاه برنامه कितना कितनी शुल्क फीस लागत में कौन उपलब्ध पढाई कितने कति शुल्क कस्तो पढाइ कुन উপলব্ধ কত খরচ ফি কোন প্রোগ্রাম আছে دانشگاه कितने कितनी কতটি विश्वविद्यालय сколько berapa biaya kuliah program tersedia dalam apa berapakah berapa narxi qancha qaysi mavjud o qish puli баасы канча кайсы окуу акысы канча окууга құны қанша қандай бар оқу ақысы чанд нарх кадом таҳсил ҳаққи nähili näçe bahasy okuw töleg haysy mavjud cuanto cuestan hay disponibles lengua idiomas custam quanto quais existem ensino mensalidade học phí bao nhiêu có những chương trình nào bằng tiếng 얼마나 학비 수업료 어떤 있나요 얼마인가요 얼마 किती сколько'.split(' ').map(normalize))stop.add(word);
  topic.terms=text.split(new RegExp("[^\\p{L}\\p{N}]+","u")).filter(t=>t.length>2&&!stop.has(t)&&!known.some(w=>t.startsWith(w)||w.startsWith(t))).slice(0,8);
 }
 if(/daha fazla|more|next|continue|devam|ещё|المزيد/.test(text)&&continuation)topic.offset=(previous.offset||0)+6;
 return{topic,inScope,reason:inScope?'supported':'off_topic'};
}
export function matchesProgram(row:any,topic:Topic){
 if(topic.country&&normalize(row.country)!==normalize(topic.country))return false;
 if(topic.language&&normalize(row.language)!==normalize(topic.language))return false;
 if(topic.universityId&&Number(row.university_id)!==topic.universityId)return false;
 if(topic.degree&&normalize(row.degree)!==normalize(topic.degree))return false;
 if(topic.unknownEntity)return false;
 if(topic.terms?.some(term=>!normalize(row.program_name+' '+row.university_name).includes(normalize(term))))return false;
 if(topic.programText&&!normalize(row.program_name).includes(normalize(topic.programText)))return false;
 if(topic.program&&!programTerms[topic.program]?.some(term=>normalize(row.program_name).includes(normalize(term))))return false;
 return true;
}
export function processIntent(message:string){return processWords.some(w=>contains(normalize(message),w));}
export const processSearchWords=processWords;
