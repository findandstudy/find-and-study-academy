import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from prepare_catalog_bundle import prepare
class Quarantine(unittest.TestCase):
 def test_corrupt_checkpoint_is_reported_while_clean_translation_is_preserved(self):
  item={'id':'fixture','title':'Example','description':'Guide','content':'<p>Hello</p>'}
  jobs=[{'kind':'lesson','id':'fixture','language':lang,'sourceHash':'source','jobHash':lang,'strings':['Example','Guide','Hello']} for lang in ['es','it']]
  with tempfile.TemporaryDirectory() as temp:
   out=Path(temp)
   for job in jobs:
    value={**job,'model':'gpt-4.1-mini-2025-04-14','policy':'academy-visible-strings-v5','strings':['Ejemplo','Guía','Hola' if job['language']=='es' else 'Ciao'+chr(0)]}
    (out/(job['language']+'.json')).write_text(json.dumps(value))
   before={p.name:p.read_bytes() for p in out.iterdir()}
   with patch('prepare_catalog_bundle.build',return_value={'jobs':jobs}):result=prepare({'contents':[item],'quizzes':[]},out,set(),50)
   self.assertEqual(len(result['rows']),1);self.assertEqual(result['rows'][0]['language'],'es')
   self.assertEqual(result['rows'][0]['translation']['content'],'<p>Hola</p>')
   self.assertEqual(len(result['rejectedDrafts']),1);self.assertEqual(result['rejectedDrafts'][0]['language'],'it')
   self.assertEqual(before,{p.name:p.read_bytes() for p in out.iterdir()})
if __name__=='__main__':unittest.main()
