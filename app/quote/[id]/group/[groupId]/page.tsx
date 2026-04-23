'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function GroupLinkPage() {
  const router = useRouter()
  const { id, groupId } = useParams<{ id: string; groupId: string }>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function handleGroupLink() {
      // Track the click
      const { error: clickError } = await getSupabase()
        .from('group_link_clicks')
        .insert({
          group_id: groupId,
        })

      if (clickError) {
        console.error('Failed to log click:', clickError)
      }

      // Check if user already has a token for this group in localStorage
      const storageKey = `quote_token_${id}_${groupId}`
      const existingToken = localStorage.getItem(storageKey)

      if (existingToken) {
        // User already submitted, show error
        setError('You have already submitted a quote for this request.')
        setLoading(false)
        return
      }

      try {
        // Generate a new unique token
        const token = crypto.randomUUID().replace(/-/g, '').substring(0, 24)

        // Insert token into database
        const { error: insertError } = await getSupabase()
          .from('tokens')
          .insert({
            request_id: id,
            token,
          })

        if (insertError) {
          setError('Failed to generate quote link. Please try again.')
          setLoading(false)
          return
        }

        // Save to localStorage so user can only submit once per browser
        localStorage.setItem(storageKey, token)

        // Redirect to quote page with token
        router.push(`/quote/${id}?token=${token}`)
      } catch (err) {
        setError('An error occurred. Please try again.')
        setLoading(false)
      }
    }

    handleGroupLink()
  }, [id, groupId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return null
}
