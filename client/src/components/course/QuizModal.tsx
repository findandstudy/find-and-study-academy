import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { issueCertificate, submitAttempt } from '@/lib/api';
import { Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Quiz, Question, Attempt } from '../../types';

interface QuizModalProps {
  quiz: Quiz;
  onClose: () => void;
  onComplete: (passed: boolean) => void;
}

export function QuizModal({ quiz: quizProp, onClose, onComplete }: QuizModalProps) {
  // Normalize quiz.questions - parse if string, ensure array
  const quiz = {
    ...quizProp,
    questions: (() => {
      if (!quizProp.questions) return [];
      if (Array.isArray(quizProp.questions)) return quizProp.questions;
      if (typeof quizProp.questions === 'string') {
        try {
          return JSON.parse(quizProp.questions);
        } catch (e) {
          console.error('Failed to parse quiz questions:', e);
          return [];
        }
      }
      return [];
    })()
  };
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: boolean | number }>({});
  const [showResults, setShowResults] = useState(false);
  const [startTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  const { user } = useAuthStore();
  const { addAttempt, addCertificate, courses } = useDataStore();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (answer: boolean | number) => {
    const question = quiz.questions[currentQuestion];
    setAnswers(prev => ({
      ...prev,
      [question.id]: answer
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    if (!user) return;

    // Calculate score
    let correct = 0;
    quiz.questions.forEach(question => {
      const userAnswer = answers[question.id];
      if (question.type === 'boolean') {
        if (userAnswer === question.answer) correct++;
      } else if (question.type === 'mcq') {
        if (userAnswer === question.answerIndex) correct++;
      }
    });

    const scorePercent = Math.round((correct / quiz.questions.length) * 100);
    const passed = scorePercent >= quiz.passPercent;

    // Save attempt locally and to server
    const attempt: Attempt = {
      id: `attempt-${Date.now()}`,
      userId: user.id,
      quizId: quiz.id,
      scorePercent,
      correct,
      incorrect: quiz.questions.length - correct,
      date: new Date().toISOString()
    };
    addAttempt(attempt);

    // Also submit to server for certificate validation
    try {
      await submitAttempt({
        quizId: quiz.id,
        scorePercent,
        correct,
        incorrect: quiz.questions.length - correct
      });
    } catch (error) {
      console.error('Failed to submit attempt to server:', error);
      // Don't block the UI, but log the error
    }

    // If final quiz and passed, issue certificate via server API
    if (quiz.isFinal && passed) {
      const course = courses.find(c => 
        c.sections.some(s => s.lessons.some(l => l.quizId === quiz.id))
      );

      if (course) {
        try {
          // Issue certificate via secure server API (authentication and code generation handled server-side)
          const result = await issueCertificate({
            courseId: course.id,
            quizId: quiz.id
          });

          if (result.success) {
            // Add to localStorage for immediate UI feedback
            const certificate = {
              id: result.certificate!.id,
              userId: user.id,
              courseId: course.id,
              scorePercent: result.certificate!.scorePercent,
              code: result.certificate!.code,
              issuedAt: result.certificate!.issuedAt
            };
            addCertificate(certificate);

            toast({
              title: 'Congratulations! 🎉',
              description: `You've earned your certificate with ${result.certificate!.scorePercent}% score! Code: ${result.certificate!.code}`
            });
          } else {
            console.error('Certificate issuance failed:', result.message);
            
            // Check if it's a duplicate certificate (409 response)
            if (result.message?.includes('already issued') || result.message?.includes('Certificate already')) {
              toast({
                title: 'Certificate Already Earned! 🎓',
                description: result.message || 'You already have a certificate for this course.',
                variant: 'default'
              });
            } else {
              toast({
                title: 'Certificate Issue Error',
                description: result.message || 'Failed to issue certificate. Please contact support.',
                variant: 'destructive'
              });
            }
          }
        } catch (error) {
          console.error('Certificate issuance error:', error);
          toast({
            title: 'Certificate Issue Error',
            description: 'Network error while issuing certificate. Please try again.',
            variant: 'destructive'
          });
        }
      }
    }

    setShowResults(true);
  };

  const closeModal = () => {
    if (showResults) {
      const correct = Object.keys(answers).filter(qId => {
        const question = quiz.questions.find(q => q.id === qId);
        const userAnswer = answers[qId];
        if (question?.type === 'boolean') {
          return userAnswer === question.answer;
        } else if (question?.type === 'mcq') {
          return userAnswer === question.answerIndex;
        }
        return false;
      }).length;
      
      const scorePercent = Math.round((correct / quiz.questions.length) * 100);
      const passed = scorePercent >= quiz.passPercent;
      
      onComplete(passed);
    } else {
      onClose();
    }
  };

  if (showResults) {
    const correct = Object.keys(answers).filter(qId => {
      const question = quiz.questions.find(q => q.id === qId);
      const userAnswer = answers[qId];
      if (question?.type === 'boolean') {
        return userAnswer === question.answer;
      } else if (question?.type === 'mcq') {
        return userAnswer === question.answerIndex;
      }
      return false;
    }).length;
    
    const scorePercent = Math.round((correct / quiz.questions.length) * 100);
    const passed = scorePercent >= quiz.passPercent;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
              {passed ? (
                <CheckCircle className="w-16 h-16 text-green-500" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500" />
              )}
            </div>
            <CardTitle className={passed ? 'text-green-700' : 'text-red-700'}>
              {passed ? 'Quiz Passed!' : 'Quiz Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold">{scorePercent}%</div>
              <div className="text-sm text-muted-foreground">
                {correct} out of {quiz.questions.length} questions correct
              </div>
              <div className="text-sm text-muted-foreground">
                Time: {formatTime(timeElapsed)}
              </div>
              {!passed && (
                <p className="text-sm text-red-600">
                  You need {quiz.passPercent}% to pass. Please review the content and try again.
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-md bg-green-50">
                <div className="text-green-700 font-semibold">{correct}</div>
                <div className="text-sm text-green-600">Correct</div>
              </div>
              <div className="p-3 rounded-md bg-red-50">
                <div className="text-red-700 font-semibold">{quiz.questions.length - correct}</div>
                <div className="text-sm text-red-600">Incorrect</div>
              </div>
            </div>

            <Button onClick={closeModal} className="w-full" data-testid="button-close-results">
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const hasAnswer = answers[question.id] !== undefined;
  const allAnswered = quiz.questions.every(q => answers[q.id] !== undefined);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{quiz.title}</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mr-1" />
                {formatTime(timeElapsed)}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-quiz">
                ✕
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
              <span>Pass: {quiz.passPercent}%</span>
            </div>
            <Progress value={(currentQuestion + 1) / quiz.questions.length * 100} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Question */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{question.text}</h3>
            
            {question.type === 'boolean' ? (
              <div className="space-y-2">
                <Button
                  variant={answers[question.id] === true ? 'default' : 'outline'}
                  onClick={() => handleAnswer(true)}
                  className="w-full justify-start"
                  data-testid="button-answer-true"
                >
                  True
                </Button>
                <Button
                  variant={answers[question.id] === false ? 'default' : 'outline'}
                  onClick={() => handleAnswer(false)}
                  className="w-full justify-start"
                  data-testid="button-answer-false"
                >
                  False
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {question.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={answers[question.id] === index ? 'default' : 'outline'}
                    onClick={() => handleAnswer(index)}
                    className="w-full justify-start"
                    data-testid={`button-answer-${index}`}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
              data-testid="button-previous"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            <div className="flex space-x-2">
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index === currentQuestion
                      ? 'bg-primary text-primary-foreground'
                      : answers[quiz.questions[index].id] !== undefined
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`button-question-${index}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            
            {currentQuestion === quiz.questions.length - 1 ? (
              <Button
                onClick={submitQuiz}
                disabled={!allAnswered}
                data-testid="button-submit-quiz"
              >
                Submit Quiz
              </Button>
            ) : (
              <Button
                onClick={nextQuestion}
                disabled={!hasAnswer}
                data-testid="button-next"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Answer Summary */}
          <div className="text-center text-sm text-muted-foreground">
            Answered: {Object.keys(answers).length} / {quiz.questions.length}
            {!allAnswered && ' (Answer all questions to submit)'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}