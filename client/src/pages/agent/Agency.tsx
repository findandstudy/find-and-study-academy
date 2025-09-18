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
    lat: undefined,
    lng: undefined,
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAgencyData(prev => ({
          ...prev,
          logoUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
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

  const hasCoordinates = agencyData.lat && agencyData.lng;
  const mapUrl = hasCoordinates 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${agencyData.lng! - 0.01}%2C${agencyData.lat! - 0.01}%2C${agencyData.lng! + 0.01}%2C${agencyData.lat! + 0.01}&amp;layer=mapnik&amp;marker=${agencyData.lat}%2C${agencyData.lng}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Agency</h1>
        <p className="text-muted-foreground mt-1">
          Manage your agency information and profile.
        </p>
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
                  />
                  <Label htmlFor="logo" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  value={agencyData.lat || ''}
                  onChange={(e) => updateField('lat', parseFloat(e.target.value) || 0)}
                  placeholder="41.0082"
                  data-testid="input-latitude"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  value={agencyData.lng || ''}
                  onChange={(e) => updateField('lng', parseFloat(e.target.value) || 0)}
                  placeholder="28.9784"
                  data-testid="input-longitude"
                />
              </div>
            </div>

            {/* Map Display */}
            {mapUrl && (
              <div className="space-y-2">
                <Label>Location Preview</Label>
                <div className="h-64 rounded-md overflow-hidden border">
                  <iframe
                    src={mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    title="Agency Location"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Coordinates: {agencyData.lat}, {agencyData.lng}
                </p>
              </div>
            )}
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