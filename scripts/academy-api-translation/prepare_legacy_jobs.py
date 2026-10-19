"""Plan repairs of flattened legacy lesson HTML. Read-only; no paid requests or DB writes."""
import json,sys,urllib.request,hashlib
from pathlib import Path
from build_catalog_jobs import digest,lesson_strings
LANGS='tr ar fr ru fa zh es id'.split()
def main(snapshot_path,destination,raw_guards_path):
 raw=json.loads(Path(raw_guards_path).read_text());guards={(r["id"],r["language"]):r for r in raw["rows"]}
 snapshot=json.loads(Path(snapshot_path).read_text());sources={i['id']:i for i in snapshot['contents']};present={(r['id'],r['language']):r['status'] for r in snapshot['lessonTranslations']};jobs=[];manifest=[]
 def h(value):return hashlib.sha256((value or '').encode()).hexdigest()
 for language in LANGS:
  data=json.load(urllib.request.urlopen('https://academy.findandstudy.com/api/public/contents?lang='+language,timeout=60))
  for old in data['contents']:
   source=sources.get(old['id'])
   if not source or present.get((old['id'],language))!='published':continue
   guard=guards.get((old['id'],language))
   raw_empty=bool(guard and guard['existingHashes']['content']==h(''))
   if '<style' not in (source.get('content') or ''):continue
   if not raw_empty and ('<style' in (old.get('content') or '') or old.get('content')==source.get('content')):continue
   if not guard or guard['status']!='published':raise ValueError('Missing raw published translation guard')
   if any(h(old.get(k))!=guard['projectedHashes'][k] for k in ['title','description','content']):raise ValueError('Public/raw projection changed; refresh export')
   fields={k:source.get(k) for k in ['title','description','content']}
   job={'version':1,'kind':'lesson','id':source['id'],'title':source['title'],'language':language,'sourceHash':digest(fields),'strings':lesson_strings(source)};job['jobHash']=digest(job);jobs.append(job)
   manifest.append({'jobHash':job['jobHash'],'id':source['id'],'language':language,'sourceHash':job['sourceHash'],'existingHashes':guard['existingHashes']})
 out=Path(destination)
 with out.open('x') as f:json.dump({'version':1,'sourceLanguage':'en','jobs':jobs,'manualReview':[]},f,ensure_ascii=False)
 out.chmod(0o600)
 with Path(str(out)+'.repair-manifest.json').open('x') as f:json.dump({'version':1,'repairRequiresBackup':True,'rows':manifest},f,ensure_ascii=False)
 Path(str(out)+'.repair-manifest.json').chmod(0o600)
 print(json.dumps({'repairJobs':len(jobs),'paidRequests':0,'databaseWrites':0}))
if __name__=='__main__':main(*sys.argv[1:])
