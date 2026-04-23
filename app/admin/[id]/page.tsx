'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase, type Request, type Quote, type Token } from '@/lib/supabase'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<Request | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedGroup, setCopiedGroup] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [creatingGroupLink, setCreatingGroupLink] = useState(false)
  const [groupLinkClicks, setGroupLinkClicks] = useState(0)
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
  const [images, setImages] = useState<any[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [quoteImages, setQuoteImages] = useState<{ [quoteId: string]: any[] }>({})

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<any[]>([])

  const [tokenCount, setTokenCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Disable page scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [lightboxOpen])

  async function fetchData() {
    const db = getSupabase()
    const [{ data: req, error: reqErr }, { data: qs, error: qErr }, { count: tCount }, { data: allImgs, error: imgErr }] = await Promise.all([
      db.from('requests').select('*').eq('id', id).single(),
      db.from('quotes').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      db.from('tokens').select('*', { count: 'exact', head: true }).eq('request_id', id),
      db.from('images').select('*'),
    ])
    if (reqErr) setError(reqErr.message)
    else {
      setRequest(req)
      // Fetch group link clicks if group_id exists
      if (req?.group_id) {
        const { count: clickCount } = await db
          .from('group_link_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', req.group_id)
        setGroupLinkClicks(clickCount || 0)
      }
    }
    if (!qErr) setQuotes(qs || [])

    // Split images into request and quote images
    if (allImgs) {
      const requestImgs = allImgs.filter((img) => img.request_id === id && !img.quote_id)
      const quoteImgsData = allImgs.filter((img) => img.quote_id)

      setImages(requestImgs)

      // Group quote images by quote_id
      const grouped: { [quoteId: string]: any[] } = {}
      quoteImgsData.forEach((img) => {
        if (!grouped[img.quote_id]) grouped[img.quote_id] = []
        grouped[img.quote_id].push(img)
      })
      setQuoteImages(grouped)
    }

    if (imgErr) console.error('Image fetch error:', imgErr)
    setTokenCount(tCount || 0)
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  useEffect(() => {
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

  async function createGroupLink() {
    setCreatingGroupLink(true)
    const groupId = crypto.randomUUID().replace(/-/g, '').substring(0, 24)

    const { error } = await getSupabase()
      .from('requests')
      .update({ group_id: groupId })
      .eq('id', id)

    if (error) {
      alert('Failed to create group link: ' + error.message)
      setCreatingGroupLink(false)
      return
    }

    // Update local state
    if (request) {
      setRequest({ ...request, group_id: groupId })
    }
    setGroupLinkClicks(0) // Reset click count for new group link

    const groupUrl = `${window.location.origin}/quote/${id}/group/${groupId}`
    await navigator.clipboard.writeText(groupUrl)
    setCopiedGroup(true)
    setCreatingGroupLink(false)
    setTimeout(() => setCopiedGroup(false), 3000)
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setUploadingImage(true)
    const filename = `${id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await getSupabase().storage
      .from('quote-images')
      .upload(filename, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingImage(false)
      return
    }

    const { error: dbError } = await getSupabase().from('images').insert({
      request_id: id,
      storage_path: filename,
      uploaded_by: 'requester',
    })

    if (!dbError) {
      setImages([...images, { request_id: id, storage_path: filename, uploaded_by: 'requester' }])
    }
    setUploadingImage(false)
    e.target.value = ''
  }

  async function deleteImage(storagePath: string) {
    const { error } = await getSupabase().storage.from('quote-images').remove([storagePath])
    if (!error) {
      setImages(images.filter((img) => img.storage_path !== storagePath))
    }
  }

  function getImageUrl(storagePath: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quote-images/${storagePath}`
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
              {request.customer_details && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                  <p className="text-xs font-medium text-blue-600 mb-1">Customer Details</p>
                  <p className="whitespace-pre-wrap">{request.customer_details}</p>
                </div>
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
                style={{ backgroundColor: '#d32f2f' }}
                className="text-sm text-white font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-60 shadow-md"
              >
                {generatingToken ? 'Generating...' : copied ? '✓ Copied!' : '📋 Copy Share Link'}
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition text-gray-700 disabled:opacity-60"
                title="Refresh quotes and responses"
              >
                {refreshing ? 'Refreshing...' : '🔄 Refresh'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={createGroupLink}
                  disabled={creatingGroupLink}
                  className="text-sm border border-blue-300 rounded-lg px-4 py-2 text-blue-700 hover:bg-blue-50 transition disabled:opacity-60 font-semibold"
                >
                  {creatingGroupLink ? 'Creating...' : copiedGroup ? '✓ Copied Group Link!' : '👥 Create Group Link'}
                </button>
                {request?.group_id && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {groupLinkClicks} click{groupLinkClicks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

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

            <div className="mt-6 pt-6 border-t border-gray-200 w-full">
              <label className="text-sm font-medium text-gray-700 block mb-2">Request Images</label>
              <div className="flex gap-2 items-center mb-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="text-sm file:border file:border-gray-300 file:rounded file:px-2 file:py-1 hover:file:bg-gray-50"
                />
                {uploadingImage && <span className="text-xs text-gray-500">Uploading...</span>}
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, idx) => (
                    <div key={img.storage_path} className="relative group">
                      <img
                        src={getImageUrl(img.storage_path)}
                        alt="request"
                        className="w-full h-20 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition"
                        onClick={() => {
                          setLightboxImages(images.map(i => ({
                            src: getImageUrl(i.storage_path)
                          })))
                          setLightboxIndex(idx)
                          setLightboxOpen(true)
                        }}
                      />
                      <button
                        onClick={() => deleteImage(img.storage_path)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-2">
                        Supplier Images {quoteImages[quote.id] ? `(${quoteImages[quote.id].length})` : '(0)'}
                      </p>
                      {quoteImages[quote.id] && quoteImages[quote.id].length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                          {quoteImages[quote.id].map((img, idx) => (
                            <img
                              key={img.id}
                              src={getImageUrl(img.storage_path)}
                              alt="quote"
                              className="w-full h-16 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition"
                              onClick={() => {
                                setLightboxImages(quoteImages[quote.id].map(i => ({
                                  src: getImageUrl(i.storage_path)
                                })))
                                setLightboxIndex(idx)
                                setLightboxOpen(true)
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No images uploaded</p>
                      )}
                    </div>

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

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        plugins={[Zoom]}
        zoom={{
          maxZoomPixelRatio: 10,
        }}
        on={{
          view: ({ index: currentIndex }) => setLightboxIndex(currentIndex),
        }}
      />
    </div>
  )
}
