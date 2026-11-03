import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api, getAuthToken, setAuthToken, clearAuthToken } from './api/client';
import ToastContainer from './components/Toast';

const CATEGORIES = [
  'General',
  'Food & Dining',
  'Groceries',
  'Transport & Travel',
  'Housing & Rent',
  'Utilities & Bills',
  'Entertainment',
  'Shopping',
  'Other'
];

function App() {
  // Authentication state
  const [token, setToken] = useState(() => getAuthToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // App navigation state
  const [activeTab, setActiveTab] = useState('Overview'); // 'Overview' | 'Groups' | 'Expenses' | 'Balances'
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Groups and active group data
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balancesData, setBalancesData] = useState({ balances: [], debts: [], settlements: [] });

  // Create group form state
  const [newGroup, setNewGroup] = useState({ name: '', description: '', currency: 'INR' });
  const [createGroupLoading, setCreateGroupLoading] = useState(false);

  // Add member form state
  const [memberEmail, setMemberEmail] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    description: '',
    amount: '',
    category: 'General',
    paidBy: '',
    expenseDate: new Date().toISOString().slice(0, 10)
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Settle form state
  const [settleForm, setSettleForm] = useState({
    payeeId: '',
    payeeName: '',
    amount: '',
    note: 'Settled debt'
  });
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Format currency helper
  const formatMoney = useCallback((val, currency = 'INR') => {
    const num = Number(val || 0);
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2
      }).format(Number.isFinite(num) ? num : 0);
    } catch {
      return `₹${Number(num).toFixed(2)}`;
    }
  }, []);

  // 1. Initial auth check & profile load
  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    let isMounted = true;
    async function loadMe() {
      try {
        const data = await api.auth.getMe();
        if (isMounted) {
          setCurrentUser(data.user);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to fetch user with stored token, logging out:', err.message);
          handleLogout();
        }
      }
    }

    loadMe();
    return () => { isMounted = false; };
  }, [token]);

  // 2. Load groups and active group details
  const loadGroupData = useCallback(async (groupId, currentGroupsList = groups) => {
    if (!groupId) {
      setGroupMembers([]);
      setExpenses([]);
      setBalancesData({ balances: [], debts: [], settlements: [] });
      return;
    }

    setDashboardLoading(true);
    try {
      const [groupDetailsRes, balancesRes] = await Promise.all([
        api.groups.getById(groupId).catch(() => null),
        api.settlements.getBalances(groupId).catch(() => null)
      ]);

      if (groupDetailsRes) {
        setGroupMembers(groupDetailsRes.members || []);
        setExpenses(groupDetailsRes.expenses || []);
      }

      if (balancesRes) {
        setBalancesData({
          balances: balancesRes.balances || [],
          debts: balancesRes.debts || balancesRes.transfers || [],
          settlements: balancesRes.settlements || []
        });
      }
    } catch (err) {
      addToast(`Could not load group data: ${err.message}`, 'error');
    } finally {
      setDashboardLoading(false);
    }
  }, [groups, addToast]);

  const loadGroups = useCallback(async (targetGroupIdToSelect) => {
    if (!token) return;
    setDashboardLoading(true);

    try {
      const data = await api.groups.getAll();
      const loadedGroups = data.groups || [];
      setGroups(loadedGroups);

      let nextGroupId = selectedGroupId;
      if (targetGroupIdToSelect !== undefined) {
        nextGroupId = String(targetGroupIdToSelect);
      } else if (!loadedGroups.some((g) => String(g.id) === String(selectedGroupId))) {
        nextGroupId = loadedGroups.length > 0 ? String(loadedGroups[0].id) : '';
      }

      setSelectedGroupId(nextGroupId);
      if (nextGroupId) {
        await loadGroupData(nextGroupId, loadedGroups);
      } else {
        setGroupMembers([]);
        setExpenses([]);
        setBalancesData({ balances: [], debts: [], settlements: [] });
      }
    } catch (err) {
      addToast(`Error loading groups: ${err.message}`, 'error');
    } finally {
      setDashboardLoading(false);
    }
  }, [token, selectedGroupId, loadGroupData, addToast]);

  useEffect(() => {
    if (token) {
      loadGroups();
    }
  }, [token]);

  // Auth form handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        const data = await api.auth.register({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password
        });
        setAuthToken(data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        addToast('Welcome to SplitSettle! Account registered successfully.', 'success');
      } else {
        const data = await api.auth.login({
          email: authForm.email,
          password: authForm.password
        });
        setAuthToken(data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        addToast('Signed in successfully!', 'success');
      }
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setToken('');
    setCurrentUser(null);
    setGroups([]);
    setSelectedGroupId('');
    setGroupMembers([]);
    setExpenses([]);
    setBalancesData({ balances: [], debts: [], settlements: [] });
    setAuthMode('login');
    setAuthError('');
    addToast('Signed out.', 'info');
  };

  // Group creation handler
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.name.trim()) return;

    setCreateGroupLoading(true);
    try {
      const data = await api.groups.create({
        name: newGroup.name.trim(),
        description: newGroup.description.trim(),
        currency: newGroup.currency
      });

      addToast(`Group "${data.group.name}" created!`, 'success');
      setNewGroup({ name: '', description: '', currency: 'INR' });
      await loadGroups(data.group.id);
      setActiveTab('Overview');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setCreateGroupLoading(false);
    }
  };

  // Add member handler
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !memberEmail.trim()) return;

    setAddMemberLoading(true);
    try {
      const res = await api.groups.addMember(selectedGroupId, memberEmail.trim());
      addToast(`Added ${res.member.name} (${res.member.email}) to group!`, 'success');
      setMemberEmail('');
      await loadGroupData(selectedGroupId);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Open Add Expense Modal
  const openAddExpenseModal = () => {
    if (!selectedGroupId) {
      addToast('Please select or create a group first.', 'info');
      return;
    }
    setExpenseForm({
      title: '',
      description: '',
      amount: '',
      category: 'General',
      paidBy: currentUser?.id ? String(currentUser.id) : '',
      expenseDate: new Date().toISOString().slice(0, 10)
    });
    setShowAddExpense(true);
  };

  // Open Edit Expense Modal
  const openEditExpenseModal = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: expense.title || expense.description || '',
      description: expense.description || '',
      amount: String(expense.amount || (expense.amount_paise / 100).toFixed(2)),
      category: expense.category || 'General',
      paidBy: String(expense.paid_by || ''),
      expenseDate: String(expense.expense_date || '').slice(0, 10)
    });
    setShowEditExpense(true);
  };

  // Submit Expense (Add or Edit)
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || !expenseForm.amount) return;

    setExpenseSubmitting(true);
    try {
      const payload = {
        title: expenseForm.title.trim(),
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        paidBy: Number(expenseForm.paidBy || currentUser?.id),
        expenseDate: expenseForm.expenseDate
      };

      if (showEditExpense && editingExpenseId) {
        await api.expenses.update(editingExpenseId, payload);
        addToast('Expense updated successfully.', 'success');
        setShowEditExpense(false);
      } else {
        await api.expenses.create(selectedGroupId, payload);
        addToast('Expense added and split equally among all members!', 'success');
        setShowAddExpense(false);
      }

      await loadGroupData(selectedGroupId);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Delete Expense Handler
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense? This will adjust all member balances.')) {
      return;
    }

    try {
      await api.expenses.delete(expenseId);
      addToast('Expense deleted successfully.', 'success');
      await loadGroupData(selectedGroupId);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Open Settle Up Modal
  const openSettleModal = (debt) => {
    setSettleForm({
      payeeId: String(debt.toUserId),
      payeeName: debt.toName,
      amount: String(debt.amount),
      note: `Settlement to ${debt.toName}`
    });
    setShowSettleModal(true);
  };

  // Settle Up Submission Handler
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !settleForm.payeeId || !settleForm.amount) return;

    setSettleSubmitting(true);
    try {
      await api.settlements.settle(selectedGroupId, {
        payeeId: Number(settleForm.payeeId),
        payerId: Number(currentUser?.id),
        amount: Number(settleForm.amount),
        note: settleForm.note.trim()
      });

      addToast(`Settlement of ₹${settleForm.amount} marked as settled!`, 'success');
      setShowSettleModal(false);
      await loadGroupData(selectedGroupId);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Computed metrics for active group
  const activeGroup = groups.find((g) => String(g.id) === String(selectedGroupId));
  const activeCurrency = activeGroup?.currency || 'INR';

  const totalGroupExpenses = expenses.reduce(
    (sum, exp) => sum + Number(exp.amount || exp.amount_paise / 100 || 0),
    0
  );

  const currentUserBalance = balancesData.balances.find(
    (b) => Number(b.id || b.user_id) === Number(currentUser?.id)
  );

  const userNet = Number(currentUserBalance?.net || 0);
  const youAreOwed = userNet > 0 ? userNet : 0;
  const youOwe = userNet < 0 ? Math.abs(userNet) : 0;

  // Unauthenticated screen
  if (!token) {
    return (
      <main className="app-shell">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <section className="brand-panel">
          <div className="brand">
            <div className="brand-icon">S</div>
            <span>SplitSettle</span>
          </div>

          <div className="brand-content">
            <p className="eyebrow">SHARED EXPENSES, SIMPLIFIED</p>
            <h1>
              Good friends.
              <br />
              Clear balances.
            </h1>
            <p className="brand-description">
              Track group expenses, split bills fairly with exact equal rounding, and settle up
              without the awkward mental calculations.
            </p>

            <div className="feature-list">
              <p><span>✓</span> Exact equal split with rounding correction</p>
              <p><span>✓</span> Per-member balances: paid, owed, and net</p>
              <p><span>✓</span> Simplified "Settle Up" summary</p>
              <p><span>✓</span> Real-time MySQL backend with JWT authentication</p>
            </div>
          </div>

          <p className="brand-footer">Spend together. Settle simply.</p>
        </section>

        <section className="form-panel">
          <div className="auth-card">
            <div className="brand" style={{ marginBottom: 20 }}>
              <div className="brand-icon">S</div>
              <span>SplitSettle</span>
            </div>

            <p className="eyebrow">
              {authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}
            </p>

            <h2>
              {authMode === 'login'
                ? 'Sign in to your account'
                : 'Create your account'}
            </h2>

            <p className="form-subtitle">
              {authMode === 'login'
                ? 'Enter your credentials to access your shared expenses.'
                : 'Create a free account to start managing group expenses.'}
            </p>

            <div className="mode-switch">
              <button
                type="button"
                className={authMode === 'login' ? 'mode-active' : ''}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'mode-active' : ''}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>
                  Full name
                  <input
                    type="text"
                    placeholder="Ragul Rajapathy"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </label>

              {authError && (
                <div className="message toast-error" role="alert">
                  {authError}
                </div>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign in →'
                  : 'Create account →'}
              </button>
            </form>

            <p className="security-note">
              Protected with encrypted passwords & JWT authentication.
            </p>
          </div>
        </section>
      </main>
    );
  }

  // Authenticated Dashboard
  return (
    <main className="dashboard-shell">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <span>SplitSettle</span>
        </div>

        <p className="sidebar-caption">WORKSPACE</p>

        <nav className="dashboard-nav">
          {[
            ['Overview', '▦'],
            ['Groups', '♧'],
            ['Expenses', '▤'],
            ['Balances', '₹']
          ].map(([tab, icon]) => (
            <button
              type="button"
              key={tab}
              className={`nav-item ${activeTab === tab ? 'nav-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span aria-hidden="true" style={{ marginRight: 10, fontSize: 16 }}>
                {icon}
              </span>
              {tab}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-chip">
            <div className="avatar">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
            </div>
            <div className="profile-details">
              <strong>{currentUser?.name || 'User'}</strong>
              <span>{currentUser?.email || ''}</span>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              {activeGroup ? `ACTIVE GROUP: ${activeGroup.name.toUpperCase()}` : 'YOUR MONEY, IN SYNC'}
            </p>
            <h1>
              {activeTab === 'Overview' && 'Dashboard Overview'}
              {activeTab === 'Groups' && 'Groups & Members'}
              {activeTab === 'Expenses' && 'Group Expenses'}
              {activeTab === 'Balances' && 'Balances & Settle Up'}
            </h1>
            <p className="dashboard-subtitle">
              {activeGroup
                ? `${groupMembers.length} member${groupMembers.length === 1 ? '' : 's'} · ${expenses.length} expense${expenses.length === 1 ? '' : 's'} recorded`
                : 'Select or create a group to start tracking shared expenses.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {activeGroup && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={openAddExpenseModal}
              >
                + Add Expense
              </button>
            )}
            <button
              className="refresh-button"
              onClick={() => loadGroups()}
              type="button"
              disabled={dashboardLoading}
            >
              {dashboardLoading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </header>

        {/* Group Selector Dropdown */}
        {groups.length > 0 && (
          <div className="content-card group-selector" style={{ width: '100%', maxWidth: 420 }}>
            <label htmlFor="group-select">Switch Active Group</label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedGroupId(newId);
                loadGroupData(newId);
              }}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.member_count || 1} members) — {group.currency || 'INR'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ----------------- TAB: OVERVIEW ----------------- */}
        {activeTab === 'Overview' && (
          <>
            <div className="welcome-banner">
              <div>
                <span className="welcome-label">WELCOME BACK, {currentUser?.name?.toUpperCase() || 'FRIEND'}</span>
                <h2>Good friends. Clear balances.</h2>
                <p>
                  {activeGroup
                    ? `Currently viewing "${activeGroup.name}". Every expense is automatically split equally.`
                    : 'Create your first group to start splitting bills fairly!'}
                </p>
              </div>
              <div className="welcome-symbol" aria-hidden="true">₹</div>
            </div>

            {/* Top Stat Cards */}
            <div className="stats-grid">
              <article className="stat-card">
                <span>My Groups</span>
                <strong>{groups.length}</strong>
                <small>Groups you belong to</small>
              </article>

              <article className="stat-card">
                <span>Total Group Expenses</span>
                <strong>{formatMoney(totalGroupExpenses, activeCurrency)}</strong>
                <small>{expenses.length} total shared records</small>
              </article>

              <article className="stat-card">
                <span>You are owed</span>
                <strong style={{ color: '#167d62' }}>
                  {formatMoney(youAreOwed, activeCurrency)}
                </strong>
                <small>Positive net balance</small>
              </article>

              <article className="stat-card">
                <span>You owe</span>
                <strong style={{ color: '#d96818' }}>
                  {formatMoney(youOwe, activeCurrency)}
                </strong>
                <small>Outstanding balance</small>
              </article>
            </div>

            {/* Settle Up Summary Card on Overview */}
            {activeGroup && balancesData.debts.length > 0 && (
              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h2>Simplified Settle Up</h2>
                    <p>Minimum transactions needed to settle all debts in this group.</p>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setActiveTab('Balances')}
                  >
                    View All Balances →
                  </button>
                </div>

                <div className="debts-grid">
                  {balancesData.debts.map((debt, idx) => (
                    <div key={idx} className="debt-card">
                      <div className="debt-info">
                        <span className="debt-text">
                          <strong>{debt.fromName}</strong> owes <strong>{debt.toName}</strong>
                        </span>
                        <span className="debt-amount">
                          {formatMoney(debt.amount, activeCurrency)}
                        </span>
                        <span className="debt-meta">Equal split repayment</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => openSettleModal(debt)}
                      >
                        Settle Up
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Expenses List */}
            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>Recent Expenses</h2>
                  <p>Latest spending activity in this group.</p>
                </div>
                {activeGroup && (
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setActiveTab('Expenses')}
                  >
                    View All ({expenses.length}) →
                  </button>
                )}
              </div>

              {expenses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>No expenses recorded yet</h3>
                  <p>When you or your group members add expenses, they will appear here.</p>
                  {activeGroup && (
                    <button
                      className="btn btn-primary"
                      type="button"
                      style={{ marginTop: 14 }}
                      onClick={openAddExpenseModal}
                    >
                      + Add First Expense
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="expense-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Paid By</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.slice(0, 5).map((exp) => (
                        <tr key={exp.id}>
                          <td>
                            <strong>{exp.title}</strong>
                            {exp.description && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {exp.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-category">{exp.category || 'General'}</span>
                          </td>
                          <td>{exp.payer_name}</td>
                          <td>{exp.expense_date}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatMoney(exp.amount, activeCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ----------------- TAB: GROUPS ----------------- */}
        {activeTab === 'Groups' && (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Create Group Form */}
            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>Create a New Group</h2>
                  <p>Group friends, flatmates, or travel companions together.</p>
                </div>
              </div>

              <form onSubmit={handleCreateGroup}>
                <label>
                  Group Name
                  <input
                    type="text"
                    placeholder="e.g. Goa Trip, Apartment 4B, Friday Dinner"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    required
                    maxLength={120}
                  />
                </label>

                <label>
                  Currency
                  <select
                    value={newGroup.currency}
                    onChange={(e) => setNewGroup({ ...newGroup, currency: e.target.value })}
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                  </select>
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  Description (optional)
                  <textarea
                    rows={2}
                    placeholder="Brief description of shared bills or group purpose..."
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    maxLength={500}
                  />
                </label>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={createGroupLoading || !newGroup.name.trim()}
                  style={{ gridColumn: '1 / -1', maxWidth: 220 }}
                >
                  {createGroupLoading ? 'Creating group...' : '+ Create Group'}
                </button>
              </form>
            </section>

            {/* Active Group Details & Member Management */}
            {activeGroup && (
              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h2>Members of "{activeGroup.name}"</h2>
                    <p>People currently sharing expenses in this group.</p>
                  </div>
                </div>

                <div className="member-chips">
                  {groupMembers.map((m) => (
                    <div key={m.id} className="member-chip-card">
                      <div className="member-chip-avatar">
                        {m.name ? m.name[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="member-chip-name">{m.name}</div>
                        <div className="member-chip-email">{m.email}</div>
                      </div>
                      <span className={`badge ${m.role === 'owner' ? 'badge-owner' : 'badge-member'}`}>
                        {m.role || 'member'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Add Member Form */}
                <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Add Member by Registered Email</h3>
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
                    Add existing registered users to this group by entering their account email.
                  </p>

                  <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 10, maxWidth: 520, margin: 0 }}>
                    <input
                      type="email"
                      placeholder="friend@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={addMemberLoading || !memberEmail.trim()}
                    >
                      {addMemberLoading ? 'Adding...' : 'Add Member'}
                    </button>
                  </form>
                </div>
              </section>
            )}

            {/* User's Groups List */}
            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>All Your Groups ({groups.length})</h2>
                  <p>Click on any group to switch and view its details.</p>
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">♧</div>
                  <h3>No groups yet</h3>
                  <p>Create your first group above to get started.</p>
                </div>
              ) : (
                <div className="simple-list">
                  {groups.map((g) => {
                    const isSelected = String(g.id) === String(selectedGroupId);
                    return (
                      <article
                        key={g.id}
                        className="list-row"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--green-light)' : 'transparent',
                          borderRadius: 10,
                          padding: '12px 14px'
                        }}
                        onClick={() => {
                          setSelectedGroupId(String(g.id));
                          loadGroupData(g.id);
                        }}
                      >
                        <div className="list-avatar">♧</div>
                        <div className="list-info">
                          <strong>{g.name}</strong>
                          <span>
                            {g.description || 'Shared expense group'} · {g.member_count || 1} members · {g.currency || 'INR'}
                          </span>
                        </div>
                        <span className={`badge ${isSelected ? 'badge-owner' : 'badge-member'}`}>
                          {isSelected ? 'Active' : 'Select'}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ----------------- TAB: EXPENSES ----------------- */}
        {activeTab === 'Expenses' && (
          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>Expenses in "{activeGroup?.name || 'Group'}"</h2>
                <p>Every expense is equally divided among all {groupMembers.length} group members.</p>
              </div>
              {activeGroup && (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={openAddExpenseModal}
                >
                  + Add Expense
                </button>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">▤</div>
                <h3>No expenses found</h3>
                <p>Track payments for food, rent, trips, or supplies by adding an expense.</p>
                {activeGroup && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    style={{ marginTop: 14 }}
                    onClick={openAddExpenseModal}
                  >
                    + Add First Expense
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="expense-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Paid By</th>
                      <th>Equal Splits</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => {
                      const isCreator = Number(exp.created_by) === Number(currentUser?.id);
                      return (
                        <tr key={exp.id}>
                          <td>
                            <strong>{exp.title}</strong>
                            {exp.description && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {exp.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-category">{exp.category || 'General'}</span>
                          </td>
                          <td>
                            <strong>{exp.payer_name}</strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: 260 }}>
                              {exp.splits && exp.splits.length > 0 ? (
                                exp.splits.map((s, idx) => (
                                  <span key={idx} className="split-tag">
                                    {s.name || `User ${s.user_id}`}: {formatMoney(s.share, activeCurrency)}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                  Split equally
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{exp.expense_date}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15 }}>
                            {formatMoney(exp.amount, activeCurrency)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isCreator ? (
                              <div className="action-row-buttons">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openEditExpenseModal(exp)}
                                  title="Edit expense"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  title="Delete expense"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ----------------- TAB: BALANCES ----------------- */}
        {activeTab === 'Balances' && (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Net Balances Overview */}
            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>Member Balances</h2>
                  <p>Individual spending, fair share owed, and net balance for each member.</p>
                </div>
              </div>

              {balancesData.balances.length === 0 ? (
                <div className="empty-state">
                  <p>No balance records are available. Add expenses to generate balances.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="expense-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th style={{ textAlign: 'right' }}>Total Paid</th>
                        <th style={{ textAlign: 'right' }}>Total Owed</th>
                        <th style={{ textAlign: 'right' }}>Net Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balancesData.balances.map((b) => {
                        const netVal = Number(b.net || 0);
                        const isPositive = netVal > 0;
                        const isNegative = netVal < 0;

                        return (
                          <tr key={b.id || b.user_id}>
                            <td>
                              <strong>{b.name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.email}</div>
                            </td>
                            <td>
                              <span className={`badge ${b.role === 'owner' ? 'badge-owner' : 'badge-member'}`}>
                                {b.role || 'member'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatMoney(b.total_paid, activeCurrency)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatMoney(b.total_owed, activeCurrency)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>
                              <span
                                style={{
                                  color: isPositive ? '#167d62' : isNegative ? '#d96818' : '#697871',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: isPositive ? '#e8f4ef' : isNegative ? '#fdf0e6' : '#f0f4f2'
                                }}
                              >
                                {isPositive && '+'}
                                {formatMoney(b.net, activeCurrency)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Settle Up Simplified Debts */}
            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>Settle Up Summary</h2>
                  <p>Suggested debt settlements to bring all member balances to ₹0.00.</p>
                </div>
              </div>

              {balancesData.debts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon" style={{ color: 'var(--green)' }}>✓</div>
                  <h3>All settled up!</h3>
                  <p>There are no outstanding debts between members in this group.</p>
                </div>
              ) : (
                <div className="debts-grid">
                  {balancesData.debts.map((debt, idx) => (
                    <div key={idx} className="debt-card">
                      <div className="debt-info">
                        <span className="debt-text">
                          <strong>{debt.fromName}</strong> owes <strong>{debt.toName}</strong>
                        </span>
                        <span className="debt-amount">
                          {formatMoney(debt.amount, activeCurrency)}
                        </span>
                        <span className="debt-meta">Calculated simplified debt</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => openSettleModal(debt)}
                      >
                        Mark as Settled
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Settlement History */}
            {balancesData.settlements && balancesData.settlements.length > 0 && (
              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h2>Settlement History</h2>
                    <p>Past payments and cleared debts in this group.</p>
                  </div>
                </div>

                <div className="simple-list">
                  {balancesData.settlements.map((s) => (
                    <div key={s.id} className="list-row">
                      <div className="list-avatar">✓</div>
                      <div className="list-info">
                        <strong>
                          {s.payer_name} paid {s.payee_name}
                        </strong>
                        <span>
                          {s.note || 'Settlement payment'} · {String(s.settled_at || s.created_at).slice(0, 10)}
                        </span>
                      </div>
                      <strong style={{ color: '#167d62', fontSize: 15 }}>
                        {formatMoney(s.amount, activeCurrency)}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <footer className="dashboard-footer">
          SplitSettle · Spend together. Settle simply.
        </footer>
      </section>

      {/* ----------------- MODAL: ADD / EDIT EXPENSE ----------------- */}
      {(showAddExpense || showEditExpense) && (
        <div className="modal-backdrop" onClick={() => { setShowAddExpense(false); setShowEditExpense(false); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showEditExpense ? 'Edit Expense' : 'Add New Expense'}</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => { setShowAddExpense(false); setShowEditExpense(false); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="modal-form">
              <label>
                Title / What was this for? *
                <input
                  type="text"
                  placeholder="e.g. Dinner, Groceries, Hotel Booking"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  required
                  maxLength={200}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Total Amount ({activeCurrency}) *
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1200.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Category
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Paid by
                  <select
                    value={expenseForm.paidBy}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paidBy: e.target.value })}
                  >
                    {groupMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {Number(m.id) === Number(currentUser?.id) ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Expense Date
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  placeholder="Extra details about this expense..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  maxLength={500}
                />
              </label>

              {/* Equal split preview helper */}
              <div className="info-banner">
                <span>ℹ</span>
                <span>
                  <strong>Equal Split Logic:</strong> This amount will be split equally among all{' '}
                  <strong>{groupMembers.length}</strong> group members
                  {expenseForm.amount && groupMembers.length > 0 && (
                    <> (approx. {formatMoney(Number(expenseForm.amount) / groupMembers.length, activeCurrency)} each)</>
                  )}
                  . Rounding paise are automatically distributed so shares sum to the exact total.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowAddExpense(false); setShowEditExpense(false); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={expenseSubmitting || !expenseForm.title.trim() || !expenseForm.amount}
                >
                  {expenseSubmitting ? 'Saving...' : showEditExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: SETTLE UP DEBT ----------------- */}
      {showSettleModal && (
        <div className="modal-backdrop" onClick={() => setShowSettleModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Settlement</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSettleModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="modal-form">
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
                Mark debt to <strong>{settleForm.payeeName}</strong> as settled.
              </p>

              <label>
                Amount to Settle ({activeCurrency}) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleForm.amount}
                  onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                  required
                />
              </label>

              <label>
                Settlement Note
                <input
                  type="text"
                  placeholder="e.g. UPI transfer, Cash, GPay"
                  value={settleForm.note}
                  onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })}
                  maxLength={200}
                />
              </label>

              <div className="info-banner">
                <span>✓</span>
                <span>
                  Recording this settlement will immediately reduce outstanding debts between the parties.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSettleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={settleSubmitting || !settleForm.amount}
                >
                  {settleSubmitting ? 'Recording...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
