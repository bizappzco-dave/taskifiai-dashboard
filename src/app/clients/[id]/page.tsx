'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  website: string;
  instagram_handle: string;
  facebook_handle: string;
  linkedin_handle: string;
  brand_tone: string;
  target_audience: string;
  usps: string;
  competitors: string;
  content_goals: string;
  posting_frequency: string;
  subscription_tier: string;
  created_at: string;
  socialdrive_enabled: boolean;
  dmchamp_enabled: boolean;
  socialdrive_upload_url?: string;
  socialdrive_dashboard_url?: string;
  dmchamp_login_url?: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState<{ socialdrive?: boolean; dmchamp?: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchClient(params.id as string);
    }
  }, [params.id]);

  const fetchClient = async (id: string) => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error('Client not found');
      const data = await res.json();
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const enableProduct = async (product: 'socialdrive' | 'dmchamp') => {
    if (!client) return;
    
    setEnabling({ [product]: true });
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}/enable-${product}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to enable ${product}`);
      }

      const updated = await res.json();
      setClient(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setEnabling({ [product]: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-500">Loading client...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Client not found'}</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-900">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="text-indigo-600 hover:text-indigo-900 mr-4">
                ← Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{client.business_name}</h1>
                <p className="text-gray-500 mt-1">{client.contact_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 capitalize">
                {client.subscription_tier}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.phone || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Industry</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.industry || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {client.website ? (
                        <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                          {client.website}
                        </a>
                      ) : (
                        'Not provided'
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Social Media */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Social Media</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Instagram</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.instagram_handle || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Facebook</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.facebook_handle || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">LinkedIn</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.linkedin_handle || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Brand Profile */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Brand Profile</h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Brand Tone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.brand_tone || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Target Audience</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{client.target_audience || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Unique Selling Points</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{client.usps || 'Not specified'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Products Sidebar */}
          <div className="space-y-6">
            {/* Products Card */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Active Products</h2>
                <div className="space-y-4">
                  {/* SocialDrive AI */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">SocialDrive AI</p>
                      <p className="text-sm text-gray-500">€99/month</p>
                    </div>
                    {client.socialdrive_enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => enableProduct('socialdrive')}
                        disabled={enabling.socialdrive}
                        className="px-3 py-1 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {enabling.socialdrive ? 'Enabling...' : 'Enable'}
                      </button>
                    )}
                  </div>

                  {/* DM Champ */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">DM Champ</p>
                      <p className="text-sm text-gray-500">€49/month</p>
                    </div>
                    {client.dmchamp_enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => enableProduct('dmchamp')}
                        disabled={enabling.dmchamp}
                        className="px-3 py-1 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {enabling.dmchamp ? 'Enabling...' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Links */}
                {(client.socialdrive_enabled || client.dmchamp_enabled) && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Links</h3>
                    <div className="space-y-2">
                      {client.socialdrive_dashboard_url && (
                        <a
                          href={client.socialdrive_dashboard_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          → SocialDrive Dashboard
                        </a>
                      )}
                      {client.socialdrive_upload_url && (
                        <a
                          href={client.socialdrive_upload_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          → Content Upload
                        </a>
                      )}
                      {client.dmchamp_login_url && (
                        <a
                          href={client.dmchamp_login_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          → DM Champ Login
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Created Date */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <p className="text-sm text-gray-500">Client since</p>
                <p className="mt-1 text-lg font-medium text-gray-900">
                  {new Date(client.created_at).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
