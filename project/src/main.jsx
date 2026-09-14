import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, Check, ChevronDown, CircleHelp, Download, FileText, Flame, LayoutDashboard, Loader2, LogOut, Mail, MoreHorizontal, Plus, Settings, Sparkles, Target, X } from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(email) {
  if (!email) return '?';
  const base = email.split('@')[0];
  if (base.length >= 2) return (base[0] + base[base.length - 1]).toUpperCase();
  return base.toUpperCase();
}

function HabitIcon({ type }) {
  if (type === 'book') return <span className="simple-icon book-icon">▤</span>;
  if (type === 'drop') return <span className="simple-icon drop-icon">◆</span>;
  if (type === 'moon') return <span className="simple-icon moon-icon">◐</span>;
  if (type === 'spark') return <Sparkles size={20} />;
  return <span className="simple-icon sun-icon">☼</span>;
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    }
    setLoading(false);
  };

  return <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand"><div className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></div><span>habit<span className="brand-accent">flow</span></span></div>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="auth-copy">{mode === 'signin' ? 'Sign in to track your daily habits.' : 'Start building better habits today.'}</p>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label><span><Mail size={14} /> Email</span><input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} /></label>
        <button className="primary-button full" type="submit" disabled={loading}>{loading ? <Loader2 size={18} className="spin" /> : (mode === 'signin' ? 'Sign in' : 'Create account')}</button>
      </form>
      <p className="auth-switch">{mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}<button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</button></p>
    </div>
  </div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [habits, setHabits] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [allCheckins, setAllCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeNav, setActiveNav] = useState('Today');
  const [showModal, setShowModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', description: '' });
  const habitsRef = useRef(habits);
  habitsRef.current = habits;

  const today = todayStr();
  const weekStart = dateNDaysAgo(6);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const [{ data: habitData, error: habitError }, { data: checkinData, error: checkinError }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: true }),
      supabase.from('habit_checkins').select('id, habit_id, checkin_date').gte('checkin_date', dateNDaysAgo(365))
    ]);
    if (habitError || checkinError) {
      setError(habitError || checkinError);
      setLoading(false);
      return;
    }
    setHabits(habitData || []);
    setCheckins((checkinData || []).filter((c) => c.checkin_date >= weekStart));
    setAllCheckins(checkinData || []);
    setLoading(false);
  }, [session, weekStart]);

  useEffect(() => {
    if (session) loadData();
    else { setHabits([]); setCheckins([]); setAllCheckins([]); setLoading(false); }
  }, [session, loadData]);

  useEffect(() => {
    if (!session) return;
    const habitChannel = supabase
      .channel('habits-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, (payload) => {
        if (payload.eventType === 'INSERT') setHabits((prev) => [...prev, payload.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
        else if (payload.eventType === 'UPDATE') setHabits((prev) => prev.map((h) => h.id === payload.new.id ? payload.new : h));
        else if (payload.eventType === 'DELETE') {
          setHabits((prev) => prev.filter((h) => h.id !== payload.old.id));
          setCheckins((prev) => prev.filter((c) => c.habit_id !== payload.old.id));
          setAllCheckins((prev) => prev.filter((c) => c.habit_id !== payload.old.id));
        }
      })
      .subscribe();

    const checkinChannel = supabase
      .channel('checkins-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_checkins' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newCheckin = payload.new;
          if (newCheckin.checkin_date >= weekStart) setCheckins((prev) => prev.some((c) => c.id === newCheckin.id) ? prev : [...prev, newCheckin]);
          setAllCheckins((prev) => prev.some((c) => c.id === newCheckin.id) ? prev : [...prev, newCheckin]);
        } else if (payload.eventType === 'DELETE') {
          setCheckins((prev) => prev.filter((c) => c.id !== payload.old.id));
          setAllCheckins((prev) => prev.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setCheckins((prev) => prev.map((c) => c.id === payload.new.id ? payload.new : c));
          setAllCheckins((prev) => prev.map((c) => c.id === payload.new.id ? payload.new : c));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(habitChannel);
      supabase.removeChannel(checkinChannel);
    };
  }, [session, weekStart]);

  const isCompletedToday = useCallback((habitId) => {
    return checkins.some((c) => c.habit_id === habitId && c.checkin_date === today);
  }, [checkins, today]);

  const getHistory = useCallback((habitId) => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = dateNDaysAgo(i);
      const done = allCheckins.some((c) => c.habit_id === habitId && c.checkin_date === dateStr);
      result.push({ date: dateStr, done, label: dayLabel(dateStr) });
    }
    return result;
  }, [allCheckins]);

  const getStreak = useCallback((habitId) => {
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const dateStr = dateNDaysAgo(i);
      const done = allCheckins.some((c) => c.habit_id === habitId && c.checkin_date === dateStr);
      if (done) count++;
      else if (i === 0) continue;
      else break;
    }
    return count;
  }, [allCheckins]);

  const completedCount = habits.filter((h) => isCompletedToday(h.id)).length;
  const percent = habits.length ? Math.round((completedCount / habits.length) * 100) : 0;
  const weekTotal = checkins.filter((c) => c.checkin_date >= weekStart).length;
  const weekPossible = habits.length * 7;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.best_streak || 0, getStreak(h.id)), 0);

  const toggleHabit = async (habitId) => {
    const alreadyDone = isCompletedToday(habitId);
    if (alreadyDone) {
      const { error: delError } = await supabase.from('habit_checkins').delete().eq('habit_id', habitId).eq('checkin_date', today);
      if (delError) { setError(delError); return; }
    } else {
      const { error: insError } = await supabase.from('habit_checkins').insert({ habit_id: habitId, checkin_date: today });
      if (insError) { setError(insError); return; }
      const newStreak = getStreak(habitId) + 1;
      if (newStreak > 0) {
        const habit = habitsRef.current.find((h) => h.id === habitId);
        const newBest = Math.max(habit?.best_streak || 0, newStreak);
        await supabase.from('habits').update({ streak: newStreak, best_streak: newBest }).eq('id', habitId);
      }
    }
  };

  const addHabit = async (event) => {
    event.preventDefault();
    if (!newHabit.name.trim()) return;
    const { error: insError } = await supabase.from('habits').insert({
      name: newHabit.name.trim(),
      description: newHabit.description.trim() || 'Make a little progress every day',
      icon: 'spark', color: 'green', streak: 0, best_streak: 0
    });
    if (insError) { setError(insError); return; }
    setNewHabit({ name: '', description: '' });
    setShowModal(false);
  };

  const removeHabit = async (id) => {
    const { error: delError } = await supabase.from('habits').delete().eq('id', id);
    if (delError) { setError(delError); return; }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const exportJSON = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user: session?.user?.email || 'unknown',
      summary: { total_habits: habits.length, total_checkins: allCheckins.length, best_streak: bestStreak, week_total: weekTotal, week_possible: weekPossible },
      habits: habits.map((h) => ({
        name: h.name,
        description: h.description,
        current_streak: getStreak(h.id),
        best_streak: h.best_streak,
        created_at: h.created_at,
        checkins: allCheckins.filter((c) => c.habit_id === h.id).map((c) => c.checkin_date).sort()
      }))
    };
    downloadFile(JSON.stringify(payload, null, 2), 'habit-flow-report.json', 'application/json');
  };

  const exportText = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    let text = `HABIT FLOW — REPORT\n${dateStr}\nUser: ${session?.user?.email || 'unknown'}\n${'='.repeat(50)}\n\n`;
    text += `SUMMARY\n`;
    text += `  Active habits:    ${habits.length}\n`;
    text += `  Total check-ins:  ${allCheckins.length}\n`;
    text += `  Best streak:      ${bestStreak} days\n`;
    text += `  This week:        ${weekTotal}/${weekPossible} check-ins\n\n`;
    text += `${'='.repeat(50)}\n\nHABITS & HISTORY\n\n`;
    habits.forEach((h, i) => {
      const streak = getStreak(h.id);
      const history = getHistory(h.id);
      text += `${i + 1}. ${h.name}\n`;
      text += `   ${h.description}\n`;
      text += `   Current streak: ${streak} days | Best: ${h.best_streak} days\n`;
      text += `   Last 7 days:    `;
      text += history.map((d) => `${d.label[0]}:${d.done ? 'Y' : 'N'}`).join('  ');
      text += `\n\n`;
    });
    text += `${'='.repeat(50)}\n`;
    text += `Generated by Habit Flow\n`;
    downloadFile(text, 'habit-flow-report.txt', 'text/plain');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const encouragement = useMemo(() => {
    if (habits.length === 0) return 'Add your first habit to get started.';
    if (percent === 100) return 'All done. You showed up for yourself.';
    if (percent >= 50) return 'You are building good momentum.';
    return 'Small steps still move you forward.';
  }, [percent, habits.length]);

  if (!authReady) {
    return <div className="app-shell"><div className="loading-state"><Loader2 size={28} className="spin" /><p>Loading…</p></div></div>;
  }

  if (!session) {
    return <AuthScreen onAuthed={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />;
  }

  const userEmail = session.user?.email || '';
  const userInitials = initials(userEmail);

  if (loading) {
    return <div className="app-shell"><div className="loading-state"><Loader2 size={28} className="spin" /><p>Loading your habits…</p></div></div>;
  }

  if (error) {
    return <div className="app-shell"><div className="loading-state error-state"><p>Something went wrong loading your data.</p><button className="primary-button" onClick={() => { setError(null); loadData(); }}>Try again</button></div></div>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17} strokeWidth={2.5} /></div><span>habit<span className="brand-accent">flow</span></span></div>
      <div className="workspace"><div className="avatar">{userInitials}</div><div><strong>{userEmail.split('@')[0]}</strong><span>{userEmail}</span></div></div>
      <nav className="nav-list" aria-label="Main navigation">
        {[['Today', LayoutDashboard], ['Calendar', CalendarDays], ['Insights', Target]].map(([label, Icon]) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}><Icon size={18} /><span>{label}</span>{label === 'Today' && <span className="nav-count">{completedCount}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => setShowExport(true)}><Download size={18} /><span>Export reports</span></button>
        <button className="nav-item" onClick={handleSignOut}><LogOut size={18} /><span>Sign out</span></button>
        <div className="tip"><CircleHelp size={16} /><div><strong>Make it easy</strong><span>Consistency beats intensity.</span></div></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark"><Sparkles size={15} /></div><span>habit<span className="brand-accent">flow</span></span></div>
        <div className="topbar-actions">
          <span className="save-status"><span className="status-dot realtime-dot"></span> Live</span>
          <button className="icon-button" onClick={() => setShowExport(true)}><Download size={18} /></button>
          <div className="avatar small">{userInitials}</div>
          <button className="icon-button sign-out-btn" onClick={handleSignOut}><LogOut size={17} /></button>
        </div>
      </header>
      <div className="content-wrap">
        <section className="hero-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{greeting()}, {userEmail.split('@')[0]}<span className="wave">✦</span></h1><p className="hero-copy">{encouragement}</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add habit</button></section>
        <section className="overview-grid"><div className="progress-card card"><div className="card-heading"><div><p className="label">TODAY'S PROGRESS</p><h2>{completedCount} <span>/ {habits.length} habits</span></h2></div><div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` }}><div><strong>{percent}%</strong><span>complete</span></div></div></div><div className="progress-line"><span style={{ width: `${percent}%` }}></span></div><p className="muted">Keep going — your future self will thank you.</p></div><div className="streak-card card"><div className="streak-top"><div className="flame-wrap"><Flame size={22} fill="currentColor" /></div><div><p className="label">CURRENT BEST</p><h2>{bestStreak} <span>days</span></h2></div></div><div className="mini-stats"><div><strong>{weekTotal}</strong><span>this week</span></div><div><strong>{habits.length}</strong><span>active habits</span></div><div><strong>{habits.length ? Math.round((weekTotal / weekPossible) * 100) : 0}%</strong><span>consistency</span></div></div></div></section>
        <section className="section-heading"><div><p className="label">YOUR ROUTINE</p><h2>Today's habits</h2></div></section>
        <section className="habit-list">
          {habits.length === 0 && <div className="empty-state"><p>No habits yet. Add your first one to begin tracking.</p><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add habit</button></div>}
          {habits.map((habit) => {
            const completed = isCompletedToday(habit.id);
            const history = getHistory(habit.id);
            const streak = getStreak(habit.id);
            return <article className={`habit-card ${completed ? 'is-complete' : ''}`} key={habit.id}>
              <button aria-label={`Mark ${habit.name} complete`} className={`check-button ${completed ? 'checked' : ''}`} onClick={() => toggleHabit(habit.id)}>{completed && <Check size={17} strokeWidth={3} />}</button>
              <div className={`habit-icon ${habit.color}`}><HabitIcon type={habit.icon} /></div>
              <div className="habit-info"><h3>{habit.name}</h3><p>{habit.description}</p><div className="habit-history">{history.map((day) => <span className={day.done ? 'done' : ''} key={`${habit.id}-${day.date}`} title={`${day.label} ${day.done ? 'complete' : 'not complete'}`}>{day.done ? <Check size={10} strokeWidth={3} /> : ''}</span>)}</div></div>
              <div className="habit-streak"><Flame size={16} /><strong>{streak}</strong><span>day streak</span></div>
              <button className="more-button" onClick={() => removeHabit(habit.id)} aria-label={`Remove ${habit.name}`}><MoreHorizontal size={19} /></button>
            </article>;
          })}
        </section>
        <section className="bottom-grid">
          <div className="week-card card">
            <div className="section-heading compact"><div><p className="label">LAST 7 DAYS</p><h2>Weekly rhythm</h2></div><span className="week-score">{weekTotal}<small> / {weekPossible}</small></span></div>
            <div className="week-bars">{[6, 5, 4, 3, 2, 1, 0].map((offset) => {
              const dateStr = dateNDaysAgo(offset);
              const count = checkins.filter((c) => c.checkin_date === dateStr).length;
              const label = dayLabel(dateStr);
              return <div className="day-bar" key={dateStr}><div className="bar-track"><span style={{ height: `${habits.length ? Math.max(8, (count / habits.length) * 100) : 8}%` }}></span></div><strong>{label[0]}</strong></div>;
            })}</div>
          </div>
          <div className="quote-card"><div className="quote-mark">"</div><p>We are what we repeatedly do. Excellence, then, is not an act, but a habit.</p><span>— Aristotle</span></div>
        </section>
      </div>
    </main>
    {showModal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)}><form className="modal" onSubmit={addHabit}><button type="button" className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button><div className="modal-icon"><Plus size={21} /></div><p className="label">NEW ROUTINE</p><h2>Add a habit</h2><p className="modal-copy">Choose one small action you want to make part of your day.</p><label>Habit name<input autoFocus value={newHabit.name} onChange={(event) => setNewHabit({ ...newHabit, name: event.target.value })} placeholder="e.g. Stretch for 5 minutes" /></label><label>Description <span>optional</span><input value={newHabit.description} onChange={(event) => setNewHabit({ ...newHabit, description: event.target.value })} placeholder="What will this help you do?" /></label><button className="primary-button full" type="submit">Create habit <Plus size={17} /></button></form></div>}
    {showExport && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowExport(false)}><div className="modal export-modal">
      <button type="button" className="modal-close" onClick={() => setShowExport(false)}><X size={18} /></button>
      <div className="modal-icon export-icon"><Download size={21} /></div>
      <p className="label">EXPORT</p>
      <h2>Download your reports</h2>
      <p className="modal-copy">Export your habit history and check-in data as a file you can keep or share.</p>
      <div className="export-options">
        <button className="export-option" onClick={() => { exportJSON(); setShowExport(false); }}>
          <div className="export-option-icon json"><FileText size={22} /></div>
          <div><strong>JSON report</strong><span>Structured data with all habits, check-ins, and stats — for backup or re-import.</span></div>
        </button>
        <button className="export-option" onClick={() => { exportText(); setShowExport(false); }}>
          <div className="export-option-icon txt"><FileText size={22} /></div>
          <div><strong>Text report</strong><span>Readable summary of your habits, streaks, and last 7 days — easy to print or share.</span></div>
        </button>
      </div>
    </div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
