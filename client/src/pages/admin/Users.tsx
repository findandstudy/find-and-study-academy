import { useState, useMemo, useRef } from 'react';
import { WORLD_COUNTRIES } from '@/lib/world-countries';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Search, Crown, UserCheck, Calendar, Edit3, Save, X, Trash2, UserPlus, CheckCircle2, XCircle, AlertCircle, Upload, Download, FileSpreadsheet, ChevronRight, RotateCcw, Camera, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'agent' | 'staff';
  status: 'active' | 'inactive';
  agencyId?: string;
  companyName?: string;
  profilePicture?: string;
  agency?: {
    id: string;
    name: string;
    country: string;
    city: string;
  } | null;
}

interface UserEditForm {
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'staff';
  status: 'active' | 'inactive';
  companyName: string;
}

interface CreateUserForm {
  username: string;
  password: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'staff';
  status: 'active' | 'inactive';
  companyName: string;
  country: string;
  profilePicture: string;
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Edit dialog state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UserEditForm>({ name: '', email: '', role: 'agent', status: 'active', companyName: '' });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'agent',
    status: 'active',
    companyName: '',
    country: '',
    profilePicture: '',
  });
  const [createPhotoUploading, setCreatePhotoUploading] = useState(false);
  const createPhotoInputRef = useRef<HTMLInputElement>(null);
  
  // Delete confirmation state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Bulk import state
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  type ImportRow = { name: string; email: string; username: string; password: string; role: string; status: string; companyName: string };
  type ImportResult = { row: number; email: string; status: 'success' | 'error'; message?: string };
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importResults, setImportResults] = useState<{ successCount: number; errorCount: number; results: ImportResult[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  // Fetch users
  const { data: usersData, isLoading } = useQuery<{ success: boolean; users: User[] }>({
    queryKey: ['/api/admin/users'],
    staleTime: 30000,
  });

  const users: User[] = usersData?.users || [];

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = search === '' || 
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.username?.toLowerCase().includes(search.toLowerCase()) ||
        user.agency?.name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const agents = users.filter(u => u.role === 'agent').length;
    const staff = users.filter(u => u.role === 'staff').length;
    const active = users.filter(u => u.status === 'active').length;
    
    return { total, admins, agents, staff, active };
  }, [users]);

  // Selection handlers
  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u.id));
  const isSomeSelected = filteredUsers.some(u => selectedUsers.has(u.id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      return apiRequest('POST', '/api/admin/users', data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Success', description: 'User created successfully' });
      setIsCreateDialogOpen(false);
      setCreateForm({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'agent',
        status: 'active',
        companyName: '',
        country: '',
        profilePicture: '',
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create user',
        variant: 'destructive' 
      });
    },
  });

  // Upload profile picture for the new user being created
  const handleCreatePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Geçersiz dosya', description: 'Sadece PNG, JPG veya JPEG yükleyebilirsiniz.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Dosya çok büyük', description: 'Profil fotoğrafı en fazla 5MB olabilir.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setCreatePhotoUploading(true);
    try {
      const session = JSON.parse(localStorage.getItem('fas_session') || '{}');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: {
          'x-user-id': session?.user?.id || '',
          'x-user-role': session?.user?.role || '',
        },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.url) {
        throw new Error(json.message || 'Yükleme başarısız');
      }
      setCreateForm((prev) => ({ ...prev, profilePicture: json.url }));
      toast({ title: 'Yüklendi', description: 'Profil fotoğrafı yüklendi.' });
    } catch (err: any) {
      toast({ title: 'Yükleme hatası', description: err.message || 'Profil fotoğrafı yüklenemedi', variant: 'destructive' });
    } finally {
      setCreatePhotoUploading(false);
      if (createPhotoInputRef.current) createPhotoInputRef.current.value = '';
    }
  };

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<UserEditForm> }) => {
      return apiRequest('PATCH', `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Success', description: 'User updated successfully' });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update user',
        variant: 'destructive' 
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Success', description: 'User deleted successfully' });
      setDeleteUserId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete user',
        variant: 'destructive' 
      });
    },
  });

  // Bulk status update mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; status: 'active' | 'inactive' }) => {
      return apiRequest('POST', '/api/admin/users/bulk-status', data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Success', description: 'User statuses updated successfully' });
      setSelectedUsers(new Set());
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update user statuses',
        variant: 'destructive' 
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest('POST', '/api/admin/users/bulk-delete', { userIds });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Success', description: 'Users deleted successfully' });
      setSelectedUsers(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete users',
        variant: 'destructive' 
      });
    },
  });

  // Handlers
  const handleCreateUser = () => {
    createUserMutation.mutate(createForm);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companyName: user.companyName || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      id: editingUser.id,
      updates: editForm,
    });
  };

  const handleDeleteUser = (userId: string) => {
    setDeleteUserId(userId);
  };

  const confirmDeleteUser = () => {
    if (deleteUserId) {
      deleteUserMutation.mutate(deleteUserId);
    }
  };

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const userIds = Array.from(selectedUsers);
    bulkStatusMutation.mutate({ userIds, status });
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    const userIds = Array.from(selectedUsers);
    bulkDeleteMutation.mutate(userIds);
  };

  // ── Bulk Import helpers ──────────────────────────────────────────────────────
  const downloadUserTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instructionData = [
      ['FIELD', 'REQUIRED', 'EXAMPLE', 'NOTES'],
      ['name', 'Yes', 'John Smith', 'Full name of the user'],
      ['email', 'Yes', 'john@agency.com', 'Must be unique'],
      ['username', 'Yes', 'johnsmith', 'Must be unique, no spaces'],
      ['password', 'Yes', 'SecurePass123', 'Minimum 6 characters'],
      ['role', 'No', 'agent', 'admin | agent | staff (default: agent)'],
      ['status', 'No', 'active', 'active | inactive (default: active)'],
      ['companyName', 'No', 'ABC Agency', 'Agency or company name'],
    ];
    const instrSheet = XLSX.utils.aoa_to_sheet(instructionData);
    instrSheet['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, instrSheet, 'Instructions');

    const headerRow = ['name', 'email', 'username', 'password', 'role', 'status', 'companyName'];
    const exampleRow = ['Jane Doe', 'jane@example.com', 'janedoe', 'Pass1234', 'agent', 'active', 'My Agency'];
    const dataSheet = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    dataSheet['!cols'] = headerRow.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Users');
    XLSX.writeFile(wb, 'user_bulk_import_template.xlsx');
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const wsName = wb.SheetNames.find(n => n.toLowerCase() !== 'instructions') || wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        const mapped = json.map(row => ({
          name: String(row['name'] || row['Name'] || '').trim(),
          email: String(row['email'] || row['Email'] || '').trim().toLowerCase(),
          username: String(row['username'] || row['Username'] || '').trim(),
          password: String(row['password'] || row['Password'] || '').trim(),
          role: String(row['role'] || row['Role'] || 'agent').trim().toLowerCase(),
          status: String(row['status'] || row['Status'] || 'active').trim().toLowerCase(),
          companyName: String(row['companyName'] || row['CompanyName'] || row['company_name'] || '').trim(),
        }));
        setImportData(mapped);
        setImportStep(2);
      } catch {
        toast({ title: 'Error', description: 'Could not parse the file. Please use the template.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const bulkImportMutation = useMutation({
    mutationFn: async (users: typeof importData) => {
      return apiRequest('POST', '/api/admin/users/bulk-import', { users }) as Promise<any>;
    },
    onSuccess: async (data: any) => {
      setImportResults({ successCount: data.successCount, errorCount: data.errorCount, results: data.results });
      setImportStep(3);
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Import Failed', description: error.message || 'An error occurred', variant: 'destructive' });
    },
  });

  const closeBulkImport = () => {
    setIsBulkImportOpen(false);
    setImportStep(1);
    setImportData([]);
    setImportResults(null);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const getUserInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'outline' => {
    if (role === 'admin') return 'default';
    if (role === 'staff') return 'outline';
    return 'secondary';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'staff') return 'Staff';
    return 'Agent';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
        <XCircle className="w-3 h-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Loading users...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-heading">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, roles, and permissions across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} data-testid="button-bulk-import-users">
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-user">
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold" data-testid="text-total-users">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Administrators</p>
                <p className="text-2xl font-bold" data-testid="text-admin-count">{stats.admins}</p>
              </div>
              <Crown className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold" data-testid="text-agent-count">{stats.agents}</p>
              </div>
              <UserCheck className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Staff / Active</p>
                <p className="text-2xl font-bold" data-testid="text-active-users">{stats.staff} / {stats.active}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, username, or agency..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-user-search"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-role-filter">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Administrators</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedUsers.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                <span className="font-medium" data-testid="text-selected-count">
                  {selectedUsers.size} user(s) selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange('active')}
                  disabled={bulkStatusMutation.isPending}
                  data-testid="button-bulk-activate"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Set Active
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange('inactive')}
                  disabled={bulkStatusMutation.isPending}
                  data-testid="button-bulk-deactivate"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Set Inactive
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all users"
              data-testid="checkbox-select-all"
              className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
            />
            <Users className="w-5 h-5 ml-2" />
            User Directory ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found matching your search criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`card-user-${user.id}`}>
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => handleSelectUser(user.id)}
                      aria-label={`Select ${user.name}`}
                      data-testid={`checkbox-user-${user.id}`}
                    />
                    <Avatar className="w-12 h-12">
                      {user.profilePicture ? (
                        <AvatarImage src={user.profilePicture} alt={user.name} />
                      ) : null}
                      <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold" data-testid={`text-user-name-${user.id}`}>{user.name}</h3>
                        <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`badge-role-${user.id}`}>
                          {getRoleLabel(user.role)}
                        </Badge>
                        {getStatusBadge(user.status)}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>{user.email}</p>
                      {user.agency && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-user-agency-${user.id}`}>
                          {user.agency.name} • {user.agency.city}, {user.agency.country}
                        </p>
                      )}
                      {!user.agency && user.companyName && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-user-company-${user.id}`}>
                          {user.companyName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-user" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Profile picture upload */}
            <div>
              <Label>Profile Picture</Label>
              <div className="mt-2 flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={createForm.profilePicture || undefined} alt="Profile preview" />
                  <AvatarFallback>
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <input
                    ref={createPhotoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleCreatePhotoSelect}
                    data-testid="input-create-photo"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => createPhotoInputRef.current?.click()}
                      disabled={createPhotoUploading}
                      data-testid="button-upload-photo"
                    >
                      {createPhotoUploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" />Fotoğraf Yükle</>
                      )}
                    </Button>
                    {createForm.profilePicture && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreateForm({ ...createForm, profilePicture: '' })}
                        data-testid="button-remove-photo"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Kaldır
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG veya JPEG · en fazla 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="create-username">Username *</Label>
              <Input
                id="create-username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="Enter username"
                data-testid="input-create-username"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Password *</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Enter password"
                data-testid="input-create-password"
              />
            </div>
            <div>
              <Label htmlFor="create-name">Full Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-create-name"
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="Enter email address"
                data-testid="input-create-email"
              />
            </div>
            <div>
              <Label htmlFor="create-role">Role</Label>
              <Select value={createForm.role} onValueChange={(value: 'admin' | 'agent' | 'staff') => setCreateForm({ ...createForm, role: value })}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-company">Company Name</Label>
              <Input
                id="create-company"
                value={createForm.companyName}
                onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                placeholder="Enter company name (optional)"
                data-testid="input-create-company"
              />
            </div>
            <div>
              <Label htmlFor="create-country">Country</Label>
              <Select
                value={createForm.country || undefined}
                onValueChange={(value) => setCreateForm({ ...createForm, country: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="create-country" data-testid="select-create-country">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— None —</SelectItem>
                  {WORLD_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} data-testid={`option-country-${c.code}`}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-status">Status</Label>
              <Select value={createForm.status} onValueChange={(value: 'active' | 'inactive') => setCreateForm({ ...createForm, status: value })}>
                <SelectTrigger data-testid="select-create-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending || createPhotoUploading || !createForm.username || !createForm.password || !createForm.name || !createForm.email}
              data-testid="button-submit-create"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editForm.role} onValueChange={(value: 'admin' | 'agent' | 'staff') => setEditForm({ ...editForm, role: value })}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-company">Company Name</Label>
                <Input
                  id="edit-company"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  placeholder="Enter company name (optional)"
                  data-testid="input-edit-company"
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editForm.status} onValueChange={(value: 'active' | 'inactive') => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedUsers.size} user(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Import Dialog ────────────────────────────────────────────── */}
      <Dialog open={isBulkImportOpen} onOpenChange={(open) => !open && closeBulkImport()}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto" data-testid="dialog-bulk-import">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Import Users
            </DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm mb-4">
            {(['1. Template', '2. Preview', '3. Results'] as const).map((label, idx) => {
              const step = idx + 1;
              const active = importStep === step;
              const done = importStep > step;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {done ? <CheckCircle2 className="w-3 h-3" /> : step}
                  </div>
                  <span className={active ? 'font-medium' : 'text-muted-foreground'}>{label.split('. ')[1]}</span>
                  {idx < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>

          {/* Step 1 – Download Template */}
          {importStep === 1 && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/30 space-y-2">
                <p className="font-medium text-sm">Before uploading, download the Excel template:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>name</strong>, <strong>email</strong>, <strong>username</strong>, <strong>password</strong> — required</li>
                  <li><strong>role</strong> — admin | agent | staff (default: agent)</li>
                  <li><strong>status</strong> — active | inactive (default: active)</li>
                  <li><strong>companyName</strong> — optional agency/company name</li>
                </ul>
              </div>
              <Button onClick={downloadUserTemplate} className="w-full" variant="outline" data-testid="button-download-user-template">
                <Download className="w-4 h-4 mr-2" />
                Download Excel Template
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or upload your file</span></div>
              </div>
              <div
                className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
                onClick={() => importFileRef.current?.click()}
                data-testid="drop-zone-import"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to choose your Excel or CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Supported: .xlsx, .xls, .csv</p>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFileChange}
                  data-testid="input-import-file"
                />
              </div>
            </div>
          )}

          {/* Step 2 – Preview & Confirm */}
          {importStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{importData.length} row(s) found in file</p>
                <Button variant="ghost" size="sm" onClick={() => { setImportStep(1); setImportData([]); if (importFileRef.current) importFileRef.current.value = ''; }}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Choose another file
                </Button>
              </div>
              <div className="overflow-x-auto max-h-64 border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {['#', 'Name', 'Email', 'Username', 'Role', 'Status', 'Company'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importData.slice(0, 100).map((row, i) => {
                      const hasError = !row.name || !row.email || !row.username || !row.password;
                      return (
                        <tr key={i} className={`border-t ${hasError ? 'bg-destructive/5' : ''}`}>
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td>
                          <td className="px-3 py-1.5">{row.name || <span className="text-destructive">Missing</span>}</td>
                          <td className="px-3 py-1.5">{row.email || <span className="text-destructive">Missing</span>}</td>
                          <td className="px-3 py-1.5">{row.username || <span className="text-destructive">Missing</span>}</td>
                          <td className="px-3 py-1.5"><Badge variant="outline" className="text-xs">{row.role || 'agent'}</Badge></td>
                          <td className="px-3 py-1.5">{row.status || 'active'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.companyName || '—'}</td>
                        </tr>
                      );
                    })}
                    {importData.length > 100 && (
                      <tr className="border-t bg-muted/20"><td colSpan={7} className="px-3 py-2 text-center text-muted-foreground">...and {importData.length - 100} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {importData.some(r => !r.name || !r.email || !r.username || !r.password) && (
                <p className="text-xs text-destructive">Rows highlighted in red are missing required fields and will be skipped.</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportStep(1); setImportData([]); if (importFileRef.current) importFileRef.current.value = ''; }}>Back</Button>
                <Button
                  onClick={() => bulkImportMutation.mutate(importData)}
                  disabled={bulkImportMutation.isPending || importData.length === 0}
                  data-testid="button-confirm-import"
                >
                  {bulkImportMutation.isPending ? 'Importing...' : `Import ${importData.length} Users`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3 – Results */}
          {importStep === 3 && importResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{importResults.successCount + importResults.errorCount}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="rounded-md border p-3 text-center bg-green-500/5">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResults.successCount}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="rounded-md border p-3 text-center bg-destructive/5">
                  <p className="text-2xl font-bold text-destructive">{importResults.errorCount}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              {importResults.errorCount > 0 && (
                <div className="overflow-y-auto max-h-48 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.results.filter(r => r.status === 'error').map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-muted-foreground">{r.row}</td>
                          <td className="px-3 py-1.5">{r.email}</td>
                          <td className="px-3 py-1.5"><Badge variant="destructive" className="text-xs">Error</Badge></td>
                          <td className="px-3 py-1.5 text-destructive">{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button onClick={closeBulkImport} data-testid="button-close-import">Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
