import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/clients/[id]/staff
 * List all staff members for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: staff, error } = await supabase
      .from('client_staff_access')
      .select(`
        id,
        user_id,
        role,
        created_at,
        invited_email,
        invitation_accepted
      `)
      .eq('client_id', params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get user details for staff with user_id
    const userIds = staff.filter((s) => s.user_id).map((s) => s.user_id);
    let userMap = new Map();

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, raw_user_meta_data')
        .in('id', userIds);

      if (users) {
        users.forEach((u) => {
          userMap.set(u.id, u);
        });
      }
    }

    // Format staff list
    const formattedStaff = staff.map((s: any) => {
      const user = userMap.get(s.user_id);
      return {
        id: s.id,
        user_id: s.user_id,
        email: user?.email || s.invited_email,
        role: s.role,
        created_at: s.created_at,
        invitation_accepted: s.invitation_accepted,
        name: user?.raw_user_meta_data?.fullName || user?.raw_user_meta_data?.name,
      };
    });

    return NextResponse.json({ staff: formattedStaff });
  } catch (error: any) {
    console.error('List staff error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/clients/[id]/staff
 * Add a staff member to a client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by email in our database
    const { data: existingUser } = await supabase
      .from('client_staff_access')
      .select('user_id, users:users (id, email, raw_user_meta_data)')
      .eq('invited_email', email)
      .or(`invited_email.is.null, invited_email.eq.${email}`)
      .maybeSingle();

    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (existingUser?.users) {
      const user = Array.isArray(existingUser.users)
        ? existingUser.users[0]
        : existingUser.users;
      if (user) {
        userId = user.id;
        userEmail = user.email;
        userName =
          (user.raw_user_meta_data as any)?.fullName ||
          (user.raw_user_meta_data as any)?.name;
      }
    }

    // If user exists, add them directly
    if (userId) {
      const { data: access, error: accessError } = await supabase
        .from('client_staff_access')
        .insert({
          client_id: params.id,
          user_id: userId,
          role,
          invitation_accepted: true,
        })
        .select()
        .single();

      if (accessError) {
        if (accessError.code === '23505') {
          // Unique violation
          return NextResponse.json(
            { error: 'User is already a staff member' },
            { status: 409 }
          );
        }
        console.error('Failed to add staff:', accessError);
        return NextResponse.json(
          { error: 'Failed to add staff' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        staff: {
          id: access.id,
          user_id: access.user_id,
          email: userEmail,
          role: access.role,
        },
        message: `${userEmail} added as ${role}`,
      });
    }

    // User doesn't exist - create pending invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('client_staff_access')
      .insert({
        client_id: params.id,
        invited_email: email,
        role,
        invitation_accepted: false,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Failed to create invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email,
        role,
        status: 'pending',
      },
      message: `Invitation sent to ${email}. They will gain access once they create an account.`,
    });
  } catch (error: any) {
    console.error('Add staff error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
