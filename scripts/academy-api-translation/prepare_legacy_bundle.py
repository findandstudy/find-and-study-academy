"""Reconstruct reviewed repair checkpoints. No API calls or database writes."""
import argparse,json
from pathlib import Path
from build_catalog_jobs import digest
from prepare_catalog_bundle import reconstruct

def prepare(snapshot,plan,manifest,outputs,limit=50):
 sources={item['id']:item for item in snapshot['contents']};jobs={j['jobHash']:j for j in plan['jobs']};guards={r['jobHash']:r for r in manifest['rows']};rows={};rejected=[]
 for file in sorted(outputs.glob('*.json')):
  out=json.loads(file.read_text());job=jobs.get(out.get('jobHash'))
  if not job:continue
  if out.get('model')!='gpt-4.1-mini-2025-04-14' or out.get('policy')!='academy-visible-strings-v5':continue
  if digest({k:v for k,v in job.items() if k!='jobHash'})!=job['jobHash']:raise ValueError('Plan hash mismatch')
  if job['kind']!='lesson' or any(out.get(k)!=job[k] for k in ['id','kind','language','sourceHash']):raise ValueError('Output identity mismatch')
  source=sources[job['id']];fields={k:source.get(k) for k in ['title','description','content']}
  if digest(fields)!=job['sourceHash']:raise ValueError('Snapshot source changed')
  guard=guards[job['jobHash']]
  if any(guard[k]!=job[k] for k in ['id','language','sourceHash']):raise ValueError('Repair manifest mismatch')
  if set(guard['existingHashes'])!={'title','description','content'} or any(len(v)!=64 for v in guard['existingHashes'].values()):raise ValueError('Invalid existing-row guards')
  if any(isinstance(v,str) and any(ord(c)<32 and ord(c) not in (9,10,13) for c in v) for v in out.get('strings',[])):
   rejected.append({'kind':job['kind'],'id':job['id'],'language':job['language'],'jobHash':job['jobHash'],'checkpoint':file.name,'reason':'Invalid control character; original checkpoint retained'});continue
  row={'kind':'lesson','id':job['id'],'language':job['language'],'sourceHash':job['sourceHash'],'jobHash':job['jobHash'],'job':job,'strings':out['strings'],'existingHashes':guard['existingHashes'],'translation':reconstruct(source,job,out['strings'])}
  key=(job['id'],job['language'])
  if key in rows and rows[key]!=row:raise ValueError('Conflicting checkpoints')
  rows[key]=row
 selected=list(rows.values())[:limit]
 return {'version':1,'mode':'repair-existing-only','reviewRequired':True,'rows':selected,'rejectedDrafts':rejected,'bundleHash':digest(selected)}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('snapshot',type=Path);p.add_argument('plan',type=Path);p.add_argument('manifest',type=Path);p.add_argument('outputs',type=Path);p.add_argument('destination',type=Path);p.add_argument('--limit',type=int,default=50);a=p.parse_args()
 b=prepare(*[json.loads(x.read_text()) for x in [a.snapshot,a.plan,a.manifest]],a.outputs,a.limit)
 with a.destination.open('x') as f:json.dump(b,f,ensure_ascii=False,indent=2)
 a.destination.chmod(0o600);print(json.dumps({'repairRows':len(b['rows']),'bundleHash':b['bundleHash'],'databaseWrites':0,'rejectedDrafts':len(b['rejectedDrafts'])}))
