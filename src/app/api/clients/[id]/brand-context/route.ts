import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/clients/[id]/brand-context
 * Get brand context for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const clientId = params.id;

    const { data: brandContext, error } = await supabase
      .from('brand_contexts')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
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
    const supabase = getSupabaseAdmin();
    const clientId = params.id;
    const body = await request.json();

    const { data: existing } = await supabase
      .from('brand_contexts')
      .select('id')
      .eq('client_id', clientId)
      .single();

    let result;

    if (existing) {
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
