import { DEFAULT_MAX_MONTHLY_SCANS, getScanDate, getScanIssues, getScanSource, getScanTitle, type ScanActivity } from '@/lib/monthly-scans';

interface MonthlyScansPanelProps {
  scans: ScanActivity[];
  heading: string;
  eyebrow?: string;
  maxItems?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  variant?: 'home' | 'reports';
}

interface MonthlyScansPanelRowProps {
  scan: ScanActivity;
  variant: 'home' | 'reports';
}

function MonthlyScanRow({ scan, variant }: MonthlyScansPanelRowProps) {
  const issues = getScanIssues(scan);

  if (variant === 'reports') {
    return (
      <article className="taskifi-report-row">
        <div>
          <h3>{getScanTitle(scan)}</h3>
          <p>
            {getScanSource(scan)}
            {scan.description ? ` • ${scan.description}` : ''}
          </p>
          {issues.length > 0 && <small>Top issues: {issues.slice(0, 3).join(' • ')}</small>}
          <div className="taskifi-client-action-grid">
            {scan.details?.report_links?.free_preview_html && (
              <a href={scan.details.report_links.free_preview_html} target="_blank" rel="noopener noreferrer">
                Open preview
              </a>
            )}
            {scan.details?.report_links?.full_report_pdf && (
              <a href={scan.details.report_links.full_report_pdf} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            )}
          </div>
        </div>
        <div className="taskifi-report-row-metrics">
          <strong>{getScanDate(scan)}</strong>
          <span>Monthly scan</span>
        </div>
      </article>
    );
  }

  return (
    <article className="taskifi-activity-row-lite">
      <span className="taskifi-activity-dot" />
      <div>
        <h3>{getScanTitle(scan)}</h3>
        <p>
          {getScanSource(scan)}
          {scan.description ? ` • ${scan.description}` : ''}
        </p>
        {issues.length > 0 && <p>Top issues: {issues.slice(0, 3).join(' • ')}</p>}
        <div className="taskifi-client-action-grid">
          {scan.details?.report_links?.free_preview_html && (
            <a href={scan.details.report_links.free_preview_html} target="_blank" rel="noopener noreferrer">
              Open preview
            </a>
          )}
          {scan.details?.report_links?.full_report_pdf && (
            <a href={scan.details.report_links.full_report_pdf} target="_blank" rel="noopener noreferrer">
              Download PDF
            </a>
          )}
        </div>
      </div>
      <small>{getScanDate(scan) === '—' ? '' : getScanDate(scan)}</small>
    </article>
  );
}

export default function MonthlyScansPanel({
  scans,
  heading,
  eyebrow = 'Visibility',
  maxItems = DEFAULT_MAX_MONTHLY_SCANS,
  emptyTitle = 'No monthly scan events yet',
  emptyDescription = 'Monthly scan summaries will show once TotalSiteData writes scan activity.',
  variant = 'home',
}: MonthlyScansPanelProps) {
  const visibleScans = scans.slice(0, maxItems);

  return (
    <article className="taskifi-module-card">
      <div className="taskifi-module-header">
        <div>
          <p className="taskifi-eyebrow">{eyebrow}</p>
          <h2>{heading}</h2>
        </div>
        <span className="taskifi-soft-badge">{scans.length} scans</span>
      </div>
      {scans.length === 0 ? (
        <div className="taskifi-inner-empty">
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <div className="taskifi-list-stack">
          {visibleScans.map((scan) => (
            <MonthlyScanRow key={scan.id} scan={scan} variant={variant} />
          ))}
        </div>
      )}
    </article>
  );
}
