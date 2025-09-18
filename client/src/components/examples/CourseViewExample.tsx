import { CourseView } from '../course/CourseView';
import { AgentLayout } from '../layouts/AgentLayout';
import { SEED_COURSES } from '../../data/seed';

export default function CourseViewExample() {
  return (
    <AgentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Course Example</h1>
          <p className="text-muted-foreground mt-1">Turkey training course with interactive content</p>
        </div>
        <CourseView course={SEED_COURSES[0]} />
      </div>
    </AgentLayout>
  );
}