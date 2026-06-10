import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Phone, Mail, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Admin Settings Component
 * 
 * Features:
 * - Update WhatsApp number
 * - Update contact details
 * - Update business information
 * - Store in Supabase
 */
export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableAvailable, setTableAvailable] = useState(true);

  const [settings, setSettings] = useState({
    whatsapp_number: '919773239442',
    phone_1: '9773239442',
    phone_2: '7778052990',
    email: 'xltraders990@gmail.com',
    company_name: 'XL Traders',
    address: 'Surat, Gujarat',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '',
    business_description: '',
  });

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        // Only show "not configured" banner when the table truly doesn't exist.
        // PGRST204 = no schema cache entry; 42P01 = undefined_table (raw PG).
        const isTableMissing = error.code === 'PGRST204' || error.code === '42P01';
        if (isTableMissing) setTableAvailable(false);
        // All other errors (RLS denial, network hiccup, etc.): use defaults silently.
        return;
      }
      // data === null means the table exists but has no rows — use defaults.
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // Unexpected JS exception — don't flag table as missing.
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Try to update or insert
      const { error } = await supabase
        .from('business_settings')
        .upsert(settings, { onConflict: 'id' });

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means table doesn't exist, which is okay for demo
        throw error;
      }

      // Also save to localStorage as fallback
      localStorage.setItem('xl-traders-settings', JSON.stringify(settings));

      toast.success('Settings saved');
    } catch (error) {
      console.error(error);
      // Save to localStorage anyway
      localStorage.setItem('xl-traders-settings', JSON.stringify(settings));
      toast.success('Settings saved locally');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-600 text-sm mt-1">Manage business information and contact details</p>
      </div>

      {/* Table unavailable notice */}
      {!tableAvailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Settings not configured</span> — the{' '}
          <code className="font-mono text-xs">business_settings</code> table was not found in Supabase.
          Changes will be saved to localStorage only.
        </div>
      )}

      {/* Business Information */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="XL Traders"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Street address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="Surat"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={settings.state}
                onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                placeholder="Gujarat"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={settings.pincode}
                onChange={(e) => setSettings({ ...settings, pincode: e.target.value })}
                placeholder="395001"
              />
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <Label htmlFor="business_description">Business Description</Label>
            <Textarea
              id="business_description"
              value={settings.business_description}
              onChange={(e) => setSettings({ ...settings, business_description: e.target.value })}
              placeholder="Describe your business..."
              rows={4}
            />
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number *</Label>
              <Input
                id="whatsapp"
                value={settings.whatsapp_number}
                onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                placeholder="919773239442"
                type="tel"
              />
              <p className="text-xs text-slate-500">Include country code (e.g., 91 for India)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_1">Phone 1</Label>
              <Input
                id="phone_1"
                value={settings.phone_1}
                onChange={(e) => setSettings({ ...settings, phone_1: e.target.value })}
                placeholder="9773239442"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_2">Phone 2</Label>
              <Input
                id="phone_2"
                value={settings.phone_2}
                onChange={(e) => setSettings({ ...settings, phone_2: e.target.value })}
                placeholder="7778052990"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="xltraders990@gmail.com"
                type="email"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-600 mt-1" />
            <div>
              <h4 className="font-semibold text-blue-900">WhatsApp Integration</h4>
              <p className="text-sm text-blue-700 mt-1">
                The WhatsApp number is used for enquiry buttons throughout the site
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-green-600 mt-1" />
            <div>
              <h4 className="font-semibold text-green-900">Contact Details</h4>
              <p className="text-sm text-green-700 mt-1">
                These are displayed in the header and footer
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-purple-600 mt-1" />
            <div>
              <h4 className="font-semibold text-purple-900">Business Info</h4>
              <p className="text-sm text-purple-700 mt-1">
                Used for company information on the site
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Preview */}
      <Card className="p-6 bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Preview</h3>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-slate-600">Company:</span>
            <p className="font-medium">{settings.company_name}</p>
          </div>
          <div>
            <span className="text-slate-600">Address:</span>
            <p className="font-medium">{settings.address}, {settings.city}, {settings.state} {settings.pincode}</p>
          </div>
          <div>
            <span className="text-slate-600">WhatsApp:</span>
            <p className="font-medium">+{settings.whatsapp_number}</p>
          </div>
          <div>
            <span className="text-slate-600">Email:</span>
            <p className="font-medium">{settings.email}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
