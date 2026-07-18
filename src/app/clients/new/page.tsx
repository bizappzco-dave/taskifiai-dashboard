'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import DashboardNav from '@/components/DashboardNav';

type FieldName =
  | 'business_name'
  | 'contact_name'
  | 'email'
  | 'phone'
  | 'industry'
  | 'website'
  | 'instagram_handle'
  | 'facebook_handle'
  | 'linkedin_handle'
  | 'brand_tone'
  | 'target_audience'
  | 'usps'
  | 'competitors'
  | 'content_goals'
  | 'posting_frequency'
  | 'subscription_tier'
  | 'subscription_billing_cycle'
  | 'subscription_price'
  | 'subscription_description';

const initialFormData: Record<FieldName, string> = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  industry: '',
  website: '',
  instagram_handle: '',
  facebook_handle: '',
  linkedin_handle: '',
  brand_tone: '',
  target_audience: '',
  usps: '',
  competitors: '',
  content_goals: '',
  posting_frequency: '',
  subscription_tier: 'starter',
  subscription_billing_cycle: 'monthly',
  subscription_price: '',
  subscription_description: '',
};

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Please sign in again before creating a client.');
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create client');
      }

      const client = await res.json();
      router.push(`/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero taskifi-form-hero">
          <div>
            <Link href="/" className="taskifi-back-link">← Back to dashboard</Link>
            <p className="taskifi-pill"><span /> Client setup</p>
            <h1>Add a client without the clutter.</h1>
            <p>Create the core client profile once, then connect content, review, ad report and lead-tracking workflows as the account grows.</p>
          </div>
          <div className="taskifi-setup-steps">
            <span><strong>1</strong> Business</span>
            <span><strong>2</strong> Contact</span>
            <span><strong>3</strong> Brand</span>
          </div>
        </section>

        {error && <div className="taskifi-alert" role="alert"><strong>Could not create client:</strong> {error}</div>}

        <form onSubmit={handleSubmit} className="taskifi-client-form">
          <section className="taskifi-form-card">
            <div className="taskifi-form-card-heading">
              <p className="taskifi-eyebrow">Step 1</p>
              <h2>Business information</h2>
              <p>The basic profile used across TaskifiAI products.</p>
            </div>
            <div className="taskifi-form-grid">
              <Field label="Business name" name="business_name" value={formData.business_name} onChange={handleChange} required placeholder="e.g. T1T Towing" />
              <Field label="Industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. Towing, kitchens, beauty" />
              <Field label="Website" name="website" type="url" value={formData.website} onChange={handleChange} placeholder="https://example.com" />
              <label className="taskifi-field">
                <span>Subscription tier</span>
                <select name="subscription_tier" value={formData.subscription_tier} onChange={handleChange}>
                  <option value="starter">Starter (€49/mo)</option>
                  <option value="pro">Pro (€99/mo)</option>
                  <option value="enterprise">Enterprise (€179/mo)</option>
                </select>
              </label>
              <label className="taskifi-field">
                <span>Billing model</span>
                <select name="subscription_billing_cycle" value={formData.subscription_billing_cycle} onChange={handleChange}>
                  <option value="monthly">Monthly subscription</option>
                  <option value="one_off">One-off subscription fee</option>
                </select>
              </label>
              <label className="taskifi-field">
                <span>Subscription price</span>
                <input
                  type="number"
                  name="subscription_price"
                  value={formData.subscription_price}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder={formData.subscription_billing_cycle === 'one_off' ? 'e.g. 179.00' : 'e.g. 179.00'}
                />
              </label>
              <Field
                label="Subscription description"
                name="subscription_description"
                value={formData.subscription_description}
                onChange={handleChange}
                placeholder="Premium setup + monthly management"
              />
            </div>
          </section>

          <section className="taskifi-form-card">
            <div className="taskifi-form-card-heading">
              <p className="taskifi-eyebrow">Step 2</p>
              <h2>Contact details</h2>
              <p>The person TaskifiAI should use for client communication and approvals.</p>
            </div>
            <div className="taskifi-form-grid">
              <Field label="Contact name" name="contact_name" value={formData.contact_name} onChange={handleChange} required placeholder="e.g. Deborah Murphy" />
              <Field label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="contact@example.com" />
              <Field label="Phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+353 87 123 4567" />
            </div>
          </section>

          <section className="taskifi-form-card">
            <div className="taskifi-form-card-heading">
              <p className="taskifi-eyebrow">Step 3</p>
              <h2>Social and brand profile</h2>
              <p>Useful context for captions, review responses, audits and campaign reporting.</p>
            </div>
            <div className="taskifi-form-grid three">
              <Field label="Instagram" name="instagram_handle" value={formData.instagram_handle} onChange={handleChange} placeholder="@username" />
              <Field label="Facebook" name="facebook_handle" value={formData.facebook_handle} onChange={handleChange} placeholder="@username" />
              <Field label="LinkedIn" name="linkedin_handle" value={formData.linkedin_handle} onChange={handleChange} placeholder="/in/username" />
            </div>
            <div className="taskifi-form-stack">
              <Field label="Brand tone" name="brand_tone" value={formData.brand_tone} onChange={handleChange} placeholder="Professional, friendly, practical" />
              <TextArea label="Target audience" name="target_audience" value={formData.target_audience} onChange={handleChange} placeholder="Who are they trying to reach?" />
              <TextArea label="Unique selling points" name="usps" value={formData.usps} onChange={handleChange} placeholder="What makes this business different?" />
              <TextArea label="Competitors" name="competitors" value={formData.competitors} onChange={handleChange} placeholder="Known competitors or businesses to benchmark against" />
              <TextArea label="Content goals" name="content_goals" value={formData.content_goals} onChange={handleChange} placeholder="More calls, more reviews, more bookings, more repeat customers..." />
              <Field label="Posting frequency" name="posting_frequency" value={formData.posting_frequency} onChange={handleChange} placeholder="e.g. 3 posts per week" />
            </div>
          </section>

          <div className="taskifi-form-actions">
            <Link href="/" className="taskifi-button taskifi-button-secondary">Cancel</Link>
            <button type="submit" disabled={loading} className="taskifi-button taskifi-button-primary">
              {loading ? 'Creating client...' : 'Create client'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, name, value, onChange, placeholder, type = 'text', required = false }: {
  label: string;
  name: FieldName;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="taskifi-field">
      <span>{label}{required ? ' *' : ''}</span>
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </label>
  );
}

function TextArea({ label, name, value, onChange, placeholder }: {
  label: string;
  name: FieldName;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="taskifi-field">
      <span>{label}</span>
      <textarea name={name} rows={3} value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}
