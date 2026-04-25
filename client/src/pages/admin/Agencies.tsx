import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building, Plus, Edit2, Users, MapPin, Calendar, Search, Trash2, LayoutGrid, List, CheckCircle2, XCircle, Eye, Mail, Phone, Globe, User, Clock, Download, Upload, FileSpreadsheet, AlertCircle, Loader2, UserPlus, X as XIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { insertAgencySchema, type Agency, type InsertAgency } from '@shared/schema';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AgencyWithCount = Agency & { agentCount: number };

type AgencyForm = InsertAgency;

type ViewMode = 'grid' | 'list';

export default function AdminAgencies() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedAgencies, setSelectedAgencies] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<AgencyWithCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agencyToDelete, setAgencyToDelete] = useState<AgencyWithCount | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [viewAgency, setViewAgency] = useState<AgencyWithCount | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('all');
  const { toast } = useToast();
  
  // Handle view agency details
  const handleViewAgency = (agency: AgencyWithCount) => {
    setViewAgency(agency);
    setViewDialogOpen(true);
  };

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('agenciesViewMode') as ViewMode;
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('agenciesViewMode', mode);
  };

  const { data: agenciesResponse, isLoading } = useQuery({
    queryKey: ['/api/admin/agencies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/agencies');
      return response.json();
    }
  });

  // ── Export agencies to Excel ─────────────────────────────────────────────────
  const exportAgencies = (agencyList: AgencyWithCount[]) => {
    const rows = agencyList.map(a => ({
      'Agency Name': a.name,
      'Country': a.country || '',
      'City': a.city || '',
      'Contact Email': a.contactEmail || '',
      'Contact Phone': a.contactPhone || '',
      'Website': a.website || '',
      'Primary Contact': a.primaryContactName || '',
      'Primary Contact Email': a.primaryContactEmail || '',
      'Staff Size': a.staffSize ?? '',
      'Annual Students': a.annualStudents ?? '',
      'Status': a.status,
      'Description': a.description || '',
      'Created At': a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
      'Agent Count': a.agentCount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 18 },
      { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agencies');
    XLSX.writeFile(wb, `agencies_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Dışa Aktarıldı', description: `${agencyList.length} acente Excel dosyasına aktarıldı.` });
  };

  // ── Parse Excel/CSV for bulk import ─────────────────────────────────────────
  const handleImportFile = (file: File) => {
    setImportParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setImportRows(rows);
      } catch {
        toast({ title: 'Dosya Hatası', description: 'Dosya okunamadı. Excel veya CSV seçin.', variant: 'destructive' });
      } finally {
        setImportParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Run bulk import ──────────────────────────────────────────────────────────
  const handleBulkImport = async () => {
    if (!importRows.length) return;
    setImportLoading(true);
    try {
      const res = await apiRequest('POST', '/api/admin/agencies/bulk-import', { agencies: importRows });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'İçe Aktarma Tamamlandı', description: data.message });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
        setBulkImportOpen(false);
        setImportRows([]);
      } else {
        toast({ title: 'Hata', description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Hata', description: 'İçe aktarma başarısız.', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  const agencies: AgencyWithCount[] = agenciesResponse?.agencies || [];

  const form = useForm<AgencyForm>({
    resolver: zodResolver(insertAgencySchema),
    defaultValues: {
      name: '',
      country: 'Turkey',
      city: '',
      contactEmail: '',
      contactPhone: '',
      status: 'pending',
      description: ''
    }
  });

  const createAgencyMutation = useMutation({
    mutationFn: async (data: AgencyForm) => {
      const response = await apiRequest('POST', '/api/admin/agencies', data);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/agencies'] });
      toast({ title: "Success", description: "Agency created successfully" });
      setDialogOpen(false);
      setEditingAgency(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create agency", variant: "destructive" });
    }
  });

  const updateAgencyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AgencyForm> }) => {
      const response = await apiRequest('PATCH', `/api/admin/agencies/${id}`, data);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/agencies'] });
      toast({ title: "Success", description: "Agency updated successfully" });
      setDialogOpen(false);
      setEditingAgency(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update agency", variant: "destructive" });
    }
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/agencies/${id}`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/agencies'] });
      toast({ title: "Success", description: "Agency deleted successfully" });
      setDeleteDialogOpen(false);
      setAgencyToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete agency", variant: "destructive" });
    }
  });

  // Bulk status update mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { agencyIds: string[]; status: 'active' | 'inactive' | 'pending' }) => {
      return apiRequest('POST', '/api/admin/agencies/bulk-status', data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/agencies'] });
      toast({ title: 'Success', description: 'Agency statuses updated successfully' });
      setSelectedAgencies(new Set());
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update agency statuses',
        variant: 'destructive' 
      });
    },
  });

  // ── Users (for member assignment) ─────────────────────────────────────────
  const { data: usersResponse } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/users');
      return response.json();
    },
  });
  const allUsers: any[] = usersResponse?.users || [];

  const assignUserMutation = useMutation({
    mutationFn: async (data: { userId: string; agencyId: string | null }) => {
      const response = await apiRequest('PATCH', `/api/admin/users/${data.userId}`, { agencyId: data.agencyId });
      return response.json();
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      toast({
        title: variables.agencyId ? 'Üye eklendi' : 'Üye kaldırıldı',
        description: variables.agencyId ? 'Kullanıcı acenteye atandı.' : 'Kullanıcı acenteden çıkarıldı.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error?.message || 'Üye atama işlemi başarısız oldu.',
        variant: 'destructive',
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (agencyIds: string[]) => {
      return apiRequest('POST', '/api/admin/agencies/bulk-delete', { agencyIds });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/agencies'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/agencies'] });
      toast({ title: 'Success', description: 'Agencies deleted successfully' });
      setSelectedAgencies(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete agencies',
        variant: 'destructive' 
      });
    },
  });

  const filteredAgencies = agencies.filter((agency: AgencyWithCount) => {
    const matchesSearch = agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agency.city || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agency.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Selection handlers
  const isAllSelected = filteredAgencies.length > 0 && filteredAgencies.every(a => selectedAgencies.has(a.id));
  const isSomeSelected = filteredAgencies.some(a => selectedAgencies.has(a.id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAgencies(new Set());
    } else {
      setSelectedAgencies(new Set(filteredAgencies.map(a => a.id)));
    }
  };

  const handleSelectAgency = (agencyId: string) => {
    const newSelected = new Set(selectedAgencies);
    if (newSelected.has(agencyId)) {
      newSelected.delete(agencyId);
    } else {
      newSelected.add(agencyId);
    }
    setSelectedAgencies(newSelected);
  };

  const handleEditAgency = (agency: AgencyWithCount) => {
    setEditingAgency(agency);
    form.reset({
      name: agency.name,
      country: agency.country,
      city: agency.city || '',
      contactEmail: agency.contactEmail || '',
      contactPhone: agency.contactPhone || '',
      status: agency.status,
      description: agency.description || ''
    });
    setDialogOpen(true);
  };

  const handleDeleteAgency = (agency: AgencyWithCount) => {
    setAgencyToDelete(agency);
    setDeleteDialogOpen(true);
  };

  const handleBulkStatusChange = (status: 'active' | 'inactive' | 'pending') => {
    const agencyIds = Array.from(selectedAgencies);
    bulkStatusMutation.mutate({ agencyIds, status });
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    const agencyIds = Array.from(selectedAgencies);
    bulkDeleteMutation.mutate(agencyIds);
  };

  const onSubmit = (data: AgencyForm) => {
    if (editingAgency) {
      updateAgencyMutation.mutate({ id: editingAgency.id, data });
    } else {
      createAgencyMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: string; label: string; icon: React.ReactNode }> = {
      active: { variant: 'default', label: 'Active', icon: <CheckCircle2 className="w-3 h-3 mr-1" /> },
      inactive: { variant: 'secondary', label: 'Inactive', icon: <XCircle className="w-3 h-3 mr-1" /> },
      pending: { variant: 'outline', label: 'Pending', icon: null }
    };
    return variants[status] || { variant: 'outline', label: status, icon: null };
  };

  const selectedCount = selectedAgencies.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agency Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage partner agencies and their agent assignments.
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Button */}
          <Button
            variant="outline"
            onClick={() => exportAgencies(agencies)}
            disabled={agencies.length === 0}
            data-testid="button-export-agencies"
          >
            <Download className="w-4 h-4 mr-2" />
            Dışa Aktar
          </Button>

          {/* Bulk Import Button & Dialog */}
          <Dialog open={bulkImportOpen} onOpenChange={(open) => { setBulkImportOpen(open); if (!open) setImportRows([]); }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-import-agencies">
                <Upload className="w-4 h-4 mr-2" />
                Toplu İçe Aktar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Toplu Acente İçe Aktarma</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Format hint */}
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <p className="font-medium">Excel/CSV Formatı</p>
                  <p className="text-muted-foreground">Sütunlar: <span className="font-mono text-xs">Agency Name, Country, City, Contact Email, Contact Phone, Website, Primary Contact, Status</span></p>
                  <p className="text-muted-foreground text-xs">Status değerleri: active, inactive, pending (boş ise "pending" olarak eklenir)</p>
                </div>

                {/* Template download */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const template = [{ 'Agency Name': 'Örnek Acente', 'Country': 'Turkey', 'City': 'Istanbul', 'Contact Email': 'info@acente.com', 'Contact Phone': '+90 212 000 0000', 'Website': 'https://acente.com', 'Primary Contact': 'Ad Soyad', 'Status': 'active', 'Description': '' }];
                    const ws = XLSX.utils.json_to_sheet(template);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Agencies');
                    XLSX.writeFile(wb, 'agencies_template.xlsx');
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Şablon İndir
                </Button>

                {/* File picker */}
                {importRows.length === 0 ? (
                  <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-md cursor-pointer hover-elevate">
                    {importParsing ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                    )}
                    <div className="text-center">
                      <p className="font-medium">{importParsing ? 'Okunuyor...' : 'Excel veya CSV dosyası seçin'}</p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      disabled={importParsing}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{importRows.length} satır bulundu</span>
                      <Button variant="ghost" size="sm" onClick={() => setImportRows([])}>Temizle</Button>
                    </div>
                    {/* Preview table */}
                    <div className="border rounded-md overflow-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            {Object.keys(importRows[0] || {}).slice(0, 6).map(k => (
                              <TableHead key={k}>{k}</TableHead>
                            ))}
                            {Object.keys(importRows[0] || {}).length > 6 && <TableHead>...</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importRows.slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                              {Object.values(row).slice(0, 6).map((val: any, j) => (
                                <TableCell key={j} className="text-sm max-w-[150px] truncate">{String(val)}</TableCell>
                              ))}
                              {Object.values(row).length > 6 && <TableCell className="text-muted-foreground">…</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {importRows.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">+ {importRows.length - 10} daha...</p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setImportRows([])}>İptal</Button>
                      <Button onClick={handleBulkImport} disabled={importLoading}>
                        {importLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />İçe Aktarılıyor...</> : <><Upload className="w-4 h-4 mr-2" />{importRows.length} Acente Ekle</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-agency">
              <Plus className="w-4 h-4 mr-2" />
              Add Agency
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAgency ? 'Edit Agency' : 'Add New Agency'}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agency Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-agency-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agency-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ''} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ''}
                          placeholder="Brief description of the agency..."
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false);
                      setEditingAgency(null);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAgencyMutation.isPending || updateAgencyMutation.isPending}
                    data-testid="button-save-agency"
                  >
                    {(createAgencyMutation.isPending || updateAgencyMutation.isPending) ? 'Saving...' : 
                     editingAgency ? 'Update Agency' : 'Create Agency'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agencies by name or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-agencies"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
            data-testid="button-view-grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
            data-testid="button-view-list"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedCount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all-toolbar"
                />
                <span className="font-medium" data-testid="text-selected-count">
                  {selectedCount} {selectedCount === 1 ? 'agency' : 'agencies'} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange('active')}
                  disabled={bulkStatusMutation.isPending}
                  data-testid="button-bulk-active"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Set Active
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange('inactive')}
                  disabled={bulkStatusMutation.isPending}
                  data-testid="button-bulk-inactive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Set Inactive
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgencies.map((agency: AgencyWithCount) => {
            const statusBadge = getStatusBadge(agency.status);
            const isSelected = selectedAgencies.has(agency.id);
            return (
              <Card key={agency.id} className="hover-elevate" data-testid={`card-agency-${agency.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectAgency(agency.id)}
                        data-testid={`checkbox-agency-${agency.id}`}
                        className="mt-1"
                      />
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="line-clamp-1">{agency.name}</span>
                      </CardTitle>
                    </div>
                    <Badge variant={statusBadge.variant as any} className="flex-shrink-0">
                      {statusBadge.icon}
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground ml-8">
                    <MapPin className="w-4 h-4" />
                    {agency.city}, {agency.country}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Email:</span>
                      <br />
                      <span className="text-muted-foreground">{agency.contactEmail}</span>
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span>
                      <br />
                      <span className="text-muted-foreground">{agency.contactPhone}</span>
                    </div>
                    {agency.description && (
                      <div>
                        <span className="font-medium">Description:</span>
                        <br />
                        <span className="text-muted-foreground text-xs">{agency.description}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{agency.agentCount} agents</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Since {new Date(agency.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleViewAgency(agency)}
                        data-testid={`button-view-${agency.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEditAgency(agency)}
                        data-testid={`button-edit-${agency.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDeleteAgency(agency)}
                        data-testid={`button-delete-${agency.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredAgencies.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.map((agency: AgencyWithCount) => {
                  const statusBadge = getStatusBadge(agency.status);
                  const isSelected = selectedAgencies.has(agency.id);
                  return (
                    <TableRow key={agency.id} className="hover-elevate" data-testid={`row-agency-${agency.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSelectAgency(agency.id)}
                          data-testid={`checkbox-agency-${agency.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-primary flex-shrink-0" />
                          <div>
                            <div className="font-medium">{agency.name}</div>
                            {agency.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {agency.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span>{agency.city}, {agency.country}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="text-muted-foreground">{agency.contactEmail}</div>
                          <div className="text-muted-foreground">{agency.contactPhone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span>{agency.agentCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge.variant as any}>
                          {statusBadge.icon}
                          {statusBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(agency.createdAt).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleViewAgency(agency)}
                            data-testid={`button-view-${agency.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleEditAgency(agency)}
                            data-testid={`button-edit-${agency.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDeleteAgency(agency)}
                            data-testid={`button-delete-${agency.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agency</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agencyToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => agencyToDelete && deleteAgencyMutation.mutate(agencyToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Agencies</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} {selectedCount === 1 ? 'agency' : 'agencies'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete {selectedCount} {selectedCount === 1 ? 'Agency' : 'Agencies'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filteredAgencies.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm || statusFilter !== 'all' 
                ? 'No agencies found matching your filters.' 
                : 'No agencies registered yet.'}
            </p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first partner agency to get started.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* View Agency Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Acente Detayları
            </DialogTitle>
          </DialogHeader>
          
          {viewAgency && (
            <div className="space-y-6">
              {/* Header with Logo and Status */}
              <div className="flex items-start gap-4 pb-4 border-b">
                {viewAgency.logoUrl ? (
                  <img 
                    src={viewAgency.logoUrl} 
                    alt={viewAgency.name} 
                    className="w-20 h-20 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                    <Building className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{viewAgency.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStatusBadge(viewAgency.status).variant as any}>
                      {getStatusBadge(viewAgency.status).icon}
                      {getStatusBadge(viewAgency.status).label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {viewAgency.agentCount} acente
                    </span>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Temel Bilgiler
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Acente Adı:</span>
                    <p className="font-medium">{viewAgency.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Durum:</span>
                    <p className="font-medium capitalize">{viewAgency.status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ülke:</span>
                    <p className="font-medium">{viewAgency.country || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Şehir:</span>
                    <p className="font-medium">{viewAgency.city || '-'}</p>
                  </div>
                  {viewAgency.address && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Adres:</span>
                      <p className="font-medium">{viewAgency.address}</p>
                    </div>
                  )}
                  {viewAgency.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Açıklama:</span>
                      <p className="font-medium">{viewAgency.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  İletişim Bilgileri
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">E-posta:</span>
                      <p className="font-medium">{viewAgency.contactEmail || viewAgency.primaryContactEmail || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Telefon:</span>
                      <p className="font-medium">{viewAgency.contactPhone || viewAgency.phone || '-'}</p>
                    </div>
                  </div>
                  {viewAgency.primaryContactName && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">Yetkili Kişi:</span>
                        <p className="font-medium">{viewAgency.primaryContactName}</p>
                      </div>
                    </div>
                  )}
                  {viewAgency.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">Web Sitesi:</span>
                        <p className="font-medium">
                          <a href={viewAgency.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {viewAgency.website}
                          </a>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Information */}
              {(viewAgency.staffSize || viewAgency.annualStudents) && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    İşletme Bilgileri
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {viewAgency.staffSize && (
                      <div>
                        <span className="text-muted-foreground">Personel Sayısı:</span>
                        <p className="font-medium">{viewAgency.staffSize}</p>
                      </div>
                    )}
                    {viewAgency.annualStudents && (
                      <div>
                        <span className="text-muted-foreground">Yıllık Öğrenci:</span>
                        <p className="font-medium">{viewAgency.annualStudents}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Map Links */}
              {(viewAgency.googleMapUrl || viewAgency.yandexMapUrl) && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Harita Linkleri
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {viewAgency.googleMapUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewAgency.googleMapUrl} target="_blank" rel="noopener noreferrer">
                          <MapPin className="w-4 h-4 mr-2" />
                          Google Haritalar
                        </a>
                      </Button>
                    )}
                    {viewAgency.yandexMapUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewAgency.yandexMapUrl} target="_blank" rel="noopener noreferrer">
                          <MapPin className="w-4 h-4 mr-2" />
                          Yandex Haritalar
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Registration Date */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Kayıt Tarihi: {new Date(viewAgency.createdAt).toLocaleDateString('tr-TR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}</span>
                </div>
              </div>

              {/* Agency Members */}
              {(() => {
                const assignedMembers = allUsers.filter(u => u.agencyId === viewAgency.id);
                const search = memberSearch.trim().toLowerCase();
                const candidates = allUsers.filter(u => {
                  if (u.agencyId === viewAgency.id) return false;
                  if (memberRoleFilter !== 'all' && u.role !== memberRoleFilter) return false;
                  if (!search) return true;
                  return (
                    (u.name || '').toLowerCase().includes(search) ||
                    (u.email || '').toLowerCase().includes(search) ||
                    (u.username || '').toLowerCase().includes(search) ||
                    (u.companyName || '').toLowerCase().includes(search)
                  );
                });
                return (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Acente Üyeleri
                      <Badge variant="secondary" className="ml-1" data-testid="badge-member-count">
                        {assignedMembers.length}
                      </Badge>
                    </h4>

                    {/* Currently assigned */}
                    {assignedMembers.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {assignedMembers.map(u => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between gap-2 rounded-md border p-2"
                            data-testid={`row-member-${u.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{u.name || u.username}</span>
                                <Badge variant="outline" className="capitalize">{u.role}</Badge>
                                {u.status && u.status !== 'active' && (
                                  <Badge variant="secondary" className="capitalize">{u.status}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => assignUserMutation.mutate({ userId: u.id, agencyId: null })}
                              disabled={assignUserMutation.isPending}
                              data-testid={`button-remove-member-${u.id}`}
                            >
                              <XIcon className="w-4 h-4 mr-1" />
                              Kaldır
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-4">
                        Bu acenteye henüz üye atanmamış.
                      </p>
                    )}

                    {/* Add members */}
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <UserPlus className="w-4 h-4" />
                        Üye Ekle
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="İsim, e-posta veya kullanıcı adı ile ara..."
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="pl-9"
                            data-testid="input-member-search"
                          />
                        </div>
                        <Select value={memberRoleFilter} onValueChange={setMemberRoleFilter}>
                          <SelectTrigger className="w-full sm:w-40" data-testid="select-member-role">
                            <SelectValue placeholder="Rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tüm roller</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <ScrollArea className="h-56 rounded-md border">
                        {candidates.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            {search || memberRoleFilter !== 'all'
                              ? 'Aramanızla eşleşen kullanıcı bulunamadı.'
                              : 'Atanabilecek başka kullanıcı yok.'}
                          </div>
                        ) : (
                          <div className="p-1">
                            {candidates.map(u => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between gap-2 rounded-md p-2 hover-elevate"
                                data-testid={`row-candidate-${u.id}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium truncate">{u.name || u.username}</span>
                                    <Badge variant="outline" className="capitalize">{u.role}</Badge>
                                    {u.agency && (
                                      <Badge variant="secondary" className="truncate max-w-[160px]">
                                        {u.agency.name}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => assignUserMutation.mutate({ userId: u.id, agencyId: viewAgency.id })}
                                  disabled={assignUserMutation.isPending}
                                  data-testid={`button-add-member-${u.id}`}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Ekle
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setViewDialogOpen(false);
                  handleEditAgency(viewAgency);
                }}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Düzenle
                </Button>
                <Button variant="destructive" onClick={() => {
                  setViewDialogOpen(false);
                  handleDeleteAgency(viewAgency);
                }}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
