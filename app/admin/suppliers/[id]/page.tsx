'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase, type Supplier, type Quote, type Request } from '@/lib/supabase'

interface SupplierQuote extends Quote {
  request?: Request
}

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
`

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const db = getSupabase()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [quotes, setQuotes] = useState<SupplierQuote[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [mergeTargetId, setMergeTargetId] = useState('')

  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: '',
    rating: 0,
  })

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

  useEffect(() => {
    fetchSupplier()
  }, [params.id])

  async function fetchSupplier() {
    setLoading(true)
    try {
      const { data: supplierData } = await db
        .from('suppliers')
        .select('*')
        .eq('id', params.id)
        .single()

      if (supplierData) {
        setSupplier(supplierData)
        setEditForm({
          name: supplierData.name,
          company: supplierData.company || '',
          email: supplierData.email || '',
          phone: supplierData.phone || '',
          notes: supplierData.notes || '',
          rating: supplierData.rating || 0,
        })
      }

      const { data: allSuppliersData } = await db
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })

      if (allSuppliersData) {
        setAllSuppliers(allSuppliersData.filter(s => s.id !== params.id))
      }

      const { data: quotesData } = await db
        .from('quotes')
        .select('*')
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })

      if (quotesData) {
        setQuotes(quotesData)

        const requestIds = [...new Set(quotesData.map(q => q.request_id))]
        if (requestIds.length > 0) {
          const { data: requestsData } = await db
            .from('requests')
            .select('*')
            .in('id', requestIds)

          if (requestsData) {
            setRequests(requestsData)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching supplier:', error)
    }
    setLoading(false)
  }

  async function handleSave() {
    try {
      const { error } = await db
        .from('suppliers')
        .update(editForm)
        .eq('id', params.id)

      if (!error) {
        setSupplier({ ...supplier!, ...editForm })
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving supplier:', error)
    }
  }

  async function handleMerge() {
    if (!mergeTargetId) return

    try {
      await db
        .from('quotes')
        .update({ supplier_id: mergeTargetId })
        .eq('supplier_id', params.id)

      await db
        .from('suppliers')
        .delete()
        .eq('id', params.id)

      router.push('/admin/suppliers')
    } catch (error) {
      console.error('Error merging supplier:', error)
    }
  }

  async function handleDelete() {
    try {
      await db
        .from('quotes')
        .update({ supplier_id: null })
        .eq('supplier_id', params.id)

      await db
        .from('suppliers')
        .delete()
        .eq('id', params.id)

      router.push('/admin/suppliers')
    } catch (error) {
      console.error('Error deleting supplier:', error)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-50'}`}>
        <style>{modernStyles}</style>
        <p className={`p-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading supplier...</p>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-50'}`}>
        <style>{modernStyles}</style>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Supplier not found.</p>
          <Link href="/admin/suppliers" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-4 inline-block">
            ← Back to Suppliers
          </Link>
        </div>
      </div>
    )
  }

  const getRequestTitle = (requestId: string) => {
    return requests.find(r => r.id === requestId)?.title || 'Unknown'
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-50'}`}>
      <style>{modernStyles}</style>

      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{supplier.name}</h1>
            <p className="text-sm text-red-100 mt-1">{supplier.company || 'No company'}</p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
            title="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/admin/suppliers" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-6 inline-block">
          ← Back to Suppliers
        </Link>

        <div className={`rounded-lg border p-6 mb-8 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Supplier Details</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Company
                </label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                  }`}
                  rows={3}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Rating (1-5)
                </label>
                <select
                  value={editForm.rating}
                  onChange={(e) => setEditForm({ ...editForm, rating: parseFloat(e.target.value) })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                  }`}
                >
                  <option value={0}>No rating</option>
                  <option value={1}>1 - Poor</option>
                  <option value={2}>2 - Fair</option>
                  <option value={3}>3 - Good</option>
                  <option value={4}>4 - Very Good</option>
                  <option value={5}>5 - Excellent</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Name</p>
                <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{supplier.name}</p>
              </div>
              <div>
                <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Company</p>
                <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{supplier.company || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{supplier.email || '—'}</p>
                </div>
                <div>
                  <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{supplier.phone || '—'}</p>
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Notes</p>
                <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{supplier.notes || '—'}</p>
              </div>
              <div>
                <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rating</p>
                <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {supplier.rating ? `${supplier.rating} / 5` : 'No rating'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-lg border p-6 mb-8 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Actions</h2>

          <div className="space-y-3">
            {!isMerging && (
              <button
                onClick={() => setIsMerging(true)}
                className="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition text-left"
              >
                Merge with Another Supplier
              </button>
            )}

            {isMerging && (
              <div className="space-y-3 p-4 border rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select a supplier to merge into (all quotes will be reassigned):
                </p>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                  }`}
                >
                  <option value="">Choose a supplier...</option>
                  {allSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleMerge}
                    disabled={!mergeTargetId}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
                  >
                    Confirm Merge
                  </button>
                  <button
                    onClick={() => setIsMerging(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!isDeleting && (
              <button
                onClick={() => setIsDeleting(true)}
                className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition text-left"
              >
                Delete Supplier
              </button>
            )}

            {isDeleting && (
              <div className="space-y-3 p-4 border rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Are you sure? This will delete the supplier and unlink all {quotes.length} quotes.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setIsDeleting(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg border p-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Quote History</h2>

          {quotes.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No quotes from this supplier yet.</p>
          ) : (
            <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <table className={`w-full text-sm ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                <thead>
                  <tr className={darkMode ? 'bg-slate-700 border-b border-slate-600' : 'bg-gray-50 border-b border-gray-200'}>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Request</th>
                    <th className={`text-right px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Price</th>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Date</th>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Condition</th>
                    <th className={`text-center px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id} className={`border-b ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition`}>
                      <td className={`px-4 py-3 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {getRequestTitle(quote.request_id)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        ${quote.price.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(quote.created_at).toLocaleDateString()}
                      </td>
                      <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {quote.condition || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/${quote.request_id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}