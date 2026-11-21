import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTrainingCourse, selectFinalQuiz, hasEarnedCourseCertificate } from './training-course';

test('an earned certificate stays valid for its course after the final quiz is replaced',()=>{
  const historic={userId:'agent',courseId:'course-hu',course:{id:'course-hu'},quizId:'old-inactive-final'};
  assert.equal(hasEarnedCourseCertificate('agent','course-hu',[historic]),true);
  assert.equal(hasEarnedCourseCertificate('agent','course-us',[historic]),false);
  assert.equal(hasEarnedCourseCertificate('other-agent','course-hu',[historic]),false);
});
test('course completion is never granted from an anonymous or inconsistent certificate',()=>{
  assert.equal(hasEarnedCourseCertificate(undefined,'course-hu',[{userId:'agent',courseId:'course-hu'}]),false);
  assert.equal(hasEarnedCourseCertificate('agent','course-hu',[]),false);
  assert.equal(hasEarnedCourseCertificate('agent','course-hu',[{userId:'agent',courseId:'course-hu',course:{id:'course-us'}}]),false);
});

const countries = [
  { id: 'hu', name: 'Hungary', code: 'HU', status: 'active' },
  { id: 'us', name: 'U.S.A', code: 'US', status: 'active' },
  { id: 'historic', name: 'Historical destination', code: 'DE', status: 'inactive' },
];

test('existing live country resolver keeps destination names and persisted IDs exactly', () => {
  assert.deepEqual(resolveTrainingCourse('course-us', [], countries), {
    id: 'course-us', title: 'U.S.A — Agent Training', slug: 'us-training',
  });
});

test('an exact registered course retains live resolver precedence', () => {
  const courses = [{ id: 'course-hu', title: 'Registered historical title', slug: 'registered' }];
  assert.deepEqual(resolveTrainingCourse('course-hu', courses, countries), courses[0]);
});

test('inactive country publication does not erase historical certificate identity', () => {
  assert.equal(resolveTrainingCourse('course-historic', [], countries)?.title, 'Historical destination — Agent Training');
});

test('unknown legacy course IDs are never guessed from other destinations', () => {
  assert.equal(resolveTrainingCourse('course-1', [], countries), null);
  assert.equal(resolveTrainingCourse('course-missing', [], countries), null);
});

test('metadata resolution never mutates stored names or source IDs', () => {
  const original = structuredClone(countries);
  resolveTrainingCourse('course-hu', [], countries);
  assert.deepEqual(countries, original);
});

test('a final must match the exact requested country-course identity', () => {
  const quiz = { id: 'hu-final', courseId: 'course-hu', countryId: 'hu', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([quiz], 'course-hu', 'hu'), quiz);
  assert.equal(selectFinalQuiz([quiz], 'course-us', 'us'), undefined);
});

test('an unscoped course-1 final cannot appear in another destination', () => {
  const legacy = { id: 'legacy-final', courseId: 'course-1', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([legacy], 'course-hu', 'hu'), undefined);
  assert.equal(selectFinalQuiz([legacy], 'course-1', 'hu'), undefined);
});

test('a quiz with an explicit foreign country cannot use a matching course ID to leak across destinations', () => {
  const conflicting = { courseId: 'course-hu', countryId: 'us', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([conflicting], 'course-hu', 'hu'), undefined);
});

test('country alone is insufficient when the final has no course identity', () => {
  const missing = { countryId: 'hu', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([missing], 'course-hu', 'hu'), undefined);
});

test('multiple active finals fail closed regardless of array order', () => {
  const one = { id: 'one', courseId: 'course-hu', countryId: 'hu', isFinal: true, status: 'active' };
  const two = { ...one, id: 'two' };
  assert.equal(selectFinalQuiz([one, two], 'course-hu', 'hu'), undefined);
  assert.equal(selectFinalQuiz([two, one], 'course-hu', 'hu'), undefined);
});

test('draft and inactive finals do not displace the single active final', () => {
  const active = { id: 'active', courseId: 'course-hu', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([{ ...active, status: 'draft' }, active, { ...active, status: 'inactive' }], 'course-hu', 'hu'), active);
});

test('an exact registered legacy course may select its own final without a country context', () => {
  const legacy = { courseId: 'course-1', isFinal: true, status: 'active' };
  assert.equal(selectFinalQuiz([legacy], 'course-1'), legacy);
});
