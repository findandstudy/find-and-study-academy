import subprocess,json,pathlib,secrets,urllib.parse,re,os
cfg=pathlib.Path('/root/.config/findandstudy-academy/catalog-readonly.json');role='academy_findy_catalog_ro'
def sql(db,text):return subprocess.check_output(['sudo','-u','postgres','psql','-v','ON_ERROR_STOP=1','-d',db,'-At'],input=text,text=True,stderr=subprocess.PIPE)
assert sql('fasos_apply',"SELECT count(*) FROM information_schema.tables WHERE table_name IN ('programs','universities')").strip()=='2'
if cfg.exists():assert (cfg.stat().st_mode&0o777)==0o600
else:
 assert sql('postgres',f"SELECT count(*) FROM pg_roles WHERE rolname='{role}'").strip()=='0','Role exists without private configuration; inspect before proceeding'
 password=secrets.token_hex(32)
 sql('postgres',f"CREATE ROLE {role} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 4; ALTER ROLE {role} SET default_transaction_read_only=on; ALTER ROLE {role} SET statement_timeout='5s'; GRANT CONNECT ON DATABASE fasos_apply TO {role};")
 cfg.parent.mkdir(parents=True,exist_ok=True);fd=os.open(cfg,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump({'connectionString':f'postgresql://{role}:{password}@127.0.0.1:5432/fasos_apply'},f)
view='''CREATE SCHEMA IF NOT EXISTS findy_catalog;
CREATE OR REPLACE VIEW findy_catalog.programs AS SELECT p.id AS program_id,p.name AS program_name,p.degree,p.language,p.duration,p.tuition_fee,p.discounted_fee,p.currency,p.fee_type,p.application_fee,p.deposit_fee,p.intakes,p.updated_at AS program_updated_at,u.id AS university_id,u.name AS university_name,u.country,u.city,u.updated_at AS university_updated_at FROM public.programs p JOIN public.universities u ON u.id=p.university_id WHERE p.is_active=true AND u.is_active=true AND u.status='open';
REVOKE ALL ON SCHEMA findy_catalog FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA findy_catalog FROM PUBLIC;
GRANT USAGE ON SCHEMA findy_catalog TO academy_findy_catalog_ro;
GRANT SELECT ON findy_catalog.programs TO academy_findy_catalog_ro;'''
sql('fasos_apply',view)
permissions=sql('fasos_apply',"SELECT has_table_privilege('academy_findy_catalog_ro','findy_catalog.programs','SELECT'),has_table_privilege('academy_findy_catalog_ro','public.programs','SELECT'),has_table_privilege('academy_findy_catalog_ro','public.users','SELECT')").strip();assert permissions=='t|f|f',permissions
apps=json.loads(subprocess.check_output(['pm2','jlist'],text=True));app=next(x for x in apps if x['name']=='academy');env=app['pm2_env'];dburl=env.get('DATABASE_URL') or env.get('env',{}).get('DATABASE_URL');db=urllib.parse.urlparse(dburl).path.lstrip('/');assert re.fullmatch(r'[\w-]+',db)
sql(db,'''CREATE TABLE IF NOT EXISTS findy_daily_usage(user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,day date NOT NULL,used integer NOT NULL DEFAULT 0 CHECK(used>=0),last_request timestamptz,minute_start timestamptz,minute_used integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS findy_chat_context(user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_id varchar(100) NOT NULL,topic jsonb NOT NULL,expires_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,session_id));
CREATE INDEX IF NOT EXISTS findy_chat_context_expiry ON findy_chat_context(expires_at);''')
print('READONLY_CATALOG_VIEW_READY; base program/user tables inaccessible; private config mode 600; quota/context tables ready')
print('ACTIVE_COUNTRY_COUNTS',sql('fasos_apply','SELECT country,count(*) FROM findy_catalog.programs GROUP BY country ORDER BY country').strip())
