import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { QuizModal } from './QuizModal';
import { VideoPlayer } from '@/components/VideoPlayer';
import { BookOpen, CheckCircle, PlayCircle, Award } from 'lucide-react';
import type { Course, Lesson, Quiz, Progress as ProgressType } from '../../types';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CourseViewProps {
  course: Course;
  quizzes?: Quiz[];
  countryId?: string; // Optional country ID for filtering final exams
}

export function CourseView({ course, quizzes: quizzesProp, countryId }: CourseViewProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render after quiz completion
  const { user } = useAuthStore();
  const { quizzes: storeQuizzes, certificates } = useDataStore();
  const { toast } = useToast();
  
  // Use prop quizzes if provided, otherwise fallback to store quizzes
  const quizzes = quizzesProp || storeQuizzes;

  // Fetch progress from backend
  const { data: progressResponse } = useQuery<{ success: boolean; progress: any }>({
    queryKey: ['/api/progress', course.id],
    enabled: !!user
  });

  // Fetch attempts from backend
  const { data: attemptsResponse } = useQuery<{ success: boolean; attempts: any[] }>({
    queryKey: ['/api/attempts'],
    enabled: !!user
  });

  // Use backend attempts if available, otherwise fallback to empty array
  const attempts = attemptsResponse?.attempts || [];

  // Get user progress for this course
  const userProgress = progressResponse?.progress;
  const completedLessons = userProgress?.lessonCompletedIds || [];
  
  // Calculate total lessons
  const totalLessons = course.sections.reduce((total, section) => total + section.lessons.length, 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  // Check if user has certificate for this course
  const hasCertificate = certificates.some(c => c.userId === user?.id && c.courseId === course.id);

  // Get final quiz - filter by countryId if provided
  const finalQuiz = quizzes.find(q => {
    if (!q.isFinal) return false;
    // If countryId is provided, only show final exam for this specific country
    if (countryId) {
      // Match by country ID (most specific)
      if (q.countryId && q.countryId === countryId) return true;
      // If quiz has no country but matches the default course-1, allow it for backward compatibility
      if (!q.countryId && q.courseId === 'course-1') return true;
      return false;
    }
    // If no countryId provided, match by courseId
    if (q.courseId === course.id) return true;
    // Fallback to default course for backward compatibility
    if (q.courseId === 'course-1') return true;
    return false;
  });

  // Get all lesson-level (mini) quizzes for this course
  const miniQuizzes = course.sections.flatMap(section => 
    section.lessons
      .filter(lesson => lesson.quizId)
      .map(lesson => quizzes.find(q => q.id === lesson.quizId))
      .filter((q): q is Quiz => q !== undefined)
  );

  // Check if all mini quizzes have been successfully completed
  const allMiniQuizzesCompleted = miniQuizzes.length > 0 && miniQuizzes.every(quiz => {
    if (!user) return false;
    // Find the best attempt for this quiz
    const quizAttempts = attempts.filter(a => a.userId === user.id && a.quizId === quiz.id);
    if (quizAttempts.length === 0) return false;
    // Check if any attempt passed the quiz
    const bestAttempt = quizAttempts.reduce((best, current) => 
      current.scorePercent > best.scorePercent ? current : best
    );
    return bestAttempt.scorePercent >= quiz.passPercent;
  });

  // Mutation to save lesson completion to backend
  const saveProgressMutation = useMutation({
    mutationFn: async (data: { lessonCompletedIds: string[]; percent: number }) => {
      const response = await apiRequest('POST', '/api/progress', {
        courseId: course.id,
        lessonCompletedIds: data.lessonCompletedIds,
        percent: data.percent
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refetch progress
      queryClient.invalidateQueries({ queryKey: ['/api/progress', course.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress'] });
      
      toast({
        title: 'Lesson Completed',
        description: 'Your progress has been saved.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save your progress.',
        variant: 'destructive'
      });
    }
  });

  useEffect(() => {
    // Auto-select first lesson if none selected
    if (!selectedLesson && course.sections[0]?.lessons[0]) {
      setSelectedLesson(course.sections[0].lessons[0]);
    }
  }, [course, selectedLesson]);

  const handleLessonComplete = (lessonId: string) => {
    if (!user) return;

    const newCompletedIds = [...completedLessons, lessonId];
    const newPercent = Math.round((newCompletedIds.length / totalLessons) * 100);
    
    // Save to backend
    saveProgressMutation.mutate({
      lessonCompletedIds: newCompletedIds,
      percent: newPercent
    });
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
    // Force re-render to update quiz completion status
    setTimeout(() => setRefreshKey(prev => prev + 1), 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Lesson Tree */}
      <div className="lg:col-span-1 space-y-4">
        {/* Stats Card */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {course.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Circular Progress */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">Overall Progress</div>
                <div className="text-2xl font-bold text-primary">{progressPercent}%</div>
                <div className="text-xs text-muted-foreground">{completedLessons.length} of {totalLessons} lessons</div>
              </div>
              <div className="relative w-20 h-20">
                <svg className="transform -rotate-90 w-20 h-20">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-muted/30"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - progressPercent / 100)}`}
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Award className="w-8 h-8 text-primary/60" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections & Lessons */}
        <Card className="h-fit">
          <CardContent className="space-y-6 pt-6">
            {course.sections.map((section, sectionIndex) => (
              <div key={section.id}>
                {/* Section Header */}
                <div className="relative mb-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/30">
                      {section.title.match(/^[A-Z]\d/)?.[0] || `S${sectionIndex + 1}`}
                    </Badge>
                    <h3 className="font-semibold text-sm bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      {section.title}
                    </h3>
                  </div>
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-border via-border/50 to-transparent -z-10" />
                </div>

                {/* Lessons */}
                <div className="space-y-2">
                  {section.lessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isSelected = selectedLesson?.id === lesson.id;
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLesson(lesson)}
                        className={`
                          group relative flex items-center w-full p-3 text-left text-sm rounded-lg transition-all duration-200 hover:-translate-y-0.5
                          ${isSelected 
                            ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20' 
                            : 'hover:bg-accent/50 hover:shadow-sm'
                          }
                        `}
                        data-testid={`button-lesson-${lesson.id}`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 mr-3 shrink-0 text-green-500" />
                        ) : (
                          <BookOpen className="w-5 h-5 mr-3 shrink-0" />
                        )}
                        <span className="truncate flex-1">{lesson.title}</span>
                        {!isSelected && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-primary/0 group-hover:bg-primary/50 transition-colors" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Final Quiz */}
            {finalQuiz && (
              <div className="border-t pt-6">
                <Button
                  onClick={startFinalQuiz}
                  variant="outline"
                  size="sm"
                  className="w-full bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30"
                  disabled={progressPercent < 100 || (miniQuizzes.length > 0 && !allMiniQuizzesCompleted)}
                  data-testid="button-final-quiz"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Final Exam
                  {progressPercent < 100 && ' (Complete all lessons)'}
                  {progressPercent >= 100 && miniQuizzes.length > 0 && !allMiniQuizzesCompleted && ' (Complete all quizzes)'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lesson Content */}
      <div className="lg:col-span-3">
        {selectedLesson ? (
          <Card className="h-fit border-primary/10 bg-gradient-to-br from-card to-card/30">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {completedLessons.includes(selectedLesson.id) ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {selectedLesson.title}
                  </span>
                </CardTitle>
                {completedLessons.includes(selectedLesson.id) && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                    ✓ Completed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Lesson Content */}
              <div 
                className="prose prose-sm max-w-none prose-headings:bg-gradient-to-r prose-headings:from-foreground prose-headings:to-foreground/70 prose-headings:bg-clip-text prose-headings:text-transparent"
                dangerouslySetInnerHTML={{ __html: selectedLesson.html }}
              />

              {/* Quiz Section */}
              {selectedLesson.quizId && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <PlayCircle className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Mini Quiz</h3>
                        <p className="text-sm text-muted-foreground">
                          Test your knowledge before moving forward
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => startQuiz(selectedLesson)}
                      className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20"
                      data-testid={`button-start-quiz-${selectedLesson.id}`}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Quiz
                    </Button>
                  </div>
                </div>
              )}

              {/* Mark Complete Button - Show for all lessons that aren't completed yet */}
              {!completedLessons.includes(selectedLesson.id) && (() => {
                // Check if this lesson has a quiz
                const lessonQuiz = selectedLesson.quizId ? quizzes.find(q => q.id === selectedLesson.quizId) : null;
                
                // If lesson has a quiz, check if user passed it
                let quizPassed = true; // Default to true if no quiz
                if (lessonQuiz && user) {
                  const quizAttempts = attempts.filter(a => a.userId === user.id && a.quizId === lessonQuiz.id);
                  if (quizAttempts.length === 0) {
                    quizPassed = false;
                  } else {
                    const bestAttempt = quizAttempts.reduce((best, current) => 
                      current.scorePercent > best.scorePercent ? current : best
                    );
                    quizPassed = bestAttempt.scorePercent >= lessonQuiz.passPercent;
                  }
                }
                
                return (
                  <div className="border-t pt-6">
                    <Button
                      onClick={() => handleLessonComplete(selectedLesson.id)}
                      className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20"
                      disabled={!quizPassed}
                      data-testid={`button-complete-lesson-${selectedLesson.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Complete
                      {lessonQuiz && !quizPassed && ' (Complete quiz first)'}
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card className="h-96 flex items-center justify-center bg-gradient-to-br from-card to-card/30 border-dashed">
            <div className="text-center">
              <div className="p-6 rounded-full bg-primary/5 w-fit mx-auto mb-4">
                <BookOpen className="w-16 h-16 text-primary/40" />
              </div>
              <p className="text-muted-foreground text-lg">Select a lesson to start learning</p>
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