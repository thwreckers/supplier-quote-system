'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSupabase, type Request } from '@/lib/supabase'

interface Quote {
  id: string
  supplier_name: string
  price: number
  condition: string
  notes: string
  created_at: string
}

export default function SupplierQuotePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [supplierName, setSupplierName] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('Used')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Submitted quote state
  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null)

  useEffect(() => {
    async function fetchRequest() {
      if (!token) {
        setError('This quote link is invalid. Missing token.')
        setLoading(false)
        return
      }

      const { data: tokenData, error: tokenError } = await getSupabase()
        .from('tokens')
        .select('*')
        .eq('token', token)
        .single()

      if (tokenError || !tokenData) {
        setError('This quote link is invalid or has expired.')
        setLoading(false)
        return
      }

      if (tokenData.used) {
        setError('This quote link has already been used.')
        setLoading(false)
        return
      }

      const { data: req, error: reqError } = await getSupabase()
        .from('requests')
        .select('*')
        .eq('id', id)
        .single()

      if (reqError) setError('This quote link is invalid or has expired.')
      else setRequest(req)

      setLoading(false)
    }
    fetchRequest()
  }, [id, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    if (!id || !token) {
      setSubmitError('Error: Invalid quote link.')
      setSubmitting(false)
      return
    }

    const { data: newQuote, error: insertError } = await getSupabase()
      .from('quotes')
      .insert({
        request_id: id,
        supplier_name: supplierName,
        price: parseFloat(price),
        condition,
        notes,
      })
      .select('*')
      .single()

    if (insertError) {
      setSubmitError(insertError.message)
      setSubmitting(false)
      return
    }

    const { error: tokenError } = await getSupabase()
      .from('tokens')
      .update({ used: true })
      .eq('token', token)

    if (tokenError) {
      console.error('Failed to mark token as used:', tokenError)
    }

    if (newQuote) {
      setSubmittedQuote(newQuote)
    }
    setSubmitting(false)
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error || 'Request not found'}</p>
        </div>
      </div>
    )
  }

  if (request.status === 'closed') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl">&#x1F512;</span>
          </div>
          <h2 className="font-semibold text-gray-800 mb-1">Quotes Closed</h2>
          <p className="text-sm text-gray-500">This request is no longer accepting quotes.</p>
        </div>
      </div>
    )
  }

  if (submittedQuote) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
          <div className="max-w-lg mx-auto">
            <h1 className="text-lg font-bold">Quote Submitted</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800 mb-1">Quote Submitted!</h2>
            <p className="text-sm text-gray-500">Thank you. Your quote has been received.</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Your Quote</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Your Name / Company
                </label>
                <p className="text-sm text-gray-900">{submittedQuote.supplier_name}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Price (AUD)
                </label>
                <p className="text-sm text-gray-900">${submittedQuote.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Condition
                </label>
                <p className="text-sm text-gray-900">{submittedQuote.condition}</p>
              </div>

              {submittedQuote.notes && (
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                    Notes
                  </label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{submittedQuote.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-400">
                  Submitted on {new Date(submittedQuote.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Submit a Quote</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Request info */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Request</p>
          <h2 className="text-lg font-bold text-gray-900">{request.title}</h2>
          {request.description && (
            <p className="text-sm text-gray-600 mt-2">{request.description}</p>
          )}
        </div>

        {/* Quote form */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Your Quote</h3>
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name / Company <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ABC Auto Parts"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (AUD) <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
              >
                <option value="New">New</option>
                <option value="Used">Used</option>
                <option value="Reconditioned">Reconditioned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                placeholder="Additional details, warranty, delivery info..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: '#d32f2f' }}
              className="w-full text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
