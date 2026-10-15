import { createHash } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { storage } from './storage';
import { quizTranslations, type Quiz } from '@shared/schema';
import { isSupportedLanguage } from '@shared/languages';
import { mergeQuestionTranslations, parseQuizQuestions } from '@shared/quiz-localization';

export function quizSourceHash(quiz: Pick<Quiz, 'title' | 'description' | 'questions'>): string {
  return createHash('sha256').update(JSON.stringify({
    title: quiz.title, description: quiz.description ?? null, questions: parseQuizQuestions(quiz.questions),
  })).digest('hex');
}

export async function localizeQuizzes(quizzes: Quiz[], language: string) {
  const translations = language === 'en' ? [] : await db.select().from(quizTranslations)
    .where(and(eq(quizTranslations.language, language), eq(quizTranslations.status, 'published')));
  const byId = new Map(translations.map(item => [item.quizId, item]));
  return quizzes.map(quiz => {
    const base = { ...quiz, questions: parseQuizQuestions(quiz.questions) };
    const translated = byId.get(quiz.id);
    // A source edit makes the old translation stale. Serve the source until
    // the translation is reviewed, rather than grading mismatched questions.
    if (!translated || translated.sourceHash !== quizSourceHash(quiz)) return base;
    try {
      return { ...base, title: translated.title, description: translated.description,
        questions: mergeQuestionTranslations(base.questions, JSON.parse(translated.questions)) };
    } catch {
      return base;
    }
  });
}

const translationSchema = z.object({
  title: z.string().trim().min(1).max(1000),
  description: z.string().max(20000).nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  questions: z.array(z.object({
    id: z.string(), text: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).optional(),
    explanation: z.string().optional(),
  }).strict()).min(1),
}).strict();

export function registerQuizTranslationRoutes(app: Express, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  app.get('/api/admin/quizzes/:id/translations', requireAuth, requireAdmin, async (req, res) => {
    try {
      const quiz = await storage.getQuizById(req.params.id);
      if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
      const rows = await db.select().from(quizTranslations).where(eq(quizTranslations.quizId, quiz.id));
      const sourceHash = quizSourceHash(quiz);
      res.json({ success: true, sourceHash, translations: rows.map(row => ({ ...row,
        questions: JSON.parse(row.questions), stale: row.sourceHash !== sourceHash,
      })) });
    } catch {
      res.status(500).json({ success: false, message: 'Could not load quiz translations' });
    }
  });

  app.put('/api/admin/quizzes/:id/translations/:language', requireAuth, requireAdmin, async (req, res) => {
    if (!isSupportedLanguage(req.params.language) || req.params.language === 'en') {
      return res.status(400).json({ success: false, message: 'Choose a supported translation language' });
    }
    const parsed = translationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid translation', errors: parsed.error.errors });
    try {
      // Keep the source locked while validating and saving, so a simultaneous
      // source edit cannot leave a newly published translation out of date.
      const saved = await db.transaction(async tx => {
        const { quizzes: quizTable } = await import('@shared/schema');
        const [quiz] = await tx.select().from(quizTable).where(eq(quizTable.id, req.params.id)).for('share');
        if (!quiz) throw new Error('Quiz not found');
        const sourceHash = quizSourceHash(quiz);
        if (sourceHash !== parsed.data.sourceHash) throw new Error('The source quiz changed. Reload before saving.');
        mergeQuestionTranslations(parseQuizQuestions(quiz.questions), parsed.data.questions);
        const values = { quizId: quiz.id, language: req.params.language, ...parsed.data,
          description: parsed.data.description ?? null, questions: JSON.stringify(parsed.data.questions), updatedAt: new Date() };
        const [row] = await tx.insert(quizTranslations).values(values).onConflictDoUpdate({
          target: [quizTranslations.quizId, quizTranslations.language], set: values,
        }).returning();
        return { ...row, questions: parsed.data.questions };
      });
      res.json({ success: true, translation: saved });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save quiz translation';
      res.status(message === 'Quiz not found' ? 404 : message.includes('source quiz changed') ? 409 : 400).json({ success: false, message });
    }
  });
}
