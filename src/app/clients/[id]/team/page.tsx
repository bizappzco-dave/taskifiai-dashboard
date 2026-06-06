'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StaffMember {
  id: string;
  user_id?: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
  name?: string;
  created_at: string;
  invitation_accepted: boolean;
}

export default function TeamManagementPage() {
  const params = useParams();
  const clientId = params.id as string;
  
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStaff();
  }, [clientId]);

  async function fetchStaff() {
    try {
      const res = await fetch(`/api/clients/${clientId}/staff`);
      if (!res.ok) throw new Error('Failed to load team');
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addStaffMember(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setMessage('');

    try {
      const res = await fetch(`/api/clients/${clientId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add staff');
      }

      const data = await res.json();
      setMessage(data.message || 'Staff member added successfully');
      setNewEmail('');
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeStaffMember(staffId: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return;

    try {
      const res = await fetch(`/api/clients/${clientId}/staff/${staffId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove staff');
      }

      setMessage('Staff member removed');
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function updateRole(staffId: string, newRole: 'admin' | 'staff' | 'viewer') {
    try {
      const res = await fetch(`/api/clients/${clientId}/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }

      setMessage('Role updated');
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-500">Loading team...</p>
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
              <Link href={`/clients/${clientId}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                ← Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
                <p className="text-gray-500 mt-1">Manage who has access to this client</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Add Staff Form */}
        <div className="bg-white shadow sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add Team Member</h2>
            <form onSubmit={addStaffMember} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="team@company.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>

        {/* Team List */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Current Team</h2>
            
            {staff.length === 0 ? (
              <p className="text-gray-500 text-sm">No team members yet. Add someone above.</p>
            ) : (
              <div className="space-y-4">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-700 font-medium">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.name || member.email}
                        </p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        {!member.invitation_accepted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                            Pending Invitation
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member.id, e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="viewer">Viewer</option>
                      </select>

                      <button
                        onClick={() => removeStaffMember(member.id, member.email)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Role Descriptions */}
        <div className="mt-6 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Role Permissions</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-4">
                <dt className="w-20 font-medium text-gray-700">Admin</dt>
                <dd className="text-gray-600">Full access - can manage team, create content, view all data</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-20 font-medium text-gray-700">Staff</dt>
                <dd className="text-gray-600">Can create content and view data, cannot manage team</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-20 font-medium text-gray-700">Viewer</dt>
                <dd className="text-gray-600">Read-only access - can view but not create or modify</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
