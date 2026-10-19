#!/usr/bin/python3
import json,shutil,pathlib,datetime,urllib.request,subprocess
root=pathlib.Path('/var/lib/academy-maintenance');root.mkdir(mode=0o700,exist_ok=True)
u=shutil.disk_usage('/');pct=round(u.used/u.total*100,1);errors=[];healthy=False
try:
 with urllib.request.urlopen('https://academy.findandstudy.com/api/health',timeout=15) as r:healthy=json.load(r).get('status')=='ok'
except Exception: pass
if not healthy:errors.append('SITE_UNHEALTHY')
if pct>=85:errors.append('DISK_CRITICAL' if pct>=90 else 'DISK_WARNING')
now=datetime.datetime.now(datetime.timezone.utc)
try:
 b=json.loads((root/'last-backup.json').read_text());age=(now-datetime.datetime.fromisoformat(b['backupAt'])).total_seconds()/86400
 if age>8 or not b['restoreTestPassed']:errors.append('BACKUP_STALE_OR_UNVERIFIED')
except Exception:errors.append('BACKUP_MISSING');b={}
result={'checkedAt':now.isoformat(),'healthy':healthy,'diskPercent':pct,'availableGB':round(u.free/1024**3,2),'lastBackupAt':b.get('backupAt'),'restoreTestPassed':b.get('restoreTestPassed',False),'alerts':errors}
p=root/'status.json';previous=json.loads(p.read_text()) if p.exists() else {};tmp=root/'status.tmp';tmp.write_text(json.dumps(result,indent=2));tmp.chmod(0o600);tmp.replace(p)
if previous.get('alerts')!=errors:subprocess.run(['logger','-p','daemon.warning' if errors else 'daemon.info','-t','academy-maintenance',json.dumps(result)])
print(json.dumps(result))
