"""Offline job planning from a private read-only catalog snapshot. No credentials/API calls."""
import hashlib,html,json,re,sys
from pathlib import Path
from html.parser import HTMLParser
LANGUAGES='tr ar fr ru fa zh hi es id ur tk ky kk uz tg bn pt ne vi ko uk it'.split()
def digest(value):
 return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
class VisibleText(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0]
        for match in re.finditer('\n', source):
            self.lines.append(match.end())
        self.hidden = []
        self.spans = []

    def handle_starttag(self, tag, attrs):
        if tag in ('style', 'script'):
            self.hidden.append(tag)

    def handle_endtag(self, tag):
        if self.hidden and tag == self.hidden[-1]:
            self.hidden.pop()

    def add(self, data):
        if self.hidden:
            return
        line, column = self.getpos()
        start = self.lines[line - 1] + column
        end = start + len(data)
        if self.spans and self.spans[-1][1] == start:
            self.spans[-1] = (self.spans[-1][0], end)
        else:
            self.spans.append((start, end))

    handle_data = add

    def handle_entityref(self, name):
        self.add('&' + name + ';')

    def handle_charref(self, name):
        self.add('&#' + name + ';')

def normalize_questions(questions):
 for _ in range(4):
  if isinstance(questions,str):questions=json.loads(questions)
 assert isinstance(questions,list) and questions
 reserved={q['id'] for q in questions};seen=set();result=[]
 for index,q in enumerate(questions):
  item=dict(q)
  if item['id'] in seen:
   candidate=f"{item['id']}__duplicate_{index+1}"
   while candidate in reserved or candidate in seen:candidate+='_' 
   item['id']=candidate
  seen.add(item['id']);result.append(item)
 return result

def lesson_strings(item):
 values=[]
 def add(text):
  if not isinstance(text,str) or not any(c.isalpha() for c in text):return
  text=html.unescape(text).strip()
  if text and text not in values:values.append(text)
 for field in ['title','description']:add(item.get(field))
 source=item.get('content') or '';parser=VisibleText(source);parser.feed(source)
 for start,end in parser.spans:
  text=source[start:end];match=re.search(r'\S(?:.*\S)?',text,re.S)
  if match and text.strip() not in (r'\n',r'\r\n'):add(match.group())
 return values

def build(snapshot):
 present={kind:{} for kind in ['lesson','quiz']};review=[];jobs=[]
 for kind,key in [('lesson','lessonTranslations'),('quiz','quizTranslations')]:
  for row in snapshot[key]:
   present[kind].setdefault(row['id'],set()).add(row['language'])
   if row['language'] in LANGUAGES and row['status']!='published':review.append({'kind':kind,'id':row['id'],'language':row['language'],'reason':'Existing non-published translation preserved; review separately'})
 def add(kind,item,strings,source):
  if not item.get('title') or not strings or any(not isinstance(s,str) or (not s.strip() and not(kind=='quiz' and i==1)) for i,s in enumerate(strings)):
   review.append({'kind':kind,'id':item['id'],'reason':'Missing source title/text'});return
  for language in LANGUAGES:
   if language in present[kind].get(item['id'],set()):continue
   job={'version':1,'kind':kind,'id':item['id'],'title':item['title'],'language':language,'sourceHash':digest(source),'strings':strings};job['jobHash']=digest(job);jobs.append(job)
 for item in snapshot['contents']:
  add('lesson',item,lesson_strings(item),{k:item.get(k) for k in ['title','description','content']})
 for item in snapshot['quizzes']:
  try:
   questions=normalize_questions(item['questions'])
   if any(not isinstance(q.get('text'),str) or len(q['text'].strip())<8 or q.get('explanation') for q in questions):raise ValueError('Damaged source text or unsupported explanation')
   strings=[item['title'],item.get('description') or '']
   for q in questions:
    if q['type'] not in ['mcq','boolean']:raise ValueError('Unsupported question type')
    strings.append(q['text'])
    if q['type']=='mcq':
     if not isinstance(q.get('options'),list) or not q['options'] or not isinstance(q.get('answerIndex'),int) or not 0<=q['answerIndex']<len(q['options']):raise ValueError('Invalid source options/grading')
     strings.extend(q['options'])
    elif not isinstance(q.get('answer'),bool):raise ValueError('Invalid boolean grading')
   add('quiz',item,strings,{'title':item['title'],'description':item.get('description'),'questions':questions})
  except (ValueError,TypeError,KeyError,AssertionError,json.JSONDecodeError) as e:review.append({'kind':'quiz','id':item['id'],'reason':str(e)})
 return {'version':1,'sourceLanguage':'en','jobs':jobs,'manualReview':review}
if __name__=='__main__':
 if len(sys.argv)!=3:raise SystemExit('Usage: build_catalog_jobs.py PRIVATE_SNAPSHOT OUTPUT_JOBS')
 plan=build(json.loads(Path(sys.argv[1]).read_text()));Path(sys.argv[2]).write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');Path(sys.argv[2]).chmod(0o600)
 print(json.dumps({'jobs':len(plan['jobs']),'lessonJobs':sum(j['kind']=='lesson' for j in plan['jobs']),'quizJobs':sum(j['kind']=='quiz' for j in plan['jobs']),'manualReview':len(plan['manualReview']),'paidRequests':0}))
