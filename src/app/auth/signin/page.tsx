'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showReset, setShowReset] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = getSupabase()

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('✅ Account created. Please check your email to confirm your account.')
        setEmail('')
        setPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('✅ Signed in successfully. Redirecting...')
        setTimeout(() => {
          window.location.href = '/'
        }, 900)
      }
    } catch (error: any) {
      setMessage(`❌ ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = getSupabase()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) throw error
      setMessage('✅ Password reset email sent. Check your inbox.')
      setShowReset(false)
      setEmail('')
    } catch (error: any) {
      setMessage(`❌ ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="taskifi-auth-page">
      <section className="taskifi-auth-brand-panel">
        <a href="https://taskifi-demos.vercel.app/taskifiai/" className="taskifi-brand taskifi-auth-logo" aria-label="TaskifiAI homepage">
          <img src="/taskifi-logo.svg" alt="TaskifiAI" className="taskifi-brand-logo" />
          <span className="taskifi-brand-subtitle">
            <small>Local growth systems</small>
          </span>
        </a>
        <p className="taskifi-pill"><span /> One dashboard. Every platform. Connected.</p>
        <h1>{showReset ? 'Reset access to your workspace.' : 'Welcome to your TaskifiAI dashboard.'}</h1>
        <p>
          Sign in to manage clients, SocialDrive AI links, review workflows, ad reports and lead capture from one clean workspace.
        </p>
        <div className="taskifi-auth-proof-grid">
          <span>Google Business</span>
          <span>SocialDrive AI</span>
          <span>Reviews</span>
          <span>Lead Pipeline</span>
        </div>
      </section>

      <section className="taskifi-auth-card" aria-label={showReset ? 'Reset password' : 'Sign in'}>
        <p className="taskifi-eyebrow">Dashboard access</p>
        <h2>{showReset ? 'Reset password' : isSignUp ? 'Create account' : 'Sign in'}</h2>
        <p className="taskifi-auth-subtitle">
          {showReset
            ? 'Enter your email and we will send a secure reset link.'
            : isSignUp
              ? 'Create an account to access TaskifiAI tools.'
              : 'Use your TaskifiAI account details to continue.'}
        </p>

        {message && (
          <div className={message.startsWith('✅') ? 'taskifi-message success' : 'taskifi-message error'}>
            {message}
          </div>
        )}

        {showReset ? (
          <form onSubmit={handleResetPassword} className="taskifi-auth-form">
            <label>
              <span>Email address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>
            <button type="submit" disabled={loading} className="taskifi-button taskifi-button-primary taskifi-button-full">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button type="button" onClick={() => { setShowReset(false); setMessage('') }} className="taskifi-auth-link">
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="taskifi-auth-form">
            <label>
              <span>Email address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </label>
            {!isSignUp && (
              <button type="button" onClick={() => setShowReset(true)} className="taskifi-auth-link taskifi-auth-link-left">
                Forgot password?
              </button>
            )}
            <button type="submit" disabled={loading} className="taskifi-button taskifi-button-primary taskifi-button-full">
              {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}

        {!showReset && (
          <button onClick={() => { setIsSignUp(!isSignUp); setMessage('') }} className="taskifi-auth-toggle">
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        )}

        <a href="https://taskifi-demos.vercel.app/taskifiai/" className="taskifi-auth-home">← Back to TaskifiAI homepage</a>
      </section>
    </main>
  )
}
