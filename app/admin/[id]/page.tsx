'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase, type Request, type Quote, type Token } from '@/lib/supabase'

export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<Request | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const db = getSupabase()
      const [{ data: req, error: reqErr }, { data: qs, error: qErr }] = await Promise.all([
        db.from('requests').select('*').eq('id', id).single(),
        db.from('quotes').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      ])
      if (reqErr) setError(reqErr.message)
      else setRequest(req)
      if (!qErr) setQuotes(qs || [])
      setLoading(false)
    }
    fetchData()
  }, [id])

  async function toggleStatus() {
    if (!request) return
    setTogglingStatus(true)
    const newStatus = request.status === 'open' ? 'closed' : 'open'
    const { error } = await getSupabase().from('requests').update({ status: newStatus }).eq('id', id)
    if (!error) setRequest({ ...request, status: newStatus })
    setTogglingStatus(false)
  }

  async function copyLink() {
    setGeneratingToken(true)
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    const { error } = await getSupabase().from('tokens').insert({
      request_id: id,
      token,
    })

    if (error) {
      console.error('Failed to create token:', error)
      setGeneratingToken(false)
      return
    }

    const shareUrl = `${window.location.origin}/quote/${id}?token=${token}`
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setGeneratingToken(false)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-red-600">{error || 'Request not found'}</p>
      </div>
    )
  }

  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-white text-sm opacity-80 hover:opacity-100">
            ← Back
          </Link>
          <span className="text-sm font-semibold">Admin</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Request card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{request.title}</h1>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    request.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {request.status}
                </span>
              </div>
              {request.description && (
                <p className="text-sm text-gray-600 mt-1">{request.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">Created {formatDate(request.created_at)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyLink}
                disabled={generatingToken}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition text-gray-700 disabled:opacity-60"
              >
                {generatingToken ? 'Generating...' : copied ? 'Copied!' : 'Copy Share Link'}
              </button>
              <button
                onClick={toggleStatus}
                disabled={togglingStatus}
                style={request.status === 'open' ? { backgroundColor: '#555' } : { backgroundColor: '#d32f2f' }}
                className="text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-60"
              >
                {request.status === 'open' ? 'Close Request' : 'Reopen Request'}
              </button>
            </div>
          </div>
        </div>

        {/* Quotes */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            Quotes ({quotes.length})
          </h2>
          {quotes.length > 1 && (
            <span className="text-xs text-gray-400">Sorted by price (lowest first)</span>
          )}
        </div>

        {quotes.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No quotes received yet.</p>
            <p className="text-gray-400 text-xs mt-1">Share the link with suppliers to start receiving quotes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedQuotes.map((quote, index) => (
              <div
                key={quote.id}
                className={`bg-white rounded-lg border p-4 shadow-sm ${
                  index === 0 ? 'border-green-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">{quote.supplier_name}</p>
                      {index === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Lowest
                        </span>
                      )}
                    </div>
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-2">
                      {quote.condition}
                    </span>
                    {quote.notes && (
                      <p className="text-sm text-gray-600">{quote.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(quote.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">${Number(quote.price).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
