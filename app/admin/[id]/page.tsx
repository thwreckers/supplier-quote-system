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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [bulkTokenCount, setBulkTokenCount] = useState(1)
  const [generatingBulk, setGeneratingBulk] = useState(false)
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([])
  const [editingExpiry, setEditingExpiry] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryTime, setExpiryTime] = useState('')
  const [savingExpiry, setSavingExpiry] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const [tokenCount, setTokenCount] = useState(0)

  useEffect(() => {
    async function fetchData() {
      const db = getSupabase()
      const [{ data: req, error: reqErr }, { data: qs, error: qErr }, { count: tCount }] = await Promise.all([
        db.from('requests').select('*').eq('id', id).single(),
        db.from('quotes').select('*').eq('request_id', id).order('created_at', { ascending: true }),
        db.from('tokens').select('*', { count: 'exact', head: true }).eq('request_id', id),
      ])
      if (reqErr) setError(reqErr.message)
      else setRequest(req)
      if (!qErr) setQuotes(qs || [])
      setTokenCount(tCount || 0)
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
    const token = crypto.randomUUID().replace(/-/g, '').substring(0, 24)

    const { error } = await getSupabase().from('tokens').insert({
      request_id: id,
      token,
    })

    if (error) {
      alert('Failed to create share link: ' + error.message)
      setGeneratingToken(false)
      return
    }

    const shareUrl = `${window.location.origin}/quote/${id}?token=${token}`
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setGeneratingToken(false)
    setTimeout(() => setCopied(false), 3000)
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

  async function saveAdminNote(quoteId: string, noteText: string) {
    setSavingNote(true)
    const { error } = await getSupabase()
      .from('quotes')
      .update({ admin_notes: noteText })
      .eq('id', quoteId)

    if (!error) {
      setQuotes(
        quotes.map((q) =>
          q.id === quoteId ? { ...q, admin_notes: noteText } : q
        )
      )
      setEditingNoteId(null)
    }
    setSavingNote(false)
  }

  async function generateBulkTokens() {
    setGeneratingBulk(true)
    const tokens: string[] = []

    for (let i = 0; i < bulkTokenCount; i++) {
      const token = crypto.randomUUID().replace(/-/g, '').substring(0, 24)
      const { error } = await getSupabase().from('tokens').insert({
        request_id: id,
        token,
      })
      if (!error) {
        tokens.push(`${window.location.origin}/quote/${id}?token=${token}`)
      }
    }

    setGeneratedTokens(tokens)
    setGeneratingBulk(false)
  }

  async function copyAllTokens() {
    const allTokens = generatedTokens.join('\n\n')
    await navigator.clipboard.writeText(allTokens)
    alert(`Copied ${generatedTokens.length} links to clipboard!`)
  }

  async function saveExpiry() {
    if (!expiryDate || !expiryTime) return
    setSavingExpiry(true)
    const expiryDatetime = `${expiryDate}T${expiryTime}:00`
    const { error } = await getSupabase()
      .from('requests')
      .update({ expires_at: expiryDatetime })
      .eq('id', id)

    if (!error && request) {
      setRequest({ ...request, expires_at: expiryDatetime })
      setEditingExpiry(false)
    }
    setSavingExpiry(false)
  }

  function startEditExpiry() {
    if (request?.expires_at) {
      const dt = new Date(request.expires_at)
      setExpiryDate(dt.toISOString().split('T')[0])
      setExpiryTime(dt.toISOString().split('T')[1].substring(0, 5))
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setExpiryDate(tomorrow.toISOString().split('T')[0])
      setExpiryTime('17:00')
    }
    setEditingExpiry(true)
  }

  function isExpired() {
    if (!request?.expires_at) return false
    return new Date(request.expires_at) < new Date()
  }

  function formatExpiry(dateStr: string | null) {
    if (!dateStr) return 'No expiry set'
    const dt = new Date(dateStr)
    return dt.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  async function updateQuoteStatus(quoteId: string, newStatus: 'pending' | 'selected' | 'rejected') {
    setUpdatingStatus(quoteId)
    const { error } = await getSupabase()
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quoteId)

    if (!error) {
      setQuotes(
        quotes.map((q) =>
          q.id === quoteId ? { ...q, status: newStatus } : q
        )
      )
    }
    setUpdatingStatus(null)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'selected':
        return 'bg-green-100 text-green-700'
      case 'rejected':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-yellow-100 text-yellow-700'
    }
  }

  async function exportPDF() {
    const html2pdf = (await import('html2pdf.js')).default

    const element = document.createElement('div')
    element.innerHTML = `
      <h1 style="text-align: center; margin-bottom: 10px;">${request?.title || 'Quotes'}</h1>
      ${request?.description ? `<p style="text-align: center; margin-bottom: 20px; color: #666;">${request.description}</p>` : ''}
      <p style="margin-bottom: 20px; color: #999; font-size: 12px;">Exported: ${new Date().toLocaleDateString('en-AU')}</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Supplier</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Price</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Condition</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${sortedQuotes.map((quote) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${quote.supplier_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$${Number(quote.price).toFixed(2)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${quote.condition}</td>
              <td style="border: 1px solid #ddd; padding: 8px;"><strong>${quote.status.toUpperCase()}</strong></td>
              <td style="border: 1px solid #ddd; padding: 8px;">${quote.notes ? quote.notes.substring(0, 30) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    const opt: any = {
      margin: 10,
      filename: `${request?.title || 'quotes'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    }

    html2pdf().set(opt).from(element).save()
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

              {editingExpiry ? (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex gap-2 items-end">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Date</label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Time</label>
                      <input
                        type="time"
                        value={expiryTime}
                        onChange={(e) => setExpiryTime(e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      />
                    </div>
                    <button
                      onClick={saveExpiry}
                      disabled={savingExpiry}
                      className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-60"
                    >
                      {savingExpiry ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingExpiry(false)}
                      className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isExpired()
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isExpired() ? 'Expired' : 'Expires'}: {formatExpiry(request.expires_at)}
                  </span>
                  <button
                    onClick={startEditExpiry}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={copyLink}
                disabled={generatingToken}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition text-gray-700 disabled:opacity-60"
              >
                {generatingToken ? 'Generating...' : copied ? 'Copied!' : 'Copy Share Link'}
              </button>

              <div className="flex gap-1 items-center">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={bulkTokenCount}
                  onChange={(e) => setBulkTokenCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-16 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  onClick={generateBulkTokens}
                  disabled={generatingBulk}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition text-gray-700 disabled:opacity-60"
                >
                  {generatingBulk ? 'Generating...' : 'Generate Bulk'}
                </button>
              </div>
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

        {/* Bulk tokens display */}
        {generatedTokens.length > 0 && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-900">{generatedTokens.length} Share Links Generated</h3>
              <button
                onClick={copyAllTokens}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
              >
                Copy All Links
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {generatedTokens.map((url, idx) => (
                <div key={idx} className="bg-white rounded p-2 text-xs font-mono text-gray-600 break-all">
                  {url}
                </div>
              ))}
            </div>
            <button
              onClick={() => setGeneratedTokens([])}
              className="text-xs text-blue-600 mt-3 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* Response tracking */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Invitations Sent</p>
              <p className="text-2xl font-bold text-gray-900">{tokenCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Responses Received</p>
              <p className="text-2xl font-bold text-green-600">{quotes.length}</p>
            </div>
          </div>
          {tokenCount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Response rate: {Math.round((quotes.length / tokenCount) * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Quotes */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-800">
            Quotes ({quotes.length})
          </h2>
          <div className="flex gap-2 items-center">
            {quotes.length > 1 && (
              <span className="text-xs text-gray-400">Sorted by price (lowest first)</span>
            )}
            {quotes.length > 0 && (
              <button
                onClick={exportPDF}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition text-gray-700"
              >
                📥 Export PDF
              </button>
            )}
          </div>
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{quote.supplier_name}</p>
                      {index === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Lowest
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-2">
                      {quote.condition}
                    </span>
                    {quote.notes && (
                      <p className="text-sm text-gray-600 mb-2">{quote.notes}</p>
                    )}

                    {editingNoteId === quote.id ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          placeholder="Add internal notes..."
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1 resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveAdminNote(quote.id, editingNoteText)}
                            disabled={savingNote}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-60"
                          >
                            {savingNote ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        {quote.admin_notes ? (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                            <p className="text-xs text-blue-900">{quote.admin_notes}</p>
                          </div>
                        ) : null}
                        <button
                          onClick={() => {
                            setEditingNoteId(quote.id)
                            setEditingNoteText(quote.admin_notes || '')
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {quote.admin_notes ? 'Edit notes' : 'Add notes'}
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">{formatDate(quote.created_at)}</p>
                  </div>
                  <div className="text-right flex flex-col gap-2">
                    <p className="text-xl font-bold text-gray-900">${Number(quote.price).toFixed(2)}</p>
                    <div className="flex gap-1 flex-col">
                      <button
                        onClick={() => updateQuoteStatus(quote.id, 'selected')}
                        disabled={updatingStatus === quote.id}
                        className={`text-xs px-2 py-1 rounded font-medium transition ${
                          quote.status === 'selected'
                            ? 'bg-green-600 text-white'
                            : 'border border-green-300 text-green-700 hover:bg-green-50'
                        } disabled:opacity-60`}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => updateQuoteStatus(quote.id, 'rejected')}
                        disabled={updatingStatus === quote.id}
                        className={`text-xs px-2 py-1 rounded font-medium transition ${
                          quote.status === 'rejected'
                            ? 'bg-red-600 text-white'
                            : 'border border-red-300 text-red-700 hover:bg-red-50'
                        } disabled:opacity-60`}
                      >
                        Reject
                      </button>
                      {quote.status !== 'pending' && (
                        <button
                          onClick={() => updateQuoteStatus(quote.id, 'pending')}
                          disabled={updatingStatus === quote.id}
                          className="text-xs px-2 py-1 rounded font-medium border border-yellow-300 text-yellow-700 hover:bg-yellow-50 transition disabled:opacity-60"
                        >
                          Undo
                        </button>
                      )}
                    </div>
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
