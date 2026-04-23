'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase, type Request } from '@/lib/supabase'

export default function AdminPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [customerDetails, setCustomerDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchRequests() {
    const { data, error } = await getSupabase()
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { data, error } = await getSupabase()
      .from('requests')
      .insert({
        title,
        description,
        customer_details: customerDetails || null,
        status: 'open'
      })
      .select()
      .single()
    if (error) {
      setError(error.message)
    } else {
      const link = `${window.location.origin}/quote/${data.id}`
      setNewLink(link)
      setTitle('')
      setDescription('')
      setCustomerDetails('')
      setShowForm(false)
      fetchRequests()
    }
    setSubmitting(false)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Supplier Quote System</h1>
          <span className="text-sm opacity-80">Admin</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* New link banner */}
        {newLink && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-800 mb-1">Request created! Share this link with suppliers:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm bg-white border border-green-200 rounded px-2 py-1 break-all text-green-700">
                {newLink}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(newLink) }}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
            <button onClick={() => setNewLink(null)} className="mt-2 text-xs text-green-600 underline">Dismiss</button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">All Requests</h2>
          <button
            onClick={() => { setShowForm(!showForm); setNewLink(null); setError(null) }}
            style={{ backgroundColor: '#d32f2f' }}
            className="text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            {showForm ? 'Cancel' : '+ New Request'}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Create New Request</h3>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2015 Mazda 3 Front Bumper"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Part details, condition requirements, notes for suppliers..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Details (Admin Only)</label>
                <textarea
                  placeholder="Customer name, contact info, internal notes, etc..."
                  value={customerDetails}
                  onChange={e => setCustomerDetails(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{ backgroundColor: '#d32f2f' }}
                className="text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
              >
                {submitting ? 'Creating...' : 'Create Request'}
              </button>
            </form>
          </div>
        )}

        {/* Requests list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No requests yet. Create your first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <Link key={req.id} href={`/admin/${req.id}`}>
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-red-300 hover:shadow-sm transition cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{req.title}</p>
                      {req.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{req.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(req.created_at)}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        req.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
