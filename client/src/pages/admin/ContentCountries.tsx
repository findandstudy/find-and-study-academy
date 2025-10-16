import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Globe, 
  FileText, 
  Plus, 
  Search, 
  Pencil, 
  Trash2,
  BookOpen,
  VideoIcon,
  FileIcon,
  HelpCircle,
  Power,
  PowerOff
} from 'lucide-react';
import { insertCountrySchema, insertContentSchema, type Country, type Content, type InsertCountry, type InsertContent } from '@shared/schema';

export default function AdminContentCountries() {
  const { toast } = useToast();
  const [searchCountry, setSearchCountry] = useState('');
  const [searchContent, setSearchContent] = useState('');
  const [isCountryDialogOpen, setIsCountryDialogOpen] = useState(false);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingContent, setEditingContent] = useState<(Content & { countryName?: string }) | null>(null);

  // Countries query
  const { data: countries = [], isLoading: countriesLoading, refetch: refetchCountries } = useQuery({
    queryKey: ['/api/admin/countries'],
    select: (data: any) => data.countries as Country[]
  });

  // Contents query
  const { data: contents = [], isLoading: contentsLoading, refetch: refetchContents } = useQuery({
    queryKey: ['/api/admin/contents'],
    select: (data: any) => data.contents as Array<Content & { countryName?: string }>
  });

  // Quizzes query - for linking quizzes to content
  const { data: quizzes = [] } = useQuery({
    queryKey: ['/api/admin/quizzes'],
    select: (data: any) => data.quizzes as Array<{ id: string; title: string; description?: string }>
  });

  // Country form
  const countryForm = useForm<InsertCountry>({
    resolver: zodResolver(insertCountrySchema),
    defaultValues: {
      name: '',
      code: '',
      flag: '',
      status: 'active',
      description: ''
    }
  });

  // Content form
  const contentForm = useForm<InsertContent>({
    resolver: zodResolver(insertContentSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      type: 'lesson',
      countryId: 'none',
      courseId: 'none',
      quizId: 'none',
      content: '',
      status: 'published',
      order: 0
    }
  });

  // Country mutations
  const createCountryMutation = useMutation({
    mutationFn: async (data: InsertCountry) => {
      const response = await apiRequest('POST', '/api/admin/countries', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Country created successfully' });
      setIsCountryDialogOpen(false);
      countryForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/countries'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create country', variant: 'destructive' });
    }
  });

  const updateCountryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCountry> }) => {
      const response = await apiRequest('PATCH', `/api/admin/countries/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Country updated successfully' });
      setIsCountryDialogOpen(false);
      setEditingCountry(null);
      countryForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/countries'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update country', variant: 'destructive' });
    }
  });

  const deleteCountryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/countries/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Country deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/countries'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete country', variant: 'destructive' });
    }
  });

  const toggleCountryStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/countries/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Country status updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/countries'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update country status', variant: 'destructive' });
    }
  });

  // Content mutations
  const createContentMutation = useMutation({
    mutationFn: async (data: InsertContent) => {
      const response = await apiRequest('POST', '/api/admin/contents', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Content created successfully' });
      setIsContentDialogOpen(false);
      contentForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create content', variant: 'destructive' });
    }
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertContent> }) => {
      const response = await apiRequest('PATCH', `/api/admin/contents/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Content updated successfully' });
      setIsContentDialogOpen(false);
      setEditingContent(null);
      contentForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update content', variant: 'destructive' });
    }
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/contents/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Content deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete content', variant: 'destructive' });
    }
  });

  // Filter functions
  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(searchCountry.toLowerCase()) ||
    country.code.toLowerCase().includes(searchCountry.toLowerCase())
  );

  const filteredContents = contents.filter(content => 
    content.title.toLowerCase().includes(searchContent.toLowerCase()) ||
    content.type.toLowerCase().includes(searchContent.toLowerCase()) ||
    (content.countryName && content.countryName.toLowerCase().includes(searchContent.toLowerCase()))
  );

  // Form handlers
  const onCountrySubmit = (data: InsertCountry) => {
    if (editingCountry) {
      updateCountryMutation.mutate({ id: editingCountry.id, data });
    } else {
      createCountryMutation.mutate(data);
    }
  };

  const onContentSubmit = (data: InsertContent) => {
    // Convert "none" back to null for database storage
    const processedData = {
      ...data,
      countryId: data.countryId === 'none' ? null : data.countryId,
      courseId: data.courseId === 'none' ? null : data.courseId,
      quizId: data.quizId === 'none' ? null : data.quizId,
      section: data.section?.trim() || null // Convert empty/whitespace to null
    };
    
    if (editingContent) {
      updateContentMutation.mutate({ id: editingContent.id, data: processedData });
    } else {
      createContentMutation.mutate(processedData);
    }
  };

  const openCountryDialog = (country?: Country) => {
    if (country) {
      setEditingCountry(country);
      countryForm.reset(country);
    } else {
      setEditingCountry(null);
      countryForm.reset();
    }
    setIsCountryDialogOpen(true);
  };

  const openContentDialog = (content?: Content & { countryName?: string }) => {
    if (content) {
      setEditingContent(content);
      contentForm.reset({
        ...content,
        content: content.content || '', // Convert null to empty string
        countryId: content.countryId || 'none',
        courseId: content.courseId || 'none',
        quizId: content.quizId || 'none',
        section: content.section || '' // Empty string for text input
      });
    } else {
      setEditingContent(null);
      contentForm.reset();
    }
    setIsContentDialogOpen(true);
  };

  const handleDeleteCountry = (id: string) => {
    if (window.confirm('Are you sure you want to delete this country? This action cannot be undone.')) {
      deleteCountryMutation.mutate(id);
    }
  };

  const handleToggleCountryStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    toggleCountryStatusMutation.mutate({ id, status: newStatus });
  };

  const handleDeleteContent = (id: string) => {
    if (window.confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      deleteContentMutation.mutate(id);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video': return <VideoIcon className="w-4 h-4" />;
      case 'document': return <FileIcon className="w-4 h-4" />;
      case 'quiz': return <HelpCircle className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      published: 'default',
      inactive: 'secondary',
      draft: 'secondary',
      archived: 'destructive'
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Content & Countries</h1>
        <p className="text-muted-foreground mt-1">
          Manage countries and content for the educational platform.
        </p>
      </div>

      <Tabs defaultValue="countries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="countries" className="flex items-center gap-2" data-testid="tab-countries">
            <Globe className="w-4 h-4" />
            Countries
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2" data-testid="tab-content">
            <FileText className="w-4 h-4" />
            Content
          </TabsTrigger>
        </TabsList>

        {/* Countries Management */}
        <TabsContent value="countries" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Country Management
                </CardTitle>
                <Dialog open={isCountryDialogOpen} onOpenChange={setIsCountryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openCountryDialog()} data-testid="button-add-country">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Country
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingCountry ? 'Edit Country' : 'Add New Country'}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...countryForm}>
                      <form onSubmit={countryForm.handleSubmit(onCountrySubmit)} className="space-y-4">
                        <FormField
                          control={countryForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Turkey" {...field} data-testid="input-country-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={countryForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country Code</FormLabel>
                              <FormControl>
                                <Input placeholder="TR" maxLength={2} {...field} data-testid="input-country-code" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={countryForm.control}
                          name="flag"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Flag (emoji or URL)</FormLabel>
                              <FormControl>
                                <Input placeholder="🇹🇷" {...field} value={field.value || ''} data-testid="input-country-flag" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={countryForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-country-status">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={countryForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Country description or additional info..." 
                                  {...field} 
                                  value={field.value || ''}
                                  data-testid="textarea-country-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsCountryDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createCountryMutation.isPending || updateCountryMutation.isPending}
                            data-testid="button-save-country"
                          >
                            {editingCountry ? 'Update Country' : 'Create Country'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <Input
                  placeholder="Search countries..."
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search-countries"
                />
              </div>
            </CardHeader>
            <CardContent>
              {countriesLoading ? (
                <div className="text-center py-4">Loading countries...</div>
              ) : (
                <div className="space-y-2">
                  {filteredCountries.map((country) => (
                    <div key={country.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{country.flag}</span>
                        <div>
                          <div className="font-medium">{country.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Code: {country.code} • {getStatusBadge(country.status)}
                          </div>
                          {country.description && (
                            <div className="text-sm text-muted-foreground mt-1">{country.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={country.status === 'active' ? 'default' : 'outline'}
                          onClick={() => handleToggleCountryStatus(country.id, country.status)}
                          disabled={toggleCountryStatusMutation.isPending}
                          data-testid={`button-toggle-country-${country.id}`}
                          title={country.status === 'active' ? 'Deactivate country' : 'Activate country'}
                        >
                          {country.status === 'active' ? (
                            <Power className="w-4 h-4 text-white" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCountryDialog(country)}
                          data-testid={`button-edit-country-${country.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCountry(country.id)}
                          data-testid={`button-delete-country-${country.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredCountries.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchCountry ? 'No countries found matching your search.' : 'No countries added yet.'}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Management */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Content Management
                </CardTitle>
                <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openContentDialog()} data-testid="button-add-content">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Content
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingContent ? 'Edit Content' : 'Add New Content'}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...contentForm}>
                      <form onSubmit={contentForm.handleSubmit(onContentSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contentForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="Lesson title" {...field} data-testid="input-content-title" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contentForm.control}
                            name="slug"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Slug</FormLabel>
                                <FormControl>
                                  <Input placeholder="lesson-slug" {...field} data-testid="input-content-slug" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={contentForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Brief description" {...field} value={field.value || ''} data-testid="input-content-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contentForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Content Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-content-type">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="lesson">Lesson</SelectItem>
                                    <SelectItem value="video">Video</SelectItem>
                                    <SelectItem value="document">Document</SelectItem>
                                    <SelectItem value="quiz">Quiz</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contentForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-content-status">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={contentForm.control}
                          name="section"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Section (Optional)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., A1 Destination Countries, A2 Advanced Level..." 
                                  {...field} 
                                  value={field.value || ''} 
                                  data-testid="input-content-section" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contentForm.control}
                            name="countryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-content-country">
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">No specific country</SelectItem>
                                    {countries.map((country) => (
                                      <SelectItem key={country.id} value={country.id}>
                                        {country.flag} {country.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contentForm.control}
                            name="quizId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Linked Quiz (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-content-quiz">
                                      <SelectValue placeholder="Select quiz" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">No quiz</SelectItem>
                                    {quizzes.map((quiz) => (
                                      <SelectItem key={quiz.id} value={quiz.id}>
                                        {quiz.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contentForm.control}
                            name="order"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Order</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0" 
                                    {...field}
                                    value={field.value?.toString() || '0'}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    data-testid="input-content-order"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={contentForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Content Body</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Content body (HTML, Markdown, etc.)" 
                                  className="min-h-[150px]"
                                  {...field} 
                                  value={field.value || ''}
                                  data-testid="textarea-content-body"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsContentDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createContentMutation.isPending || updateContentMutation.isPending}
                            data-testid="button-save-content"
                          >
                            {editingContent ? 'Update Content' : 'Create Content'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <Input
                  placeholder="Search content..."
                  value={searchContent}
                  onChange={(e) => setSearchContent(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search-content"
                />
              </div>
            </CardHeader>
            <CardContent>
              {contentsLoading ? (
                <div className="text-center py-4">Loading content...</div>
              ) : (
                <div className="space-y-2">
                  {filteredContents.map((content) => (
                    <div key={content.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getContentIcon(content.type)}
                        <div className="flex-1">
                          <div className="font-medium">{content.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Type: {content.type} • {getStatusBadge(content.status)}
                            {content.countryName && ` • Country: ${content.countryName}`}
                          </div>
                          {content.description && (
                            <div className="text-sm text-muted-foreground mt-1">{content.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openContentDialog(content)}
                          data-testid={`button-edit-content-${content.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteContent(content.id)}
                          data-testid={`button-delete-content-${content.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredContents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchContent ? 'No content found matching your search.' : 'No content added yet.'}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}