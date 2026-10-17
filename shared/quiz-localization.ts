import { frontendQuestionSchema, type FrontendQuestion } from './schema';

export type QuizQuestion = FrontendQuestion & { explanation?: string };
export interface QuestionTranslation {
  id: string;
  text: string;
  options?: string[];
  explanation?: string;
}

// Older records contain JSON serialized twice. Decode without rewriting them.
export function parseQuizQuestions(value: unknown): QuizQuestion[] {
  if (value == null || value === '') return [];
  for (let depth = 0; depth < 4 && typeof value === 'string'; depth++) {
    value = JSON.parse(value);
  }
  if (!Array.isArray(value)) throw new Error('Quiz questions must be an array');
  const ids = new Set<string>();
  const reservedIds = new Set(value.map(item => item?.id));
  return value.map((item, index) => {
    const parsed = frontendQuestionSchema.parse(item);
    // Four legacy quizzes reuse q2 for two different questions. Give only the
    // duplicate a stable runtime ID so answers cannot overwrite one another.
    // Leave persisted questions and every already unique ID untouched.
    if (ids.has(parsed.id)) {
      let candidate = `${parsed.id}__duplicate_${index + 1}`;
      while (reservedIds.has(candidate) || ids.has(candidate)) candidate += '_';
      parsed.id = candidate;
    }
    ids.add(parsed.id);
    if (parsed.type === 'mcq' && (!Number.isInteger(parsed.answerIndex) || parsed.answerIndex >= parsed.options.length)) {
      throw new Error('Invalid correct option index');
    }
    return { ...item, ...parsed };
  });
}

// Only text can change. IDs, types, answer keys and question/option order stay
// in the base quiz, so existing attempts and grading remain compatible.
export function mergeQuestionTranslations(base: QuizQuestion[], translated: QuestionTranslation[]): QuizQuestion[] {
  if (base.length !== translated.length) throw new Error('Question count must match the source');
  return base.map((question, index) => {
    const localized = translated[index];
    if (!localized || localized.id !== question.id) throw new Error('Question IDs and order must match the source');
    if (!localized.text?.trim()) throw new Error('Every question needs translated text');
    if (question.explanation && !localized.explanation?.trim()) throw new Error('Every source explanation must be translated');
    if (question.type === 'mcq') {
      if (localized.options?.length !== question.options.length || localized.options.some(s => !s.trim())) {
        throw new Error('Every answer option must be translated in its original position');
      }
    } else if (localized.options !== undefined) {
      throw new Error('True/false questions cannot have options');
    }
    return {
      ...question,
      text: localized.text,
      ...(question.type === 'mcq' ? { options: localized.options! } : {}),
      ...(localized.explanation !== undefined ? { explanation: localized.explanation } : {}),
    };
  });
}
