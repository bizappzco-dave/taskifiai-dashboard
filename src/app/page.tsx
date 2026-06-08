'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  industry: string;
  upload_token?: string;
  review_token?: string;
  tier?: string;
  user_id?: string;
  created_at: string;
  socialdrive_enabled?: boolean;
  dmchamp_enabled?: boolean;
}

interface StaffAccess {
  client_id: string;
  role: string;
  clients: {
    id: string;
    name: string;
    industry: string;
    upload_token?: string;
    review_token?: string;
    tier?: string;
    created_at: string;
    socialdrive_enabled?: boolean;
    dmchamp_enabled?: boolean;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const supabase = getSupabase();
      
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        // Redirect to sign in
        router.push('/auth/signin');
        return;
      }
      
      setUser({ email: currentUser.email || '', id: currentUser.id });

      // Get clients owned by user
      const { data: ownedClients, error: ownedError } = await supabase
        .from('clients')
        .select('id, name, industry, upload_token, review_token, tier, user_id, created_at, socialdrive_enabled, dmchamp_enabled')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Get clients where user is staff
      const { data: staffAccess, error: staffError } = await supabase
        .from('client_staff_access')
        .select('client_id, role, clients:client_id (id, name, industry, upload_token, review_token, tier, created_at, socialdrive_enabled, dmchamp_enabled)')
        .eq('user_id', currentUser.id);

      if (staffError) throw staffError;

      // Combine both lists
      const staffClients = (staffAccess?.map(s => {
        const client = s.clients;
        return Array.isArray(client) ? client[0] : client;
      }).filter(Boolean) || []) as Client[];
      
      const allClients = [...(ownedClients || []), ...staffClients];
      
      // Remove duplicates by client id
      const uniqueClientsMap = new Map<string, Client>();
      allClients.forEach((c) => {
        if (c && c.id) {
          uniqueClientsMap.set(c.id, c);
        }
      });
      const uniqueClients = Array.from(uniqueClientsMap.values());

      setClients(uniqueClients);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">TaskifiAI</h1>
              <p className="text-gray-600 mt-1">Welcome back{user?.email ? `, ${user.email}` : ''}</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/pipeline"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                📊 Lead Pipeline
              </Link>
              <Link
                href="/clients/new"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                + Add Client
              </Link>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {clients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4 text-lg">No clients yet</p>
            <p className="text-gray-500 mb-6">Add your first client to get started with TaskifiAI products</p>
            <Link
              href="/clients/new"
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Your First Client
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div key={client.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
                {/* Client Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{client.industry}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full capitalize">
                    {client.tier || 'simple'}
                  </span>
                </div>

                {/* Product Badges */}
                <div className="flex gap-2 mb-4">
                  {client.socialdrive_enabled ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      SocialDrive
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      SocialDrive
                    </span>
                  )}
                  {client.dmchamp_enabled ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      DM Champ
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      DM Champ
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 mb-4">
                  {client.upload_token ? (
                    <a
                      href={`https://socialdrive-ai.vercel.app/upload/${client.upload_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      📸 Upload Images
                    </a>
                  ) : (
                    <button
                      disabled
                      className="block w-full bg-gray-300 text-gray-500 text-center px-4 py-2 rounded-lg font-medium cursor-not-allowed"
                    >
                      Upload (Not Enabled)
                    </button>
                  )}
                  
                  {client.review_token ? (
                    <a
                      href={`https://socialdrive-ai.vercel.app/review?token=${client.review_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      ✅ Review Posts
                    </a>
                  ) : (
                    <button
                      disabled
                      className="block w-full bg-gray-300 text-gray-500 text-center px-4 py-2 rounded-lg font-medium cursor-not-allowed"
                    >
                      Review (Not Enabled)
                    </button>
                  )}
                  
                  <a
                    href="https://socialdrive-ai.vercel.app/client/posting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    ✍️ Create Post
                  </a>
                </div>

                {/* Secondary Actions */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <Link
                    href={`/clients/${client.id}`}
                    className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-center px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    📋 View Details
                  </Link>
                  <Link
                    href={`/clients/${client.id}/team`}
                    className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-center px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    👥 Manage Team
                  </Link>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Added {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
