import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const uploadPostApiKey = process.env.UPLOAD_POST_API_KEY!;
const uploadPostBaseUrl = process.env.UPLOAD_POST_BASE_URL || 'https://api.upload-post.com/api/uploadposts';

/**
 * POST /api/clients/[id]/connect-upload-post
 * Creates Upload-Post user profile and generates JWT connect URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const clientId = params.id;

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, upload_post_user_id, upload_post_username')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let userId = client.upload_post_user_id;
    let username = client.upload_post_username;

    // Step 1: Create user profile if doesn't exist
    if (!userId) {
      // Generate unique username from client name
      const generatedUsername = `${client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${clientId.slice(0, 6)}`;

      const createUserResponse = await fetch(`${uploadPostBaseUrl}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Apikey ${uploadPostApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `client-${clientId}@taskifiai.com`, // Internal email, client won't see
          username: generatedUsername,
          plan: 'professional',
        }),
      });

      const createUserResult = await createUserResponse.json();

      if (!createUserResponse.ok || !createUserResult.success) {
        console.error('Failed to create Upload-Post user:', createUserResult);
        return NextResponse.json(
          { error: 'Failed to create Upload-Post profile', details: createUserResult },
          { status: 500 }
        );
      }

      userId = createUserResult.user_id;
      username = createUserResult.username;

      // Save to database
      await supabase
        .from('clients')
        .update({
          upload_post_user_id: userId,
          upload_post_username: username,
        })
        .eq('id', clientId);
    }

    // Step 2: Generate JWT for connect URL
    const generateJwtResponse = await fetch(`${uploadPostBaseUrl}/users/generate-jwt`, {
      method: 'POST',
      headers: {
        'Authorization': `Apikey ${uploadPostApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    const jwtResult = await generateJwtResponse.json();

    if (!generateJwtResponse.ok || !jwtResult.success) {
      console.error('Failed to generate JWT:', jwtResult);
      return NextResponse.json(
        { error: 'Failed to generate connect URL', details: jwtResult },
        { status: 500 }
      );
    }

    const jwt = jwtResult.jwt;
    const connectUrl = `https://app.upload-post.com/connect?jwt=${jwt}`;

    // Save JWT to database (temporary, for tracking)
    await supabase
      .from('clients')
      .update({
        upload_post_jwt: jwt,
        upload_post_connected: false, // Will be set to true after OAuth
      })
      .eq('id', clientId);

    return NextResponse.json({
      success: true,
      user_id: userId,
      username,
      jwt,
      connect_url: connectUrl,
      message: 'Connect URL generated. Client should open this URL to connect their social accounts.',
    });

  } catch (error: any) {
    console.error('Connect Upload-Post error:', error.message);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * GET /api/clients/[id]/connect-upload-post
 * Check connection status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const clientId = params.id;

    const { data: client, error } = await supabase
      .from('clients')
      .select('upload_post_user_id, upload_post_username, upload_post_connected')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      connected: client.upload_post_connected || false,
      username: client.upload_post_username,
      user_id: client.upload_post_user_id,
    });

  } catch (error: any) {
    console.error('Check connection status error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
