'use client'

import { useEffect, useState } from 'react'
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
  const [backfilling, setBackfilling] = useState(false)

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

    // Fetch all suppliers
    const { data: suppliersData } = await db
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })

    if (suppliersData) {
      // Fetch all quotes to calculate stats
      const { data: quotesData } = await db
        .from('quotes')
        .select('supplier_id, price, created_at')

      // Calculate stats for each supplier
      const stats: SupplierStats[] = suppliersData.map(supplier => {
        const supplierQuotes = quotesData?.filter(q => q.supplier_id === supplier.id) || []
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
    setLoading(false)
  }

  async function backfillSuppliers() {
    setBackfilling(true)
    try {
      const db = getSupabase()

      // Get all quotes with supplier_name but no supplier_id
      const { data: quotesWithoutSupplier } = await db
        .from('quotes')
        .select('supplier_name, id')
        .is('supplier_id', null)

      if (!quotesWithoutSupplier || quotesWithoutSupplier.length === 0) {
        // Check if there are ANY quotes at all
        const { data: allQuotes } = await db.from('quotes').select('count')
        const totalQuotes = allQuotes ? Object.keys(allQuotes).length : 0

        alert(`No unlinked quotes found.\n\nTotal quotes in system: ${totalQuotes}\n\nSuppliers are created when quotes are submitted through the supplier form.`)
        setBackfilling(false)
        return
      }

      // Get unique supplier names
      const uniqueNames = [...new Set(quotesWithoutSupplier.map(q => q.supplier_name).filter(Boolean))]

      // Get existing suppliers
      const { data: existingSuppliers } = await db
        .from('suppliers')
        .select('name, id')

      const existingNames = new Set(existingSuppliers?.map(s => s.name) || [])

      let created = 0
      let linked = 0

      // Create new suppliers and link quotes
      for (const name of uniqueNames) {
        if (existingNames.has(name)) {
          // Supplier exists, link quotes
          const supplierId = existingSuppliers?.find(s => s.name === name)?.id
          if (supplierId) {
            await db
              .from('quotes')
              .update({ supplier_id: supplierId })
              .eq('supplier_name', name)
              .is('supplier_id', null)
            linked += quotesWithoutSupplier.filter(q => q.supplier_name === name).length
          }
        } else {
          // Create new supplier
          const { data: newSupplier } = await db
            .from('suppliers')
            .insert({ name })
            .select('id')
            .single()

          if (newSupplier?.id) {
            await db
              .from('quotes')
              .update({ supplier_id: newSupplier.id })
              .eq('supplier_name', name)
              .is('supplier_id', null)
            created++
            linked += quotesWithoutSupplier.filter(q => q.supplier_name === name).length
          }
        }
      }

      alert(`✓ Backfill complete!\n${created} new suppliers created\n${linked} quotes linked`)
      fetchSuppliers()
    } catch (error) {
      console.error('Error backfilling suppliers:', error)
      alert('Error backfilling suppliers')
    }
    setBackfilling(false)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.supplier.company?.toLowerCase().includes(searchQuery.toLowerCase()))
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
          <button
            onClick={backfillSuppliers}
            disabled={backfilling}
            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {backfilling ? 'Importing...' : '📥 Import Existing Suppliers from Quotes'}
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
                    <tr key={stat.supplier.id} className={`border-b ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition`}>
                      <td className={`px-4 py-3 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{stat.supplier.name}</td>
                      <td className={`px-4 py-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{stat.supplier.company || '—'}</td>
                      <td className={`px-4 py-3 text-center font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{stat.quoteCount}</td>
                      <td className={`px-4 py-3 text-right font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {stat.quoteCount > 0 ? `$${stat.avgPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {stat.lastQuoteDate ? new Date(stat.lastQuoteDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/suppliers/${stat.supplier.id}`}
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
