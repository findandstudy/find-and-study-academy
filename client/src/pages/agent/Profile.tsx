import { useState, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Camera, Upload, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AgentProfile() {
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
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState((user as any)?.emailNotifications ?? true);
  const [courseCompletionNotif, setCourseCompletionNotif] = useState((user as any)?.courseCompletionNotif ?? true);
  const [certificateNotif, setCertificateNotif] = useState((user as any)?.certificateNotif ?? true);
  const [announcementNotif, setAnnouncementNotif] = useState((user as any)?.announcementNotif ?? true);

  const handleUpdateProfile = () => {
    if (!user) return;
    
    const updates = {
      name,
      emailNotifications,
      courseCompletionNotif,
      certificateNotif,
      announcementNotif
    };
    
    updateDataUser(user.id, updates as any);
    updateAuthUser(updates as any);
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
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('agent.profile.toast.invalidFileType'),
        description: t('agent.profile.toast.invalidFileTypeDescription'),
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
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
      
      console.log('[PROFILE PICTURE] Backend response:', result);
      console.log('[PROFILE PICTURE] Updating stores with URL:', result.url);
      
      // Update user in both stores
      updateDataUser(user.id, { profilePicture: result.url } as any);
      updateAuthUser({ profilePicture: result.url } as any);
      
      console.log('[PROFILE PICTURE] Updated user in stores, user now:', useAuthStore.getState().user);
      
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
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('agent.profile.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('agent.profile.subtitle')}
          </p>
        </div>
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
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  data-testid="button-upload-profile-picture"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? t('agent.profile.uploading') : t('agent.profile.choosePhoto')}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center whitespace-pre-line">
                {t('agent.profile.fileLimits')}
              </p>
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
                placeholder={t('agent.profile.fullNamePlaceholder')}
                autoComplete="name"
                data-testid="input-profile-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('agent.profile.email')}</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
                data-testid="input-profile-email"
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

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('agent.profile.changePassword')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('agent.profile.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('agent.profile.currentPasswordPlaceholder')}
                autoComplete="current-password"
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
                autoComplete="new-password"
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
                autoComplete="new-password"
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

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t('agent.profile.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications" className="text-base font-medium">
                {t('agent.profile.emailNotificationsLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('agent.profile.emailNotificationsHint')}
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              data-testid="switch-email-notifications"
            />
          </div>

          <div className="flex items-center justify-between" style={{ opacity: emailNotifications ? 1 : 0.5 }}>
            <div className="space-y-0.5">
              <Label htmlFor="courseCompletionNotif" className="text-base font-medium">
                {t('agent.profile.courseCompletionLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('agent.profile.courseCompletionHint')}
              </p>
            </div>
            <Switch
              id="courseCompletionNotif"
              checked={courseCompletionNotif}
              onCheckedChange={setCourseCompletionNotif}
              disabled={!emailNotifications}
              data-testid="switch-course-completion"
            />
          </div>

          <div className="flex items-center justify-between" style={{ opacity: emailNotifications ? 1 : 0.5 }}>
            <div className="space-y-0.5">
              <Label htmlFor="certificateNotif" className="text-base font-medium">
                {t('agent.profile.certificateLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('agent.profile.certificateHint')}
              </p>
            </div>
            <Switch
              id="certificateNotif"
              checked={certificateNotif}
              onCheckedChange={setCertificateNotif}
              disabled={!emailNotifications}
              data-testid="switch-certificate"
            />
          </div>

          <div className="flex items-center justify-between" style={{ opacity: emailNotifications ? 1 : 0.5 }}>
            <div className="space-y-0.5">
              <Label htmlFor="announcementNotif" className="text-base font-medium">
                {t('agent.profile.announcementsLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('agent.profile.announcementsHint')}
              </p>
            </div>
            <Switch
              id="announcementNotif"
              checked={announcementNotif}
              onCheckedChange={setAnnouncementNotif}
              disabled={!emailNotifications}
              data-testid="switch-announcements"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}