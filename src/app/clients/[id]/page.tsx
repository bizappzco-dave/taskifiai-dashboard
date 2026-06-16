'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityFeed from '@/components/ActivityFeed';

interface Client {
  id: string;
  name: string;
  industry: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram_handle?: string;
  facebook_handle?: string;
  linkedin_handle?: string;
  brand_tone?: string;
  target_audience?: string;
  usps?: string;
  competitors?: string;
  content_goals?: string;
  posting_frequency?: string;
  tier?: string;
  created_at: string;
  socialdrive_enabled?: boolean;
  dmchamp_enabled?: boolean;
  socialdrive_upload_url?: string;
  socialdrive_dashboard_url?: string;
  dmchamp_login_url?: string;
  upload_post_user_id?: string;
  upload_post_username?: string;
  upload_post_connected?: boolean;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState<{ socialdrive?: boolean; dmchamp?: boolean }>({});
  const [disabling, setDisabling] = useState<{ socialdrive?: boolean; dmchamp?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [connectingUploadPost, setConnectingUploadPost] = useState(false);
  const [uploadPostConnectUrl, setUploadPostConnectUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

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

  const disableProduct = async (product: 'socialdrive' | 'dmchamp') => {
    if (!client) return;
    
    if (!confirm(`Are you sure you want to disable ${product === 'socialdrive' ? 'SocialDrive AI' : 'DM Champ'} for ${client.name}? This will remove their access.`)) {
      return;
    }
    
    setDisabling({ [product]: true });
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}/disable-${product}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to disable ${product}`);
      }

      const updated = await res.json();
      setClient(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDisabling({ [product]: false });
    }
  };

  const connectUploadPost = async () => {
    if (!client) return;
    
    setConnectingUploadPost(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}/connect-upload-post`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate connect URL');
      }

      const data = await res.json();
      setUploadPostConnectUrl(data.connect_url);
      
      // Open connect URL in popup
      if (data.connect_url) {
        const popup = window.open(
          data.connect_url,
          'Connect Social Accounts',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Poll for connection status every 3 seconds
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/clients/${client.id}/connect-upload-post`);
          const statusData = await statusRes.json();
          
          if (statusData.connected) {
            clearInterval(pollInterval);
            // Refresh client data
            fetchClient(client.id);
            setUploadPostConnectUrl(null);
            alert('Social accounts connected successfully!');
          }
        }, 3000);
        
        // Stop polling if popup is closed
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            // Continue polling for 30 more seconds in case they're still connecting
            setTimeout(() => {
              clearInterval(pollInterval);
            }, 30000);
          }
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setConnectingUploadPost(false);
    }
  };

  const startEditing = () => {
    if (client) {
      setEditForm({ ...client });
      setEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const saveChanges = async () => {
    if (!client) return;
    
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save changes');
      }

      const updated = await res.json();
      setClient(updated);
      setEditing(false);
      setEditForm({});
      alert('Client details updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const updateEditForm = (field: keyof Client, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
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
                <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
                <p className="text-gray-500 mt-1">{client.industry}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 capitalize">
                {client.tier}
              </span>
              {!editing ? (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
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
                  {!editing ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => updateEditForm('email', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone || ''}
                          onChange={(e) => updateEditForm('phone', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                        <input
                          type="text"
                          value={editForm.industry || ''}
                          onChange={(e) => updateEditForm('industry', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                        <input
                          type="url"
                          value={editForm.website || ''}
                          onChange={(e) => updateEditForm('website', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>

            {/* Social Media */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Social Media</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {!editing ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                        <input
                          type="text"
                          value={editForm.instagram_handle || ''}
                          onChange={(e) => updateEditForm('instagram_handle', e.target.value)}
                          placeholder="@username"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                        <input
                          type="text"
                          value={editForm.facebook_handle || ''}
                          onChange={(e) => updateEditForm('facebook_handle', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                        <input
                          type="text"
                          value={editForm.linkedin_handle || ''}
                          onChange={(e) => updateEditForm('linkedin_handle', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}
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
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <a
                    href={`/clients/${client.id}/brand-context`}
                    className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Full Brand Context (Caption Library, Hashtag Strategy & More)
                  </a>
                </div>
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
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                        <button
                          onClick={() => disableProduct('socialdrive')}
                          disabled={disabling.socialdrive}
                          className="px-2 py-1 text-xs font-medium rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-50"
                        >
                          {disabling.socialdrive ? 'Disabling...' : 'Disable'}
                        </button>
                      </div>
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
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                        <button
                          onClick={() => disableProduct('dmchamp')}
                          disabled={disabling.dmchamp}
                          className="px-2 py-1 text-xs font-medium rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-50"
                        >
                          {disabling.dmchamp ? 'Disabling...' : 'Disable'}
                        </button>
                      </div>
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

                {/* Connected Accounts */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Connected Accounts</h3>
                  <div className="space-y-3">
                    {/* Instagram */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Instagram</p>
                          {client.upload_post_username ? (
                            <p className="text-xs text-gray-500">@{client.upload_post_username}</p>
                          ) : (
                            <p className="text-xs text-gray-500">Not connected</p>
                          )}
                        </div>
                      </div>
                      {client.upload_post_connected ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={connectUploadPost}
                          disabled={connectingUploadPost}
                          className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {connectingUploadPost ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Connect Instagram to enable automated posting via Upload-Post
                  </p>
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
                      <Link
                        href={`/clients/${client.id}/team`}
                        className="block text-sm text-indigo-600 hover:text-indigo-900"
                      >
                        → Manage Team
                      </Link>
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

        {/* Activity Feed */}
        <div className="mt-8">
          <ActivityFeed clientId={client.id} />
        </div>
      </main>
    </div>
  );
}
