import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { QuizModal } from './QuizModal';
import { BookOpen, CheckCircle, PlayCircle, Award } from 'lucide-react';
import type { Course, Lesson, Quiz, Progress as ProgressType } from '../../types';

interface CourseViewProps {
  course: Course;
}

export function CourseView({ course }: CourseViewProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const { user } = useAuthStore();
  const { progresses, quizzes, updateProgress, certificates } = useDataStore();

  // Get user progress for this course
  const userProgress = progresses.find(p => p.userId === user?.id && p.courseId === course.id);
  const completedLessons = userProgress?.lessonCompletedIds || [];
  
  // Calculate total lessons
  const totalLessons = course.sections.reduce((total, section) => total + section.lessons.length, 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  // Check if user has certificate for this course
  const hasCertificate = certificates.some(c => c.userId === user?.id && c.courseId === course.id);

  // Get final quiz
  const finalQuiz = quizzes.find(q => q.isFinal);

  useEffect(() => {
    // Auto-select first lesson if none selected
    if (!selectedLesson && course.sections[0]?.lessons[0]) {
      setSelectedLesson(course.sections[0].lessons[0]);
    }
  }, [course, selectedLesson]);

  const handleLessonComplete = (lessonId: string) => {
    if (!user) return;

    const newCompletedIds = [...completedLessons, lessonId];
    const newProgress: ProgressType = {
      userId: user.id,
      courseId: course.id,
      percent: Math.round((newCompletedIds.length / totalLessons) * 100),
      lessonCompletedIds: newCompletedIds
    };
    
    updateProgress(newProgress);
  };

  const startQuiz = (lesson: Lesson) => {
    const quiz = quizzes.find(q => q.id === lesson.quizId);
    if (quiz) {
      setActiveQuiz(quiz);
    }
  };

  const startFinalQuiz = () => {
    if (finalQuiz) {
      setActiveQuiz(finalQuiz);
    }
  };

  const closeQuiz = () => {
    setActiveQuiz(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Lesson Tree */}
      <div className="lg:col-span-1">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {course.sections.map((section) => (
              <div key={section.id}>
                <h3 className="font-medium text-sm mb-2">{section.title}</h3>
                <div className="space-y-1 ml-4">
                  {section.lessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isSelected = selectedLesson?.id === lesson.id;
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLesson(lesson)}
                        className={`
                          flex items-center w-full p-2 text-left text-sm rounded-md hover-elevate transition-colors
                          ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                        `}
                        data-testid={`button-lesson-${lesson.id}`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <BookOpen className="w-4 h-4 mr-2" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Final Quiz */}
            {finalQuiz && (
              <div className="border-t pt-4">
                <Button
                  onClick={startFinalQuiz}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={progressPercent < 100}
                  data-testid="button-final-quiz"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Final Exam
                  {progressPercent < 100 && ' (Complete all lessons first)'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lesson Content */}
      <div className="lg:col-span-3">
        {selectedLesson ? (
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {completedLessons.includes(selectedLesson.id) ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <BookOpen className="w-5 h-5" />
                  )}
                  {selectedLesson.title}
                </CardTitle>
                {completedLessons.includes(selectedLesson.id) && (
                  <Badge variant="success">Completed</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lesson Content */}
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedLesson.html }}
              />

              {/* Quiz Section */}
              {selectedLesson.quizId && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Mini Quiz</h3>
                      <p className="text-sm text-muted-foreground">
                        Test your knowledge before moving to the next lesson
                      </p>
                    </div>
                    <Button
                      onClick={() => startQuiz(selectedLesson)}
                      variant="default"
                      data-testid={`button-start-quiz-${selectedLesson.id}`}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Quiz
                    </Button>
                  </div>
                </div>
              )}

              {/* Completion Status */}
              {!completedLessons.includes(selectedLesson.id) && !selectedLesson.quizId && (
                <div className="border-t pt-6">
                  <Button
                    onClick={() => handleLessonComplete(selectedLesson.id)}
                    className="w-full"
                    data-testid={`button-complete-lesson-${selectedLesson.id}`}
                  >
                    Mark as Complete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="h-64 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select a lesson to start learning</p>
            </div>
          </Card>
        )}
      </div>

      {/* Quiz Modal */}
      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz}
          onClose={closeQuiz}
          onComplete={(passed) => {
            if (passed && selectedLesson && !completedLessons.includes(selectedLesson.id)) {
              handleLessonComplete(selectedLesson.id);
            }
            closeQuiz();
          }}
        />
      )}
    </div>
  );
}