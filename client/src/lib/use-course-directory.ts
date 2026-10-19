import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '@/i18n/languages';
import { countryLabel, courseText } from '@/i18n/course-labels';
type Course = {id:string;title:string;slug?:string};
type Country = {id:string;code:string;name:string;status:string};
// Match the generated course IDs used by AgentCourses; never use local seed courses.
export function useCourseDirectory(){
 const {i18n}=useTranslation();const language=normalizeLanguage(i18n.resolvedLanguage||i18n.language);
 const courses=useQuery<{courses:Course[]}>({queryKey:['/api/courses']});
 const countries=useQuery<{countries:Country[]}>({queryKey:['/api/public/countries']});
 const directory=new Map<string,Course>((courses.data?.courses??[]).map(c=>[c.id,c]));
 for(const c of countries.data?.countries??[])directory.set(`course-${c.id}`,{id:`course-${c.id}`,title:`${countryLabel(language,c.code,c.name)} — ${courseText(language,0)}`,slug:`${c.code.toLowerCase()}-training`});
 return {directory,isLoading:courses.isPending||countries.isPending,isError:courses.isError||countries.isError};
}
