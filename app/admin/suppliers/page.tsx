'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase, type Supplier, type Quote } from '@/lib/supabase'

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

interface SupplierStats {
  supplier: Supplier
  quoteCount: number
  avgPrice: number
  lastQuoteDate: string | null
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [page, setPage] = useState(1)
  const SUPPLIERS_PER_PAGE = 10

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Duplicate detection state
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{ primary: Supplier; duplicates: Supplier[] }>>([])
  const [mergeState, setMergeState] = useState<{ primary: Supplier; duplicate: Supplier } | null>(null)
  const [isMerging, setIsMerging] = useState(false)

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
    fetchSuppliers()
  }, [])

  async function fetchSuppliers() {
    setLoading(true)
    const db = getSupabase()

    try {
      // Get all quotes to see who has submitted
      const { data: allQuotes } = await db
        .from('quotes')
        .select('supplier_id, supplier_name, price, created_at')

      if (!allQuotes) {
        setSuppliers([])
        setLoading(false)
        return
      }

      // Get unique supplier_name values from quotes
      const uniqueSupplierNames = [...new Set(allQuotes
        .map(q => q.supplier_name)
        .filter(Boolean)
      )]

      // Get existing suppliers
      const { data: existingSuppliers } = await db
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })

      const existingSupplierMap = new Map((existingSuppliers || []).map(s => [s.name, s]))
      const suppliersToCreate = uniqueSupplierNames.filter(name => !existingSupplierMap.has(name))

      // Create missing suppliers from quote history
      for (const name of suppliersToCreate) {
        const { data: newSupplier } = await db
          .from('suppliers')
          .insert({ name })
          .select('*')
          .single()

        if (newSupplier) {
          existingSupplierMap.set(newSupplier.name, newSupplier)
        }
      }

      // Fetch updated suppliers list
      const { data: suppliersData } = await db
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })

      if (suppliersData) {
        // Calculate stats for each supplier from quotes
        const stats: SupplierStats[] = suppliersData.map(supplier => {
          const supplierQuotes = allQuotes.filter(q => q.supplier_id === supplier.id) || []
          const avgPrice = supplierQuotes.length > 0
            ? supplierQuotes.reduce((sum, q) => sum + q.price, 0) / supplierQuotes.length
            : 0
          const lastQuoteDate = supplierQuotes.length > 0
            ? supplierQuotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
            : null

          return {
            supplier,
            quoteCount: supplierQuotes.length,
            avgPrice,
            lastQuoteDate,
          }
        })

        setSuppliers(stats)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
    setLoading(false)
  }

  async function deleteSupplier(supplierId: string) {
    if (!confirm('Delete this supplier? Their quotes will be unlinked.')) return

    try {
      const db = getSupabase()
      // Unlink quotes
      await db.from('quotes').update({ supplier_id: null }).eq('supplier_id', supplierId)
      // Delete supplier
      await db.from('suppliers').delete().eq('id', supplierId)
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Error deleting supplier')
    }
  }

  // Helper functions for duplicate detection
  function normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  function levenshteinDistance(a: string, b: string): number {
    const aLen = a.length
    const bLen = b.length
    const matrix: number[][] = []

    for (let i = 0; i <= bLen; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= aLen; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[bLen][aLen]
  }

  function stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    const longerLength = longer.length
    if (longerLength === 0) return 1.0
    const editDistance = levenshteinDistance(longer, shorter)
    return (longerLength - editDistance) / longerLength
  }

  function detectDuplicates() {
    const allSuppliers = suppliers.map(s => s.supplier)
    const normalized = new Map<string, Supplier[]>()
    const grouped: Array<{ primary: Supplier; duplicates: Supplier[] }> = []
    const seen = new Set<string>()

    // Group by normalized name (exact matches)
    for (const supplier of allSuppliers) {
      if (supplier.merged_into_id) continue // Skip merged suppliers
      const norm = normalizeName(supplier.name)
      if (!normalized.has(norm)) {
        normalized.set(norm, [])
      }
      normalized.get(norm)!.push(supplier)
    }

    // Find groups with multiple suppliers
    for (const [norm, group] of normalized) {
      if (group.length > 1) {
        grouped.push({
          primary: group[0],
          duplicates: group.slice(1),
        })
      }
    }

    // Also find fuzzy matches (>70% similarity or if one name starts with the other)
    for (const supplier1 of allSuppliers) {
      if (supplier1.merged_into_id) continue
      for (const supplier2 of allSuppliers) {
        if (supplier2.merged_into_id || supplier1.id >= supplier2.id) continue
        const name1 = normalizeName(supplier1.name)
        const name2 = normalizeName(supplier2.name)

        // Check similarity
        const similarity = stringSimilarity(name1, name2)

        // Check if one name starts with the other (e.g., "Ahmadi Auto" vs "Ahmadi Auto Parts")
        const isSubstring = name1.startsWith(name2.split(' ')[0] + ' ') ||
                           name2.startsWith(name1.split(' ')[0] + ' ')

        if ((similarity > 0.7 && similarity < 1.0) || (isSubstring && similarity > 0.65)) {
          // Check if not already in grouped
          const key = `${supplier1.id}-${supplier2.id}`
          if (!seen.has(key)) {
            seen.add(key)
            grouped.push({
              primary: supplier1,
              duplicates: [supplier2],
            })
          }
        }
      }
    }

    setPotentialDuplicates(grouped)
    setShowDuplicates(true)
  }

  async function mergeDuplicates(primary: Supplier, duplicate: Supplier) {
    if (!window.confirm(`Merge "${duplicate.name}" into "${primary.name}"? All quotes will be reassigned.`)) {
      return
    }

    setIsMerging(true)
    try {
      const db = getSupabase()

      // Update all quotes from duplicate to primary
      await db
        .from('quotes')
        .update({ supplier_id: primary.id })
        .eq('supplier_id', duplicate.id)

      // Mark duplicate as merged
      await db
        .from('suppliers')
        .update({ merged_into_id: primary.id })
        .eq('id', duplicate.id)

      // Refresh data
      setMergeState(null)
      setShowDuplicates(false)
      fetchSuppliers()
    } catch (error) {
      console.error('Error merging suppliers:', error)
      alert('Error merging suppliers')
    } finally {
      setIsMerging(false)
    }
  }

  function toggleEditRow(supplier: Supplier) {
    if (editingId === supplier.id) {
      setEditingId(null)
    } else {
      setEditingId(supplier.id)
      setEditFormData({
        name: supplier.name || '',
        company: supplier.company || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        notes: supplier.notes || '',
      })
      setSaveMessage(null)
    }
  }

  async function saveSupplier(supplierId: string) {
    if (!editFormData.name.trim()) {
      alert('Supplier name is required')
      return
    }

    setIsSaving(true)
    try {
      const db = getSupabase()
      await db
        .from('suppliers')
        .update({
          name: editFormData.name,
          company: editFormData.company || null,
          email: editFormData.email || null,
          phone: editFormData.phone || null,
          notes: editFormData.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId)

      setSaveMessage('✓ Saved successfully')
      setTimeout(() => setSaveMessage(null), 2000)

      // Update local state without full refresh
      setSuppliers(suppliers.map(s =>
        s.supplier.id === supplierId
          ? { ...s, supplier: { ...s.supplier, ...editFormData } }
          : s
      ))
    } catch (error) {
      console.error('Error saving supplier:', error)
      setSaveMessage('Error saving supplier')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredSuppliers = suppliers.filter(s =>
    !s.supplier.merged_into_id && // Hide merged suppliers
    (s.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.supplier.company?.toLowerCase().includes(searchQuery.toLowerCase())))
  )

  const totalPages = Math.ceil(filteredSuppliers.length / SUPPLIERS_PER_PAGE)
  const paginatedSuppliers = filteredSuppliers.slice(
    (page - 1) * SUPPLIERS_PER_PAGE,
    page * SUPPLIERS_PER_PAGE
  )

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-50'}`}>
      <style>{modernStyles}</style>

      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-white hover:text-red-100 text-sm font-medium mr-4">
            ← Back
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Supplier Database</h1>
            <p className="text-sm text-red-100 mt-1">Internal tracking • {suppliers.length} suppliers</p>
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
        {/* Search and Actions */}
        <div className="mb-6 space-y-3">
          <input
            type="text"
            placeholder="Search suppliers by name or company..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'border-gray-300'
            }`}
          />
          <button
            onClick={detectDuplicates}
            style={{ backgroundColor: '#d32f2f' }}
            className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            🔍 Find Duplicates
          </button>
        </div>

        {/* Suppliers Table */}
        {loading ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading suppliers...</p>
        ) : filteredSuppliers.length === 0 ? (
          <div className={`rounded-lg border p-8 text-center ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {suppliers.length === 0 ? 'No suppliers yet. They appear when quotes are submitted.' : 'No suppliers match your search.'}
            </p>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <table className={`w-full text-sm ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                <thead>
                  <tr className={darkMode ? 'bg-slate-700 border-b border-slate-600' : 'bg-gray-50 border-b border-gray-200'}>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Supplier Name</th>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Company</th>
                    <th className={`text-center px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Quotes</th>
                    <th className={`text-right px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Avg Price</th>
                    <th className={`text-left px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Last Quote</th>
                    <th className={`text-center px-4 py-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSuppliers.map((stat, idx) => (
                    <React.Fragment key={stat.supplier.id}>
                      <tr className={`border-b ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition`}>
                        <td className={`px-4 py-3 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{stat.supplier.name}</td>
                        <td className={`px-4 py-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{stat.supplier.company || '—'}</td>
                        <td className={`px-4 py-3 text-center font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{stat.quoteCount}</td>
                        <td className={`px-4 py-3 text-right font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {stat.quoteCount > 0 ? `$${stat.avgPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {stat.lastQuoteDate ? new Date(stat.lastQuoteDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center space-x-2 flex justify-center">
                          <button
                            onClick={() => toggleEditRow(stat.supplier)}
                            className={`text-xs font-medium ${editingId === stat.supplier.id ? 'text-orange-600 hover:text-orange-800' : 'text-blue-600 hover:text-blue-800'}`}
                          >
                            {editingId === stat.supplier.id ? 'Close' : 'Edit'}
                          </button>
                          <button
                            onClick={() => deleteSupplier(stat.supplier.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {/* Inline Edit Form */}
                      {editingId === stat.supplier.id && (
                        <tr className={darkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                              <h3 className={`font-medium mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                Edit Supplier Details
                              </h3>

                              <div className="grid grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="col-span-2">
                                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Name <span style={{ color: '#d32f2f' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                                    }`}
                                  />
                                </div>

                                {/* Company */}
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Company
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.company}
                                    onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                                    }`}
                                  />
                                </div>

                                {/* Email */}
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                                    }`}
                                  />
                                </div>

                                {/* Phone */}
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Phone
                                  </label>
                                  <input
                                    type="tel"
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                                    }`}
                                  />
                                </div>

                                {/* Notes */}
                                <div className="col-span-2">
                                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Notes
                                  </label>
                                  <textarea
                                    value={editFormData.notes}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    rows={2}
                                    className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                      darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Buttons & Message */}
                              <div className="flex gap-2 mt-4 items-center">
                                <button
                                  onClick={() => saveSupplier(stat.supplier.id)}
                                  disabled={isSaving}
                                  style={{ backgroundColor: '#d32f2f' }}
                                  className="text-white px-4 py-2 rounded font-medium text-sm hover:opacity-90 disabled:opacity-50"
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => toggleEditRow(stat.supplier)}
                                  disabled={isSaving}
                                  className={`px-4 py-2 rounded font-medium text-sm ${
                                    darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                                  } disabled:opacity-50`}
                                >
                                  Close
                                </button>
                                {saveMessage && (
                                  <span className={`text-sm font-medium ${saveMessage.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                                    {saveMessage}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between mt-6 p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Page {page} of {totalPages} ({filteredSuppliers.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition ${
                      page === 1
                        ? darkMode ? 'bg-slate-700 border-slate-600 text-gray-500 cursor-not-allowed' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                        : darkMode ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition ${
                      page === totalPages
                        ? darkMode ? 'bg-slate-700 border-slate-600 text-gray-500 cursor-not-allowed' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                        : darkMode ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Duplicates Modal */}
        {showDuplicates && (
          <div className={`mt-6 p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${darkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
                ⚠️ Potential Duplicates Found
              </h2>
              <button
                onClick={() => setShowDuplicates(false)}
                className={`text-sm font-medium ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Close
              </button>
            </div>

            {potentialDuplicates.length === 0 ? (
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                No duplicates detected. Your supplier names look good!
              </p>
            ) : (
              <div className="space-y-4">
                {potentialDuplicates.map((group, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-yellow-300'}`}
                  >
                    <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Match Group {idx + 1}
                    </p>

                    <div className="space-y-2">
                      {/* Primary */}
                      <div className={`p-2 rounded ${darkMode ? 'bg-slate-600' : 'bg-green-50'}`}>
                        <p className={`text-xs font-medium ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                          ✓ Primary (keep)
                        </p>
                        <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {group.primary.name}
                        </p>
                      </div>

                      {/* Duplicates */}
                      {group.duplicates.map((dup) => (
                        <div key={dup.id} className={`p-2 rounded ${darkMode ? 'bg-slate-600' : 'bg-red-50'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-medium ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                                ✗ Duplicate
                              </p>
                              <p className={`text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                {dup.name}
                              </p>
                            </div>
                            <button
                              onClick={() => mergeDuplicates(group.primary, dup)}
                              disabled={isMerging}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {isMerging ? 'Merging...' : 'Merge'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
