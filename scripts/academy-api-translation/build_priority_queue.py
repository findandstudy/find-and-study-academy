"""Combine private jobs with Türkiye legacy layout repairs first; no paid calls."""
import json,sys
from pathlib import Path
normal,repairs,ids_file,output=sys.argv[1:]
a=json.loads(Path(normal).read_text());b=json.loads(Path(repairs).read_text());ids=set(json.loads(Path(ids_file).read_text()));priority=[j for j in b['jobs'] if j['id'] in ids];rest=[j for j in b['jobs'] if j['id'] not in ids];seen=set();jobs=[]
for job in priority+a['jobs']+rest:
 if job['jobHash'] in seen:continue
 seen.add(job['jobHash']);jobs.append(job)
plan={'version':1,'sourceLanguage':'en','jobs':jobs,'manualReview':a.get('manualReview',[])+b.get('manualReview',[])}
with Path(output).open('x') as f:json.dump(plan,f,ensure_ascii=False)
Path(output).chmod(0o600);print(json.dumps({'priorityRepairJobs':len(priority),'totalJobs':len(jobs),'paidRequests':0,'databaseWrites':0}))
