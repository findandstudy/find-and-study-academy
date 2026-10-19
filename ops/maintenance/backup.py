#!/usr/bin/env python3
# Only creates backups. Existing backups and deployments are never removed.
import pathlib,subprocess,json,os,datetime,hashlib,shutil,fcntl
BASE=pathlib.Path('/var/lib/academy-maintenance');KEY=pathlib.Path('/root/.config/findandstudy-academy/backup-key.pem');CERT=KEY.with_suffix('.crt');APP=pathlib.Path('/var/www/academy.findandstudy.com');DB='findandstudy'
BASE.mkdir(parents=True,exist_ok=True);os.chmod(BASE,0o700)
lock=(BASE/'backup.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def run(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def sql(db,text):return run(['sudo','-u','postgres','psql','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',text]).stdout.decode().strip()
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def encrypt(args,out):
 with subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE) as src:
  with out.open('wb') as dest:r=subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-cbc','-outform','DER',str(CERT)],stdin=src.stdout,stdout=dest,stderr=subprocess.PIPE)
  src.stdout.close();src.stderr.read();code=src.wait()
  if r.returncode or code:raise RuntimeError('Encrypted backup pipeline failed')
 os.chmod(out,0o600)
def decrypt_to(args,src):
 with subprocess.Popen(['openssl','cms','-decrypt','-binary','-inform','DER','-in',str(src),'-inkey',str(KEY)],stdout=subprocess.PIPE,stderr=subprocess.PIPE) as dec:
  r=subprocess.run(args,stdin=dec.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE);dec.stdout.close();dec.stderr.read();code=dec.wait()
  if r.returncode or code:raise RuntimeError('Restore pipeline failed')
if not KEY.exists():
 os.umask(0o077);run(['openssl','req','-x509','-newkey','rsa:3072','-nodes','-keyout',str(KEY),'-out',str(CERT),'-days','3650','-subj','/CN=Academy Backup Encryption/'])
assert (KEY.stat().st_mode&0o777)==0o600
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');dest=BASE/'backups'/stamp;dest.mkdir(parents=True,exist_ok=False);os.chmod(dest,0o700)
critical=['users','countries','contents','content_translations','quizzes','quiz_translations','partnership_applications','academy_translation_jobs','academy_translation_publications'];counts={t:int(sql(DB,'SELECT count(*) FROM '+t)) for t in critical}
sessions=sql(DB,"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%session%'").splitlines()
encrypt(['sudo','-u','postgres','pg_dump','-Fc','-d',DB]+['--exclude-table-data=public.'+s for s in sessions],dest/'database.dump.cms')
encrypt(['tar','--exclude=academy.findandstudy.com/node_modules','--exclude=academy.findandstudy.com/.git','--exclude=*.env*','--exclude=academy.findandstudy.com/.local','--exclude=academy.findandstudy.com/logs','--exclude=academy.findandstudy.com/.cache','-C','/var/www','-czf','-','academy.findandstudy.com','-C','/var/lib/academy-translations','outputs/budget-ledger.json'],dest/'files.tar.gz.cms')
rest=BASE/('restore-'+stamp);rest.mkdir();testdb='academy_restore_'+stamp.lower().replace('t','_').replace('z','');created=False
try:
 run(['sudo','-u','postgres','createdb','--template=template0',testdb]);created=True
 decrypt_to(['sudo','-u','postgres','pg_restore','--no-owner','--no-privileges','--exit-on-error','-d',testdb],dest/'database.dump.cms')
 restored={t:int(sql(testdb,'SELECT count(*) FROM '+t)) for t in critical};assert counts==restored,'Restored row counts differ'
 for s in sessions:assert int(sql(testdb,'SELECT count(*) FROM '+s))==0,'Sessions must not be restored'
 decrypt_to(['tar','-xzf','-','-C',str(rest)],dest/'files.tar.gz.cms')
 paths=['server/routes.ts','server/findy-grounded.ts','server/training-integrity.ts','client/src/App.tsx','dist/index.js','dist/public/index.html','package.json']
 for p in paths:assert sha(APP/p)==sha(rest/'academy.findandstudy.com'/p),p
 assert sha(rest/'outputs/budget-ledger.json')==sha(pathlib.Path('/var/lib/academy-translations/outputs/budget-ledger.json'))
 originals=APP/'public/uploads';upload_checks=0
 for p in originals.rglob('*'):
  if p.is_file() and not p.is_symlink():assert sha(p)==sha(rest/'academy.findandstudy.com/public/uploads'/p.relative_to(originals));upload_checks+=1
 report={'backupAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'restoreTestPassed':True,'databaseTableCounts':restored,'sourceFilesVerified':len(paths),'uploadedFilesVerified':upload_checks,'sessionTablesExcluded':len(sessions),'budgetLedgerRestoredInIsolation':True,'encrypted':True,'files':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in dest.iterdir() if p.is_file()}}
 (dest/'manifest.json').write_text(json.dumps(report,indent=2));os.chmod(dest/'manifest.json',0o600);(BASE/'last-backup.json').write_text(json.dumps(report,indent=2));print(json.dumps({'backup':stamp,'restoreTestPassed':True,'databaseTablesVerified':len(restored),'uploadedFilesVerified':upload_checks,'encryptedBytes':sum(v['bytes'] for v in report['files'].values())}))
finally:
 if created:run(['sudo','-u','postgres','dropdb',testdb])
 # Remove only this newly created disposable restore-test directory.
 assert rest.parent==BASE and rest.name=='restore-'+stamp
 shutil.rmtree(rest)
