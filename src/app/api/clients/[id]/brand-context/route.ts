import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/clients/[id]/brand-context
 * Get brand context for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const clientId = params.id;

    const { data: brandContext, error } = await supabase
      .from('brand_contexts')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No brand context yet
        return NextResponse.json({ brandContext: null });
      }
      throw error;
    }

    return NextResponse.json({ brandContext });

  } catch (error: any) {
    console.error('Get brand context error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/clients/[id]/brand-context
 * Update brand context for a client
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const clientId = params.id;
    const body = await request.json();

    // Check if brand context exists
    const { data: existing } = await supabase
      .from('brand_contexts')
      .select('id')
      .eq('client_id', clientId)
      .single();

    let result;
    
    if (existing) {
      // Update existing
      result = await supabase
        .from('brand_contexts')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from('brand_contexts')
        .insert({
          client_id: clientId,
          ...body,
        })
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({ brandContext: result.data });

  } catch (error: any) {
    console.error('Update brand context error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
