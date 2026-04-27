'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { getSupabase, type Request, type Quote, type Token, type CustomField, type SelectedSupplier } from '@/lib/supabase'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

const modernStyles = `
  /* Dark mode support */
  .dark-mode {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --border-color: #475569;
  }

  .light-mode {
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --border-color: #e2e8f0;
  }

  input[type="text"],
  input[type="email"],
  input[type="tel"],
  input[type="number"],
  input[type="date"],
  input[type="time"],
  select,
  textarea {
    border-radius: 8px;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .dark-mode input[type="text"],
  .dark-mode input[type="email"],
  .dark-mode input[type="tel"],
  .dark-mode input[type="number"],
  .dark-mode input[type="date"],
  .dark-mode input[type="time"],
  .dark-mode select,
  .dark-mode textarea {
    background: #1e293b;
    border-color: #475569;
    color: #f1f5f9;
  }

  input:focus,
  select:focus,
  textarea:focus {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(211, 47, 47, 0.15);
  }

  .dark-mode table {
    background: #1e293b;
  }

  .dark-mode tbody tr:hover {
    background: #334155;
  }
`

export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // Redirect to suppliers page if accessing /admin/suppliers via this dynamic route
  if (id === 'suppliers') {
    redirect('/admin/suppliers')
  }

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

  // Field editing state
  const [editingFields, setEditingFields] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'textarea'>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [savingFields, setSavingFields] = useState(false)

  // Per-part selection state (maps part_index -> quote_id)
  const [selectedParts, setSelectedParts] = useState<{ [partIdx: number]: string }>({})
  const [savingSelection, setSavingSelection] = useState(false)

  // Dark mode state with localStorage persistence
  const [darkMode, setDarkMode] = useState(false)

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode')
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode))
    }
  }, [])

  // Save dark mode preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

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
      if (req?.custom_fields) {
        setCustomFields(req.custom_fields)
      }
      // Initialize selected parts from request data
      if (req?.selected_suppliers) {
        const partsMap: { [partIdx: number]: string } = {}
        req.selected_suppliers.forEach((supplier: SelectedSupplier) => {
          partsMap[supplier.part_index] = supplier.quote_id
        })
        setSelectedParts(partsMap)
      }
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

  async function updateStatus(newStatus: string) {
    if (!request) return
    setTogglingStatus(true)
    const { error } = await getSupabase().from('requests').update({ status: newStatus }).eq('id', id)
    if (!error) setRequest({ ...request, status: newStatus as typeof request.status })
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

  async function addCustomField() {
    if (!newFieldName.trim() || !request) return

    const newField: CustomField = {
      id: `field_${Date.now()}`,
      name: newFieldName,
      type: newFieldType,
      required: newFieldRequired,
      options: newFieldType === 'select' ? newFieldOptions.split(',').map(o => o.trim()) : undefined,
    }

    const updatedFields = [...customFields, newField]
    setSavingFields(true)
    const { error } = await getSupabase()
      .from('requests')
      .update({ custom_fields: updatedFields })
      .eq('id', id)

    if (!error) {
      setCustomFields(updatedFields)
      if (request) setRequest({ ...request, custom_fields: updatedFields })
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldRequired(false)
      setNewFieldOptions('')
    }
    setSavingFields(false)
  }

  async function removeCustomField(fieldId: string) {
    if (!request) return
    const updatedFields = customFields.filter(f => f.id !== fieldId)
    setSavingFields(true)
    const { error } = await getSupabase()
      .from('requests')
      .update({ custom_fields: updatedFields })
      .eq('id', id)

    if (!error) {
      setCustomFields(updatedFields)
      if (request) setRequest({ ...request, custom_fields: updatedFields })
    }
    setSavingFields(false)
  }

  function getQuoteFieldValue(quote: Quote, fieldId: string): string | undefined {
    if (!quote.quote_fields) return undefined
    return quote.quote_fields.find(f => f.field_id === fieldId)?.value
  }

  async function savePartSelection(partIdx: number, quoteId: string) {
    if (!request) return

    const updatedSelection = { ...selectedParts }
    if (updatedSelection[partIdx] === quoteId) {
      // Deselect if clicking same option
      delete updatedSelection[partIdx]
    } else {
      updatedSelection[partIdx] = quoteId
    }

    // Convert map to array format for database
    const selectedSuppliers = Object.entries(updatedSelection).map(([partIdx, quoteId]) => {
      const quote = quotes.find(q => q.id === quoteId)
      const price = quote?.quote_fields?.[parseInt(partIdx)]
        ? JSON.parse(quote.quote_fields[parseInt(partIdx)].value).price || '0'
        : '0'

      return {
        part_index: parseInt(partIdx),
        quote_id: quoteId,
        price: parseFloat(price),
      }
    })

    setSavingSelection(true)
    const { error } = await getSupabase()
      .from('requests')
      .update({ selected_suppliers: selectedSuppliers })
      .eq('id', id)

    if (!error) {
      setSelectedParts(updatedSelection)
      if (request) {
        setRequest({ ...request, selected_suppliers: selectedSuppliers })
      }
    }
    setSavingSelection(false)
  }

  async function exportPDF() {
    const html2pdf = (await import('html2pdf.js')).default

    // Build breakdown table with selected suppliers
    let breakdownTableHtml = ''
    let grandTotal = 0

    if (request?.parts && request.parts.length > 0) {
      const breakdownRows = request.parts.map((part, partIdx) => {
        const selectedQuoteId = selectedParts[partIdx]
        const quote = quotes.find(q => q.id === selectedQuoteId)
        let partPrice = '0'
        if (quote && quote.quote_fields && quote.quote_fields[partIdx]) {
          try {
            const parsed = JSON.parse(quote.quote_fields[partIdx].value)
            partPrice = parsed.price || '0'
          } catch (e) {
            // Fallback
          }
        }
        const qty = request.quantities?.[partIdx] || 1
        const unitPrice = parseFloat(partPrice)
        const totalPartPrice = unitPrice * qty
        grandTotal += totalPartPrice

        return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${part}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${qty}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${quote?.supplier_name || 'Not selected'}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${totalPartPrice.toFixed(2)}</td>
          </tr>
        `
      }).join('')

      breakdownTableHtml = `
        <h2 style="margin-top: 30px; margin-bottom: 10px; font-size: 16px; font-weight: bold;">Quote Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Part</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Supplier</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Unit Price</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">Grand Total:</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      `
    }

    const element = document.createElement('div')
    element.innerHTML = `
      <h1 style="text-align: center; margin-bottom: 10px;">${request?.title || 'Quotes'}</h1>
      ${request?.description ? `<p style="text-align: center; margin-bottom: 20px; color: #666;">${request.description}</p>` : ''}
      <p style="margin-bottom: 20px; color: #999; font-size: 12px;">Exported: ${new Date().toLocaleDateString('en-AU')}</p>

      ${breakdownTableHtml}

      <h2 style="margin-top: 30px; margin-bottom: 10px; font-size: 16px; font-weight: bold;">All Quotes</h2>
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
      filename: `${request?.title || 'quotes'}-breakdown.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    }

    html2pdf().set(opt).from(element).save()
  }

  if (loading) {
    return (
      <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-100'}`}>
        <style>{modernStyles}</style>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-100'}`}>
        <style>{modernStyles}</style>
        <p className="text-sm text-red-600">{error || 'Request not found'}</p>
      </div>
    )
  }

  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price)

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-100'}`}>
      <style>{modernStyles}</style>
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-white text-sm opacity-80 hover:opacity-100">
            ← Back
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <span className="text-sm font-semibold">Admin</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Request card */}
        <div className={`rounded-lg border p-6 mb-6 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{request.title}</h1>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    request.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {request.status}
                </span>
                {request?.group_id && (
                  <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                    {groupLinkClicks} click{groupLinkClicks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {request.description && (
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{request.description}</p>
              )}
              {request.customer_details && (() => {
                try {
                  const details = JSON.parse(request.customer_details)
                  if (details.type === 'ad-hoc') {
                    // Display ad-hoc customer as formatted key-value pairs (only filled fields)
                    const fields = [
                      { label: 'Name', value: details.name },
                      { label: 'Company', value: details.company },
                      { label: 'Email', value: details.email },
                      { label: 'Phone', value: details.phone },
                      { label: 'Source', value: details.source },
                      { label: 'Notes', value: details.notes }
                    ].filter(f => f.value) // Only show fields with values

                    return (
                      <div className={`mt-2 p-3 border rounded text-sm ${darkMode ? 'bg-purple-900 bg-opacity-20 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                        <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>Customer Details (Ad-Hoc)</p>
                        <div className="space-y-1">
                          {fields.map((field, idx) => (
                            <div key={idx} className="text-xs">
                              <span className={`font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>{field.label}:</span>
                              <span className={`ml-2 ${darkMode ? 'text-purple-200' : 'text-purple-900'}`}>{field.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                } catch (e) {
                  // Not JSON, display as-is (regular customer details text)
                  return (
                    <div className={`mt-2 p-2 border rounded text-sm ${darkMode ? 'bg-blue-900 bg-opacity-20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                      <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>Customer Details</p>
                      <p className="whitespace-pre-wrap text-xs">{request.customer_details}</p>
                    </div>
                  )
                }
              })()}

              {request?.parts && request.parts.length > 0 && (
                <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                  <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Parts Requested ({request.parts.length})</p>
                  <div className={`overflow-x-auto border rounded ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`border-b ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                          <th className={`text-left px-3 py-2 font-medium w-3/4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Part</th>
                          <th className={`text-left px-3 py-2 font-medium w-1/4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {request.parts.map((part, idx) => (
                          <tr key={idx} className={idx !== request.parts!.length - 1 ? `border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}` : ''}>
                            <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{part}</td>
                            <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{request.quantities?.[idx] || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Created {formatDate(request.created_at)}</p>

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
            <div className="flex justify-between items-start">
              <div />

              <div className="flex flex-col gap-2 items-end w-48">
                <button
                  onClick={copyLink}
                  disabled={generatingToken}
                  style={{ backgroundColor: '#d32f2f' }}
                  className="w-full text-sm text-white font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-60 shadow-md"
                >
                  {generatingToken ? 'Generating...' : copied ? '✓ Copied!' : '📋 Copy Share Link'}
                </button>

                <button
                  onClick={createGroupLink}
                  disabled={creatingGroupLink}
                  style={{ backgroundColor: '#2563eb' }}
                  className="w-full text-sm text-white font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-60 shadow-md"
                >
                  {creatingGroupLink ? 'Creating...' : copiedGroup ? '✓ Copied Group Link!' : '👥 Create Group Link'}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{ backgroundColor: '#f0f4f8' }}
                  className="w-full text-sm text-gray-700 font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-60 shadow-md"
                  title="Refresh quotes and responses"
                >
                  {refreshing ? 'Refreshing...' : '🔄 Refresh'}
                </button>

                <select
                  value={request.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={togglingStatus}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60 ${
                    request.status === 'open'
                      ? 'bg-green-600 hover:bg-green-700'
                      : request.status === 'awarded'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : request.status === 'completed'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : request.status === 'archived'
                      ? 'bg-gray-600 hover:bg-gray-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <option value="open">Open</option>
                  <option value="awarded">Awarded</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className={`mt-6 pt-6 border-t w-full ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <label className={`text-sm font-medium block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Request Images</label>
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

                    {/* Parts Table */}
                    {request?.parts && request.parts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 font-medium mb-2">Quote Details</p>
                        <div className="overflow-x-auto border border-gray-200 rounded text-xs">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-2 py-1 font-medium text-gray-600 w-2/5">Part</th>
                                <th className="text-left px-2 py-1 font-medium text-gray-600 w-1/5">Price</th>
                                <th className="text-left px-2 py-1 font-medium text-gray-600 w-1/5">Notes</th>
                                <th className="text-center px-2 py-1 font-medium text-gray-600 w-1/5">Select</th>
                              </tr>
                            </thead>
                            <tbody>
                              {request.parts.map((part, partIdx) => {
                                let partPrice = ''
                                let partNotes = ''
                                if (quote.quote_fields && quote.quote_fields[partIdx]) {
                                  try {
                                    const parsed = JSON.parse(quote.quote_fields[partIdx].value)
                                    partPrice = parsed.price || ''
                                    partNotes = parsed.notes || ''
                                  } catch (e) {
                                    // Fallback if parsing fails
                                  }
                                }
                                const isSelected = selectedParts[partIdx] === quote.id
                                return (
                                  <tr key={partIdx} className={`${isSelected ? 'bg-green-50' : ''} ${partIdx !== request.parts!.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                    <td className="px-2 py-1 text-gray-900">{part}</td>
                                    <td className="px-2 py-1 text-gray-900">${Number(partPrice).toFixed(2)}</td>
                                    <td className="px-2 py-1 text-gray-600">{partNotes}</td>
                                    <td className="px-2 py-1 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => savePartSelection(partIdx, quote.id)}
                                        disabled={savingSelection}
                                        className="cursor-pointer disabled:opacity-60"
                                      />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
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

        {/* Quick Supplier Comparison */}
        {request?.parts && request.parts.length > 0 && quotes.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Quick Supplier Comparison</h3>
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Part (Qty)</th>
                    {sortedQuotes.map(quote => (
                      <th key={quote.id} className="text-left px-3 py-2 font-medium text-gray-600 min-w-32 border-l border-gray-200">
                        {quote.supplier_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {request.parts.map((part, partIdx) => {
                    const prices = sortedQuotes.map(quote => {
                      if (quote.quote_fields && quote.quote_fields[partIdx]) {
                        try {
                          const parsed = JSON.parse(quote.quote_fields[partIdx].value)
                          return parseFloat(parsed.price || '0')
                        } catch (e) {
                          return null
                        }
                      }
                      return null
                    })
                    const minPrice = Math.min(...prices.filter(p => p !== null) as number[])
                    const qty = request.quantities?.[partIdx] || 1

                    return (
                      <tr key={partIdx} className={partIdx !== request.parts!.length - 1 ? 'border-b border-gray-200' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {part} ({qty}x)
                        </td>
                        {sortedQuotes.map((quote, quoteIdx) => {
                          const price = prices[quoteIdx]
                          const isLowest = price !== null && price === minPrice
                          const isSelected = selectedParts[partIdx] === quote.id

                          return (
                            <td
                              key={quote.id}
                              className={`px-3 py-2 border-l border-gray-200 cursor-pointer transition ${
                                isLowest ? 'bg-green-50 font-bold text-green-700' : ''
                              } ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''} hover:bg-gray-50`}
                              onClick={() => savePartSelection(partIdx, quote.id)}
                            >
                              {price !== null ? `$${price.toFixed(2)}` : '—'}
                              {isLowest && price !== null && (
                                <span className="ml-1 text-xs bg-green-200 text-green-800 px-1 rounded">✓</span>
                              )}
                              {isSelected && <span className="ml-1 text-xs">✓ Selected</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
