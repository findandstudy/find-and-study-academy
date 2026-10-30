import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstUnfinishedLesson, requestedTrainingCourse, resolveTrainingCourse, trainingCourseHref } from '../shared/training-course';

test('continue links round-trip exact course identity, including reserved URL characters', () => {
  for (const id of ['course-latvia-id', 'stored-course', 'course-a&b +/漢字']) {
    const url = new URL(trainingCourseHref(id), 'https://academy.example');
    assert.equal(url.pathname, '/agent/courses');
    assert.equal(requestedTrainingCourse(url.search), id);
  }
});

test('missing target is distinct from an invalid explicit target; no default-course substitution', () => {
  assert.equal(requestedTrainingCourse(''), null);
  assert.equal(requestedTrainingCourse('?lang=tr'), null);
  for (const query of ['?course=', `?course=${'x'.repeat(201)}`]) assert.equal(requestedTrainingCourse(query), '');
  assert.equal(requestedTrainingCourse('?course=unknown'), 'unknown');
});

test('resume chooses first unfinished lesson in curriculum order, independent of completion receipt order', () => {
  const lessons = [{ id: 'intro' }, { id: 'second' }, { id: 'third' }];
  assert.equal(firstUnfinishedLesson(lessons, ['third', 'intro']), lessons[1]);
  assert.equal(firstUnfinishedLesson(lessons, ['obsolete-lesson']), lessons[0]);
  assert.equal(firstUnfinishedLesson(lessons, []), lessons[0]);
  assert.equal(firstUnfinishedLesson(lessons, lessons.map(lesson => lesson.id)), lessons[0]);
  assert.equal(firstUnfinishedLesson([], []), null);
});

test('certificate metadata resolves stored courses before generated country courses', () => {
  const courses = [{ id: 'course-tr', title: 'Original course title', slug: 'original' }];
  const countries = [{ id: 'tr', name: 'Türkiye', code: 'TR' }, { id: 'lv', name: 'Latvia', code: 'LV' }];
  assert.deepEqual(resolveTrainingCourse('course-tr', courses, countries), courses[0]);
  assert.deepEqual(resolveTrainingCourse('course-lv', courses, countries), {
    id: 'course-lv', title: 'Latvia — Agent Training', slug: 'lv-training',
  });
});

test('historical country certificate remains identifiable regardless of current publication status', () => {
  const countries = [{ id: 'retired', name: 'Historical destination', code: 'LV', isActive: false }];
  const before = JSON.stringify(countries);
  assert.equal(resolveTrainingCourse('course-retired', [], countries)?.title, 'Historical destination — Agent Training');
  assert.equal(JSON.stringify(countries), before);
  assert.equal(resolveTrainingCourse('course-unknown', [], countries), null);
  assert.equal(resolveTrainingCourse('retired', [], countries), null);
});
