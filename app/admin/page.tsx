'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase, type Request, type Customer } from '@/lib/supabase'

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

  /* Checkboxes */
  input[type="checkbox"].styled-checkbox {
    appearance: none;
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  }

  .dark-mode input[type="checkbox"].styled-checkbox {
    background: #1e293b;
    border-color: #475569;
  }

  input[type="checkbox"].styled-checkbox:hover {
    border-color: #9ca3af;
  }

  input[type="checkbox"].styled-checkbox:checked {
    background-color: #d32f2f;
    border-color: #d32f2f;
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100%;
  }

  input[type="checkbox"].styled-checkbox:checked:hover {
    background-color: #b71c1c;
    border-color: #b71c1c;
  }

  /* Modern Buttons */
  button {
    transition: all 0.3s ease;
    border-radius: 8px;
    font-weight: 500;
  }

  button:active {
    transform: scale(0.98);
  }

  /* Inputs */
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

  /* Cards */
  .card {
    border-radius: 12px;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  .dark-mode .card {
    background: #1e293b;
    border-color: #475569;
  }

  /* Tables */
  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  .dark-mode table {
    background: #1e293b;
  }

  .dark-mode tbody tr:hover {
    background: #334155;
  }
`

export default function AdminPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [quoteCounts, setQuoteCounts] = useState<{ [requestId: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [parts, setParts] = useState<string[]>(['', '', ''])
  const [quantities, setQuantities] = useState<number[]>([1, 1, 1])
  const [customerDetails, setCustomerDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [searchCustomer, setSearchCustomer] = useState('')

  // Form-specific customer selection
  const [formCustomerId, setFormCustomerId] = useState<string | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerCompany, setNewCustomerCompany] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerNotes, setNewCustomerNotes] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)

  // Ad-hoc customer state
  const [adHocName, setAdHocName] = useState('')
  const [adHocCompany, setAdHocCompany] = useState('')
  const [adHocEmail, setAdHocEmail] = useState('')
  const [adHocPhone, setAdHocPhone] = useState('')
  const [adHocNotes, setAdHocNotes] = useState('')
  const [adHocSource, setAdHocSource] = useState('Phone Call')

  // Delete request state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Bulk selection state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkClosing, setBulkClosing] = useState(false)

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false)

  // Edit customer state
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerCompany, setEditCustomerCompany] = useState('')
  const [editCustomerEmail, setEditCustomerEmail] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editCustomerNotes, setEditCustomerNotes] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)

  // Delete customer state
  const [deleteConfirmCustomerId, setDeleteConfirmCustomerId] = useState<string | null>(null)
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null)

  async function fetchRequests() {
    const db = getSupabase()

    // Fetch customers
    const { data: customersData, error: customersError } = await db
      .from('customers')
      .select('*')
      .order('name', { ascending: true })

    if (!customersError) {
      setCustomers(customersData || [])
    }

    const { data, error } = await db
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setRequests(data || [])
      // Fetch quote counts for each request
      if (data) {
        const counts: { [requestId: string]: number } = {}
        for (const req of data) {
          const { count } = await db
            .from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('request_id', req.id)
          counts[req.id] = count || 0
        }
        setQuoteCounts(counts)
      }
    }
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchRequests()
    setRefreshing(false)
  }

  async function deleteRequest(requestId: string) {
    setDeletingId(requestId)
    const { error } = await getSupabase()
      .from('requests')
      .delete()
      .eq('id', requestId)

    if (!error) {
      setRequests(requests.filter(r => r.id !== requestId))
      setDeleteConfirmId(null)
    } else {
      setError(error.message)
    }
    setDeletingId(null)
  }

  function toggleRequestSelection(requestId: string) {
    const newSelected = new Set(selectedRequests)
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId)
    } else {
      newSelected.add(requestId)
    }
    setSelectedRequests(newSelected)
  }

  function toggleSelectAll() {
    if (selectedRequests.size === filteredRequests.length) {
      setSelectedRequests(new Set())
    } else {
      setSelectedRequests(new Set(filteredRequests.map(r => r.id)))
    }
  }

  async function bulkDeleteRequests() {
    setBulkDeleting(true)
    const { error } = await getSupabase()
      .from('requests')
      .delete()
      .in('id', Array.from(selectedRequests))

    if (!error) {
      setRequests(requests.filter(r => !selectedRequests.has(r.id)))
      setSelectedRequests(new Set())
      setDeleteConfirmId(null)
    } else {
      setError(error.message)
    }
    setBulkDeleting(false)
  }

  async function bulkCloseRequests() {
    setBulkClosing(true)
    const { error } = await getSupabase()
      .from('requests')
      .update({ status: 'closed' })
      .in('id', Array.from(selectedRequests))

    if (!error) {
      setRequests(requests.map(r =>
        selectedRequests.has(r.id) ? { ...r, status: 'closed' } : r
      ))
      setSelectedRequests(new Set())
    } else {
      setError(error.message)
    }
    setBulkClosing(false)
  }

  function startEditCustomer(customerId: string) {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setEditingCustomerId(customerId)
      setEditCustomerName(customer.name)
      setEditCustomerCompany(customer.company || '')
      setEditCustomerEmail(customer.email || '')
      setEditCustomerPhone(customer.phone || '')
      setEditCustomerNotes(customer.notes || '')
    }
  }

  async function saveCustomerEdit() {
    if (!editingCustomerId || !editCustomerName.trim()) {
      setError('Customer name is required')
      return
    }

    setSavingCustomer(true)
    const { error: err } = await getSupabase()
      .from('customers')
      .update({
        name: editCustomerName,
        company: editCustomerCompany || null,
        email: editCustomerEmail || null,
        phone: editCustomerPhone || null,
        notes: editCustomerNotes || null,
      })
      .eq('id', editingCustomerId)

    if (err) {
      setError(err.message)
    } else {
      // Update local customers list
      const updatedCustomers = customers.map(c =>
        c.id === editingCustomerId
          ? {
              ...c,
              name: editCustomerName,
              company: editCustomerCompany || null,
              email: editCustomerEmail || null,
              phone: editCustomerPhone || null,
              notes: editCustomerNotes || null,
            }
          : c
      )
      setCustomers(updatedCustomers)

      // Re-select the customer to refresh the display
      if (formCustomerId === editingCustomerId) {
        selectCustomerForForm(editingCustomerId)
      }

      setEditingCustomerId(null)
    }
    setSavingCustomer(false)
  }

  async function deleteCustomer(customerId: string) {
    setDeletingCustomerId(customerId)
    const { error } = await getSupabase()
      .from('customers')
      .delete()
      .eq('id', customerId)

    if (!error) {
      setCustomers(customers.filter(c => c.id !== customerId))
      setDeleteConfirmCustomerId(null)
      // Clear any filters that might reference this customer
      if (selectedCustomerId === customerId) {
        setSelectedCustomerId(null)
      }
    } else {
      setError(error.message)
    }
    setDeletingCustomerId(null)
  }

  function selectCustomerForForm(customerId: string) {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setFormCustomerId(customerId)
      // Auto-fill customer details
      const detailsText = [
        customer.name,
        customer.company && `Company: ${customer.company}`,
        customer.contact_person && `Contact: ${customer.contact_person}`,
        customer.email && `Email: ${customer.email}`,
        customer.phone && `Phone: ${customer.phone}`,
        customer.notes && `Notes: ${customer.notes}`
      ]
        .filter(Boolean)
        .join('\n')
      setCustomerDetails(detailsText)
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!newCustomerName.trim()) {
      setError('Customer name is required')
      return
    }

    setAddingCustomer(true)
    const { data, error: err } = await getSupabase()
      .from('customers')
      .insert({
        name: newCustomerName,
        company: newCustomerCompany || null,
        email: newCustomerEmail || null,
        phone: newCustomerPhone || null,
        notes: newCustomerNotes || null,
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
      setAddingCustomer(false)
    } else {
      // Add to local customers list
      setCustomers([...customers, data].sort((a, b) => a.name.localeCompare(b.name)))
      // Select the newly created customer
      selectCustomerForForm(data.id)
      // Reset add customer form
      setNewCustomerName('')
      setNewCustomerCompany('')
      setNewCustomerEmail('')
      setNewCustomerPhone('')
      setNewCustomerNotes('')
      setShowAddCustomer(false)
      setAddingCustomer(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Filter out empty parts
    const nonEmptyParts = parts.filter(p => p.trim() !== '')

    if (nonEmptyParts.length === 0) {
      setError('Please add at least one part')
      setSubmitting(false)
      return
    }

    const nonEmptyQuantities = quantities.slice(0, nonEmptyParts.length)

    // Determine customer info - use ad-hoc if name is filled, otherwise use dropdown
    let finalCustomerId = null
    let finalCustomerDetails = null

    if (adHocName.trim()) {
      // Ad-hoc customer - store only filled-in fields as JSON in customer_details
      finalCustomerId = null
      const adHocData: any = {
        type: 'ad-hoc',
        name: adHocName,
      }
      // Only add optional fields if they have values
      if (adHocCompany.trim()) adHocData.company = adHocCompany
      if (adHocEmail.trim()) adHocData.email = adHocEmail
      if (adHocPhone.trim()) adHocData.phone = adHocPhone
      if (adHocNotes.trim()) adHocData.notes = adHocNotes
      if (adHocSource) adHocData.source = adHocSource

      finalCustomerDetails = JSON.stringify(adHocData)
    } else {
      // Regular customer from dropdown
      finalCustomerId = formCustomerId || null
      finalCustomerDetails = customerDetails || null
    }

    const { data, error } = await getSupabase()
      .from('requests')
      .insert({
        title,
        description: '',
        parts: nonEmptyParts,
        quantities: nonEmptyQuantities,
        customer_details: finalCustomerDetails,
        customer_id: finalCustomerId,
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
      setParts(['', '', ''])
      setQuantities([1, 1, 1])
      setCustomerDetails('')
      setFormCustomerId(null)
      setAdHocName('')
      setAdHocCompany('')
      setAdHocEmail('')
      setAdHocPhone('')
      setAdHocNotes('')
      setAdHocSource('Phone Call')
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

  // Get filtered requests based on selected customer
  const filteredRequests = selectedCustomerId
    ? requests.filter(req => req.customer_id === selectedCustomerId)
    : requests

  // Get filtered customers based on search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchCustomer.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchCustomer.toLowerCase()))
  )

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark-mode bg-slate-900' : 'light-mode bg-gray-50'}`}>
      <style>{modernStyles}</style>
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Supplier Quote System</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <span className="text-sm opacity-90">Admin</span>
          </div>
        </div>
      </header>

      <div className={`flex min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        {/* Left Sidebar - Customer Filter */}
        <div className={`w-64 transition-colors duration-300 border-r p-4 shadow-sm overflow-y-auto ${
          darkMode
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Filter by Customer</h2>

          {/* Search box */}
          <input
            type="text"
            placeholder="Search customers..."
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
          />

          {/* Clear filter button */}
          {selectedCustomerId && (
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="w-full text-sm text-red-600 hover:text-red-800 font-medium mb-3 border border-red-200 rounded px-2 py-1"
            >
              ✕ Clear Filter
            </button>
          )}

          {/* Customer list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
            ) : (
              filteredCustomers.map(customer => (
                <div key={customer.id}>
                  {deleteConfirmCustomerId === customer.id ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs space-y-2">
                      <p className="text-red-900 font-medium">Delete {customer.name}?</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteCustomer(customer.id)}
                          disabled={deletingCustomerId === customer.id}
                          className="flex-1 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded hover:bg-red-700 transition disabled:opacity-60"
                        >
                          {deletingCustomerId === customer.id ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmCustomerId(null)}
                          className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition relative group ${
                        selectedCustomerId === customer.id
                          ? 'bg-red-100 text-red-900 font-medium'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{customer.name}</div>
                      {customer.company && <div className="text-xs text-gray-500">{customer.company}</div>}
                      <div className="text-xs text-gray-400">
                        {requests.filter(r => r.customer_id === customer.id).length} request{requests.filter(r => r.customer_id === customer.id).length !== 1 ? 's' : ''}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeleteConfirmCustomerId(customer.id)
                        }}
                        className="absolute top-1 right-1 text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition text-lg"
                        title="Delete customer"
                      >
                        ✕
                      </button>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 px-4 py-8 transition-colors duration-300">
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

        <div className="max-w-4xl mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              {selectedCustomerId ? `Requests for ${customers.find(c => c.id === selectedCustomerId)?.name}` : 'All Requests'}
            </h2>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition text-gray-700 disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : '🔄 Refresh'}
              </button>
              <button
                onClick={() => { setShowForm(!showForm); setNewLink(null); setError(null) }}
                style={{ backgroundColor: '#d32f2f' }}
                className="text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition"
              >
                {showForm ? 'Cancel' : '+ New Request'}
              </button>
            </div>
          </div>

        {/* Create form */}
        {showForm && (
          <div className={`card ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-6 mb-6`}>
            <h3 className={`text-base font-semibold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Create New Request</h3>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2015 Mazda 3 Front Bumper"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition-all ${
                  darkMode
                    ? 'bg-slate-700 border border-slate-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customer (Optional)</label>
                <div className="flex gap-2 items-end">
                  <select
                    value={formCustomerId || ''}
                    onChange={e => {
                      if (e.target.value) {
                        selectCustomerForForm(e.target.value)
                      } else {
                        setFormCustomerId(null)
                        setCustomerDetails('')
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <option value="">Select a customer...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.company ? `(${customer.company})` : ''}
                      </option>
                    ))}
                  </select>
                  {formCustomerId && (
                    <button
                      type="button"
                      onClick={() => startEditCustomer(formCustomerId)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition text-gray-700 font-medium whitespace-nowrap"
                    >
                      ✎ Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition text-gray-700 font-medium whitespace-nowrap"
                  >
                    {showAddCustomer ? '− Cancel' : '+ New'}
                  </button>
                </div>
              </div>

              <div className={`border rounded-lg p-4 space-y-3 mb-4 ${darkMode ? 'bg-purple-900 bg-opacity-20 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-purple-300' : 'text-purple-900'}`}>Quick Customer (Ad-Hoc)</p>
                <p className={`text-xs mb-3 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>For one-time contacts - leave blank to use selected customer above</p>
                <input
                  type="text"
                  placeholder="Customer name"
                  value={adHocName}
                  onChange={e => setAdHocName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <input
                  type="text"
                  placeholder="Company (optional)"
                  value={adHocCompany}
                  onChange={e => setAdHocCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={adHocEmail}
                  onChange={e => setAdHocEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={adHocPhone}
                  onChange={e => setAdHocPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <select
                  value={adHocSource}
                  onChange={e => setAdHocSource(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="Phone Call">Phone Call</option>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Other">Other</option>
                </select>
                <textarea
                  placeholder="Notes (optional)"
                  value={adHocNotes}
                  onChange={e => setAdHocNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                />
              </div>

              {formCustomerId && (
                <div className={`border rounded-lg overflow-hidden ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                        <td className={`px-3 py-2 font-medium w-1/4 ${darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>Name</td>
                        <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {customers.find(c => c.id === formCustomerId)?.name}
                        </td>
                      </tr>
                      {customers.find(c => c.id === formCustomerId)?.company && (
                        <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                          <td className={`px-3 py-2 font-medium w-1/4 ${darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>Company</td>
                          <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {customers.find(c => c.id === formCustomerId)?.company}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.email && (
                        <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                          <td className={`px-3 py-2 font-medium w-1/4 ${darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>Email</td>
                          <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {customers.find(c => c.id === formCustomerId)?.email}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.phone && (
                        <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                          <td className={`px-3 py-2 font-medium w-1/4 ${darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>Phone</td>
                          <td className={`px-3 py-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {customers.find(c => c.id === formCustomerId)?.phone}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.notes && (
                        <tr>
                          <td className={`px-3 py-2 font-medium w-1/4 ${darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>Notes</td>
                          <td className={`px-3 py-2 whitespace-pre-wrap ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {customers.find(c => c.id === formCustomerId)?.notes}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {showAddCustomer && (
                <div className={`border rounded-lg p-4 space-y-3 ${darkMode ? 'bg-blue-900 bg-opacity-20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>Add New Customer</p>
                  <input
                    type="text"
                    placeholder="Customer name *"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <input
                    type="text"
                    placeholder="Company name (optional)"
                    value={newCustomerCompany}
                    onChange={e => setNewCustomerCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newCustomerEmail}
                    onChange={e => setNewCustomerEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={newCustomerNotes}
                    onChange={e => setNewCustomerNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    disabled={addingCustomer || !newCustomerName.trim()}
                    className="w-full bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                  >
                    {addingCustomer ? 'Adding...' : 'Add Customer'}
                  </button>
                </div>
              )}

              {editingCustomerId && (
                <div className={`border rounded-lg p-4 space-y-3 ${darkMode ? 'bg-amber-900 bg-opacity-20 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-amber-300' : 'text-amber-900'}`}>Edit Customer</p>
                  <input
                    type="text"
                    placeholder="Customer name *"
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <input
                    type="text"
                    placeholder="Company name (optional)"
                    value={editCustomerCompany}
                    onChange={e => setEditCustomerCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={editCustomerEmail}
                    onChange={e => setEditCustomerEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={editCustomerPhone}
                    onChange={e => setEditCustomerPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={editCustomerNotes}
                    onChange={e => setEditCustomerNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveCustomerEdit}
                      disabled={savingCustomer}
                      className="flex-1 bg-amber-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-60"
                    >
                      {savingCustomer ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCustomerId(null)}
                      className="flex-1 bg-white border border-amber-300 text-amber-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-amber-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Parts</label>
                <div className={`overflow-x-auto border rounded-lg ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-300'}`}>
                        <th className={`text-left px-3 py-2 text-xs font-medium w-3/4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Part</th>
                        <th className={`text-left px-3 py-2 text-xs font-medium w-1/4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part, idx) => (
                        <tr key={idx} className={idx !== parts.length - 1 ? `border-b ${darkMode ? 'border-slate-600' : 'border-gray-300'}` : ''}>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder={`Part ${idx + 1}`}
                              value={part}
                              onChange={e => {
                                const newParts = [...parts]
                                newParts[idx] = e.target.value
                                setParts(newParts)
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={quantities[idx] || 1}
                              onChange={e => {
                                const newQtys = [...quantities]
                                newQtys[idx] = Math.max(1, parseInt(e.target.value) || 1)
                                setQuantities(newQtys)
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParts([...parts, ''])
                    setQuantities([...quantities, 1])
                  }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Row
                </button>
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
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
          ) : filteredRequests.length === 0 ? (
            <div className={`card ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-8 text-center`}>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {selectedCustomerId ? 'No requests for this customer.' : 'No requests yet. Create your first one above.'}
              </p>
            </div>
          ) : (
            <>
              {selectedRequests.size > 0 && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-900">
                    {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRequests(new Set())}
                      className="text-sm border border-blue-300 rounded px-3 py-1 hover:bg-blue-100 transition text-blue-700"
                    >
                      Clear
                    </button>
                    <button
                      onClick={bulkCloseRequests}
                      disabled={bulkClosing}
                      className="text-sm bg-gray-600 text-white rounded px-3 py-1 hover:bg-gray-700 transition font-medium disabled:opacity-60"
                    >
                      {bulkClosing ? 'Closing...' : 'Close Selected'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId('bulk')}
                      className="text-sm bg-red-600 text-white rounded px-3 py-1 hover:bg-red-700 transition font-medium"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}

              {deleteConfirmId === 'bulk' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-red-900 mb-3">
                    Delete {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={bulkDeleteRequests}
                      disabled={bulkDeleting}
                      className="flex-1 bg-red-600 text-white text-sm font-medium px-3 py-2 rounded hover:bg-red-700 transition disabled:opacity-60"
                    >
                      {bulkDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 bg-white border border-red-300 text-red-600 text-sm font-medium px-3 py-2 rounded hover:bg-red-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedRequests.size > 0 && selectedRequests.size === filteredRequests.length}
                    onChange={toggleSelectAll}
                    className="styled-checkbox"
                  />
                  <label className="text-xs text-gray-600 font-medium cursor-pointer">
                    {selectedRequests.size === filteredRequests.length && filteredRequests.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </label>
                </div>
              {filteredRequests.map(req => (
                <div key={req.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRequests.has(req.id)}
                    onChange={() => toggleRequestSelection(req.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="styled-checkbox mt-1 shrink-0"
                  />
                  <div className="flex-1">
                    {deleteConfirmId === req.id ? (
                      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                        <p className="text-sm font-semibold text-red-900 mb-3">Delete "{req.title}"?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteRequest(req.id)}
                            disabled={deletingId === req.id}
                            className="flex-1 bg-red-600 text-white text-sm font-medium px-3 py-2 rounded hover:bg-red-700 transition disabled:opacity-60"
                          >
                            {deletingId === req.id ? 'Deleting...' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="flex-1 bg-white border border-red-300 text-red-600 text-sm font-medium px-3 py-2 rounded hover:bg-red-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Link href={`/admin/${req.id}`}>
                        <div className={`card p-4 cursor-pointer transition-all ${
                          selectedRequests.has(req.id)
                            ? darkMode ? 'border-blue-500 bg-blue-900 bg-opacity-30' : 'border-blue-300 bg-blue-50'
                            : darkMode ? 'bg-slate-800 border-slate-700 hover:border-red-500' : 'bg-white border-gray-200 hover:border-red-300'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{req.title}</p>
                            {req.description && (
                              <p className={`text-xs mt-0.5 line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{req.description}</p>
                            )}
                            {req.customer_id && customers.find(c => c.id === req.customer_id) && (
                              <p className="text-xs text-blue-600 mt-1">
                                👤 {customers.find(c => c.id === req.customer_id)?.name}
                              </p>
                            )}
                            {!req.customer_id && req.customer_details && (() => {
                              try {
                                const adHoc = JSON.parse(req.customer_details)
                                if (adHoc.type === 'ad-hoc') {
                                  return (
                                    <p className="text-xs text-purple-600 mt-1">
                                      ☎️ {adHoc.name} ({adHoc.source})
                                    </p>
                                  )
                                }
                              } catch (e) {}
                              return null
                            })()}
                            <p className="text-xs text-gray-400 mt-1">{formatDate(req.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                req.status === 'open'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {req.status}
                            </span>
                            {quoteCounts[req.id] > 0 && (
                              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                +{quoteCounts[req.id]} quote{quoteCounts[req.id] !== 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setDeleteConfirmId(req.id)
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </main>
      </div>
    </div>
  )
}
