import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeQuestionTranslations, parseQuizQuestions } from './quiz-localization';

const questions = [
  { id: 'first', type: 'boolean', text: 'Source statement', answer: true },
  { id: 'second', type: 'mcq', text: 'Source question', options: ['First', 'Second'], answerIndex: 1, explanation: 'Reason' },
];

test('legacy nested JSON produces the same questions without changing answer keys', () => {
  assert.deepEqual(parseQuizQuestions(JSON.stringify(JSON.stringify(questions))), questions);
  assert.throws(() => parseQuizQuestions('{broken'));
  assert.throws(() => parseQuizQuestions('{}'));
  const duplicateInput = [...questions, questions[0]];
  const repaired = parseQuizQuestions(duplicateInput);
  assert.deepEqual(repaired.map(q => q.id), ['first', 'second', 'first__duplicate_3']);
  assert.equal(duplicateInput[2].id, 'first');
});

test('translations preserve IDs, types, answer keys and source data', () => {
  const base = parseQuizQuestions(questions);
  const translated = mergeQuestionTranslations(base, [
    { id: 'first', text: 'Çevrilen ifade' },
    { id: 'second', text: 'Çevrilen soru', options: ['Birinci', 'İkinci'], explanation: 'Gerekçe' },
  ]);
  assert.equal(translated[0].id, 'first');
  assert.equal(translated[0].type === 'boolean' && translated[0].answer, true);
  assert.equal(translated[1].type === 'mcq' && translated[1].answerIndex, 1);
  assert.deepEqual(base, questions);
});

test('incomplete, reordered or structurally incompatible translations cannot be published', () => {
  const base = parseQuizQuestions(questions);
  assert.throws(() => mergeQuestionTranslations(base, []));
  assert.throws(() => mergeQuestionTranslations(base, [{ id: 'second', text: 'X' }, { id: 'first', text: 'Y' }]));
  assert.throws(() => mergeQuestionTranslations(base, [{ id: 'first', text: 'X' }, { id: 'second', text: 'Y', options: ['A'], explanation: 'Z' }]));
  assert.throws(() => mergeQuestionTranslations(base, [{ id: 'first', text: 'X' }, { id: 'second', text: 'Y', options: ['A', 'B'] }]));
});
