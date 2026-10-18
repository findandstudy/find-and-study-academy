import {createHash} from 'node:crypto';
import {decode} from 'html-entities';
import {parseQuizQuestions,mergeQuestionTranslations} from '@shared/quiz-localization';
export type Kind='content'|'quiz';
export const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function sourceValue(kind:Kind,row:any){return kind==='quiz'?{title:row.title,description:row.description??null,questions:parseQuizQuestions(row.questions)}:{title:row.title,description:row.description??null,content:row.content??null};}
export function sourceHash(kind:Kind,row:any){return hash(sourceValue(kind,row));}
const escapeText=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// Quote-aware lexer: all tags, attributes, URLs, comments and raw script/style blocks stay byte-for-byte intact.
export function htmlParts(html:string){
 const parts:{raw:string;text?:string;before?:string;after?:string}[]=[];let pos=0,rawTag='';
 while(pos<html.length){
  if(html.startsWith('<!--',pos)){const end=html.indexOf('-->',pos+4);if(end<0)throw Error('INVALID_HTML');parts.push({raw:html.slice(pos,end+3)});pos=end+3;continue;}
  
  if(html[pos]==='<'&&/^<\/?[A-Za-z!]/.test(html.slice(pos))){let end=pos+1,quote='';for(;end<html.length;end++){const c=html[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}if(end>=html.length)throw Error('INVALID_HTML');const tag=html.slice(pos,end+1);parts.push({raw:tag});const name=/^<\/?([A-Za-z0-9]+)/.exec(tag)?.[1]?.toLowerCase();if(/^<\//.test(tag)&&name===rawTag)rawTag='';else if(!rawTag&&['script','style','code','pre'].includes(name||'')&&!/\/>$/.test(tag))rawTag=name!;pos=end+1;continue;}
  let end=pos+1;while(end<html.length&&!(html[end]==='<'&&/^<\/?[A-Za-z!]/.test(html.slice(end)))&&!html.startsWith('<!--',end))end++;const raw=html.slice(pos,end),match=/^(\s*)([\s\S]*?)(\s*)$/.exec(raw)!;const text=decode(match[2]);parts.push(rawTag||!new RegExp('\\p{L}','u').test(text)?{raw}:{raw,text,before:match[1],after:match[3]});pos=end;
 }
 return parts;
}
export function manifest(kind:Kind,value:any){
 const fields:{path:string;text:string}[]=[];const add=(path:string,s:any)=>{if(typeof s==='string'&&s.trim())fields.push({path,text:s});};add('title',value.title);add('description',value.description);
 let parts:ReturnType<typeof htmlParts>=[];
 if(kind==='content'){parts=htmlParts(value.content||'');parts.forEach((p,i)=>{if(p.text!==undefined)add('html.'+i,p.text)});}
 else (Array.isArray(value.questions)&&value.questions.every((q:any)=>q.type===undefined)?value.questions:parseQuizQuestions(value.questions)).forEach((q:any,i:number)=>{add('q.'+i+'.text',q.text);if(Array.isArray(q.options))q.options.forEach((s:string,j:number)=>add('q.'+i+'.o.'+j,s));add('q.'+i+'.explanation',q.explanation);});
 return {fields,parts};
}
export function reconstruct(kind:Kind,value:any,strings:string[]){const m=manifest(kind,value);if(strings.length!==m.fields.length)throw Error('FRAGMENT_COUNT_MISMATCH');const out=structuredClone(value);const byPath=new Map(m.fields.map((f,i)=>[f.path,strings[i]]));out.title=byPath.get('title')??value.title;out.description=byPath.get('description')??value.description;
 if(kind==='content')out.content=value.content===null?null:m.parts.map((p,i)=>p.text===undefined?p.raw:(p.before||'')+escapeText(byPath.get('html.'+i)!)+(p.after||'')).join('');
 else out.questions=parseQuizQuestions(value.questions).map((q,i)=>({id:q.id,text:byPath.get('q.'+i+'.text')!,...(q.type==='mcq'?{options:q.options.map((_,j)=>byPath.get('q.'+i+'.o.'+j)!)}:{}),...(q.explanation?{explanation:byPath.get('q.'+i+'.explanation')!}:{})}));return out;}
const protectedValues=(s:string)=>(s.match(/https?:\/\/[^\s<>"']+|\{\{[^{}]+\}\}|\{[A-Za-z_][\w.]*\}|\d+(?:[.,]\d+)*/g)||[]).sort();
export function validateResult(kind:Kind,source:any,result:any){if(!result||typeof result!=='object'||Object.keys(result).sort().join(',')!==(kind==='quiz'?'description,questions,title':'content,description,title'))throw Error('INVALID_DRAFT_SHAPE');if(typeof result.title!=='string'||!result.title.trim())throw Error('MISSING_TITLE');const a=manifest(kind,source),b=manifest(kind,result);if(a.fields.length!==b.fields.length)throw Error('FRAGMENT_COUNT_MISMATCH');a.fields.forEach((f,i)=>{const t=b.fields[i];if(t.path!==f.path||typeof t.text!=='string'||!t.text.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t.text)||JSON.stringify(protectedValues(f.text))!==JSON.stringify(protectedValues(t.text)))throw Error('PROTECTED_VALUES_CHANGED');});if(kind==='content'){const tags=(x:any[])=>x.filter(p=>p.text===undefined).map(p=>p.raw);if(JSON.stringify(tags(a.parts))!==JSON.stringify(tags(b.parts)))throw Error('HTML_STRUCTURE_CHANGED');}else mergeQuestionTranslations(parseQuizQuestions(source.questions),result.questions);return result;}
export function reuseFragments(kind:Kind,previous:any,translation:any,current:any){
 const now=manifest(kind,current).fields,out:(string|null)[]=now.map(()=>null);if(!previous||!translation)return out;
 try{const a=manifest(kind,previous),b=manifest(kind,translation);if(a.fields.length!==b.fields.length)return out;
 if(kind==='content'&&JSON.stringify(a.parts.filter(p=>p.text===undefined))!==JSON.stringify(b.parts.filter(p=>p.text===undefined)))return out;
 const map=new Map<string,string|null>();a.fields.forEach((f,i)=>{const v=b.fields[i];if(f.path!==v.path)return;const key=f.path.split('.')[0]+':'+f.text;if(map.has(key)&&map.get(key)!==v.text)map.set(key,null);else map.set(key,v.text);});now.forEach((f,i)=>{out[i]=map.get(f.path.split('.')[0]+':'+f.text)||null;});
 }catch{}return out;
}
