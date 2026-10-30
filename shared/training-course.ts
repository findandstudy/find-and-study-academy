export interface TrainingCourseSummary { id: string; title: string; slug?: string }
export interface TrainingCountry { id: string; name: string; code: string }

/** Read-only metadata lookup; never reissue or reassign a certificate. */
export function resolveTrainingCourse(courseId: string, courses: readonly TrainingCourseSummary[], countries: readonly TrainingCountry[]): TrainingCourseSummary | null {
  const stored = courses.find(course => course.id === courseId);
  if (stored) return { id: stored.id, title: stored.title, slug: stored.slug };
  const country = countries.find(country => `course-${country.id}` === courseId);
  if (!country) return null;
  // Current publication status must not erase a historical certificate's identity.
  return { id: courseId, title: `${country.name} — Agent Training`, slug: `${country.code.toLowerCase()}-training` };
}

export function trainingCourseHref(courseId: string): string {
  return `/agent/courses?${new URLSearchParams({ course: courseId })}`;
}

export function requestedTrainingCourse(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has('course')) return null;
  const course = params.get('course');
  // An invalid explicit target must not become an unrelated default course.
  return course && course.length <= 200 ? course : '';
}

export function firstUnfinishedLesson<T extends { id: string }>(lessons: readonly T[], completedIds: readonly string[]): T | null {
  const completed = new Set(completedIds);
  return lessons.find(lesson => !completed.has(lesson.id)) ?? lessons[0] ?? null;
}
