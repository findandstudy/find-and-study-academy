import i18n from '@/i18n';
import catalog from './legacy-ui-catalog.json';
import {createElement,Fragment,type ReactNode} from 'react';
const data=catalog as {keys:Record<string,string>;dictionaries:Record<string,Record<string,string>>};
const dictionaries=data.dictionaries,sourceKeys=data.keys;
const lookup=(language:string,source:string)=>dictionaries[language]?.[sourceKeys[source]];
export function legacyLocale(){const l=(i18n.resolvedLanguage||i18n.language||'en').split('-')[0];return dictionaries[l]?l:'en';}
const fill=(text:string,params:Record<string,unknown>)=>text.replace(/\{value\d+\}/g,key=>String(params[key.slice(1,-1)]??key));
export function legacyUi(source:string,params:Record<string,unknown>={}){const translated=lookup(legacyLocale(),source)??lookup('en',source)??source;return fill(translated,params);}
export function legacyRich(source:string,params:Record<string,ReactNode>){const text=lookup(legacyLocale(),source)??lookup('en',source)??source;return text.split(/(\{value\d+\})/g).map((part,index)=>createElement(Fragment,{key:index},/^\{value\d+\}$/.test(part)?params[part.slice(1,-1)]??part:part));}
const statuses:Record<string,string>={active:'Active',inactive:'Inactive',pending:'Pending',draft:'Draft',published:'Published',archived:'Archived',info:'Info',warning:'Warning',success:'Success',error:'Error',low:'Low',medium:'Medium',high:'High',urgent:'Urgent',all:'All',admins:'Admins',agents:'Agents',admin:'Admin',agent:'Agent',staff:'Staff',lesson:'Lesson',video:'Video',document:'Document',image:'Image',quiz:'Quiz',approved:'Approved',rejected:'Rejected',completed:'Completed',failed:'Failed',processing:'Processing',queued:'Queued',paid:'Paid',unpaid:'Unpaid',cancelled:'Cancelled',expired:'Expired',revoked:'Revoked',enabled:'Enabled',disabled:'Disabled',user:'User',assistant:'Assistant',system:'System',public:'Public',private:'Private',student:'Student',boolean:'Boolean',string:'String',number:'Number',json:'JSON',general:'General',payment:'Payment',email:'Email',security:'Security',content:'Content',ai:'AI'};
export function legacyStatus(value:unknown){if(typeof value!=='string')return String(value??'');const source=statuses[value.toLowerCase()]||value;return legacyUi(source);}
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let patterns:Array<{source:string;keys:string[];regex:RegExp}>|undefined;
const trainingMessageAliases:Record<string,string>={"QUIZ_UNAVAILABLE": "This quiz is unavailable.", "COURSE_CONTENT_UNAVAILABLE": "Course content is unavailable.", "COMPLETE_LESSONS_FIRST": "Complete all lessons before taking the final exam.", "PASS_LESSON_QUIZZES_FIRST": "Pass all lesson quizzes before taking the final exam.", "TRAINING_VALIDATION_FAILED": "We could not validate your training progress. Please try again.", "QUIZ_ID_REQUIRED": "Please select a quiz.", "QUIZ_QUESTIONS_INVALID": "This quiz could not be loaded. Please contact support.", "QUIZ_QUESTIONS_EMPTY": "This quiz does not contain any questions.", "ALL_ANSWERS_REQUIRED": "Answer every question before submitting.", "INVALID_ANSWER": "One or more answers are invalid. Please check your answers.", "COURSE_ID_REQUIRED": "Please select a course.", "INVALID_LESSON_IDS": "Your lesson selection is invalid. Please reload the page.", "LESSON_OUTSIDE_COURSE": "This lesson does not belong to the selected course.", "PASS_LESSON_QUIZ_FIRST": "Pass the lesson quiz before marking this lesson complete.", "FINAL_EXAM_REQUIRED": "A final exam is required to issue a certificate.", "Training validation failed": "We could not validate your training progress. Please try again."};
export function legacyMessage(value:unknown,depth=0):string{
 if(typeof value!=='string')return String(value??'');if(trainingMessageAliases[value])return legacyMessage(trainingMessageAliases[value],depth);if(lookup(legacyLocale(),value))return legacyUi(value);
 const prefix=value.match(/^([45]\d\d):\s*([\s\S]*)$/);const body=prefix?prefix[2]:value;
 if(depth<2&&body.startsWith('{')){try{const parsed=JSON.parse(body),message=parsed.message||parsed.error;if(typeof message==='string')return (prefix?prefix[1]+': ':'')+legacyMessage(message,depth+1);}catch{}}
 if(body!==value)return prefix![1]+': '+legacyMessage(body,depth+1);
 if(!patterns)patterns=Object.keys(sourceKeys).filter(s=>/\{value\d+\}/.test(s)).sort((a,b)=>b.replace(/\{value\d+\}/g,'').length-a.replace(/\{value\d+\}/g,'').length).map(source=>{const keys=source.match(/\{value\d+\}/g)||[],pieces=source.split(/\{value\d+\}/g);return {source,keys,regex:new RegExp('^'+pieces.map(escape).join('([\\s\\S]*?)')+'$')};});
 for(const p of patterns){const m=body.match(p.regex);if(m)return legacyUi(p.source,Object.fromEntries(p.keys.map((key,i)=>[key.slice(1,-1),m[i+1]])));}
 return body;
}
export function legacyDate(value:any,pattern:string){const date=new Date(value);if(!Number.isFinite(date.getTime()))return String(value??'');const options:Intl.DateTimeFormatOptions={day:'numeric',month:'short'};if(/Y/.test(pattern))options.year='numeric';if(/H|h/.test(pattern)){options.hour='2-digit';options.minute='2-digit';}if(!Intl.DateTimeFormat.supportedLocalesOf([legacyLocale()]).length){options.month='2-digit';options.hour12=false;return new Intl.DateTimeFormat('en-CA',options).format(date);}return new Intl.DateTimeFormat(legacyLocale(),options).format(date);}

export function legacyCountry(code:string,fallback:string){try{return new Intl.DisplayNames([legacyLocale()],{type:'region'}).of(code)||fallback;}catch{return fallback;}}

// The legacy launcher is outside React's root; localize its static chrome only.
const widgetText:Record<string,string>={'[data-testid="text-chat-title"]':'Findy Assistant','.findy-status':'Online','.findy-welcome-text h4':'Hello!','.findy-welcome-text p':"I'm Findy, your Find And Study assistant. How can I help you today?",'.findy-footer-text':'Powered by AI'};
const widgetAttrs=[['#findy-minimize','aria-label','Minimize Findy'],['#findy-minimize','title','Minimize'],['#findy-button','aria-label','Chat with Findy'],['#findy-close','aria-label','Close chat'],['#findy-input','placeholder','Type your message...'],['#findy-input','aria-label','Type your message'],['#findy-send','aria-label','Send message']];
function refreshWidget(){
 for(const[selector,text]of Object.entries(widgetText)){const node=document.querySelector(selector);if(!node)continue;if(selector==='.findy-status'){const texts=Array.from(node.childNodes).filter(n=>n.nodeType===3);if(texts.length)texts[texts.length-1].textContent=' '+legacyUi(text);else node.append(document.createTextNode(' '+legacyUi(text)));}else node.textContent=legacyUi(text);}
 for(const[selector,attribute,text]of widgetAttrs)document.querySelector(selector)?.setAttribute(attribute,legacyUi(text));
 const meta=document.querySelector('meta[name="description"]');meta?.setAttribute('content',legacyUi('Educational platform for Find And Study agents with courses, quizzes, certificates, and comprehensive training materials.'));
}
if(typeof window!=='undefined'){
 (window as any).__academyLegacyUi={text:legacyUi,message:legacyMessage,locale:legacyLocale};
 window.addEventListener('academy-widget-reset',refreshWidget);i18n.on('languageChanged',refreshWidget);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshWidget,{once:true});else refreshWidget();
}
