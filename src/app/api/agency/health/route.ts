import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Agency Health Dashboard API
 * 
 * Returns health scores for all clients:
 * - Green: Score 70-100 (healthy)
 * - Amber: Score 40-69 (needs attention)
 * - Red: Score 0-39 (critical)
 */

interface HealthMetrics {
  visibility: number;
  engagement: number;
  reputation: number;
  leadCapture: number;
  overall: number;
}

interface ClientHealth {
  clientId: string;
  businessName: string;
  status: 'green' | 'amber' | 'red';
  score: number;
  metrics: HealthMetrics;
  lastActivity: string | null;
  openTasks: number;
  alerts: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, business_name, name, email, website, instagram_handle')
      .eq('is_active', true)
      .order('business_name');

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      console.error('Error code:', clientsError.code);
      console.error('Error details:', clientsError.details);
      return NextResponse.json(
        { error: 'Failed to fetch clients', details: clientsError.message },
        { status: 500 }
      );
    }

    // Calculate health for each client
    const healthData: ClientHealth[] = await Promise.all(
      clients.map(async (client) => {
        const metrics = await calculateHealthMetrics(supabase, client.id);
        const status = getStatusFromScore(metrics.overall);
        const alerts = generateAlerts(metrics, client);

        return {
          clientId: client.id,
          businessName: client.business_name || client.name || 'Unnamed Client',
          status,
          score: metrics.overall,
          metrics,
          lastActivity: await getLastActivity(supabase, client.id),
          openTasks: await countOpenTasks(supabase, client.id),
          alerts
        };
      })
    );

    // Summary stats
    const summary = {
      total: healthData.length,
      green: healthData.filter(c => c.status === 'green').length,
      amber: healthData.filter(c => c.status === 'amber').length,
      red: healthData.filter(c => c.status === 'red').length,
      averageScore: Math.round(
        healthData.reduce((sum, c) => sum + c.score, 0) / healthData.length
      )
    };

    return NextResponse.json({
      summary,
      clients: healthData
    });

  } catch (error) {
    console.error('Health dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function calculateHealthMetrics(supabase: any, clientId: string): Promise<HealthMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get activities for this client
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', thirtyDaysAgo);

  // Get leads
  const { data: leads } = await supabase
    .from('leads')
    .select('status, value, created_at')
    .eq('client_id', clientId)
    .gte('created_at', thirtyDaysAgo);

  // Get GMB reviews (if credentials exist)
  const { data: reviews } = await supabase
    .from('gmb_reviews')
    .select('star_rating, sentiment, review_time')
    .eq('credential_id', clientId)
    .gte('review_time', thirtyDaysAgo);

  // Calculate Visibility Score (0-100)
  // Based on: website presence, GBP activity, posts published
  const visibilityScore = calculateVisibilityScore(activities, clientId);

  // Calculate Engagement Score (0-100)
  // Based on: reviews responded to, social interactions, email opens
  const engagementScore = calculateEngagementScore(activities, reviews);

  // Calculate Reputation Score (0-100)
  // Based on: average rating, review count, sentiment analysis
  const reputationScore = calculateReputationScore(reviews);

  // Calculate Lead Capture Score (0-100)
  // Based on: leads generated, conversion rate
  const leadCaptureScore = calculateLeadCaptureScore(leads);

  // Overall score is average of four pillars
  const overall = Math.round(
    (visibilityScore + engagementScore + reputationScore + leadCaptureScore) / 4
  );

  return {
    visibility: visibilityScore,
    engagement: engagementScore,
    reputation: reputationScore,
    leadCapture: leadCaptureScore,
    overall
  };
}

function calculateVisibilityScore(activities: any[] | null, clientId: string): number {
  if (!activities) return 0;

  // Count GBP-related activities
  const gbpActivities = activities.filter(a => 
    ['gbp_post_published', 'gbp_update', 'website_scan'].includes(a.activity_type)
  );

  // Score based on activity frequency
  const activityCount = gbpActivities.length;
  if (activityCount >= 10) return 90 + Math.min(activityCount - 10, 10);
  if (activityCount >= 5) return 70 + (activityCount - 5) * 4;
  if (activityCount >= 2) return 40 + (activityCount - 2) * 10;
  return activityCount * 20;
}

function calculateEngagementScore(activities: any[] | null, reviews: any[] | null): number {
  if (!activities && !reviews) return 0;

  const engagementActivities = (activities || []).filter(a =>
    ['review_replied', 'whatsapp_message', 'email_sent', 'social_post'].includes(a.activity_type)
  );

  const respondedReviews = (reviews || []).filter(r => r.action_taken).length;
  const totalReviews = (reviews || []).length;
  const reviewResponseRate = totalReviews > 0 ? (respondedReviews / totalReviews) * 100 : 0;

  const score = Math.round(
    (engagementActivities.length * 5) + 
    (reviewResponseRate * 0.5)
  );

  return Math.min(score, 100);
}

function calculateReputationScore(reviews: any[] | null): number {
  if (!reviews || reviews.length === 0) return 50; // Neutral if no reviews

  const avgRating = reviews.reduce((sum, r) => sum + r.star_rating, 0) / reviews.length;
  const reviewCount = reviews.length;
  
  // Positive sentiment bonus
  const positiveReviews = reviews.filter(r => r.sentiment === 'positive').length;
  const sentimentScore = (positiveReviews / reviewCount) * 100;

  // Calculate composite score
  const ratingScore = (avgRating / 5) * 100;
  const volumeScore = Math.min(reviewCount * 5, 100); // Max at 20 reviews

  return Math.round((ratingScore * 0.5) + (sentimentScore * 0.3) + (volumeScore * 0.2));
}

function calculateLeadCaptureScore(leads: any[] | null): number {
  if (!leads || leads.length === 0) return 0;

  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

  // Score based on volume + conversion
  const volumeScore = Math.min(totalLeads * 10, 100);
  const conversionScore = conversionRate * 2;

  return Math.round((volumeScore * 0.6) + (conversionScore * 0.4));
}

function getStatusFromScore(score: number): 'green' | 'amber' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function generateAlerts(metrics: HealthMetrics, client: any): string[] {
  const alerts: string[] = [];

  if (metrics.visibility < 40) {
    alerts.push('Low visibility - GBP posts needed');
  }
  if (metrics.engagement < 40) {
    alerts.push('Low engagement - review responses needed');
  }
  if (metrics.reputation < 60) {
    alerts.push('Reputation risk - negative reviews detected');
  }
  if (metrics.leadCapture < 30) {
    alerts.push('No recent leads - check lead sources');
  }
  if (!client.website) {
    alerts.push('Missing website URL');
  }
  if (!client.instagram_handle) {
    alerts.push('No Instagram connected');
  }

  return alerts;
}

async function getLastActivity(supabase: any, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from('activities')
    .select('created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.created_at || null;
}

async function countOpenTasks(supabase: any, clientId: string): Promise<number> {
  // For now, count leads as tasks
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .in('status', ['new_lead', 'contacted', 'follow_up']);

  return count || 0;
}
