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

  // Bulk actions state
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'delete' | 'merge' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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

  // Bulk actions functions
  function toggleSupplierSelection(supplierId: string) {
    const newSelected = new Set(selectedSuppliers)
    if (newSelected.has(supplierId)) {
      newSelected.delete(supplierId)
    } else {
      newSelected.add(supplierId)
    }
    setSelectedSuppliers(newSelected)
  }

  async function bulkMerge() {
    if (selectedSuppliers.size < 2) {
      alert('Please select at least 2 suppliers to merge')
      return
    }

    // Get selected suppliers in order
    const selectedList = paginatedSuppliers
      .filter(s => selectedSuppliers.has(s.supplier.id))
      .map(s => s.supplier)

    if (selectedList.length < 2) {
      alert('Please select at least 2 suppliers to merge')
      return
    }

    const primary = selectedList[0]
    const othersToMerge = selectedList.slice(1)

    const otherNames = othersToMerge.map(s => `"${s.name}"`).join(', ')
    if (!window.confirm(
      `Merge ${otherNames} into "${primary.name}"?\n\nAll quotes and information will be merged.`
    )) {
      return
    }

    setIsProcessing(true)
    try {
      const db = getSupabase()

      // Update all quotes from other suppliers to primary
      for (const other of othersToMerge) {
        console.log(`Updating quotes for supplier: ${other.id} -> ${primary.id}`)
        const { error: quoteError } = await db
          .from('quotes')
          .update({ supplier_id: primary.id })
          .eq('supplier_id', other.id)

        if (quoteError) {
          console.error(`Error updating quotes for ${other.name}:`, quoteError)
          alert(`Error updating quotes: ${quoteError.message}`)
          setIsProcessing(false)
          return
        }

        // Mark as merged
        console.log(`Marking supplier as merged: ${other.id}`)
        const { error: mergeError } = await db
          .from('suppliers')
          .update({ merged_into_id: primary.id })
          .eq('id', other.id)

        if (mergeError) {
          console.error(`Error marking supplier as merged:`, mergeError)
          alert(`Error marking supplier: ${mergeError.message}`)
          setIsProcessing(false)
          return
        }
      }

      console.log('Merge completed successfully')
      alert('Suppliers merged successfully!')
      setSelectedSuppliers(new Set())
      setBulkAction(null)
      fetchSuppliers()
    } catch (error) {
      console.error('Error merging suppliers:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  async function bulkDelete() {
    if (selectedSuppliers.size === 0) {
      alert('Please select suppliers to delete')
      return
    }

    const selectedList = paginatedSuppliers.filter(s => selectedSuppliers.has(s.supplier.id))
    const names = selectedList.map(s => `"${s.supplier.name}"`).join(', ')

    if (!window.confirm(
      `Delete ${selectedList.length} supplier(s): ${names}?\n\nTheir quotes will be unlinked.`
    )) {
      return
    }

    setIsProcessing(true)
    try {
      const db = getSupabase()

      for (const stat of selectedList) {
        console.log(`Deleting supplier: ${stat.supplier.id}`)

        // Unlink quotes
        console.log(`Unlinking quotes for supplier: ${stat.supplier.id}`)
        const { error: unlinkError } = await db
          .from('quotes')
          .update({ supplier_id: null })
          .eq('supplier_id', stat.supplier.id)

        if (unlinkError) {
          console.error(`Error unlinking quotes:`, unlinkError)
          alert(`Error unlinking quotes: ${unlinkError.message}`)
          setIsProcessing(false)
          return
        }

        // Delete supplier
        console.log(`Deleting supplier record: ${stat.supplier.id}`)
        const deleteResult = await db
          .from('suppliers')
          .delete()
          .eq('id', stat.supplier.id)

        console.log('Delete result:', deleteResult)

        if (deleteResult.error) {
          console.error(`Error deleting supplier:`, deleteResult.error)
          alert(`Error deleting supplier: ${deleteResult.error.message}`)
          setIsProcessing(false)
          return
        }
      }

      console.log('Delete completed successfully')
      alert('Suppliers deleted successfully!')
      setSelectedSuppliers(new Set())
      setBulkAction(null)
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting suppliers:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
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
        {/* Search */}
        <div className="mb-6">
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
        </div>

        {/* Bulk Actions */}
        {selectedSuppliers.size > 0 && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center justify-between ${
            darkMode ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200'
          }`}>
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {selectedSuppliers.size} supplier{selectedSuppliers.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={bulkMerge}
                disabled={isProcessing || selectedSuppliers.size < 2}
                style={{ backgroundColor: '#d32f2f' }}
                className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Merge'}
              </button>
              <button
                onClick={bulkDelete}
                disabled={isProcessing}
                className="text-white bg-red-700 px-4 py-2 rounded text-sm font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Delete'}
              </button>
              <button
                onClick={() => setSelectedSuppliers(new Set())}
                disabled={isProcessing}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                } disabled:opacity-50`}
              >
                Clear
              </button>
            </div>
          </div>
        )}

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
                    <th className={`w-12 px-4 py-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.size === paginatedSuppliers.length && paginatedSuppliers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSuppliers(new Set(paginatedSuppliers.map(s => s.supplier.id)))
                          } else {
                            setSelectedSuppliers(new Set())
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </th>
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
                        <td className={`w-12 px-4 py-3`}>
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.has(stat.supplier.id)}
                            onChange={() => toggleSupplierSelection(stat.supplier.id)}
                            className="cursor-pointer"
                          />
                        </td>
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
      </main>
    </div>
  )
}
