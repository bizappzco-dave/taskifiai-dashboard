'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = createClient()
        
        // Get current session
        const { data, error } = await supabase.auth.getSession()
        
        if (error) throw error
        if (!data.session) {
          setError('No session found')
          return
        }

        // Redirect to posting dashboard
        router.push('/client/posting')
      } catch (err: any) {
        setError(err.message || 'Authentication failed')
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Authentication Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}
