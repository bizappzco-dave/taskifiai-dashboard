'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNav from '@/components/DashboardNav';

interface BrandContext {
  id: string;
  client_id: string;
  brand_voice?: string | null;
  content_styles?: Array<{
    name?: string;
    label?: string;
    length?: string;
    purpose?: string;
    use_when?: string;
    structure?: string;
    format?: string;
    value?: string;
  }> | null;
  hashtag_strategy?: {
    philosophy?: string;
    primary?: string[];
    secondary?: string[];
    avoid?: string[];
  } | null;
  caption_library?: Array<{
    type?: string;
    label?: string;
    captions?: string[];
  }> | null;
  posting_cadence?: {
    weekly_mix?: string[];
    best_times?: string[];
    notes?: string;
    frequency?: string;
  } | null;
  image_matching?: Array<{
    image_type?: string;
    best_for?: string[];
    why?: string;
  }> | null;
  assets_reference?: string | null;
}

type TabId = 'overview' | 'captions' | 'hashtags' | 'cadence';

const emptyText = 'Not set yet';

function safeArray<T>(value?: T[] | null): T[] {
  return Array.isArray(value) ? value : [];
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="taskifi-inner-empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default function BrandContextPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [brandContext, setBrandContext] = useState<BrandContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) fetchBrandContext(clientId);
  }, [clientId]);

  async function fetchBrandContext(id: string) {
    try {
      setError(null);
      const res = await fetch(`/api/clients/${id}/brand-context`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load brand context');
      setBrandContext(data.brandContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand context');
    } finally {
      setLoading(false);
    }
  }

  async function copyCaption(caption: string, key: string) {
    await navigator.clipboard.writeText(caption);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const summary = useMemo(() => {
    const captionCount = safeArray(brandContext?.caption_library).reduce((sum, lib) => sum + safeArray(lib.captions).length, 0);
    const styleCount = safeArray(brandContext?.content_styles).length;
    const hashtagCount = [
      ...safeArray(brandContext?.hashtag_strategy?.primary),
      ...safeArray(brandContext?.hashtag_strategy?.secondary),
    ].length;
    const matchingCount = safeArray(brandContext?.image_matching).length;
    return { captionCount, styleCount, hashtagCount, matchingCount };
  }, [brandContext]);

  if (loading) {
    return (
      <main className="taskifi-dashboard taskifi-loading-screen">
        <div className="taskifi-loading-card">
          <div className="taskifi-spinner" />
          <p className="taskifi-eyebrow">Brand context</p>
          <h1>Loading AI brand guide</h1>
          <p>Pulling caption rules, hashtags and posting guidance.</p>
        </div>
      </main>
    );
  }

  if (error || !brandContext) {
    return (
      <div className="taskifi-dashboard">
        <DashboardNav />
        <main className="taskifi-main">
          <section className="taskifi-empty-state">
            <p className="taskifi-eyebrow">Brand context</p>
            <h1>{error || 'No brand context found'}</h1>
            <p>Create the client brand context from onboarding so captions and reports can use the same source of truth.</p>
            <Link href={`/clients/${clientId}`} className="taskifi-button taskifi-button-primary">Back to client</Link>
          </section>
        </main>
      </div>
    );
  }

  const contentStyles = safeArray(brandContext.content_styles);
  const captionLibrary = safeArray(brandContext.caption_library);
  const imageMatching = safeArray(brandContext.image_matching);
  const primaryTags = safeArray(brandContext.hashtag_strategy?.primary);
  const secondaryTags = safeArray(brandContext.hashtag_strategy?.secondary);
  const avoidTags = safeArray(brandContext.hashtag_strategy?.avoid);
  const weeklyMix = safeArray(brandContext.posting_cadence?.weekly_mix);
  const bestTimes = safeArray(brandContext.posting_cadence?.best_times);

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview', count: summary.styleCount + summary.matchingCount },
    { id: 'captions', label: 'Captions', count: summary.captionCount },
    { id: 'hashtags', label: 'Hashtags', count: summary.hashtagCount },
    { id: 'cadence', label: 'Cadence', count: weeklyMix.length + bestTimes.length },
  ];

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main taskifi-brand-context-main">
        <section className="taskifi-feature-hero taskifi-brand-context-hero">
          <div>
            <Link href={`/clients/${clientId}`} className="taskifi-back-link">← Back to Client Intelligence</Link>
            <p className="taskifi-pill"><span /> AI-ready brand guide</p>
            <h1>Brand context.</h1>
            <p>Caption tone, reusable post styles, hashtag rules and image matching guidance for this client.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href={`/clients/${clientId}/products`} className="taskifi-button taskifi-button-secondary">Products</Link>
            <Link href="/clients" className="taskifi-button taskifi-button-primary">All clients</Link>
          </div>
        </section>

        <section className="taskifi-stats-grid taskifi-brand-context-stats" aria-label="Brand context summary">
          <article className="taskifi-stat-card"><span>Styles</span><strong>{summary.styleCount}</strong><p>Reusable caption formats.</p></article>
          <article className="taskifi-stat-card"><span>Captions</span><strong>{summary.captionCount}</strong><p>Approved copy starters.</p></article>
          <article className="taskifi-stat-card"><span>Hashtags</span><strong>{summary.hashtagCount}</strong><p>Primary and rotation tags.</p></article>
          <article className="taskifi-stat-card"><span>Images</span><strong>{summary.matchingCount}</strong><p>Visual matching rules.</p></article>
        </section>

        <section className="taskifi-brand-tabs" aria-label="Brand context sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'active' : ''}
            >
              {tab.label}
              <span>{tab.count ?? 0}</span>
            </button>
          ))}
        </section>

        {activeTab === 'overview' && (
          <section className="taskifi-brand-layout">
            <article className="taskifi-module-card taskifi-brand-voice-card">
              <div className="taskifi-module-header">
                <div><p className="taskifi-eyebrow">Voice</p><h2>Brand voice</h2></div>
                <span className="taskifi-soft-badge">AI context</span>
              </div>
              <p>{brandContext.brand_voice || emptyText}</p>
            </article>

            <article className="taskifi-module-card">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Assets</p><h2>Reference notes</h2></div></div>
              <p className="taskifi-muted-note taskifi-pre-wrap">{brandContext.assets_reference || emptyText}</p>
            </article>

            <article className="taskifi-module-card taskifi-span-2">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Formats</p><h2>Content styles</h2></div></div>
              {contentStyles.length ? (
                <div className="taskifi-brand-card-grid">
                  {contentStyles.map((style, index) => (
                    <div key={index} className="taskifi-brand-mini-card">
                      <h3>{style.name || style.label || `Style ${index + 1}`}</h3>
                      {(style.length || style.format) && <span>{style.length || style.format}</span>}
                      <p>{style.purpose || style.value || emptyText}</p>
                      {style.use_when && <small><strong>Use when:</strong> {style.use_when}</small>}
                      {style.structure && <small><strong>Structure:</strong> {style.structure}</small>}
                    </div>
                  ))}
                </div>
              ) : <EmptyPanel title="No content styles yet" body="Add repeatable caption formats for faster monthly posting." />}
            </article>

            <article className="taskifi-module-card taskifi-span-2">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Visuals</p><h2>Image-to-caption matching</h2></div></div>
              {imageMatching.length ? (
                <div className="taskifi-brand-card-grid two">
                  {imageMatching.map((match, index) => (
                    <div key={index} className="taskifi-brand-mini-card">
                      <h3>{match.image_type || `Image type ${index + 1}`}</h3>
                      <div className="taskifi-chip-row">
                        {safeArray(match.best_for).map((type, i) => <span key={i}>{type}</span>)}
                      </div>
                      <p>{match.why || emptyText}</p>
                    </div>
                  ))}
                </div>
              ) : <EmptyPanel title="No image rules yet" body="Add guidance that maps uploaded photos to the right caption style." />}
            </article>
          </section>
        )}

        {activeTab === 'captions' && (
          <section className="taskifi-module-card">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Caption library</p><h2>Reusable approved captions</h2></div><span className="taskifi-soft-badge">Copy ready</span></div>
            {captionLibrary.length ? (
              <div className="taskifi-caption-library">
                {captionLibrary.map((lib, libIndex) => (
                  <article key={libIndex} className="taskifi-caption-group">
                    <h3>{lib.type || lib.label || `Caption group ${libIndex + 1}`} <span>{safeArray(lib.captions).length}</span></h3>
                    <div className="taskifi-list-stack">
                      {safeArray(lib.captions).map((caption, captionIndex) => {
                        const key = `${libIndex}-${captionIndex}`;
                        return (
                          <div key={key} className="taskifi-caption-card">
                            <p>{caption}</p>
                            <button type="button" onClick={() => copyCaption(caption, key)}>
                              {copied === key ? 'Copied' : 'Copy caption'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel title="No captions yet" body="Add approved caption examples so monthly content stays consistent." />}
          </section>
        )}

        {activeTab === 'hashtags' && (
          <section className="taskifi-brand-layout">
            <article className="taskifi-module-card taskifi-span-2">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Strategy</p><h2>Hashtag approach</h2></div></div>
              <p className="taskifi-muted-note taskifi-pre-wrap">{brandContext.hashtag_strategy?.philosophy || emptyText}</p>
            </article>
            <article className="taskifi-module-card"><div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Core</p><h2>Primary tags</h2></div></div><div className="taskifi-chip-row strong">{primaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>{!primaryTags.length && <EmptyPanel title="No primary tags" body="Add the stable brand and service tags." />}</article>
            <article className="taskifi-module-card"><div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Rotation</p><h2>Secondary tags</h2></div></div><div className="taskifi-chip-row">{secondaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>{!secondaryTags.length && <EmptyPanel title="No secondary tags" body="Add monthly rotation tags for variety." />}</article>
            <article className="taskifi-module-card taskifi-span-2"><div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Avoid</p><h2>Do not use</h2></div></div><div className="taskifi-chip-row danger">{avoidTags.map((tag) => <span key={tag}>{tag}</span>)}</div>{!avoidTags.length && <EmptyPanel title="No blocked tags" body="Add off-brand or low-quality tags to avoid when needed." />}</article>
          </section>
        )}

        {activeTab === 'cadence' && (
          <section className="taskifi-brand-layout">
            <article className="taskifi-module-card">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Weekly mix</p><h2>What to post</h2></div></div>
              {weeklyMix.length ? <ul className="taskifi-check-list">{weeklyMix.map((item) => <li key={item}>{item}</li>)}</ul> : <EmptyPanel title="No weekly mix yet" body="Add the regular content categories for this client." />}
            </article>
            <article className="taskifi-module-card">
              <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Timing</p><h2>Best times</h2></div></div>
              {bestTimes.length ? <ul className="taskifi-check-list clock">{bestTimes.map((time) => <li key={time}>{time}</li>)}</ul> : <EmptyPanel title="No best times yet" body="Add posting windows when performance data is available." />}
            </article>
            <article className="taskifi-info-panel taskifi-span-2">
              <div><p className="taskifi-eyebrow">Notes</p><h2>Cadence guidance</h2><p>{brandContext.posting_cadence?.notes || brandContext.posting_cadence?.frequency || 'No extra cadence notes added yet.'}</p></div>
              <ul><li>Keep posting consistent</li><li>Match captions to real images</li><li>Use the approved hashtag rules</li></ul>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
