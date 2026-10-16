import copy,hashlib,json,tempfile,unittest
from pathlib import Path
from build_catalog_jobs import digest,lesson_strings
from prepare_legacy_bundle import prepare
class RepairTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.out=Path(self.temp.name)
  self.source={'id':'fixture','title':'Example','description':'Guide','content':'<style>.x{color:red}</style><section class="x"><a href="https://example.com">Read more</a><table><tr><td>Hello</td></tr></table></section>'}
  fields={k:self.source[k] for k in ['title','description','content']}
  self.job={'version':1,'kind':'lesson','id':'fixture','title':'Example','language':'es','sourceHash':digest(fields),'strings':lesson_strings(self.source)};self.job['jobHash']=digest(self.job)
  self.plan={'jobs':[self.job]};self.snapshot={'contents':[self.source]};self.manifest={'rows':[{'id':'fixture','language':'es','jobHash':self.job['jobHash'],'sourceHash':self.job['sourceHash'],'existingHashes':{k:hashlib.sha256(b'old').hexdigest() for k in fields}}]}
  self.output={**self.job,'model':'gpt-4.1-mini-2025-04-14','policy':'academy-visible-strings-v5','strings':['Ejemplo','Guía','Leer más','Hola']};self.write()
 def tearDown(self):self.temp.cleanup()
 def write(self): (self.out/'draft.json').write_text(json.dumps(self.output))
 def run_prepare(self):return prepare(self.snapshot,self.plan,self.manifest,self.out)
 def test_structure_and_guards(self):
  b=self.run_prepare();self.assertEqual(b['mode'],'repair-existing-only');t=b['rows'][0]['translation'];self.assertIn('<style>',t['content']);self.assertIn('<table>',t['content']);self.assertIn('href="https://example.com"',t['content']);self.assertIn('Hola',t['content']);self.assertEqual(b['rows'][0]['existingHashes'],self.manifest['rows'][0]['existingHashes'])
 def test_stale_source(self):
  self.source['content']+='changed'
  with self.assertRaisesRegex(ValueError,'Snapshot source changed'):self.run_prepare()
 def test_identity_mismatch(self):
  self.output['language']='tr';self.write()
  with self.assertRaisesRegex(ValueError,'identity'):self.run_prepare()
 def test_conflicting_output(self):
  other=copy.deepcopy(self.output);other['strings'][3]='Otro';(self.out/'other.json').write_text(json.dumps(other))
  with self.assertRaisesRegex(ValueError,'Conflicting'):self.run_prepare()
 def test_missing_guard(self):
  del self.manifest['rows'][0]['existingHashes']['content']
  with self.assertRaisesRegex(ValueError,'guards'):self.run_prepare()
 def test_placeholder_rejected(self):
  self.output['strings'][3]='__FAS_KEEP_BAD__';self.write()
  with self.assertRaisesRegex(ValueError,'Invalid translated'):self.run_prepare()
if __name__=='__main__':unittest.main()
