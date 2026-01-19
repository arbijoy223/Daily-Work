
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  TaskTemplate, 
  DailyRecord, 
  UserProfile, 
  AppState, 
  TaskInstance 
} from './types';
import { 
  DEFAULT_TEMPLATES, 
  INITIAL_PROFILE, 
  ISLAMIC_CONTENT 
} from './constants';
import GlassCard from './components/GlassCard';
import CircularProgress from './components/CircularProgress';
import TaskItem from './components/TaskItem';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { getDailyInspiration } from './services/geminiService';

const getLocalDateString = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const formatDateLong = (dateStr: string) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('zenith_app_state');
    if (saved) return JSON.parse(saved);
    return {
      profile: INITIAL_PROFILE,
      templates: DEFAULT_TEMPLATES,
      records: {},
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    };
  });

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));
  const [view, setView] = useState<'home' | 'archive' | 'analytics' | 'profile'>('home');
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 11 PM Reminder Notification logic
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      setShowReminder(now.getHours() === 23);
    };
    checkTime();
    const timer = setInterval(checkTime, 30000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('zenith_app_state', JSON.stringify(state));
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state]);

  const currentRecord = useMemo(() => {
    const record = state.records[selectedDate];
    if (record) return record;

    return {
      date: selectedDate,
      tasks: state.templates.map(t => ({ ...t, completed: false })),
      totalPointsEarned: 0,
      maxPointsPossible: state.templates.reduce((acc, t) => acc + t.points, 0),
      prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false }
    };
  }, [selectedDate, state.records, state.templates]);

  useEffect(() => {
    if (!currentRecord.customQuote) {
      const fetchQuote = async () => {
        const q = await getDailyInspiration(state.profile.name);
        setState(prev => ({
          ...prev,
          records: {
            ...prev.records,
            [selectedDate]: { ...currentRecord, customQuote: q }
          }
        }));
      };
      fetchQuote();
    }
  }, [selectedDate, state.profile.name, currentRecord.customQuote]);

  const changeDate = (offset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    setSelectedDate(getLocalDateString(current));
  };

  const getReportComment = (progress: number) => {
    if (progress === 0) return "The canvas is empty, but the potential is infinite. Let's make a mark tomorrow. 🌙";
    if (progress < 30) return "Seed sower. Every great journey begins with these first small, intentional steps. 🌱";
    if (progress < 60) return "Momentum builder. You're carving a path through the noise. Keep going. 🌊";
    if (progress < 100) return "Peak performer! You are breathing the rare air of high productivity. 🚀";
    return "Zenith Master! Today, you achieved absolute alignment. You are unstoppable. 💎";
  };

  const updateRecord = (record: DailyRecord) => {
    record.totalPointsEarned = record.tasks.reduce((acc, t) => acc + (t.completed ? t.points : 0), 0);
    record.maxPointsPossible = record.tasks.reduce((acc, t) => acc + t.points, 0);
    const progressPerc = (record.totalPointsEarned / (record.maxPointsPossible || 1)) * 100;
    record.reportComment = getReportComment(progressPerc);

    setState(prev => ({
      ...prev,
      records: { ...prev.records, [selectedDate]: record }
    }));
  };

  const toggleTask = useCallback((taskId: string) => {
    const record = { ...currentRecord };
    const taskIndex = record.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    record.tasks[taskIndex].completed = !record.tasks[taskIndex].completed;
    updateRecord(record);
  }, [currentRecord]);

  const togglePrayer = (prayer: keyof Required<DailyRecord>['prayers']) => {
    const record = { ...currentRecord };
    if (!record.prayers) record.prayers = { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false };
    record.prayers[prayer] = !record.prayers[prayer];
    updateRecord(record);
  };

  const updateTaskInstance = (taskId: string, updates: Partial<TaskInstance>) => {
    const record = { ...currentRecord };
    record.tasks = record.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    updateRecord(record);
  };

  const deleteTaskInstance = (taskId: string) => {
    const record = { ...currentRecord };
    record.tasks = record.tasks.filter(t => t.id !== taskId);
    updateRecord(record);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setState(prev => ({ ...prev, profile: { ...prev.profile, avatar: reader.result as string } }));
    };
    reader.readAsDataURL(file);
  };

  const clearAllRecords = () => {
    if (window.confirm("FATAL ACTION: This will permanently erase your entire history. Proceed?")) {
      setState(prev => ({
        ...prev,
        records: {},
        profile: { ...prev.profile, totalPoints: 0, streak: 0 }
      }));
    }
  };

  const stats = useMemo(() => {
    const allRecords = Object.values(state.records).sort((a, b) => a.date.localeCompare(b.date));
    const avgScore = allRecords.length 
      ? Math.round(allRecords.reduce((acc, r) => acc + (r.totalPointsEarned || 0), 0) / allRecords.length) 
      : 0;
    const highestScore = allRecords.length 
      ? Math.max(...allRecords.map(r => r.totalPointsEarned || 0)) 
      : 0;

    const chartData = allRecords.slice(-14).map(r => ({
      date: r.date.split('-').slice(1).join('/'),
      points: r.totalPointsEarned,
    }));

    return { avgScore, highestScore, chartData, allRecords };
  }, [state.records]);

  const progress = (currentRecord.totalPointsEarned / (currentRecord.maxPointsPossible || 1)) * 100;
  const isCompleted = progress === 100 && currentRecord.tasks.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32 md:py-12 animate-in fade-in duration-1000 relative">
      
      {/* 11 PM Reminder Notification */}
      {showReminder && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-700">
          <div className="bg-indigo-600/95 backdrop-blur-xl text-white py-4 px-6 flex items-center justify-center space-x-4 shadow-[0_10px_40px_rgba(0,0,0,0.3)] border-b border-white/10">
            <span className="text-xl">🌙</span>
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Reflection Time: Finalize your daily objectives now.</span>
            <button onClick={() => setShowReminder(false)} className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Atmospheric Backgrounds */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-cyan-500/10 blur-[150px] rounded-full"></div>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
        <div className="flex items-center space-x-6">
          <div className="relative group animate-in slide-in-from-left duration-700">
            <div className="w-20 h-20 rounded-[2.5rem] overflow-hidden ring-4 ring-white dark:ring-slate-800 shadow-2xl transition-all group-hover:scale-110 group-hover:rotate-6">
              <img src={state.profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-indigo-600 to-cyan-500 w-9 h-9 rounded-2xl border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-lg">
              <span className="text-[14px] text-white">⚡</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-2 dark:text-slate-50 text-slate-900 transition-colors">
              Assalamu Alaikum, <span className="text-gradient">{state.profile.name.split(' ')[0]}</span>
            </h1>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-indigo-600 dark:text-cyan-400 flex items-center">
              Productivity Streak <span className="mx-2 text-indigo-300 opacity-40">•</span> {state.profile.streak} DAYS 🔥
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-white/40 dark:bg-slate-900/40 p-2 rounded-[2.5rem] backdrop-blur-3xl border border-white/40 dark:border-white/5 animate-in slide-in-from-right duration-700 shadow-xl shadow-black/5">
          <button onClick={() => changeDate(-1)} className="p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-90 text-indigo-600 dark:text-cyan-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="px-4 text-center min-w-[130px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">{formatDateLong(selectedDate).split(',')[0]}</p>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-black uppercase text-indigo-600 dark:text-cyan-400 cursor-pointer text-center"
            />
          </div>

          <button onClick={() => changeDate(1)} className="p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-90 text-indigo-600 dark:text-cyan-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
          </button>

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

          <button onClick={() => setState(prev => ({ ...prev, darkMode: !prev.darkMode }))} className="p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400">
            {state.darkMode ? (
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            )}
          </button>
        </div>
      </header>

      <main className="min-h-[600px] stagger-in">
        {view === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-2 space-y-12">
              
              {/* Inspiration & Feedback Card */}
              <div className="animate-float">
                <GlassCard className="group relative overflow-hidden rounded-[3.5rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-12 border-none shadow-[0_30px_70px_rgba(0,0,0,0.4)]">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-400/80">Celestial Flow 🔮</p>
                      <button onClick={() => setIsEditingQuote(true)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-xl transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    </div>
                    {isEditingQuote ? (
                      <div className="space-y-4">
                        <textarea 
                          value={currentRecord.customQuote || ""}
                          onChange={(e) => setState(prev => ({ ...prev, records: { ...prev.records, [selectedDate]: { ...currentRecord, customQuote: e.target.value }}}))}
                          onBlur={() => setIsEditingQuote(false)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white outline-none focus:ring-4 ring-cyan-500/20 text-xl font-medium leading-relaxed italic"
                          rows={3}
                          autoFocus
                        />
                        <button onClick={() => setIsEditingQuote(false)} className="px-8 py-3 bg-white text-indigo-950 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl">Sync Intentions</button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <h2 className="text-2xl md:text-4xl font-semibold leading-tight italic tracking-tight opacity-95">
                          "{currentRecord.customQuote || "Success is the steady pursuit of your highest potential."}"
                        </h2>
                        <div className="pt-8 border-t border-white/10 flex items-start space-x-6">
                          <div className="bg-cyan-500/20 p-3 rounded-[1.2rem] text-cyan-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1">Pulse Report 📝</p>
                            <p className="text-sm text-slate-300 font-medium italic leading-relaxed">{currentRecord.reportComment || getReportComment(progress)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-[-40%] right-[-20%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px]"></div>
                  <div className="absolute bottom-[-20%] left-[-20%] w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px]"></div>
                </GlassCard>
              </div>

              {/* Islamic Soul Sync Module */}
              <div className="animate-in slide-in-from-bottom duration-1000 delay-200">
                <div className="flex items-center justify-between mb-8 px-4">
                  <h3 className="text-xl font-black tracking-tight flex items-center dark:text-slate-100 text-slate-800 transition-colors">
                    Soul Sync <span className="ml-3 text-emerald-500">🌙</span>
                  </h3>
                  <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Spiritual Pulse</span>
                  </div>
                </div>
                
                <GlassCard className="rounded-[3.5rem] p-10 border-none bg-emerald-500/5 dark:bg-emerald-500/10 shadow-inner">
                  <div className="grid grid-cols-5 gap-4 mb-10">
                    {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) => (
                      <button 
                        key={p}
                        onClick={() => togglePrayer(p as any)}
                        className={`group flex flex-col items-center p-6 rounded-[2.5rem] transition-all border-2 active:scale-95 ${
                          currentRecord.prayers?.[p as keyof Required<DailyRecord>['prayers']] 
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-500/30' 
                          : 'glass bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-emerald-300'
                        }`}
                      >
                        <span className="text-2xl mb-2">{currentRecord.prayers?.[p as keyof Required<DailyRecord>['prayers']] ? '⭐' : '🌙'}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{p}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/60 p-8 rounded-[2.8rem] border border-white/20 dark:border-white/5 shadow-2xl">
                    <div className="flex items-center mb-4 space-x-3">
                      <span className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">📿</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Remembrance (Dhikr)</p>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 mb-2">
                      {ISLAMIC_CONTENT[new Date(selectedDate).getDay() % ISLAMIC_CONTENT.length].dua}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic font-medium">
                      "{ISLAMIC_CONTENT[new Date(selectedDate).getDay() % ISLAMIC_CONTENT.length].meaning}"
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Task Hub */}
              <div className="animate-in slide-in-from-bottom duration-1000 delay-400 pb-10">
                <div className="flex items-center justify-between mb-8 px-4">
                  <h3 className="text-xl font-black tracking-tight flex items-center dark:text-slate-100 text-slate-800 transition-colors">
                    Goal Matrix <span className="ml-3 text-indigo-500">⚡</span>
                  </h3>
                  <button 
                    onClick={() => {
                      const newTask: TaskInstance = { id: Math.random().toString(36).substr(2, 9), name: "New Objective 💎", points: 10, completed: false };
                      updateRecord({ ...currentRecord, tasks: [...currentRecord.tasks, newTask] });
                    }}
                    className="group flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 px-8 py-4 rounded-[1.8rem] hover:bg-indigo-700 transition-all shadow-xl active:scale-95"
                  >
                    <span>Define Goal</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
                <div className="space-y-6">
                  {currentRecord.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} onToggle={toggleTask} onUpdate={updateTaskInstance} onDelete={deleteTaskInstance} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-10 lg:sticky lg:top-8">
              <GlassCard className="rounded-[4rem] p-12 border-none bg-white/70 dark:bg-slate-900/70 shadow-2xl flex flex-col items-center">
                <CircularProgress progress={progress} size={190} strokeWidth={18} label="Day Zenith" />
                <div className="mt-10 text-center">
                  <p className="text-4xl font-black dark:text-cyan-50 text-slate-900 tracking-tight transition-colors">
                    {currentRecord.totalPointsEarned} <span className="text-[15px] text-slate-400 font-bold uppercase tracking-widest">/ {currentRecord.maxPointsPossible}</span>
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Accumulated Pts Today</p>
                </div>
              </GlassCard>

              <GlassCard className="rounded-[3rem] p-8 border-none bg-indigo-600/5 dark:bg-indigo-600/10">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-8 px-2">Growth Curve</h4>
                 <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={stats.chartData}>
                          <Area type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={4} fill="#6366f122" animationDuration={2000} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </GlassCard>
            </div>
          </div>
        )}

        {view === 'archive' && (
          <div className="stagger-in">
            <h2 className="text-4xl font-black dark:text-slate-50 text-slate-900 mb-12 tracking-tight transition-colors">Historical Vault <span className="text-indigo-500">📅</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {stats.allRecords.length > 0 ? (
                stats.allRecords.map((r) => (
                  <GlassCard key={r.date} className="p-10 rounded-[3rem] cursor-pointer hover:scale-[1.05] active:scale-95 group shadow-2xl transition-all" onClick={() => { setSelectedDate(r.date); setView('home'); }}>
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <p className="text-[11px] font-black uppercase text-indigo-600 tracking-widest mb-1">{formatDateLong(r.date).split(',')[0]}</p>
                        <h4 className="text-xl font-black dark:text-slate-100 text-slate-800 transition-colors">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h4>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-xl shadow-inner">{r.totalPointsEarned >= r.maxPointsPossible ? '🏆' : '✨'}</div>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-6 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full transition-all duration-1000" style={{ width: `${(r.totalPointsEarned / (r.maxPointsPossible || 1)) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <span>{r.tasks.length} Goals</span>
                      <span className="text-indigo-600 dark:text-cyan-400">{r.totalPointsEarned} PTS</span>
                    </div>
                  </GlassCard>
                )).reverse()
              ) : (
                <div className="col-span-full py-40 text-center opacity-30 italic text-2xl">The vault awaits your first victory.</div>
              )}
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="stagger-in space-y-12 pb-10">
            <h2 className="text-4xl font-black dark:text-slate-50 text-slate-900 mb-4 tracking-tight transition-colors">Matrix Analytics <span className="text-indigo-500">📈</span></h2>
            <GlassCard className="rounded-[4rem] p-12 h-[500px] border-none shadow-3xl">
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400 mb-10">Productivity Wave (14 Cycles)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={state.darkMode ? "#1e293b" : "#e2e8f0"} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                  <Tooltip contentStyle={{ borderRadius: '32px', border: 'none', background: state.darkMode ? '#0f172a' : '#fff', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }} labelStyle={{ fontWeight: 900, color: '#6366f1', fontSize: '13px' }} />
                  <Area type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={6} fillOpacity={1} fill="url(#colorPoints)" animationDuration={2000} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <GlassCard className="p-10 rounded-[3.5rem] bg-indigo-600 text-white border-none shadow-indigo-500/30 shadow-3xl">
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-3">Efficiency Quotient</p>
                  <h4 className="text-5xl font-black">{Math.round((Object.values(state.records).reduce((acc, r) => acc + (r.totalPointsEarned / (r.maxPointsPossible || 1)), 0) / (Object.keys(state.records).length || 1)) * 100)}%</h4>
               </GlassCard>
               <GlassCard className="p-10 rounded-[3.5rem] bg-slate-900 dark:bg-slate-950 text-white border-none shadow-2xl">
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-3">Total Energy Harvest</p>
                  <h4 className="text-5xl font-black">{Object.values(state.records).reduce((acc, r) => acc + r.totalPointsEarned, 0).toLocaleString()}</h4>
               </GlassCard>
               <GlassCard className="p-10 rounded-[3.5rem] bg-emerald-600 text-white border-none shadow-emerald-500/20 shadow-3xl">
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-3">Zenith Milestone Days</p>
                  <h4 className="text-5xl font-black">{Object.values(state.records).filter(r => r.totalPointsEarned >= r.maxPointsPossible && r.maxPointsPossible > 0).length}</h4>
               </GlassCard>
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="max-w-xl mx-auto stagger-in space-y-12 pb-20">
            <h2 className="text-4xl font-black dark:text-slate-50 text-slate-900 mb-12 tracking-tight transition-colors">Identity <span className="text-indigo-500">👤</span></h2>
            
            <GlassCard className="rounded-[4rem] p-12 flex flex-col items-center border-none shadow-3xl">
              <div className="relative mb-12 group">
                <div className="w-40 h-40 rounded-[3.8rem] overflow-hidden ring-[14px] ring-indigo-500/10 shadow-3xl transition-transform group-hover:scale-105">
                  <img src={state.profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-[-15px] right-[-15px] bg-indigo-600 text-white p-5 rounded-[1.8rem] shadow-2xl hover:scale-110 active:scale-95 transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
              </div>
              <div className="w-full space-y-6">
                 <div>
                   <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-6 mb-3 block">Display Identifier</label>
                   <input 
                    type="text" 
                    value={state.profile.name}
                    onChange={(e) => setState(prev => ({ ...prev, profile: { ...prev.profile, name: e.target.value }}))}
                    className="w-full glass bg-white/40 dark:bg-slate-900/40 px-10 py-6 rounded-[2.8rem] outline-none text-2xl font-black text-center focus:ring-4 ring-indigo-500/20 transition-all dark:text-slate-100 text-slate-800"
                    placeholder="Enter your name..."
                  />
                 </div>
              </div>
            </GlassCard>

            <GlassCard className="rounded-[3.5rem] p-10 border-none bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30">
              <div className="flex items-center space-x-5 mb-8">
                <div className="w-14 h-14 bg-rose-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 text-2xl">⚠️</div>
                <div>
                   <h3 className="text-xl font-black text-rose-600 dark:text-rose-400">Restoration Center</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-rose-500/60">Destructive Actions</p>
                </div>
              </div>
              <p className="text-sm text-rose-600/80 dark:text-rose-400/80 mb-10 font-medium italic leading-relaxed">Wiping history will reset your streak and permanently erase the vault. This action is synchronous and irreversible.</p>
              <button onClick={clearAllRecords} className="w-full py-6 bg-rose-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-xl hover:bg-rose-700 active:scale-95 transition-all">Erase Archive</button>
            </GlassCard>
          </div>
        )}
      </main>

      {/* Primary Navigation */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 glass px-14 py-6 rounded-[4rem] shadow-[0_35px_80px_rgba(0,0,0,0.3)] flex items-center space-x-14 z-50 border-t border-white/60 dark:border-white/5 transition-transform hover:scale-105 active:scale-95">
        {[
          { id: 'home', icon: 'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z', label: 'Pulse' },
          { id: 'archive', icon: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z', label: 'Vault' },
          { id: 'analytics', icon: 'M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z', label: 'Matrix' },
          { id: 'profile', icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'Soul' }
        ].map((item) => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id as any)} 
            className={`flex flex-col items-center transition-all group ${view === item.id ? 'text-indigo-600 dark:text-cyan-400 scale-125' : 'text-slate-400 hover:text-indigo-500'}`}
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d={item.icon} fillRule="evenodd" clipRule="evenodd" /></svg>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-2 transition-opacity duration-500 ${view === item.id ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
