'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSupabase, type Request, type CustomField } from '@/lib/supabase'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

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
  const [isExpired, setIsExpired] = useState(false)

  // Form state
  const [supplierName, setSupplierName] = useState('')
  const [condition, setCondition] = useState('Used')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Parts pricing state
  const [partPrices, setPartPrices] = useState<{ [partIndex: number]: string }>({})
  const [partNotes, setPartNotes] = useState<{ [partIndex: number]: string }>({})

  // Submitted quote state
  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null)

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false)
  const [quoteImages, setQuoteImages] = useState<any[]>([])
  const [requestImages, setRequestImages] = useState<any[]>([])

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<any[]>([])

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldValues, setFieldValues] = useState<{ [fieldId: string]: string }>({})

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

      const [{ data: req, error: reqError }, { data: imgs }] = await Promise.all([
        getSupabase()
          .from('requests')
          .select('*')
          .eq('id', id)
          .single(),
        getSupabase()
          .from('images')
          .select('*')
          .eq('request_id', id)
          .eq('uploaded_by', 'requester'),
      ])

      if (reqError) setError('This quote link is invalid or has expired.')
      else {
        setRequest(req)
        if (req?.custom_fields) {
          setCustomFields(req.custom_fields)
        }
        if (imgs) setRequestImages(imgs)
        if (req.expires_at && new Date(req.expires_at) < new Date()) {
          setIsExpired(true)
        }
      }

      setLoading(false)
    }
    fetchRequest()
  }, [id, token])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setUploadingImage(true)
    const filename = `quote-${id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await getSupabase().storage
      .from('quote-images')
      .upload(filename, file)

    if (!uploadError) {
      setQuoteImages([...quoteImages, { storage_path: filename }])
    }
    setUploadingImage(false)
    e.target.value = ''
  }

  function getImageUrl(storagePath: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quote-images/${storagePath}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    if (!id || !token) {
      setSubmitError('Error: Invalid quote link.')
      setSubmitting(false)
      return
    }

    // Build quote_fields from part prices and notes
    const quoteFields = request?.parts?.map((part, idx) => ({
      field_id: `part_${idx}`,
      value: JSON.stringify({
        price: partPrices[idx] || '',
        notes: partNotes[idx] || '',
      }),
    })) || []

    // Calculate total price from all parts (quantity × price per part)
    const totalPrice = request?.parts?.reduce((sum, _, idx) => {
      const qty = request?.quantities?.[idx] || 1
      const price = parseFloat(partPrices[idx] || '0')
      return sum + (isNaN(price) ? 0 : price * qty)
    }, 0) || 0

    const { data: newQuote, error: insertError } = await getSupabase()
      .from('quotes')
      .insert({
        request_id: id,
        supplier_name: supplierName,
        price: totalPrice,
        condition,
        notes: '',
        quote_fields: quoteFields.length > 0 ? quoteFields : null,
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
      // Save quote images to database
      if (quoteImages.length > 0) {
        const imagesToInsert = quoteImages.map((img) => ({
          quote_id: newQuote.id,
          storage_path: img.storage_path,
          uploaded_by: 'supplier',
        }))
        await getSupabase().from('images').insert(imagesToInsert)
      }
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

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl">⏰</span>
          </div>
          <h2 className="font-semibold text-gray-800 mb-1">Quote Link Expired</h2>
          <p className="text-sm text-gray-500">This quote request is no longer accepting submissions.</p>
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
          {requestImages.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Images</p>
              <div className="grid grid-cols-3 gap-2">
                {requestImages.map((img, idx) => (
                  <img
                    key={img.id}
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quote-images/${img.storage_path}`}
                    alt="request"
                    className="w-full h-24 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition"
                    onClick={() => {
                      setLightboxImages(requestImages.map(i => ({
                        src: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quote-images/${i.storage_path}`
                      })))
                      setLightboxIndex(idx)
                      setLightboxOpen(true)
                    }}
                  />
                ))}
              </div>
            </div>
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

            {/* Parts Pricing Table */}
            {request?.parts && request.parts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quote Details</label>
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-2/5">Part</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-1/8">Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-1/4">Price (AUD)</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-1/4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.parts.map((part, idx) => (
                        <tr key={idx} className={idx !== request.parts!.length - 1 ? 'border-b border-gray-200' : ''}>
                          <td className="px-3 py-2 text-gray-900">{part}</td>
                          <td className="px-3 py-2 text-gray-900 font-medium">{request.quantities?.[idx] || 1}</td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={partPrices[idx] || ''}
                                onChange={e => setPartPrices({ ...partPrices, [idx]: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1 pl-6 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="e.g. New, LED, Black"
                              value={partNotes[idx] || ''}
                              onChange={e => setPartNotes({ ...partNotes, [idx]: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Custom Fields */}
            {customFields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.name}
                  {field.required && <span style={{ color: '#d32f2f' }}>*</span>}
                </label>
                {field.type === 'text' && (
                  <input
                    type="text"
                    required={field.required}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                    value={fieldValues[field.id] || ''}
                    onChange={e => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    required={field.required}
                    min="0"
                    step="0.01"
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                    value={fieldValues[field.id] || ''}
                    onChange={e => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                )}
                {field.type === 'select' && field.options && (
                  <select
                    required={field.required}
                    value={fieldValues[field.id] || ''}
                    onChange={e => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  >
                    <option value="">Select an option</option>
                    {field.options.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'textarea' && (
                  <textarea
                    required={field.required}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                    value={fieldValues[field.id] || ''}
                    onChange={e => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photos (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="text-sm file:border file:border-gray-300 file:rounded file:px-2 file:py-1 hover:file:bg-gray-50"
              />
              {uploadingImage && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
              {quoteImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {quoteImages.map((img, idx) => (
                    <img
                      key={img.storage_path}
                      src={getImageUrl(img.storage_path)}
                      alt="quote"
                      className="w-full h-16 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition"
                      onClick={() => {
                        setLightboxImages(quoteImages.map(i => ({
                          src: getImageUrl(i.storage_path)
                        })))
                        setLightboxIndex(idx)
                        setLightboxOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
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
