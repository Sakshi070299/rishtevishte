'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Lock, AlertTriangle } from 'lucide-react';
import { State } from 'country-state-city';
import { profilesApi } from '@/lib/api';
import type { Profile } from '@/types';

const PARTNER_PREFERENCE_OPTIONS = [
  'Service (Job preference)',
  'Business',
  'Homely',
  'Suitable',
];

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const indiaStates = useMemo(
    () =>
      State.getStatesOfCountry('IN')
        .map(s => s.name)
        .sort((a, b) => a.localeCompare(b)),
    []
  );

  // ─── Load profile data ────────────────────────────
  useEffect(() => {
    if (!id) return;
    profilesApi.get(id)
      .then((data: any) => {
        setProfile(data);
        // Pre-fill form with existing data
        setForm({
          fullName: data.fullName || '',
          fatherName: data.fatherName || '',
          guardianPhone: data.guardianPhone || '',
          alternateMobile: data.alternateMobile || '',
          guardianEmail: data.guardianEmail || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          motherName: data.motherName || '',
          education: data.education || '',
          professionDetails: data.professionDetails || '',
          incomeType: data.incomeType || 'MONTHLY',
          incomeValue: data.incomeValue || data.monthlyIncome?.toString() || '',
          height: data.height || '',
          heightUnit: data.heightUnit || 'FT',
          weight: data.weight || '',
          diet: data.diet || '',
          healthStatus: data.healthStatus || '',
          glassesType: data.glassesType || (data.glasses ? 'YES' : 'NO'),
          religion: data.religion || '',
          caste: data.caste || '',
          house: data.house || '',
          business: data.business || '',
          otherProperty: data.otherProperty || '',
          preferredCaste: data.preferredCaste || '',
          preferredAgeMin: data.preferredAgeMin?.toString() || '',
          preferredAgeMax: data.preferredAgeMax?.toString() || '',
          preferredLocation: data.preferredLocation || '',
          partnerPreference: data.partnerPreference || '',
          partnerPreferenceDetails: data.partnerPreferenceDetails || '',
        });
      })
      .catch((err: any) => toast.error(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await profilesApi.update(id, {
        fullName: form.fullName,
        fatherName: form.fatherName,
        guardianPhone: form.guardianPhone,
        alternateMobile: form.alternateMobile?.trim() || undefined,
        guardianEmail: form.guardianEmail || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        motherName: form.motherName || undefined,
        education: form.education || undefined,
        professionDetails: form.professionDetails || undefined,
        incomeType: form.incomeValue?.trim() ? (form.incomeType || 'MONTHLY') : undefined,
        incomeValue: form.incomeValue?.trim() || undefined,
        monthlyIncome: form.incomeValue && /^\d+$/.test(form.incomeValue.trim()) ? parseInt(form.incomeValue.trim(), 10) : undefined,
        height: form.height || undefined,
        heightUnit: form.height ? (form.heightUnit || 'FT') : undefined,
        weight: form.weight || undefined,
        diet: form.diet || undefined,
        healthStatus: form.healthStatus || undefined,
        glassesType: form.glassesType || undefined,
        glasses: form.glassesType === 'YES' || form.glassesType === 'OCCASIONALLY',
        religion: form.religion || undefined,
        caste: form.caste || undefined,
        house: form.house || undefined,
        business: form.business || undefined,
        otherProperty: form.otherProperty || undefined,
        preferredCaste: form.preferredCaste || undefined,
        preferredAgeMin: form.preferredAgeMin ? parseInt(form.preferredAgeMin) : undefined,
        preferredAgeMax: form.preferredAgeMax ? parseInt(form.preferredAgeMax) : undefined,
        preferredLocation: form.preferredLocation || undefined,
        partnerPreference: form.partnerPreference?.trim() || undefined,
        partnerPreferenceDetails: form.partnerPreferenceDetails?.trim() || undefined,
      });
      toast.success('Profile updated successfully!');
      router.push('/profiles');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-20">
      <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
      <h3 className="font-bold text-temple-brown">Profile not found</h3>
      <button onClick={() => router.push('/profiles')} className="btn-primary mt-4">Back to Profiles</button>
    </div>
  );

  if (profile.status === 'SETTLED') return (
    <div className="text-center py-20">
      <Lock size={48} className="mx-auto text-blue-500 mb-4" />
      <h3 className="font-bold text-temple-brown mb-2">Profile is Settled</h3>
      <p className="text-sm text-temple-brown-light mb-4">This profile has been marked as settled and cannot be edited.</p>
      <p className="font-hindi text-primary text-sm mb-4">यह प्रोफ़ाइल तय हो चुकी है और इसे संपादित नहीं किया जा सकता।</p>
      <button onClick={() => router.push('/profiles')} className="btn-outline">Back to Profiles</button>
    </div>
  );

  const Field = ({ label, hi, field, type = 'text', ph = '' }: {
    label: string; hi?: string; field: string; type?: string; ph?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-temple-brown-light mb-1">
        {label} {hi && <span className="font-hindi text-primary">{hi}</span>}
      </label>
      <input
        type={type}
        value={form[field] || ''}
        onChange={(e) => upd(field, e.target.value)}
        placeholder={ph}
        className="input-field"
      />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/profiles')} className="text-sm text-primary hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={14} /> Back to Profiles
          </button>
          <h2 className="text-xl font-bold text-maroon">Edit Profile: {profile.fullName}</h2>
          <p className="text-xs text-temple-brown-light">{profile.registrationNumber} · {profile.gender}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          profile.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>{profile.status}</span>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-xl shadow-lg border border-[#E8D5C4] p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-maroon mb-3 text-sm border-b border-primary-light pb-2">Personal Details <span className="font-hindi text-primary">व्यक्तिगत</span></h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full Name" hi="पूरा नाम" field="fullName" />
            <Field label="Father Name" hi="पिता का नाम" field="fatherName" />
            <Field label="Phone" hi="फ़ोन" field="guardianPhone" type="tel" />
            <Field label="Alternate Mobile" hi="वैकल्पिक मोबाइल" field="alternateMobile" type="tel" ph="optional" />
            <Field label="Email" hi="ईमेल" field="guardianEmail" type="email" />
            <Field label="Education" hi="शिक्षा" field="education" />
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Income Type
              </label>
              <select
                value={form.incomeType || 'MONTHLY'}
                onChange={(e) => upd('incomeType', e.target.value)}
                className="input-field"
              >
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </div>
            <Field
              label={form.incomeType === 'YEARLY' ? 'Yearly Income' : 'Monthly Income'}
              hi={form.incomeType === 'YEARLY' ? 'वार्षिक आय' : 'आय'}
              field="incomeValue"
              ph={form.incomeType === 'YEARLY' ? 'e.g. 10 Lakh / 1200000' : 'e.g. 10 Lakh / 100000'}
            />
            <Field
              label="Height"
              field="height"
              ph={form.heightUnit === 'IN' ? 'e.g. 66' : form.heightUnit === 'FT' ? 'e.g. 5.8' : 'e.g. 170'}
            />
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Height Unit (default FT)
              </label>
              <select
                value={form.heightUnit || 'FT'}
                onChange={(e) => upd('heightUnit', e.target.value)}
                className="input-field"
              >
                <option value="CM">CM</option>
                <option value="IN">IN</option>
                <option value="FT">FT</option>
              </select>
            </div>
            <Field label="Weight (kg)" field="weight" />
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Glasses <span className="font-hindi text-primary">चश्मा</span>
              </label>
              <select
                value={form.glassesType || 'NO'}
                onChange={(e) => upd('glassesType', e.target.value)}
                className="input-field"
              >
                <option value="NO">No (नहीं)</option>
                <option value="YES">Yes (हाँ)</option>
                <option value="OCCASIONALLY">Occasionally (कभी-कभी)</option>
              </select>
            </div>
            <Field label="Religion" hi="धर्म" field="religion" />
            <Field label="Caste" hi="जाति" field="caste" />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-maroon mb-3 text-sm border-b border-primary-light pb-2">Address <span className="font-hindi text-primary">पता</span></h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label="Address" hi="पता" field="address" /></div>
            <Field label="City" hi="शहर" field="city" />
            <Field label="State" hi="राज्य" field="state" />
            <Field label="Pincode" field="pincode" />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-maroon mb-3 text-sm border-b border-primary-light pb-2">Property <span className="font-hindi text-primary">संपत्ति</span></h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="House" hi="मकान" field="house" />
            <Field label="Business" hi="व्यापार" field="business" />
            <Field label="Other Property" hi="अन्य" field="otherProperty" />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-maroon mb-3 text-sm border-b border-primary-light pb-2">Preferences <span className="font-hindi text-primary">प्राथमिकता</span></h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Preferred Caste" hi="जाति" field="preferredCaste" />
            <Field label="Age Min" field="preferredAgeMin" type="number" />
            <Field label="Age Max" field="preferredAgeMax" type="number" />
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Location <span className="font-hindi text-primary">स्थान</span>
              </label>
              <select
                value={form.preferredLocation || ''}
                onChange={(e) => upd('preferredLocation', e.target.value)}
                className="input-field"
              >
                <option value="">Select state / राज्य चुनें</option>
                {indiaStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Preference <span className="font-hindi text-primary">वरीयता</span>
              </label>
              <select
                value={form.partnerPreference || ''}
                onChange={(e) => upd('partnerPreference', e.target.value)}
                className="input-field"
              >
                <option value="">Select / चुनें</option>
                {PARTNER_PREFERENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <Field
              label="Preference Details"
              hi="वरीयता विवरण"
              field="partnerPreferenceDetails"
              ph="Describe expected profession details"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[#E8D5C4]">
          <button onClick={() => router.push('/profiles')} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
