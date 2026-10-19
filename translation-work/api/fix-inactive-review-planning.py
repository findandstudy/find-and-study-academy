"""Guarded change to audit classification only; no content or DB writes."""
import hashlib,json,sys
from pathlib import Path
p=Path('/var/lib/academy-translations/build_catalog_jobs.py');text=p.read_text();changes=[("present={kind:{} for kind in ['lesson','quiz']};review=[];jobs=[]","present={kind:{} for kind in ['lesson','quiz']};review=[];jobs=[];preserved=[]\n active={'lesson':{x['id'] for x in snapshot['contents']},'quiz':{x['id'] for x in snapshot['quizzes']}}"),("if row['language'] in LANGUAGES and row['status']!='published':review.append({'kind':kind,'id':row['id'],'language':row['language'],'reason':'Existing non-published translation preserved; review separately'})","if row['language'] in LANGUAGES and row['status']!='published':\n    record={'kind':kind,'id':row['id'],'language':row['language'],'reason':'Existing non-published translation preserved; review separately'}\n    if row['id'] in active[kind]:review.append(record)\n    else:preserved.append({**record,'reason':'Source outside active catalog; existing translation preserved without publishing'})"),("'manualReview':review}","'manualReview':review,'preservedInactiveSourceTranslations':preserved}")]
updated=text
for old,new in changes:
 if updated.count(old)!=1:raise ValueError('Unexpected audit planner source')
 updated=updated.replace(old,new)
plan=p.with_name('inactive-review-planner-plan.json');sha=hashlib.sha256(text.encode()).hexdigest()
if '--apply' not in sys.argv:
 with plan.open('x') as f:json.dump({'beforeSHA256':sha,'afterSHA256':hashlib.sha256(updated.encode()).hexdigest()},f)
 plan.chmod(0o600);print(json.dumps({'mode':'dry-run','classificationOnly':True,'beforeSHA256':sha}))
else:
 saved=json.loads(plan.read_text())
 if saved['beforeSHA256']!=sha or saved['afterSHA256']!=hashlib.sha256(updated.encode()).hexdigest():raise ValueError('Planner source changed')
 with p.with_name('build_catalog_jobs.before-inactive-review.py').open('x') as f:f.write(text)
 temp=p.with_suffix('.py.tmp');temp.write_text(updated);temp.chmod(0o600);temp.replace(p)
 print(json.dumps({'mode':'apply','classificationOnly':True,'contentWrites':0}))
