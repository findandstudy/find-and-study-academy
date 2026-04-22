import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Award, 
  Plus, 
  Search, 
  Pencil, 
  Trash2,
  HelpCircle,
  CheckCircle,
  XCircle,
  GripVertical,
  Brain,
  Target,
  ArrowUpDown,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { 
  insertQuizSchema, 
  frontendQuestionSchema,
  type Quiz, 
  type InsertQuiz,
  type QuizDTO,
  type InsertQuizDTO,
  type FrontendQuestion
} from '@shared/schema';
import { z } from 'zod';

// Use shared question schema from shared/schema.ts

const quizFormSchema = insertQuizSchema.extend({
  questions: z.array(frontendQuestionSchema).min(1, 'At least 1 question required')
}).refine(
  (data) => {
    // If quiz is a final exam, countryId is required
    if (data.isFinal && !data.countryId) {
      return false;
    }
    return true;
  },
  {
    message: 'Country is required for Final Exams',
    path: ['countryId']
  }
);

type QuizFormData = z.infer<typeof quizFormSchema>;
type Question = FrontendQuestion;

export default function AdminQuizzes() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizDTO | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'final' | 'regular'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'questions-desc' | 'questions-asc' | 'pass-desc' | 'pass-asc'>('title-asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Queries
  const { data: countries = [] } = useQuery({
    queryKey: ['/api/public/countries'],
    select: (data) => data.countries || []
  });
  
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
    queryKey: ['/api/admin/quizzes'],
    select: (data) => {
      // Backend already parses questions JSON - use directly as array
      return data.quizzes.map((quiz: any) => ({
        ...quiz,
        questions: quiz.questions || []  // Already parsed by backend
      })) as QuizDTO[];
    }
  });

  // Quiz form
  const quizForm = useForm<QuizFormData>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      id: '',
      title: '',
      courseId: 'course-1',
      countryId: undefined,
      isFinal: false,
      passPercent: 70,
      description: '',
      status: 'active',
      order: 0,
      questions: [
        {
          id: 'q1',
          type: 'boolean',
          text: '',
          answer: true
        }
      ]
    }
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: quizForm.control,
    name: 'questions'
  });

  // Watch all questions to get dynamic options (fix for hooks error)
  const watchedQuestions = useWatch({
    control: quizForm.control,
    name: 'questions',
    defaultValue: quizForm.getValues('questions') || []
  });

  // Mutations
  const createQuizMutation = useMutation({
    mutationFn: async (data: QuizFormData) => {
      // Convert questions array to JSON string for storage (same as update mutation)
      const serializedData = {
        ...data,
        questions: JSON.stringify(data.questions || [])
      };
      
      const response = await apiRequest('POST', '/api/admin/quizzes', serializedData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Quiz created successfully' });
      setIsQuizDialogOpen(false);
      quizForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create quiz', variant: 'destructive' });
    }
  });

  const updateQuizMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuizFormData> }) => {
      // Convert questions array to JSON string for storage (same as create mutation)
      const serializedData = {
        ...data,
        ...(data.questions && {
          questions: JSON.stringify(data.questions)
        })
      };
      
      const response = await apiRequest('PATCH', `/api/admin/quizzes/${id}`, serializedData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Quiz updated successfully' });
      setIsQuizDialogOpen(false);
      setEditingQuiz(null);
      quizForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update quiz', variant: 'destructive' });
    }
  });

  const deleteQuizMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/quizzes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Quiz deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete quiz', variant: 'destructive' });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/admin/quizzes/${id}`)));
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: `${selectedIds.size} quiz deleted` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Bulk delete failed', variant: 'destructive' });
    }
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => apiRequest('PATCH', `/api/admin/quizzes/${id}`, { status })));
    },
    onSuccess: (_d, vars) => {
      toast({ title: 'Updated', description: `${selectedIds.size} quiz set to ${vars.status}` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Bulk update failed', variant: 'destructive' });
    }
  });

  // Filter + sort quizzes
  const filteredQuizzes = useMemo(() => {
    let list = quizzes.filter(quiz => {
      const matchSearch =
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (quiz.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchType =
        filterType === 'all' ||
        (filterType === 'final' && quiz.isFinal) ||
        (filterType === 'regular' && !quiz.isFinal);
      const matchStatus = filterStatus === 'all' || quiz.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'title-asc': return a.title.localeCompare(b.title);
        case 'title-desc': return b.title.localeCompare(a.title);
        case 'questions-desc': return (b.questions?.length || 0) - (a.questions?.length || 0);
        case 'questions-asc': return (a.questions?.length || 0) - (b.questions?.length || 0);
        case 'pass-desc': return (b.passPercent || 0) - (a.passPercent || 0);
        case 'pass-asc': return (a.passPercent || 0) - (b.passPercent || 0);
        default: return 0;
      }
    });
    return list;
  }, [quizzes, searchQuery, filterType, filterStatus, sortBy]);

  // Selection helpers
  const allVisibleSelected = filteredQuizzes.length > 0 && filteredQuizzes.every(q => selectedIds.has(q.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuizzes.map(q => q.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Form handlers
  const onSubmit = (data: QuizFormData) => {
    // For Final Exams, automatically set courseId based on countryId
    const submissionData = {
      ...data,
      courseId: data.isFinal && data.countryId 
        ? `course-${data.countryId}` 
        : data.courseId
    };
    
    if (editingQuiz) {
      updateQuizMutation.mutate({ id: editingQuiz.id, data: submissionData });
    } else {
      createQuizMutation.mutate(submissionData);
    }
  };

  const openQuizDialog = (quiz?: QuizDTO) => {
    if (quiz) {
      setEditingQuiz(quiz);
      // Ensure questions are properly formatted - they should already be an array from backend
      const questionsArray = Array.isArray(quiz.questions) 
        ? quiz.questions 
        : (typeof quiz.questions === 'string' 
          ? JSON.parse(quiz.questions) 
          : []);
      
      quizForm.reset({
        id: quiz.id || '',
        title: quiz.title || '',
        courseId: quiz.courseId || 'course-1',
        countryId: quiz.countryId || undefined,
        isFinal: quiz.isFinal || false,
        passPercent: quiz.passPercent || 70,
        description: quiz.description || '',
        status: quiz.status || 'draft',
        order: quiz.order || 0,
        questions: questionsArray
      });
    } else {
      setEditingQuiz(null);
      quizForm.reset({
        id: '',
        title: '',
        courseId: 'course-1',
        countryId: undefined,
        isFinal: false,
        passPercent: 70,
        description: '',
        status: 'active',
        order: 0,
        questions: [
          {
            id: 'q1',
            type: 'boolean',
            text: '',
            answer: true
          }
        ]
      });
    }
    setIsQuizDialogOpen(true);
  };

  const handleDeleteQuiz = (id: string) => {
    if (window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      deleteQuizMutation.mutate(id);
    }
  };

  const addQuestion = (type: 'boolean' | 'mcq') => {
    const newQuestion: Question = type === 'boolean' 
      ? {
          id: `q${questionFields.length + 1}`,
          type: 'boolean',
          text: '',
          answer: true
        }
      : {
          id: `q${questionFields.length + 1}`,
          type: 'mcq',
          text: '',
          options: ['Option 1', 'Option 2'], // Pre-filled to avoid validation issues
          answerIndex: 0
        };
    
    appendQuestion(newQuestion);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      draft: 'secondary',
      inactive: 'destructive'
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getQuestionTypeIcon = (type: string) => {
    return type === 'boolean' ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <HelpCircle className="w-4 h-4 text-blue-600" />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Quiz Management</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage quizzes for agent training and certification.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Quiz Library
            </CardTitle>
            <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openQuizDialog()} data-testid="button-add-quiz">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
                  </DialogTitle>
                </DialogHeader>
                <Form {...quizForm}>
                  <form onSubmit={quizForm.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Basic Quiz Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={quizForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quiz Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Quiz title" {...field} data-testid="input-quiz-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quizForm.control}
                        name="id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quiz ID (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="quiz-id" {...field} data-testid="input-quiz-id" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={quizForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Quiz description..." 
                              {...field} 
                              data-testid="textarea-quiz-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={quizForm.control}
                        name="passPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pass Percentage</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                placeholder="70" 
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                data-testid="input-quiz-pass-percent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quizForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-quiz-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={quizForm.control}
                        name="isFinal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quiz Type</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === 'true')} value={field.value ? 'true' : 'false'}>
                              <FormControl>
                                <SelectTrigger data-testid="select-quiz-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="false">Regular Quiz</SelectItem>
                                <SelectItem value="true">Final Exam</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quizForm.control}
                        name="countryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Country {quizForm.watch('isFinal') && <span className="text-destructive">*</span>}
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger data-testid="select-quiz-country">
                                  <SelectValue placeholder="Select country (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {countries.map((country: any) => (
                                  <SelectItem key={country.id} value={country.id}>
                                    {country.flag} {country.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {quizForm.watch('isFinal') && (
                              <p className="text-xs text-muted-foreground">
                                Required for Final Exams - specifies which country this exam is for
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Questions Section */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Questions ({questionFields.length})
                        </h3>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => addQuestion('boolean')}
                            data-testid="button-add-boolean-question"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Add True/False
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => addQuestion('mcq')}
                            data-testid="button-add-mcq-question"
                          >
                            <HelpCircle className="w-4 h-4 mr-1" />
                            Add Multiple Choice
                          </Button>
                        </div>
                      </div>

                      {questionFields.map((field, index) => (
                        <Card key={field.id} className="p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">Question {index + 1}</span>
                              {getQuestionTypeIcon(field.type)}
                              <Badge variant="outline">{field.type === 'boolean' ? 'True/False' : 'Multiple Choice'}</Badge>
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeQuestion(index)}
                              data-testid={`button-remove-question-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <FormField
                            control={quizForm.control}
                            name={`questions.${index}.text`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Question Text</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Enter your question..." 
                                    {...field} 
                                    data-testid={`textarea-question-text-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {field.type === 'boolean' ? (
                            <FormField
                              control={quizForm.control}
                              name={`questions.${index}.answer`}
                              render={({ field }) => (
                                <FormItem className="mt-4">
                                  <FormLabel>Correct Answer</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(value === 'true')} value={field.value ? 'true' : 'false'}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-boolean-answer-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="true">True</SelectItem>
                                      <SelectItem value="false">False</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : (
                            <div className="mt-4 space-y-3">
                              <FormLabel>Answer Options</FormLabel>
                              {(() => {
                                // Get current options from top-level watched questions (fixes hooks error)
                                const currentOptions = watchedQuestions[index]?.options || field.options || ['', ''];
                                
                                return currentOptions.map((option: string, optionIndex: number) => (
                                <div key={optionIndex} className="flex gap-2 items-center">
                                  <FormField
                                    control={quizForm.control}
                                    name={`questions.${index}.answerIndex`}
                                    render={({ field: answerField }) => (
                                      <FormControl>
                                        <input
                                          type="radio"
                                          checked={answerField.value === optionIndex}
                                          onChange={() => answerField.onChange(optionIndex)}
                                          data-testid={`radio-answer-${index}-${optionIndex}`}
                                        />
                                      </FormControl>
                                    )}
                                  />
                                  <FormField
                                    control={quizForm.control}
                                    name={`questions.${index}.options.${optionIndex}`}
                                    render={({ field: optionField }) => (
                                      <FormControl>
                                        <Input 
                                          placeholder={`Option ${optionIndex + 1}`} 
                                          {...optionField} 
                                          data-testid={`input-option-${index}-${optionIndex}`}
                                        />
                                      </FormControl>
                                    )}
                                  />
                                  {currentOptions && currentOptions.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentOptions = quizForm.getValues(`questions.${index}.options`);
                                        const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
                                        quizForm.setValue(`questions.${index}.options`, newOptions);
                                        
                                        const currentAnswerIndex = quizForm.getValues(`questions.${index}.answerIndex`);
                                        if (currentAnswerIndex >= optionIndex && currentAnswerIndex > 0) {
                                          quizForm.setValue(`questions.${index}.answerIndex`, currentAnswerIndex - 1);
                                        }
                                      }}
                                      data-testid={`button-remove-option-${index}-${optionIndex}`}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                ));
                              })()}
                              
                              {(() => {
                                // Get current options from top-level watched questions (fixes hooks error)
                                const currentOptions = watchedQuestions[index]?.options || field.options || ['', ''];
                                
                                return currentOptions && currentOptions.length < 6 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentOptions = quizForm.getValues(`questions.${index}.options`);
                                    const newOptionIndex = currentOptions.length + 1;
                                    quizForm.setValue(`questions.${index}.options`, [...currentOptions, `Option ${newOptionIndex}`]);
                                  }}
                                  data-testid={`button-add-option-${index}`}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Option
                                </Button>
                                );
                              })()}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsQuizDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createQuizMutation.isPending || updateQuizMutation.isPending || !quizForm.formState.isValid}
                        data-testid="button-save-quiz"
                      >
                        {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {/* Search + Filter + Sort row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search quizzes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-quizzes"
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery('')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Select value={filterType} onValueChange={(v) => { setFilterType(v as any); setSelectedIds(new Set()); }}>
              <SelectTrigger className="w-40" data-testid="select-filter-type">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="final">Final Exam</SelectItem>
                <SelectItem value="regular">Regular Quiz</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setSelectedIds(new Set()); }}>
              <SelectTrigger className="w-36" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44" data-testid="select-sort-by">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title-asc">Title A→Z</SelectItem>
                <SelectItem value="title-desc">Title Z→A</SelectItem>
                <SelectItem value="questions-desc">Most Questions</SelectItem>
                <SelectItem value="questions-asc">Fewest Questions</SelectItem>
                <SelectItem value="pass-desc">Pass % High→Low</SelectItem>
                <SelectItem value="pass-asc">Pass % Low→High</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredQuizzes.length} of {quizzes.length}
            </span>
          </div>

          {/* Bulk actions bar */}
          {someSelected && (
            <div className="flex flex-wrap items-center gap-2 mt-3 px-3 py-2 bg-muted/50 border rounded-md">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Separator orientation="vertical" className="h-4" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'active' })}
                disabled={bulkStatusMutation.isPending}
                data-testid="button-bulk-activate"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Set Active
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'draft' })}
                disabled={bulkStatusMutation.isPending}
                data-testid="button-bulk-draft"
              >
                Set Draft
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (window.confirm(`Delete ${selectedIds.size} selected quiz(zes)?`)) {
                    bulkDeleteMutation.mutate(Array.from(selectedIds));
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
                <X className="w-3.5 h-3.5 mr-1" />
                Deselect All
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {quizzesLoading ? (
            <div className="text-center py-4">Loading quizzes...</div>
          ) : (
            <div className="space-y-2">
              {/* Select-all header */}
              {filteredQuizzes.length > 0 && (
                <div className="flex items-center gap-3 px-2 pb-1 border-b">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-xs text-muted-foreground">Select all ({filteredQuizzes.length})</span>
                </div>
              )}

              {filteredQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg hover-elevate transition-colors ${selectedIds.has(quiz.id) ? 'bg-muted/40 border-primary/30' : ''}`}
                >
                  <Checkbox
                    checked={selectedIds.has(quiz.id)}
                    onCheckedChange={() => toggleSelect(quiz.id)}
                    data-testid={`checkbox-quiz-${quiz.id}`}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    {quiz.isFinal ? (
                      <Target className="w-5 h-5 text-orange-600" />
                    ) : (
                      <Brain className="w-5 h-5 text-blue-600" />
                    )}
                    <Badge variant={quiz.isFinal ? 'destructive' : 'secondary'}>
                      {quiz.isFinal ? 'Final Exam' : 'Regular Quiz'}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{quiz.title}</div>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span>{quiz.questions?.length || 0} questions</span>
                      <span>Pass: {quiz.passPercent}%</span>
                      {getStatusBadge(quiz.status)}
                    </div>
                    {quiz.description && (
                      <div className="text-sm text-muted-foreground mt-0.5 truncate">{quiz.description}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => openQuizDialog(quiz)}
                      data-testid={`button-edit-quiz-${quiz.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      data-testid={`button-delete-quiz-${quiz.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredQuizzes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                    ? 'No quizzes match the current filters.'
                    : 'No quizzes created yet.'}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}