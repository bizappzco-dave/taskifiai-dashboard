'use client';

import Link from 'next/link';

export default function SocialLitesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center" aria-label="TaskifiAI dashboard home">
            <img src="/taskifi-logo.svg" alt="TaskifiAI" className="h-10 w-auto" />
          </Link>
          <Link href="/" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Social-Lites by TaskifiAI
          </h1>
          <p className="text-2xl text-gray-600 mb-8">
            Websites for Irish Businesses 🇮🇪
          </p>
          <p className="text-xl text-gray-700 mb-12 max-w-2xl mx-auto">
            Get professional 2-3 page website online in 48 hours. 
            Mobile-optimized, contact form, Google Maps — everything included.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/353871234567"
              className="inline-flex items-center justify-center px-8 py-4 bg-green-500 text-white text-lg font-semibold rounded-lg hover:bg-green-600 transition"
            >
              💬 Chat on WhatsApp
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              See Pricing
            </a>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            Everything You Need to Get Online
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🌐', title: '2-3 Page Website', desc: 'Home, About, Services, Contact — tailored to your business' },
              { icon: '📱', title: 'Mobile-Optimized', desc: 'Looks perfect on phones, tablets, and desktops' },
              { icon: '⚡', title: '48-Hour Launch', desc: 'From signup to live in just 2 business days' },
              { icon: '📧', title: 'Contact Form', desc: 'Let customers reach you instantly' },
              { icon: '🗺️', title: 'Google Maps', desc: 'Show customers where to find you' },
              { icon: '📊', title: 'Analytics Setup', desc: 'Google Analytics + Search Console included' },
            ].map((feature, i) => (
              <div key={i} className="p-6 bg-gray-50 rounded-lg">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            Why Choose Social-Lites?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-4 px-6 text-lg font-semibold">Feature</th>
                  <th className="text-center py-4 px-6 text-lg font-semibold bg-indigo-100">Social-Lites</th>
                  <th className="text-center py-4 px-6 text-lg font-semibold">Traditional Agency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Price', '€49/month', '€1,500-3,000+'],
                  ['Launch Time', '48 hours', '4-8 weeks'],
                  ['Revisions', 'Unlimited', '2-3 rounds'],
                  ['Hosting', 'Included', '€20-50/month'],
                  ['Updates', 'Anytime', 'Charge per hour'],
                  ['Contract', 'Month-to-month', '12+ months'],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-4 px-6 text-gray-900 font-medium">{row[0]}</td>
                    <td className="py-4 px-6 text-center bg-indigo-50 text-indigo-700 font-semibold">{row[1]}</td>
                    <td className="py-4 px-6 text-center text-gray-600">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            3 Steps to Your New Website
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Chat With Us', desc: 'WhatsApp or contact form — tell us about your business' },
              { step: '2', title: 'We Build', desc: '48 hours to design, build, and launch your site' },
              { step: '3', title: 'You\'re Live', desc: 'Start getting found online. We handle everything.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-indigo-600 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-indigo-100 mb-12">
            No hidden fees. No long contracts. Cancel anytime.
          </p>
          <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-md mx-auto">
            <div className="text-6xl font-bold mb-2">€49</div>
            <div className="text-xl text-gray-600 mb-6">per month</div>
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                2-3 page website
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Mobile-optimized design
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Contact form + Google Maps
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Hosting + SSL certificate
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Google Analytics setup
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                Unlimited updates
              </li>
            </ul>
            <a
              href="https://wa.me/353871234567?text=Hi!%20I'm%20interested%20in%20Social-Lites%20website"
              className="block w-full bg-green-500 text-white text-lg font-semibold py-4 rounded-lg hover:bg-green-600 transition"
            >
              Get Started on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {[
              { q: 'Do I need to buy a domain?', a: 'Yes, but we\'ll help you get one! Domains cost about €15-20/year. We can register it for you or you can buy your own.' },
              { q: 'What if I want changes after launch?', a: 'Unlimited updates included! Just message us on WhatsApp or email and we\'ll make the changes.' },
              { q: 'Can I cancel anytime?', a: 'Yes! Month-to-month, no long-term contracts. If you\'re not happy, just let us know.' },
              { q: 'Do you only work with Irish businesses?', a: 'We\'re based in Ireland and specialize in Irish businesses, but we work with clients worldwide.' },
              { q: 'What if I need more pages later?', a: 'No problem! Additional pages are €29/month each. Most businesses start with 2-3 pages and expand as they grow.' },
            ].map((faq, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to Get Online?
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Join Irish businesses who trust Social-Lites for their web presence.
          </p>
          <a
            href="https://wa.me/353871234567?text=Hi!%20I'm%20interested%20in%20Social-Lites%20website"
            className="inline-flex items-center px-8 py-4 bg-green-500 text-white text-lg font-semibold rounded-lg hover:bg-green-600 transition"
          >
            💬 Start a WhatsApp Chat
          </a>
          <p className="mt-6 text-gray-500">
            Or email us at <a href="mailto:hello@taskifiai.com" className="text-indigo-600 hover:underline">hello@taskifiai.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-600">
          <p>Social-Lites by TaskifiAI © 2026</p>
          <p className="mt-2">Built for Irish Businesses 🇮🇪</p>
        </div>
      </footer>
    </div>
  );
}
