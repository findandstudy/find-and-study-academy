import { useState, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Camera, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminProfile() {
  const { t } = useTranslation();
  const { user, updateUser: updateAuthUser } = useAuthStore();
  const { updateUser: updateDataUser } = useDataStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpdateProfile = () => {
    if (!user) return;
    
    updateDataUser(user.id, { name });
    updateAuthUser({ name });
    toast({
      title: t('agent.profile.toast.profileUpdated'),
      description: t('agent.profile.toast.profileUpdatedDescription')
    });
  };

  const handleChangePassword = () => {
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      toast({
        title: t('agent.profile.toast.passwordMismatch'),
        description: t('agent.profile.toast.passwordMismatchDescription'),
        variant: 'destructive'
      });
      return;
    }

    // Mock password change
    updateDataUser(user.id, { password: newPassword });
    updateAuthUser({ password: newPassword });
    toast({
      title: t('agent.profile.toast.passwordChanged'),
      description: t('agent.profile.toast.passwordChangedDescription')
    });
    
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('agent.profile.toast.invalidFileType'),
        description: t('agent.profile.toast.invalidFileTypeDescription'),
        variant: 'destructive'
      });
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('agent.profile.toast.fileTooLarge'),
        description: t('agent.profile.toast.fileTooLargeDescription'),
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      // Create FormData and upload file directly to backend
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile-picture/upload', {
        method: 'POST',
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload profile picture');
      }

      const result = await response.json();
      
      // Update user in both stores
      updateDataUser(user.id, { profilePicture: result.url } as any);
      updateAuthUser({ profilePicture: result.url } as any);
      
      toast({
        title: t('agent.profile.toast.pictureUpdated'),
        description: t('agent.profile.toast.pictureUpdatedDescription')
      });
    } catch (error) {
      console.error('Profile picture upload failed:', error);
      toast({
        title: t('agent.profile.toast.uploadFailed'),
        description: t('agent.profile.toast.uploadFailedDescription'),
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('admin.profile.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.profile.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t('agent.profile.picture')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src={(user as any)?.profilePicture || ''} alt={t('agent.profile.picture')} />
                <AvatarFallback className="text-2xl">
                  {user?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('agent.profile.uploadHint')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  data-testid="input-profile-picture"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="button-upload-profile-picture"
                >
                  {uploading ? (
                    <>
                      <Upload className="mr-2 h-4 w-4 animate-spin" />
                      {t('agent.profile.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('agent.profile.choosePhoto')}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">
                  {t('agent.profile.fileLimits')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('agent.profile.info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('agent.profile.fullName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('admin.profile.namePlaceholder')}
                data-testid="input-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('agent.profile.email')}</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">
                {t('agent.profile.emailReadonly')}
              </p>
            </div>

            <Button onClick={handleUpdateProfile} data-testid="button-update-profile">
              {t('agent.profile.update')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t('agent.profile.changePassword')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('agent.profile.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('agent.profile.currentPasswordPlaceholder')}
              data-testid="input-current-password"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('agent.profile.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('agent.profile.newPasswordPlaceholder')}
              data-testid="input-new-password"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('agent.profile.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('agent.profile.confirmPasswordPlaceholder')}
              data-testid="input-confirm-password"
            />
          </div>

          <Button 
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
            data-testid="button-change-password"
          >
            {t('agent.profile.changePasswordButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}