export const DEFAULT_MAX_MONTHLY_SCANS = 4;

export interface ScanActivity {
  id: string;
  title?: string;
  description?: string | null;
  activity_type?: string | null;
  source?: string | null;
  created_at?: string | null;
  details?: {
    scan_summary?: {
      top_issues?: string[];
    } | null;
    report_links?: {
      free_preview_html?: string | null;
      full_report_pdf?: string | null;
    } | null;
    business_name?: string | null;
    domain?: string | null;
  } | null;
}

export function getScanIssues(activity: ScanActivity): string[] {
  const issues = activity.details?.scan_summary?.top_issues;
  return Array.isArray(issues) ? issues.filter(Boolean) : [];
}

export function getScanSource(activity: ScanActivity) {
  if (activity.details?.domain) return activity.details.domain;
  if (activity.details?.business_name) return activity.details.business_name;
  return activity.source || activity.activity_type || 'TotalSiteData';
}

export function getScanTitle(activity: ScanActivity): string {
  return activity.title?.trim() || 'Monthly scan';
}

export function getScanDate(activity: ScanActivity): string {
  return activity.created_at ? new Date(activity.created_at).toLocaleDateString('en-IE') : '—';
}

export function getMonthlyScansFromActivities(activities: ScanActivity[]): ScanActivity[] {
  return activities.filter(
    (activity) => activity.activity_type === 'totalsitedata_promoted' || Boolean(activity.details?.scan_summary)
  );
}

export function getLatestTotalsitedataScan(activities: ScanActivity[]): ScanActivity | null {
  const totalsiteActivities = getMonthlyScansFromActivities(activities);
  return totalsiteActivities.length > 0 ? totalsiteActivities[0] : null;
}
