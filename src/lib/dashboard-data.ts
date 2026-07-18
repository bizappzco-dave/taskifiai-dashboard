import { getSupabase } from '@/lib/supabase';

export interface DashboardClient {
  id: string;
  name?: string;
  business_name?: string;
  industry?: string;
  email?: string;
  phone?: string;
  website?: string;
  tier?: string;
  subscription_tier?: string;
  status?: string;
  user_id?: string;
  created_at?: string;
  upload_token?: string;
  review_token?: string;
  upload_post_connected?: boolean;
  socialdrive_enabled?: boolean;
  dmchamp_enabled?: boolean;
  features?: Record<string, any> | null;
  products?: Array<{
    id: string;
    slug: string;
    name: string;
    status?: string;
    subscription_id?: string;
  }>;
  ultra_marketing_enabled?: boolean;
  subscription_description?: string | null;
  subscription_billing_cycle?: string;
  monthly_revenue?: number | null;
  brand_tone?: string;
  target_audience?: string;
  usps?: string;
  content_goals?: string;
  posting_frequency?: string;
  socialdrive_upload_url?: string;
  socialdrive_dashboard_url?: string;
  dmchamp_login_url?: string;
}

interface StaffAccessRow {
  client_id: string;
  role: string;
  clients: DashboardClient | DashboardClient[] | null;
}

export function clientName(client: Partial<DashboardClient> | null | undefined): string {
  return client?.name || client?.business_name || 'Unnamed client';
}

export function clientTier(client: Partial<DashboardClient> | null | undefined): string {
  return client?.tier || client?.subscription_tier || 'Core';
}

export function hasSocialDrive(client: Partial<DashboardClient> | null | undefined): boolean {
  return Boolean(
    client?.socialdrive_enabled ||
    client?.upload_token ||
    client?.review_token ||
    client?.upload_post_connected ||
    client?.socialdrive_upload_url ||
    client?.socialdrive_dashboard_url
  );
}

export function hasDmChamp(client: Partial<DashboardClient> | null | undefined): boolean {
  return Boolean(client?.dmchamp_enabled || client?.dmchamp_login_url);
}

export function hasUltraMarketing(client: Partial<DashboardClient> | null | undefined): boolean {
  const productStatus =
    client?.features?.products?.ultra_marketing?.status ||
    client?.features?.ultra_marketing?.status;
  const activeSubscription = client?.products?.some((product) =>
    product.slug === 'ultra-marketing' && (!product.status || product.status === 'active')
  );

  return Boolean(
    client?.ultra_marketing_enabled ||
    activeSubscription ||
    productStatus === 'active' ||
    productStatus === 'trial'
  );
}

export async function requireDashboardUser() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function loadAccessibleClients(userId: string): Promise<DashboardClient[]> {
  const supabase = getSupabase();

  const { data: ownedClients, error: ownedError } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (ownedError) throw ownedError;

  const { data: staffAccess, error: staffError } = await supabase
    .from('client_staff_access')
    .select('client_id, role, clients:client_id (*)')
    .eq('user_id', userId)
    .eq('invitation_accepted', true);

  if (staffError) throw staffError;

  const staffClients = ((staffAccess || []) as StaffAccessRow[])
    .map((row) => Array.isArray(row.clients) ? row.clients[0] : row.clients)
    .filter(Boolean) as DashboardClient[];

  const unique = new Map<string, DashboardClient>();
  [...(ownedClients || []), ...staffClients].forEach((client) => {
    if (client?.id) {
      unique.set(client.id, {
        ...client,
        socialdrive_enabled: hasSocialDrive(client),
        dmchamp_enabled: hasDmChamp(client),
        ultra_marketing_enabled: hasUltraMarketing(client),
      });
    }
  });

  return Array.from(unique.values());
}
