import { legacyUi, legacyMessage } from "@/lib/legacy-ui";
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { QuizDTO } from '@shared/schema';
import { mergeQuestionTranslations, parseQuizQuestions, type QuestionTranslation } from '@shared/quiz-localization';
import { normalizeLanguage, SUPPORTED_LANGUAGES, getLanguageMeta } from '@/i18n/languages';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Translation {
  language: string;
  title: string;
  description: string | null;
  questions: QuestionTranslation[];
  status: 'draft' | 'published';
  stale: boolean;
}
interface TranslationResponse {
  sourceHash: string;
  translations: Translation[];
}

export function QuizTranslationEditor({ quiz, onClose }: { quiz: QuizDTO; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const initial = normalizeLanguage(i18n.language);
  const [language, setLanguage] = useState<string>(initial === 'en' ? 'tr' : initial);
  const [form, setForm] = useState({ title: '', description: '', status: 'draft' as 'draft' | 'published', questions: [] as QuestionTranslation[] });
  const base = parseQuizQuestions(quiz.questions);
  const url = `/api/admin/quizzes/${encodeURIComponent(quiz.id)}/translations`;
  const { data, isFetching, error } = useQuery<TranslationResponse>({
    queryKey: [url], queryFn: async () => (await apiRequest('GET', url)).json(),
  });
  const existing = data?.translations.find(item => item.language === language);

  useEffect(() => {
    const saved = data?.translations.find(item => item.language === language);
    const questions = parseQuizQuestions(quiz.questions).map(question => {
      const translated = saved?.questions.find(item => item.id === question.id);
      return {
        id: question.id, text: translated?.text ?? '',
        ...(question.type === 'mcq' ? { options: question.options.map((_, index) => translated?.options?.[index] ?? '') } : {}),
        ...(question.explanation ? { explanation: translated?.explanation ?? '' } : {}),
      };
    });
    setForm({ title: saved?.title ?? '', description: saved?.description ?? '', status: saved?.status ?? 'draft', questions });
  }, [data, language, quiz]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.sourceHash || !form.title.trim()) throw new Error(legacyUi("A translated title is required"));
      mergeQuestionTranslations(base, form.questions);
      return (await apiRequest('PUT', `${url}/${language}`, { ...form, sourceHash: data.sourceHash })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/quizzes'] });
      toast({ title: t('toast.saved') });
    },
    onError: error => toast({ title: t('toast.failed'), description: legacyMessage(error.message), variant: 'destructive' }),
  });

  const updateQuestion = (index: number, patch: Partial<QuestionTranslation>) => setForm(previous => ({
    ...previous, questions: previous.questions.map((question, i) => i === index ? { ...question, ...patch } : question),
  }));

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t('contentEditor.title', { defaultValue: 'Quiz translations' })} — {quiz.title}</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-3">
        <Select value={language} onValueChange={value => setLanguage(normalizeLanguage(value))}>
          <SelectTrigger className="w-56" aria-label={t('language.select')}><SelectValue /></SelectTrigger>
          <SelectContent>{SUPPORTED_LANGUAGES.filter(item => item.code !== 'en').map(item => <SelectItem key={item.code} value={item.code}>{item.nativeLabel}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={form.status} onValueChange={value => setForm(previous => ({ ...previous, status: value as 'draft' | 'published' }))}>
          <SelectTrigger className="w-40" aria-label={t('common.status')}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="draft">{t('common.draft')}</SelectItem><SelectItem value="published">{t('common.published')}</SelectItem></SelectContent>
        </Select>
      </div>
      {error && <p role="alert" className="text-destructive">{legacyMessage(error.message)}</p>}
      {existing?.stale && <p role="alert" className="text-amber-700">{legacyUi("The source quiz changed. Review every question before publishing this translation.")}</p>}
      {isFetching ? <p>{t('common.loading')}</p> : <div className="space-y-5" dir={getLanguageMeta(language).dir}>
        <div className="space-y-2"><Label htmlFor="quiz-translation-title">{t('common.title')}</Label><p className="text-sm text-muted-foreground" dir="auto">{quiz.title}</p><Input id="quiz-translation-title" value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></div>
        <div className="space-y-2"><Label htmlFor="quiz-translation-description">{t('common.description')}</Label><p className="text-sm text-muted-foreground" dir="auto">{quiz.description}</p><Textarea id="quiz-translation-description" value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} /></div>
        {base.map((question, index) => <fieldset key={question.id} className="space-y-3 rounded-lg border p-4">
          <legend className="px-2 font-semibold">{index + 1}</legend>
          <p dir="auto" className="text-sm text-muted-foreground">{question.text}</p>
          <Textarea aria-label={legacyUi("Question {value0}",{value0:index + 1})} value={form.questions[index]?.text ?? ''} onChange={event => updateQuestion(index, { text: event.target.value })} />
          {question.type === 'mcq' && question.options.map((option, optionIndex) => <div key={optionIndex} className="space-y-1">
            <p dir="auto" className="text-sm text-muted-foreground">{optionIndex + 1}. {option}</p>
            <Input aria-label={legacyUi("Question {value0}, option {value1}",{value0:index + 1,value1:optionIndex + 1})} value={form.questions[index]?.options?.[optionIndex] ?? ''} onChange={event => {
              const options = [...(form.questions[index]?.options ?? [])]; options[optionIndex] = event.target.value; updateQuestion(index, { options });
            }} />
          </div>)}
          {question.explanation && <div className="space-y-1"><p dir="auto" className="text-sm text-muted-foreground">{question.explanation}</p><Textarea aria-label={legacyUi("Question {value0}, explanation",{value0:index + 1})} value={form.questions[index]?.explanation ?? ''} onChange={event => updateQuestion(index, { explanation: event.target.value })} /></div>}
        </fieldset>)}
      </div>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{t('common.close')}</Button><Button disabled={isFetching || !!error || save.isPending || !data || !base.length} onClick={() => save.mutate()}>{t(save.isPending ? 'common.saving' : 'common.save')}</Button></div>
    </DialogContent>
  </Dialog>;
}
