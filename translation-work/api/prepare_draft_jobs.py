"""Plan existing draft repairs only, with raw row guards and preserved backups."""
import json,sys,hashlib
from pathlib import Path
from build_catalog_jobs import digest,lesson_strings
snapshot=json.loads(Path(sys.argv[1]).read_text());raw=json.loads(Path(sys.argv[2]).read_text());sources={s['id']:s for s in snapshot['contents']};jobs=[];manifest=[]
for old in raw:
 if old['status']!='draft':raise ValueError('Draft-only repair required')
 source=sources.get(old['content_id'])
 if source is None:continue
 if old['content']==source.get('content'):raise ValueError('Preserve identical draft for separate review')
 fields={k:source.get(k) for k in ['title','description','content']}
 job={'version':1,'kind':'lesson','id':source['id'],'title':source['title'],'language':old['language'],'sourceHash':digest(fields),'strings':lesson_strings(source)};job['jobHash']=digest(job);jobs.append(job)
 manifest.append({'jobHash':job['jobHash'],'id':job['id'],'language':job['language'],'sourceHash':job['sourceHash'],'existingHashes':{k:hashlib.sha256((old.get(k) or '').encode()).hexdigest() for k in fields}})
for path,data in [(sys.argv[3],{'version':1,'jobs':jobs,'manualReview':[]}),(sys.argv[3]+'.repair-manifest.json',{'version':1,'rows':manifest})]:
 with Path(path).open('x') as f:json.dump(data,f,ensure_ascii=False)
 Path(path).chmod(0o600)
print(json.dumps({'draftRepairJobs':len(jobs),'databaseWrites':0,'paidRequests':0}))
