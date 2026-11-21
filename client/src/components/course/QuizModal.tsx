import { legacyUi, legacyMessage, legacyLocale } from '@/lib/legacy-ui';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { submitAttempt } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { quizVisibleText } from '@/lib/quiz-text';
import { courseText } from '@/i18n/course-labels';
import { assessmentText } from '@/i18n/assessment-labels';
import { Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { Quiz } from '../../types';
import { parseQuizQuestions } from '@shared/quiz-localization';

interface QuizModalProps {
 quiz: Quiz;
 onClose: () => void;
 onComplete: (passed: boolean) => void;
}
type Grade = { correct: number; incorrect: number; scorePercent: number };

export function QuizModal({ quiz, onClose, onComplete }: QuizModalProps) {
 useTranslation();
 const questions = useMemo(() => { try { return parseQuizQuestions(quiz.questions); } catch { return []; } }, [quiz.questions]);
 const [currentQuestion, setCurrentQuestion] = useState(0);
 const [answers, setAnswers] = useState<Record<string, boolean | number>>({});
 const [result, setResult] = useState<Grade | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const submitting = useRef(false);
 const [startTime] = useState(Date.now());
 const [timeElapsed, setTimeElapsed] = useState(0);
 const { user } = useAuthStore();
 const { addAttempt } = useDataStore();
 const { toast } = useToast();
 const locale = legacyLocale();
 const kind = courseText(locale, quiz.isFinal ? 4 : 7);
 const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
 const passed = result !== null && result.scorePercent >= quiz.passPercent;
 const closeModal = () => { if (!submitting.current) result ? onComplete(passed) : onClose(); };

 useEffect(() => {
  if (result) return;
  const timer = setInterval(() => setTimeElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
  return () => clearInterval(timer);
 }, [startTime, result]);

 const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined);
 const submitQuiz = async () => {
  if (!user || !allAnswered || submitting.current) return;
  submitting.current = true;
  setIsSubmitting(true);
  try {
   // The server grades the answer IDs; its returned grade is authoritative.
   const response = await submitAttempt({ quizId: quiz.id, answers, scorePercent: 0, correct: 0, incorrect: 0 });
   const grade = response.attempt;
   if (!response.success || !grade || !Number.isInteger(grade.correct) || !Number.isInteger(grade.incorrect)
    || grade.correct < 0 || grade.incorrect < 0 || grade.correct + grade.incorrect !== questions.length
    || !Number.isFinite(grade.scorePercent) || grade.scorePercent < 0 || grade.scorePercent > 100) {
    throw new Error(response.message || legacyUi('Quiz submission failed'));
   }
   addAttempt(grade);
   setResult({correct: grade.correct, incorrect: grade.incorrect, scorePercent: grade.scorePercent});
   queryClient.invalidateQueries({queryKey: ['/api/attempts']});
   // Finals need not be attached to a lesson. Refresh earned certificates
   // directly instead of inventing an identity from the local seed courses.
   if (response.certificate) {
    queryClient.invalidateQueries({queryKey: ['/api/certificates']});
    toast({title: response.certificate.alreadyIssued ? legacyUi('Certificate Already Earned! 🎓') : legacyUi('Congratulations! 🎉'),
     description: response.certificate.alreadyIssued
      ? legacyUi('You already have a certificate for this course. Code: {value0}', {value0: response.certificate.code})
      : legacyUi("You've earned your certificate with {value0}% score! Code: {value1}", {value0: response.certificate.scorePercent, value1: response.certificate.code}), duration: 6000});
   }
  } catch (error) {
   toast({title: legacyUi('Quiz submission failed'), description: legacyMessage(error instanceof Error ? error.message : 'Please try again.'), variant: 'destructive'});
  } finally {
   submitting.current = false;
   setIsSubmitting(false);
  }
 };
 const question = questions[currentQuestion];
 return <Dialog open onOpenChange={open => { if (!open) closeModal(); }}>
  <DialogContent data-testid="quiz-dialog" dir={document.documentElement.dir} className="max-w-2xl min-w-0 gap-5 [overflow-wrap:anywhere]" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => {if (isSubmitting) event.preventDefault();}}>
   <header className="min-w-0 space-y-3 pe-7 text-start">
    <Badge variant="secondary" className="max-w-full whitespace-normal">{kind}</Badge>
    <DialogTitle className="text-xl leading-snug" data-testid="quiz-title">{quizVisibleText(quiz.title)}</DialogTitle>
    <DialogDescription className="flex flex-wrap items-center justify-between gap-2">
     <span>{assessmentText(1, {percent: quiz.passPercent})}</span>
     <span className="inline-flex shrink-0 items-center gap-1"><Clock className="h-4 w-4" /><bdi dir="ltr">{formatTime(timeElapsed)}</bdi></span>
    </DialogDescription>
   </header>
   {!questions.length ? <div role="alert" className="space-y-4"><p>{legacyUi('This quiz has no questions available yet.')}</p><Button onClick={onClose} className="whitespace-normal">{legacyUi('Close')}</Button></div>
    : result ? <div className="space-y-5" data-testid="quiz-results" aria-live="polite">
     <div className="space-y-3 text-center">
      {passed ? <CheckCircle className="mx-auto h-14 w-14 text-green-600" /> : <XCircle className="mx-auto h-14 w-14 text-red-600" />}
      <h3 className={`text-xl font-semibold ${passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{legacyUi(passed ? 'Quiz Passed!' : 'Quiz Failed')}</h3>
      <div className="text-3xl font-bold" data-testid="quiz-score"><bdi>{result.scorePercent}%</bdi></div>
      <p className="text-sm text-muted-foreground">{legacyUi('{value0} of {value1} questions answered correctly.', {value0: result.correct, value1: questions.length})}</p>
      {!passed && <p className="text-sm text-red-700 dark:text-red-400">{assessmentText(2, {percent: quiz.passPercent})}</p>}
     </div>
     <div className="grid grid-cols-2 gap-3 text-center">
      <div className="rounded-md bg-green-50 p-3 text-green-800 dark:bg-green-950 dark:text-green-300"><div className="font-semibold">{result.correct}</div><div className="text-sm">{legacyUi('Correct')}</div></div>
      <div className="rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-300"><div className="font-semibold">{result.incorrect}</div><div className="text-sm">{legacyUi('Incorrect')}</div></div>
     </div>
     <Button onClick={closeModal} className="w-full whitespace-normal" data-testid="button-close-results">{legacyUi('Continue')}</Button>
    </div> : question && <>
     <div className="space-y-2"><p className="text-sm text-muted-foreground">{assessmentText(0, {current: currentQuestion + 1, total: questions.length})}</p><Progress value={(currentQuestion + 1) / questions.length * 100} /></div>
     <section className="min-w-0 space-y-4" aria-labelledby="quiz-question-text">
      <h3 id="quiz-question-text" className="text-lg font-medium leading-relaxed">{quizVisibleText(question.text)}</h3>
      <div className="space-y-2">
       {(question.type === 'boolean' ? [legacyUi('True'), legacyUi('False')] : question.options).map((option, index) => {
        const value = question.type === 'boolean' ? index === 0 : index;
        return <Button key={`${question.id}-${index}`} variant={answers[question.id] === value ? 'default' : 'outline'} aria-pressed={answers[question.id] === value} disabled={isSubmitting}
         onClick={() => setAnswers(previous => ({...previous, [question.id]: value}))}
         className="h-auto min-h-11 w-full min-w-0 justify-start whitespace-normal text-start leading-relaxed" data-testid={`button-answer-${question.type === 'boolean' ? String(value) : index}`}>
         <span className="min-w-0">{quizVisibleText(option)}</span>
        </Button>;
       })}
      </div>
     </section>
     <nav aria-label={kind} className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2" data-testid="question-navigation">
       {questions.map((q, index) => <button key={q.id} type="button" disabled={isSubmitting} onClick={() => setCurrentQuestion(index)} aria-label={assessmentText(0, {current: index + 1, total: questions.length})} aria-current={index === currentQuestion ? 'step' : undefined}
        className={`h-9 w-9 shrink-0 rounded-full border text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${index === currentQuestion ? 'border-primary bg-primary text-primary-foreground' : answers[q.id] !== undefined ? 'border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300' : 'border-border bg-muted text-muted-foreground'}`}
        data-testid={`button-question-${index}`}>{index + 1}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
       <Button variant="outline" onClick={() => setCurrentQuestion(i => i - 1)} disabled={currentQuestion === 0 || isSubmitting} className="min-w-0 whitespace-normal" data-testid="button-previous"><ArrowLeft className="rtl:rotate-180" />{legacyUi('Previous')}</Button>
       {currentQuestion === questions.length - 1
        ? <Button onClick={submitQuiz} disabled={!allAnswered || isSubmitting} className="min-w-0 whitespace-normal" data-testid="button-submit-quiz">{isSubmitting && <Loader2 className="animate-spin" />}{legacyUi('Submit Quiz')}</Button>
        : <Button onClick={() => setCurrentQuestion(i => i + 1)} disabled={answers[question.id] === undefined || isSubmitting} className="min-w-0 whitespace-normal" data-testid="button-next">{legacyUi('Next')}<ArrowRight className="rtl:rotate-180" /></Button>}
      </div>
     </nav>
     <p className="text-center text-sm text-muted-foreground">{assessmentText(3, {answered: Object.keys(answers).length, total: questions.length})}{!allAnswered && legacyUi(' (Answer all questions to submit)')}</p>
    </>}
  </DialogContent>
 </Dialog>;
}
