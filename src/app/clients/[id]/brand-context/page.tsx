'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface BrandContext {
  id: string;
  client_id: string;
  brand_voice: string;
  content_styles: Array<{
    name: string;
    length: string;
    purpose: string;
    use_when: string;
    structure?: string;
    format?: string;
  }>;
  hashtag_strategy: {
    philosophy: string;
    primary: string[];
    secondary: string[];
    avoid: string[];
  };
  caption_library: Array<{
    type: string;
    captions: string[];
  }>;
  posting_cadence: {
    weekly_mix: string[];
    best_times: string[];
    notes?: string;
  };
  image_matching: Array<{
    image_type: string;
    best_for: string[];
    why: string;
  }>;
  assets_reference: string;
}

export default function BrandContextPage() {
  const params = useParams();
  const router = useRouter();
  const [brandContext, setBrandContext] = useState<BrandContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'captions' | 'hashtags' | 'cadence'>('overview');

  useEffect(() => {
    if (params.id) {
      fetchBrandContext(params.id as string);
    }
  }, [params.id]);

  const fetchBrandContext = async (id: string) => {
    try {
      const res = await fetch(`/api/clients/${id}/brand-context`);
      if (!res.ok) throw new Error('Failed to load brand context');
      const data = await res.json();
      setBrandContext(data.brandContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand context');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading brand context...</p>
        </div>
      </div>
    );
  }

  if (error || !brandContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
          <p className="mt-1 text-sm text-gray-500">{error || 'No brand context found'}</p>
          <div className="mt-6">
            <Link
              href={`/clients/${params.id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              ← Back to Client
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/clients/${params.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-900 inline-flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Client
              </Link>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">Brand Context</h1>
              <p className="text-gray-500 mt-1">Brand guidelines, caption library, and content strategy</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', count: 1 },
                { id: 'captions', label: 'Caption Library', count: brandContext.caption_library.reduce((sum, lib) => sum + lib.captions.length, 0) },
                { id: 'hashtags', label: 'Hashtag Strategy', count: 1 },
                { id: 'cadence', label: 'Posting Cadence', count: 1 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.label}
                  {tab.id !== 'overview' && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Brand Voice */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Brand Voice</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{brandContext.brand_voice}</p>
            </div>

            {/* Content Styles */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Content Styles</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {brandContext.content_styles.map((style, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">{style.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{style.length}</p>
                    <p className="text-sm text-gray-600 mt-2">{style.purpose}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Use when:</span> {style.use_when}
                    </p>
                    {style.structure && (
                      <p className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Structure:</span> {style.structure}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Image Matching */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Image-to-Caption Matching</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {brandContext.image_matching.map((match, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 text-sm">{match.image_type}</h3>
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-500">Best for:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {match.best_for.map((type, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{match.why}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Assets Reference */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Assets Reference</h2>
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{brandContext.assets_reference}</p>
            </div>
          </div>
        )}

        {activeTab === 'captions' && (
          <div className="space-y-6">
            {brandContext.caption_library.map((lib, libIndex) => (
              <div key={libIndex} className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {lib.type}
                  <span className="ml-2 text-sm font-normal text-gray-500">({lib.captions.length} captions)</span>
                </h2>
                <div className="space-y-3">
                  {lib.captions.map((caption, captionIndex) => (
                    <div key={captionIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{caption}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(caption)}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'hashtags' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Hashtag Strategy</h2>
              <p className="text-gray-600 mb-4">{brandContext.hashtag_strategy.philosophy}</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Primary Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {brandContext.hashtag_strategy.primary.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Secondary Tags (Rotate)</h3>
                  <div className="flex flex-wrap gap-2">
                    {brandContext.hashtag_strategy.secondary.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Avoid</h3>
                  <div className="flex flex-wrap gap-2">
                    {brandContext.hashtag_strategy.avoid.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cadence' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Posting Cadence</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Weekly Mix</h3>
                  <ul className="space-y-2">
                    {brandContext.posting_cadence.weekly_mix.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Best Times to Post</h3>
                  <ul className="space-y-2">
                    {brandContext.posting_cadence.best_times.map((time, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-700">{time}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {brandContext.posting_cadence.notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">{brandContext.posting_cadence.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
