import{test}from'node:test';import assert from'node:assert/strict';
import{createTrainingIntegrity}from'./training-integrity';
const questions=[{id:'t1',type:'boolean',text:'Deliberately false proposition',answer:false},{id:'m1',type:'mcq',text:'Pick the second',options:['A','B','C','D'],answerIndex:1},{id:'m2',type:'mcq',text:'Pick the first',options:['A','B','C','D'],answerIndex:0},{id:'t2',type:'boolean',text:'True proposition',answer:true},{id:'m3',type:'mcq',text:'Pick the fourth',options:['A','B','C','D'],answerIndex:3}];
const correct={t1:false,m1:1,m2:0,t2:true,m3:3};
function fixture(){
 const mini={id:'mini-a',status:'active',passPercent:70,isFinal:false,courseId:'course-a',countryId:'a',questions:JSON.stringify(JSON.stringify(questions))};
 const final={...mini,id:'final-a',isFinal:true},quizzes=[mini,final],lessons=[{id:'a1',countryId:'a',courseId:'course-a',type:'lesson',status:'published',quizId:mini.id},{id:'a2',countryId:'a',courseId:'course-a',type:'lesson',status:'published'},{id:'b1',countryId:'b',courseId:'course-b',type:'lesson',status:'published'}];
 const attempts:any[]=[],progress:any={lessonCompletedIds:[]},storage={getQuizById:async(id:string)=>quizzes.find(q=>q.id===id),getCountries:async()=>[{id:'a',status:'active'},{id:'b',status:'active'}],getContents:async()=>lessons,getProgressByUserAndCourse:async()=>progress,getAttempts:async()=>attempts};
 return{...createTrainingIntegrity(storage),quizzes,lessons,attempts,progressState:progress};
}
async function invoke(handler:any,body:any,userId='learner',params={}){let status=200,result:any,next=false;await handler({body,user:{id:userId},params},{status(n:number){status=n;return this;},json(value:any){result=value;}},()=>{next=true;});return{status,result,next,body};}
test('canonical grading ignores submitted scores and preserves deliberately false boolean statements',async()=>{
 const f=fixture(),result=await invoke(f.attempt,{quizId:'mini-a',answers:{...correct,t1:true,m1:0},scorePercent:100,correct:5,incorrect:0});
 assert.equal(result.next,true);assert.equal(result.body.scorePercent,60);assert.equal(result.body.correct,3);assert.equal(result.body.incorrect,2);assert.deepEqual(f.attempts,[]);
 assert.equal((await invoke(f.attempt,{quizId:'mini-a',answers:correct})).body.scorePercent,100);
});
test('missing, extra, coerced and out-of-range answers fail before downstream persistence',async()=>{
 const f=fixture();for(const answers of[{...correct,t1:'false'},{...correct,m1:'1'},{...correct,m1:4},{...correct,unknown:0},Object.fromEntries(Object.entries(correct).filter(([id])=>id!=='m2'))]){
 const r=await invoke(f.attempt,{quizId:'mini-a',answers});assert.equal(r.status,400);assert.equal(r.next,false);
 }f.quizzes[0].status='inactive';assert.equal((await invoke(f.attempt,{quizId:'mini-a',answers:correct})).status,404);
});
test('final access needs every current lesson and a passing mini attempt by this learner',async()=>{
 const f=fixture();assert.equal((await invoke(f.attempt,{quizId:'final-a',answers:correct})).result.code,'COMPLETE_LESSONS_FIRST');
 f.progressState.lessonCompletedIds=['a1','a2'];f.attempts.push({userId:'someone-else',quizId:'mini-a',scorePercent:100});
 assert.equal((await invoke(f.attempt,{quizId:'final-a',answers:correct})).result.code,'PASS_LESSON_QUIZZES_FIRST');
 f.attempts.push({userId:'learner',quizId:'mini-a',scorePercent:60});assert.equal((await invoke(f.certificate,{quizId:'final-a'})).status,403);
 f.attempts.push({userId:'learner',quizId:'mini-a',scorePercent:80});const before=structuredClone(f.attempts);
 assert.equal((await invoke(f.attempt,{quizId:'final-a',answers:correct})).next,true);assert.deepEqual(f.attempts,before);
 assert.equal((await invoke(f.certificate,{quizId:'mini-a'})).result.code,'FINAL_EXAM_REQUIRED');
});
test('progress cannot claim foreign lessons, duplicate completion or an unpassed newly completed mini',async()=>{
 const f=fixture();assert.equal((await invoke(f.progress,{courseId:'course-a',lessonCompletedIds:['b1']})).result.code,'LESSON_OUTSIDE_COURSE');
 assert.equal((await invoke(f.progress,{courseId:'course-a',lessonCompletedIds:['a2','a2']})).result.code,'INVALID_LESSON_IDS');
 assert.equal((await invoke(f.progress,{courseId:'course-a',lessonCompletedIds:['a1']})).result.code,'PASS_LESSON_QUIZ_FIRST');
 const r=await invoke(f.progress,{courseId:'course-a',lessonCompletedIds:['a2'],percent:100,lastLessonCompletedAt:'forged'});
 assert.equal(r.next,true);assert.equal(r.body.percent,50);assert.equal('lastLessonCompletedAt'in r.body,false);
});
