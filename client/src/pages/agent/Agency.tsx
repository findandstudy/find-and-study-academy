import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { Building, Upload, MapPin, Globe, Phone, User } from 'lucide-react';
import type { Agency } from '../../types';

export default function AgentAgency() {
  const { user } = useAuthStore();
  const { agencies, updateAgency } = useDataStore();
  const { toast } = useToast();

  const userAgency = agencies.find(a => a.id === user?.agencyId);
  const [agencyData, setAgencyData] = useState<Partial<Agency>>({
    name: '',
    logoUrl: '',
    address: '',
    googleMapUrl: '',
    yandexMapUrl: '',
    staffSize: undefined,
    annualStudents: undefined,
    website: '',
    phone: '',
    primaryContactName: '',
    primaryContactEmail: ''
  });

  useEffect(() => {
    if (userAgency) {
      setAgencyData(userAgency);
    }
  }, [userAgency]);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !userAgency) return;

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

    setUploadingLogo(true);

    try {
      // Step 1: Get presigned upload URL from backend
      const urlResponse = await fetch('/api/agency-logo/upload-url', {
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
      const updateResponse = await fetch('/api/agency-logo', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({
          agencyId: userAgency.id,
          logoUrl: uploadURL.split('?')[0], // Remove query params
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update agency logo');
      }

      const result = await updateResponse.json();
      
      // Update local state
      setAgencyData(prev => ({
        ...prev,
        logoUrl: result.url
      }));

      // Update agency in store (localStorage persistence)
      updateAgency(userAgency.id, { logoUrl: result.url });

      toast({
        title: 'Logo Uploaded',
        description: 'Agency logo has been updated successfully.'
      });
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = () => {
    if (!userAgency) return;

    updateAgency(userAgency.id, agencyData);
    toast({
      title: 'Agency Updated',
      description: 'Your agency information has been saved successfully.'
    });
  };

  const updateField = (field: keyof Agency, value: string | number) => {
    setAgencyData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            My Agency
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your agency information and profile.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agency Name</Label>
              <Input
                id="name"
                value={agencyData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Your agency name"
                data-testid="input-agency-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Agency Logo</Label>
              <div className="flex items-center gap-4">
                {agencyData.logoUrl && (
                  <img
                    src={agencyData.logoUrl}
                    alt="Agency Logo"
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                )}
                <div>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="input-logo-upload"
                    disabled={uploadingLogo}
                  />
                  <Label htmlFor="logo" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploadingLogo}>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffSize">Staff Size</Label>
                <Input
                  id="staffSize"
                  type="number"
                  value={agencyData.staffSize || ''}
                  onChange={(e) => updateField('staffSize', parseInt(e.target.value) || 0)}
                  placeholder="Number of staff"
                  data-testid="input-staff-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualStudents">Annual Students</Label>
                <Input
                  id="annualStudents"
                  type="number"
                  value={agencyData.annualStudents || ''}
                  onChange={(e) => updateField('annualStudents', parseInt(e.target.value) || 0)}
                  placeholder="Students per year"
                  data-testid="input-annual-students"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={agencyData.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://yourwebsite.com"
                data-testid="input-website"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={agencyData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1 234 567 8900"
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryContactName">Primary Contact Name</Label>
              <Input
                id="primaryContactName"
                value={agencyData.primaryContactName || ''}
                onChange={(e) => updateField('primaryContactName', e.target.value)}
                placeholder="Contact person name"
                data-testid="input-contact-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryContactEmail">Primary Contact Email</Label>
              <Input
                id="primaryContactEmail"
                type="email"
                value={agencyData.primaryContactEmail || ''}
                onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                placeholder="contact@agency.com"
                data-testid="input-contact-email"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={agencyData.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Full address including city and country"
                rows={3}
                data-testid="input-address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="googleMapUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Google Map Link
                </Label>
                <Input
                  id="googleMapUrl"
                  type="url"
                  value={agencyData.googleMapUrl || ''}
                  onChange={(e) => updateField('googleMapUrl', e.target.value)}
                  placeholder="https://maps.google.com/..."
                  data-testid="input-google-map-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yandexMapUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Yandex Map Link
                </Label>
                <Input
                  id="yandexMapUrl"
                  type="url"
                  value={agencyData.yandexMapUrl || ''}
                  onChange={(e) => updateField('yandexMapUrl', e.target.value)}
                  placeholder="https://yandex.com/maps/..."
                  data-testid="input-yandex-map-url"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-agency">
          Save Changes
        </Button>
      </div>
    </div>
  );
}