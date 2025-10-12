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

export default function AgentProfile() {
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
      title: 'Profile Updated',
      description: 'Your profile and notification preferences have been updated successfully.'
    });
  };

  const handleChangePassword = () => {
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'New password and confirmation do not match.',
        variant: 'destructive'
      });
      return;
    }

    // Mock password change
    updateDataUser(user.id, { password: newPassword });
    updateAuthUser({ password: newPassword });
    toast({
      title: 'Password Changed',
      description: 'Your password has been updated successfully.'
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
        title: 'Invalid File Type',
        description: 'Please select an image file.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select an image smaller than 5MB.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get presigned upload URL from backend
      const urlResponse = await fetch('/api/profile-picture/upload-url', {
        method: 'POST',
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await urlResponse.json();

      // Step 2: Upload file directly to object storage using presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Update backend with the uploaded file URL
      const updateResponse = await fetch('/api/profile-picture', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({
          profilePictureURL: uploadURL.split('?')[0], // Remove query params
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await updateResponse.json();
      
      console.log('[PROFILE PICTURE] Backend response:', result);
      console.log('[PROFILE PICTURE] Updating stores with URL:', result.url);
      
      // Update user in both stores
      updateDataUser(user.id, { profilePicture: result.url } as any);
      updateAuthUser({ profilePicture: result.url } as any);
      
      console.log('[PROFILE PICTURE] Updated user in stores, user now:', useAuthStore.getState().user);
      
      toast({
        title: 'Profile Picture Updated',
        description: 'Your profile picture has been updated successfully.'
      });
    } catch (error) {
      console.error('Profile picture upload failed:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload profile picture. Please try again.',
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
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your account information and security settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile Picture" />
                <AvatarFallback className="text-2xl">
                  {user?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a new profile picture
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
                  {uploading ? 'Uploading...' : 'Choose Photo'}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Maximum file size: 5MB<br />
                Supported formats: JPG, PNG, GIF
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                data-testid="input-profile-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
                data-testid="input-profile-email"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>

            <Button onClick={handleUpdateProfile} data-testid="button-update-profile">
              Update Profile
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                data-testid="input-confirm-password"
              />
            </div>

            <Button 
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword}
              data-testid="button-change-password"
            >
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Email Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications" className="text-base font-medium">
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications about your activities
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
                Course Completion
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you complete a course
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
                Certificate Earned
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you earn a certificate
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
                Announcements
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about important announcements
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