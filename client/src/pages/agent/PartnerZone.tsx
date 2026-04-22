import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, Search, Package, Calendar, Globe } from 'lucide-react';
import { CountryFlag } from '@/components/CountryFlag';
import dayjs from 'dayjs';

interface Content {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  status: string;
  section: string | null;
  countryCode: string | null;
  categoryTag: string | null;
  documentUrl: string | null;
  fileSize: string | null;
  displayName: string | null;
  updatedAt: string;
  countryName?: string;
  countryFlag?: string;
}

export default function AgentPartnerZone() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const { data: contentsData, isLoading } = useQuery<{ success: boolean; contents: Content[] }>({
    queryKey: ['/api/contents'],
  });

  const allContents = contentsData?.contents ?? [];

  // Only show published documents
  const documents = allContents.filter(c => c.contentType === 'document' && c.status === 'published');

  // Get unique categories
  const categories = Array.from(new Set(documents.map(d => d.categoryTag).filter(Boolean))) as string[];
  const countries = Array.from(new Set(documents.map(d => d.countryCode).filter(Boolean))) as string[];

  const filtered = documents.filter(doc => {
    const matchesSearch = !search || 
      (doc.title?.toLowerCase().includes(search.toLowerCase())) ||
      (doc.description?.toLowerCase().includes(search.toLowerCase())) ||
      (doc.displayName?.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || doc.categoryTag === categoryFilter;
    const matchesCountry = countryFilter === 'all' || doc.countryCode === countryFilter;
    return matchesSearch && matchesCategory && matchesCountry;
  });

  // Group by category
  const grouped = filtered.reduce((acc: Record<string, Content[]>, doc) => {
    const key = doc.categoryTag || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const handleDownload = (doc: Content) => {
    const url = doc.documentUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.displayName || doc.title;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Partner Zone
        </h1>
        <p className="text-muted-foreground mt-2">
          Access downloadable resources, guides, and documents shared by Find And Study Academy.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-partner-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-country-filter">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map(code => (
              <SelectItem key={code} value={code}>{code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading resources...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">
              {documents.length === 0
                ? 'No documents available in Partner Zone yet.'
                : 'No documents match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, docs]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {category}
              <Badge variant="secondary">{docs.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {docs.map(doc => (
                <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1">
                        <CardTitle className="text-base leading-tight">
                          {doc.displayName || doc.title}
                        </CardTitle>
                        {doc.description && (
                          <CardDescription className="mt-1 line-clamp-2">{doc.description}</CardDescription>
                        )}
                      </div>
                      {doc.countryCode && (
                        <CountryFlag code={doc.countryCode} flag={doc.countryFlag} size="md" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {doc.fileSize && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {doc.fileSize}
                        </span>
                      )}
                      {doc.countryCode && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {doc.countryName || doc.countryCode}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dayjs(doc.updatedAt).format('MMM D, YYYY')}
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDownload(doc)}
                      disabled={!doc.documentUrl}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
