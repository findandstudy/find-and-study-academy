"""Reconstruct a private, reviewable catalog bundle; never calls APIs or writes DB."""
import argparse,html,json,re
from pathlib import Path
from html.parser import HTMLParser
from build_catalog_jobs import build,digest,VisibleText,normalize_questions
class Structure(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=False);self.events=[];self.feed(text)
 def handle_starttag(self,t,a):self.events.append(('start',t,a))
 def handle_startendtag(self,t,a):self.events.append(('empty',t,a))
 def handle_endtag(self,t):self.events.append(('end',t))
def reconstruct(item,job,translated):
 if len(translated)!=len(job['strings']):raise ValueError('Wrong string count')
 if any(not isinstance(v,str) or ('__FAS_KEEP_' in v) or any(ord(c)<32 and ord(c) not in (9,10,13) for c in v) or (not v.strip() and job['strings'][i].strip()) for i,v in enumerate(translated)):raise ValueError('Invalid translated value')
 if job['kind']=='quiz':
  questions=normalize_questions(item['questions']);index=2;result=[]
  for q in questions:
   entry={'id':q['id'],'text':translated[index]};index+=1
   if q['type']=='mcq':entry['options']=translated[index:index+len(q['options'])];index+=len(q['options'])
   result.append(entry)
  assert index==len(translated)
  return {'title':translated[0],'description':translated[1],'questions':result}
 mapping=dict(zip(job['strings'],translated))
 def replace(value):
  if not isinstance(value,str):return value
  key=html.unescape(value).strip()
  return mapping.get(key,value)
 source=item.get('content') or '';parser=VisibleText(source);parser.feed(source);content=source
 for start,end in reversed(parser.spans):
  raw=source[start:end];match=re.search(r'\S(?:.*\S)?',raw,re.S)
  if not match:continue
  key=html.unescape(match.group()).strip()
  if key not in mapping:continue
  left=start+match.start();right=start+match.end()
  content=content[:left]+html.escape(mapping[key],quote=False)+content[right:]
 if Structure(source).events!=Structure(content).events:raise ValueError('HTML structure changed')
 return {'title':replace(item.get('title')),'description':replace(item.get('description')),'content':content}
def prepare(snapshot,outputs,ids,limit):
 plan=build(snapshot);jobs={j['jobHash']:j for j in plan['jobs']};items={('lesson',i['id']):i for i in snapshot['contents']};items.update({('quiz',i['id']):i for i in snapshot['quizzes']})
 hold_file=outputs/'quality-holds.json'
 holds=set(json.loads(hold_file.read_text()).get('jobHashes',[])) if hold_file.exists() else set()
 rows={};rejected=[]
 for path in sorted(outputs.glob('*.json')):
  out=json.loads(path.read_text());job=jobs.get(out.get('jobHash'))
  if not job or job['jobHash'] in holds or (ids and job['id'] not in ids):continue
  if any(out.get(k)!=job[k] for k in ['kind','id','language','sourceHash']):raise ValueError('Checkpoint identity mismatch')
  if out.get('model')!='gpt-4.1-mini-2025-04-14' or out.get('policy')!='academy-visible-strings-v5':continue
  if any(isinstance(v,str) and any(ord(c)<32 and ord(c) not in (9,10,13) for c in v) for v in out['strings']):
   rejected.append({'kind':job['kind'],'id':job['id'],'language':job['language'],'jobHash':job['jobHash'],'checkpoint':path.name,'reason':'Invalid control character; requires manual review'});continue
  key=(job['kind'],job['id'],job['language']);item=items[key[:2]]
  row={'kind':job['kind'],'id':job['id'],'language':job['language'],'sourceHash':job['sourceHash'],'jobHash':job['jobHash'],'job':job,'strings':out['strings'],'translation':reconstruct(item,job,out['strings'])}
  if key in rows and rows[key]!=row:raise ValueError('Conflicting checkpoints')
  rows[key]=row
 selected=list(rows.values())[:limit]
 return {'version':1,'reviewRequired':True,'rows':selected,'bundleHash':digest(selected),'rejectedDrafts':rejected}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('snapshot',type=Path);p.add_argument('outputs',type=Path);p.add_argument('destination',type=Path);p.add_argument('--id',action='append',default=[]);p.add_argument('--limit',type=int,default=50);a=p.parse_args()
 bundle=prepare(json.loads(a.snapshot.read_text()),a.outputs,set(a.id),a.limit)
 with a.destination.open('x') as f:json.dump(bundle,f,ensure_ascii=False,indent=2)
 a.destination.chmod(0o600);print(json.dumps({'preparedRows':len(bundle['rows']),'bundleHash':bundle['bundleHash'],'databaseWrites':0,'rejectedDrafts':len(bundle['rejectedDrafts'])}))
