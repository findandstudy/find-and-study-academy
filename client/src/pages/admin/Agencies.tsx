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
import { Building, Plus, Edit2, Users, MapPin, Calendar, Search, Trash2, LayoutGrid, List, CheckCircle2, XCircle } from 'lucide-react';
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
  const { toast } = useToast();

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
    </div>
  );
}
