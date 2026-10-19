#!/usr/bin/python3
import pathlib,shutil,subprocess
root=pathlib.Path('/var/lib/academy-maintenance/backups')
# Preserve all existing backups. A bounded queue prevents unattended disk growth.
if len(list(root.glob('20*')))>=7 or shutil.disk_usage('/').free<5*1024**3:
 subprocess.run(['logger','-p','daemon.warning','-t','academy-maintenance','Backup paused: retention review or free disk space required']);raise SystemExit(1)
raise SystemExit(subprocess.call(['/usr/bin/python3','/var/lib/academy-translations/academy-backup-20261019.py']))
