'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase, type Request, type Customer } from '@/lib/supabase'

const checkboxStyles = `
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

  input[type="checkbox"].styled-checkbox:focus {
    outline: none;
    ring: 2px;
    ring-color: #fecaca;
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

  // Delete request state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Bulk selection state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkClosing, setBulkClosing] = useState(false)

  // Edit customer state
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerCompany, setEditCustomerCompany] = useState('')
  const [editCustomerEmail, setEditCustomerEmail] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editCustomerNotes, setEditCustomerNotes] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)

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

    const { data, error } = await getSupabase()
      .from('requests')
      .insert({
        title,
        description: '',
        parts: nonEmptyParts,
        quantities: nonEmptyQuantities,
        customer_details: customerDetails || null,
        customer_id: formCustomerId || null,
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
    <div className="min-h-screen bg-gray-100">
      <style>{checkboxStyles}</style>
      {/* Header */}
      <header style={{ backgroundColor: '#d32f2f' }} className="text-white px-4 py-4 shadow">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Supplier Quote System</h1>
          <span className="text-sm opacity-80">Admin</span>
        </div>
      </header>

      <div className="flex min-h-screen bg-gray-100">
        {/* Left Sidebar - Customer Filter */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 shadow-sm overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Filter by Customer</h2>

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
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
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
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 px-4 py-8">
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
            <h2 className="text-lg font-semibold text-gray-800">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Optional)</label>
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

              {formCustomerId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/4">Name</td>
                        <td className="px-3 py-2 text-gray-900">
                          {customers.find(c => c.id === formCustomerId)?.name}
                        </td>
                      </tr>
                      {customers.find(c => c.id === formCustomerId)?.company && (
                        <tr className="border-b border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/4">Company</td>
                          <td className="px-3 py-2 text-gray-900">
                            {customers.find(c => c.id === formCustomerId)?.company}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.email && (
                        <tr className="border-b border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/4">Email</td>
                          <td className="px-3 py-2 text-gray-900">
                            {customers.find(c => c.id === formCustomerId)?.email}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.phone && (
                        <tr className="border-b border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/4">Phone</td>
                          <td className="px-3 py-2 text-gray-900">
                            {customers.find(c => c.id === formCustomerId)?.phone}
                          </td>
                        </tr>
                      )}
                      {customers.find(c => c.id === formCustomerId)?.notes && (
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/4">Notes</td>
                          <td className="px-3 py-2 text-gray-900 whitespace-pre-wrap">
                            {customers.find(c => c.id === formCustomerId)?.notes}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {showAddCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-900 mb-3">Add New Customer</p>
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
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900 mb-3">Edit Customer</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Parts</label>
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-3/4">Part</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-1/4">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part, idx) => (
                        <tr key={idx} className={idx !== parts.length - 1 ? 'border-b border-gray-300' : ''}>
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
            <p className="text-sm text-gray-500">Loading...</p>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">
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
                        <div className={`bg-white rounded-lg border p-4 hover:border-red-300 hover:shadow-sm transition cursor-pointer ${
                          selectedRequests.has(req.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{req.title}</p>
                            {req.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{req.description}</p>
                            )}
                            {req.customer_id && customers.find(c => c.id === req.customer_id) && (
                              <p className="text-xs text-blue-600 mt-1">
                                👤 {customers.find(c => c.id === req.customer_id)?.name}
                              </p>
                            )}
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
