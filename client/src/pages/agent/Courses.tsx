import { CourseView } from '@/components/course/CourseView';
import { useDataStore } from '@/store/data';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

export default function AgentCourses() {
  const { courses } = useDataStore();

  if (courses.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No courses available</p>
        </div>
      </Card>
    );
  }

  // For now, show the first course (Turkey training)
  const course = courses[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Courses</h1>
        <p className="text-muted-foreground mt-1">
          Complete your agent training and earn certificates.
        </p>
      </div>

      <CourseView course={course} />
    </div>
  );
}