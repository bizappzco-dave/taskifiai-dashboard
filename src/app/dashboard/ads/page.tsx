'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'

export default function AdReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const supabase = getSupabase() as any
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        router.push('/auth/signin')
        return
      }

      await loadData(currentUser.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth/signin')
    }
  }

  const loadData = async (userId: string) => {
    setLoading(true)

    try {
      const supabase = getSupabase() as any
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (clientData) {
        const { data: reportsData } = await supabase
          .from('ad_reports')
          .select('*')
          .eq('client_id', clientData.id)
          .order('report_start_date', { ascending: false })
          .limit(12)

        if (reportsData) setReports(reportsData)

        const { data: alertsData } = await supabase
          .from('ad_alerts')
          .select('*')
          .eq('client_id', clientData.id)
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(10)

        if (alertsData) setAlerts(alertsData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }

    setLoading(false)
  }

  const latestReport = reports[0]

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value || 0)

  const formatPercent = (value: number) => `${((value || 0) * 100).toFixed(2)}%`

  if (loading) {
    return (
      <main className="taskifi-dashboard taskifi-loading-screen">
        <div className="taskifi-loading-card">
          <div className="taskifi-spinner" />
          <p className="taskifi-eyebrow">Ad reports</p>
          <h1>Loading report centre</h1>
          <p>Checking connected campaigns and weekly insights.</p>
        </div>
      </main>
    )
  }

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <Link href="/" className="taskifi-back-link">← Back to dashboard</Link>
            <p className="taskifi-pill"><span /> Ad performance</p>
            <h1>Ad reports clients can understand.</h1>
            <p>Weekly campaign summaries, clear alerts and plain-English recommendations for Google Ads and Meta campaigns.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href="/clients/new" className="taskifi-button taskifi-button-secondary">Add client</Link>
            <Link href="/pipeline" className="taskifi-button taskifi-button-primary">View lead pipeline</Link>
          </div>
        </section>

        {latestReport ? (
          <section className="taskifi-report-grid" aria-label="Latest ad report metrics">
            <article className="taskifi-stat-card"><span>Total spend</span><strong>{formatCurrency(latestReport.total_cost)}</strong><p>Campaign spend for the latest reporting period.</p></article>
            <article className="taskifi-stat-card"><span>Impressions</span><strong>{(latestReport.total_impressions || 0).toLocaleString()}</strong><p>Times ads appeared in front of potential customers.</p></article>
            <article className="taskifi-stat-card"><span>Clicks</span><strong>{(latestReport.total_clicks || 0).toLocaleString()}</strong><p>People who clicked through from ads.</p></article>
            <article className="taskifi-stat-card"><span>Average CTR</span><strong>{formatPercent(latestReport.avg_ctr)}</strong><p>How often impressions turned into clicks.</p></article>
            <article className="taskifi-stat-card"><span>ROAS</span><strong>{latestReport.avg_roas?.toFixed(1) || 0}x</strong><p>Revenue return measured against ad spend.</p></article>
          </section>
        ) : (
          <section className="taskifi-empty-state taskifi-empty-wide">
            <p className="taskifi-eyebrow">Ready when connected</p>
            <h2>No ad reports yet</h2>
            <p>Your first report will appear here after the client’s ad accounts are connected and a reporting cycle has run.</p>
            <span className="taskifi-soft-badge">Google Ads + Meta reports</span>
          </section>
        )}

        {alerts.length > 0 && (
          <section className="taskifi-module-card">
            <div className="taskifi-module-header">
              <div>
                <p className="taskifi-eyebrow">Needs attention</p>
                <h2>Active alerts</h2>
              </div>
              <span className="taskifi-soft-badge">{alerts.length} open</span>
            </div>
            <div className="taskifi-list-stack">
              {alerts.slice(0, 3).map((alert) => (
                <article key={alert.id} className="taskifi-alert-row">
                  <div className="taskifi-alert-icon">!</div>
                  <div>
                    <h3>{alert.title}</h3>
                    <p>{alert.description}</p>
                    {alert.recommendation && <small>{alert.recommendation}</small>}
                  </div>
                  <span className={`taskifi-severity ${alert.severity || 'medium'}`}>{alert.severity || 'medium'}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="taskifi-module-card">
          <div className="taskifi-module-header">
            <div>
              <p className="taskifi-eyebrow">History</p>
              <h2>Report history</h2>
            </div>
            <span className="taskifi-soft-badge">{reports.length} reports</span>
          </div>

          {reports.length === 0 ? (
            <div className="taskifi-inner-empty">
              <h3>Reports are generated weekly</h3>
              <p>Once reporting is active, each week will show spend, clicks, alerts and AI analysis in this list.</p>
            </div>
          ) : (
            <div className="taskifi-list-stack">
              {reports.map((report) => (
                <article key={report.id} className="taskifi-report-row">
                  <div>
                    <h3>Week of {new Date(report.report_start_date).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                    <p>{report.alerts_generated > 0 && `${report.alerts_generated} alerts • `}AI analysis complete</p>
                  </div>
                  <div className="taskifi-report-row-metrics">
                    <strong>{formatCurrency(report.total_cost || 0)}</strong>
                    <span>{report.total_clicks || 0} clicks</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="taskifi-info-panel">
          <div>
            <p className="taskifi-eyebrow">How it works</p>
            <h2>Simple reporting, no campaign risk.</h2>
            <p>TaskifiAI can review connected ad data and surface trends, issues and opportunities. Recommendations stay clear and controlled — clients keep budget and approval decisions.</p>
          </div>
          <ul>
            <li>Read-only campaign analysis</li>
            <li>Client-friendly weekly summaries</li>
            <li>Clear next steps before changes are made</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
