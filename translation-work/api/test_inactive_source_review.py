import unittest
from build_catalog_jobs import build,LANGUAGES
class InactiveSourceReview(unittest.TestCase):
 def snapshot(self):
  source={'id':'live','title':'Published lesson','description':'','content':'<p>Actual guide</p>'}
  return {'contents':[source],'quizzes':[],'lessonTranslations':[{'id':'live','language':l,'status':'draft' if l=='ar' else 'published'} for l in LANGUAGES]+[{'id':'archived-coming-soon','language':'ar','status':'draft'}],'quizTranslations':[]}
 def test_active_draft_remains_a_required_review_while_archived_source_is_preserved(self):
  s=self.snapshot();before=repr(s);p=build(s)
  self.assertEqual(p['jobs'],[])
  self.assertEqual([(x['id'],x['language']) for x in p['manualReview']],[('live','ar')])
  self.assertEqual([(x['id'],x['language']) for x in p['preservedInactiveSourceTranslations']],[('archived-coming-soon','ar')])
  self.assertEqual(repr(s),before)
 def test_missing_translation_of_active_source_still_generates_job(self):
  s=self.snapshot();s['lessonTranslations']=[r for r in s['lessonTranslations'] if r['language']!='it'];p=build(s)
  self.assertEqual([(x['id'],x['language']) for x in p['jobs']],[('live','it')])
 def test_inactive_quiz_drafts_are_not_shown_as_publishable_work(self):
  s=self.snapshot();s['quizTranslations']=[{'id':'old-test-quiz','language':'it','status':'draft'}];p=build(s)
  self.assertEqual(len(p['manualReview']),1)
  self.assertEqual(len(p['preservedInactiveSourceTranslations']),2)
if __name__=='__main__':unittest.main()
