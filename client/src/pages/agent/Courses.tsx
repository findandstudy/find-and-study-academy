import { CourseView } from '@/components/course/CourseView';
import { useDataStore } from '@/store/data';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Content, Country } from '@shared/schema';

export default function AgentCourses() {
  const { courses } = useDataStore();
  const [selectedCountry, setSelectedCountry] = useState<string>('turkey');

  // Fetch countries and contents from admin panel
  const { data: countries = [] } = useQuery({
    queryKey: ['/api/admin/countries'],
    select: (data: any) => data.countries as Country[]
  });

  const { data: contents = [] } = useQuery({
    queryKey: ['/api/admin/contents'],
    select: (data: any) => data.contents as Array<Content & { countryName?: string }>
  });

  // Get active countries that have published content
  const activeCountries = useMemo(() => {
    const countriesWithContent = countries.filter(country => {
      if (country.status !== 'active') return false;
      return contents.some(content => 
        content.countryId === country.id && 
        content.status === 'published'
      );
    });
    
    // Always include Turkey (default course) if not already present
    const hasTurkey = countriesWithContent.some(c => c.code === 'TR');
    if (!hasTurkey) {
      countriesWithContent.unshift({
        id: 'turkey',
        name: 'Turkey',
        code: 'TR',
        flag: '🇹🇷',
        status: 'active' as const,
        description: 'Turkey training course',
        createdAt: new Date()
      });
    }
    
    return countriesWithContent;
  }, [countries, contents]);

  // Get content for selected country
  const selectedCountryData = activeCountries.find(c => 
    c.code.toLowerCase() === selectedCountry || c.id === selectedCountry
  );

  const countryContents = useMemo(() => {
    if (selectedCountry === 'turkey' && !contents.some(c => c.countryId === 'turkey')) {
      // Return default Turkey course if no admin content exists
      return [];
    }
    
    return contents.filter(content => 
      content.countryId === selectedCountryData?.id && 
      content.status === 'published'
    );
  }, [contents, selectedCountryData?.id, selectedCountry]);

  // Create dynamic course or use default
  const dynamicCourse = useMemo(() => {
    if (selectedCountry === 'turkey' && countryContents.length === 0) {
      // Return default Turkey course
      return courses[0];
    }

    if (!selectedCountryData) return null;

    // Create dynamic course from admin contents
    return {
      id: `course-${selectedCountryData.id}`,
      title: `${selectedCountryData.name} Agent Training`,
      slug: `${selectedCountryData.code.toLowerCase()}-training`,
      sections: [{
        id: `section-${selectedCountryData.id}`,
        title: `A1 Destination Countries`,
        lessons: countryContents.map(content => ({
          id: content.id,
          title: content.title,
          html: content.content || `<h2>${content.title}</h2><p>${content.description}</p>`,
          quizId: content.type === 'quiz' ? content.id : undefined
        }))
      }]
    };
  }, [selectedCountryData, countryContents, courses, selectedCountry]);

  if (activeCountries.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No courses available</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Courses</h1>
        <p className="text-muted-foreground mt-1">
          Complete your agent training and earn certificates.
        </p>
      </div>

      <Tabs value={selectedCountry} onValueChange={setSelectedCountry} className="w-full">
        <TabsList className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full">
          {activeCountries.map((country) => (
            <TabsTrigger 
              key={country.id} 
              value={country.code.toLowerCase()}
              className="flex items-center gap-2"
              data-testid={`tab-country-${country.code.toLowerCase()}`}
            >
              <span>{country.flag}</span>
              <span>{country.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {activeCountries.map((country) => (
          <TabsContent 
            key={country.id} 
            value={country.code.toLowerCase()}
            className="space-y-6"
          >
            {dynamicCourse ? (
              <CourseView course={dynamicCourse} />
            ) : (
              <Card className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No content available for {country.name}
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}