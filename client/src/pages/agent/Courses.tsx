import { CourseView } from '@/components/course/CourseView';
import { useDataStore } from '@/store/data';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Content, Country } from '@shared/schema';
import { CountryFlag } from '@/components/CountryFlag';
import { useTranslation } from 'react-i18next';

export default function AgentCourses() {
  const { t } = useTranslation();
  const { courses } = useDataStore();
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [defaultInitialized, setDefaultInitialized] = useState(false);

  // Fetch global defaults from settings
  const { data: defaultsData } = useQuery<{ success: boolean; defaults: { default_country_code: string | null } }>({
    queryKey: ['/api/settings/defaults'],
    staleTime: 60000,
  });

  // Fetch countries and contents from public APIs (no auth required)
  const { data: countries = [] } = useQuery({
    queryKey: ['/api/public/countries'],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    select: (data: any) => {
      console.log('🌍 Public countries API response:', data);
      return data.countries as Country[];
    }
  });

  const { data: contents = [] } = useQuery({
    queryKey: ['/api/public/contents'],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    select: (data: any) => {
      console.log('📚 Public contents API response:', data);
      return data.contents as Array<Content & { countryName?: string }>;
    }
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ['/api/public/quizzes'],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    select: (data: any) => {
      console.log('📝 Public quizzes API response:', data);
      return data.quizzes;
    }
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

  // Initialize selected country from API defaults once countries are loaded
  useEffect(() => {
    if (defaultInitialized || activeCountries.length === 0) return;
    const apiDefault = defaultsData?.defaults?.default_country_code;
    if (apiDefault) {
      const found = activeCountries.find(c => c.code.toLowerCase() === apiDefault.toLowerCase());
      if (found) {
        setSelectedCountry(found.code.toLowerCase());
        setDefaultInitialized(true);
        return;
      }
    }
    // Fallback: first active country (usually Turkey)
    setSelectedCountry(activeCountries[0].code.toLowerCase());
    setDefaultInitialized(true);
  }, [activeCountries, defaultsData, defaultInitialized]);

  // Get content for selected country
  const selectedCountryData = activeCountries.find(c => 
    c.code.toLowerCase() === selectedCountry || c.id === selectedCountry
  );

  const countryContents = useMemo(() => {
    // Filter contents for selected country
    const filtered = contents.filter(content => 
      content.countryId === selectedCountryData?.id && 
      content.status === 'published'
    );
    
    return filtered;
  }, [contents, selectedCountryData?.id]);

  // Create dynamic course or use default
  const dynamicCourse = useMemo(() => {
    // If fallback Turkey (id='turkey') is selected with no content, use default course
    if (selectedCountryData?.id === 'turkey' && countryContents.length === 0) {
      return courses[0]; // Default Turkey course from store
    }

    if (!selectedCountryData) return null;

    // Group contents by section
    const contentsBySection = countryContents.reduce((acc, content) => {
      const sectionName = content.section || 'A1 Destination Countries'; // Default section
      if (!acc[sectionName]) {
        acc[sectionName] = [];
      }
      acc[sectionName].push(content);
      return acc;
    }, {} as Record<string, typeof countryContents>);

    // Create sections from grouped contents
    const sections = Object.entries(contentsBySection).map(([sectionName, sectionContents]) => ({
      id: `section-${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
      title: sectionName,
      lessons: sectionContents.map(content => {
        // Check if content is actually empty (null, undefined, or only whitespace)
        const hasContent = content.content && content.content.trim().length > 0;
        
        return {
          id: content.id,
          title: content.title,
          html: hasContent 
            ? content.content! 
            : `<div class="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
                <h2 class="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-3">${content.title}</h2>
                <p class="text-yellow-700 dark:text-yellow-300">
                  ${content.description || t('agent.courses.lessonContentPlaceholder')}
                </p>
              </div>`,
          quizId: content.quizId || undefined
        };
      })
    }));

    // Create dynamic course from admin contents
    return {
      id: `course-${selectedCountryData.id}`,
      title: `${selectedCountryData.name} Agent Training`,
      slug: `${selectedCountryData.code.toLowerCase()}-training`,
      sections
    };
  }, [selectedCountryData, countryContents, courses, selectedCountry]);

  if (activeCountries.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('agent.courses.noCourses')}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('agent.courses.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('agent.courses.subtitle')}
          </p>
        </div>
      </div>

      <Tabs value={selectedCountry} onValueChange={setSelectedCountry} className="w-full">
        <div className="w-full overflow-x-auto scrollbar-hide pb-1">
          <TabsList className="inline-flex w-max gap-2 bg-gradient-to-r from-muted/80 to-muted/50 backdrop-blur-sm p-2 rounded-xl border border-border/50 shadow-sm">
            {activeCountries.map((country) => (
              <TabsTrigger 
                key={country.id} 
                value={country.code.toLowerCase()}
                className="group relative flex items-center gap-3 whitespace-nowrap px-6 py-3 transition-all duration-300 hover:-translate-y-0.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20"
                data-testid={`tab-country-${country.code.toLowerCase()}`}
              >
                <CountryFlag code={country.code} size="md" />
                <span className="font-medium">{country.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {activeCountries.map((country) => (
          <TabsContent 
            key={country.id} 
            value={country.code.toLowerCase()}
            className="space-y-6"
          >
            {dynamicCourse ? (
              <CourseView course={dynamicCourse} quizzes={quizzes} countryId={country.id} />
            ) : (
              <Card className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {t('agent.courses.noContent', { country: country.name })}
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