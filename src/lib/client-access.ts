import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export type AuthenticatedUser = {
  id: string
  email?: string | null
}

export type ClientAccess = {
  userId: string
  clientId: string
  role: string
  client: any
}

type AuthRouteResult =
  | { user: AuthenticatedUser; response?: undefined }
  | { user?: undefined; response: NextResponse }

type ClientRouteResult =
  | { access: ClientAccess; response?: undefined }
  | { access?: undefined; response: NextResponse }

const roleRank: Record<string, number> = {
  viewer: 1,
  staff: 2,
  editor: 3,
  admin: 4,
  manager: 4,
  owner: 5,
}

export function roleAtLeast(role: string | null | undefined, minimum: string) {
  return (roleRank[role || 'viewer'] || 0) >= (roleRank[minimum] || 0)
}

function bearerTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 })
}

function forbidden(message = 'You do not have access to this client') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = bearerTokenFromRequest(request)
  if (!token) return null

  const supabase = getSupabaseAdmin() as any
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) return null
  return { id: user.id, email: user.email }
}

export async function requireAuthenticatedUserFromRequest(request: Request): Promise<AuthRouteResult> {
  const user = await getAuthenticatedUserFromRequest(request)
  if (!user) {
    return { response: unauthorized('Your session has expired. Please sign in again.') }
  }

  return { user }
}

export async function getClientAccessForUser(userId: string, clientId: string): Promise<ClientAccess | null> {
  const supabase = getSupabaseAdmin() as any

  const { data: ownedClient, error: ownedError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle()

  if (ownedError) throw ownedError

  if (ownedClient) {
    return { userId, clientId, role: 'owner', client: ownedClient }
  }

  const { data: staffAccess, error: staffError } = await supabase
    .from('client_staff_access')
    .select('role, clients:client_id (*)')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .eq('invitation_accepted', true)
    .maybeSingle()

  if (staffError) throw staffError
  if (!staffAccess) return null

  const client = Array.isArray(staffAccess.clients) ? staffAccess.clients[0] : staffAccess.clients
  if (!client) return null

  return { userId, clientId, role: staffAccess.role || 'viewer', client }
}

export async function getClientAccessFromRequest(request: Request, clientId: string): Promise<ClientAccess | null> {
  const user = await getAuthenticatedUserFromRequest(request)
  if (!user) return null

  return getClientAccessForUser(user.id, clientId)
}

export async function requireClientRouteAccess(
  request: Request,
  clientId: string,
  options: { minimumRole?: string } = {}
): Promise<ClientRouteResult> {
  const authResult = await requireAuthenticatedUserFromRequest(request)
  if (authResult.response) return { response: authResult.response }

  const access = await getClientAccessForUser(authResult.user.id, clientId)
  if (!access) return { response: forbidden() }

  const minimumRole = options.minimumRole || 'viewer'
  if (!roleAtLeast(access.role, minimumRole)) {
    return { response: forbidden(`This action requires ${minimumRole} access`) }
  }

  return { access }
}

export async function listAccessibleClientsForUser(userId: string) {
  const supabase = getSupabaseAdmin() as any

  const { data: ownedClients, error: ownedError } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (ownedError) throw ownedError

  const { data: staffAccess, error: staffError } = await supabase
    .from('client_staff_access')
    .select('client_id, role, clients:client_id (*)')
    .eq('user_id', userId)
    .eq('invitation_accepted', true)

  if (staffError) throw staffError

  const unique = new Map<string, any>()
  ;[...(ownedClients || []), ...((staffAccess || []) as any[])
    .map((row) => Array.isArray(row.clients) ? row.clients[0] : row.clients)
    .filter(Boolean)]
    .forEach((client: any) => {
      if (client?.id) unique.set(client.id, client)
    })

  return Array.from(unique.values())
}
