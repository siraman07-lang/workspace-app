import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import './App.css';

const AutoResizeTextarea = ({ value, onChange, placeholder, disabled }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; 
    }
  }, [value]); 

  return (
    <textarea
      ref={textareaRef}
      className="invisible-input text-area-input"
      rows="1"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [nickname, setNickname] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  // --- 상태 관리 ---
  const [themeColor, setThemeColor] = useState('#D17A7A');
  const [themeTextColor, setThemeTextColor] = useState('#ffffff'); 
  const [dailyGoal, setDailyGoal] = useState(5000);
  const [tags, setTags] = useState([
    { id: 't1', name: '로맨스', color: '#ffb3ba' },
    { id: 't2', name: '판타지', color: '#baffc9' }
  ]);
  const [allWorks, setAllWorks] = useState([]);

  // --- 날짜 ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const getDateString = (dateObj) => {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };
  const dateKey = getDateString(selectedDate);

  const formatMMDD = (dateStr) => {
    if (!dateStr) return '일정'; 
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}${parts[2]}`; 
    return dateStr;
  };

  // --- 클라우드 동기화 로직 ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      const fetchData = async () => {
        const { data } = await supabase.from('profiles').select('nickname, workspace_data').eq('id', session.user.id).single();
        if (data) {
          setNickname(data.nickname || '작가');
          if (data.workspace_data) {
            setThemeColor(data.workspace_data.themeColor || '#D17A7A');
            setThemeTextColor(data.workspace_data.themeTextColor || '#ffffff');
            setDailyGoal(data.workspace_data.dailyGoal || 5000);
            if (data.workspace_data.tags) setTags(data.workspace_data.tags);
            if (data.workspace_data.works && data.workspace_data.works.length > 0) {
              setAllWorks(data.workspace_data.works);
            } else {
              setAllWorks([{ id: Date.now(), date: getDateString(new Date()), tagId: 't1', title: '첫 원고를 시작해 보세요!', memo: '', deadline: '', target: 3000, current: 0, done: false }]);
            }
          } else {
             setAllWorks([{ id: Date.now(), date: getDateString(new Date()), tagId: 't1', title: '첫 원고를 시작해 보세요!', memo: '', deadline: '', target: 3000, current: 0, done: false }]);
          }
        }
        setDataLoaded(true); 
      };
      fetchData();
    } else {
      setDataLoaded(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && dataLoaded) {
      const saveDataTimer = setTimeout(async () => {
        await supabase.from('profiles').update({ 
          workspace_data: { themeColor, themeTextColor, dailyGoal, tags, works: allWorks } 
        }).eq('id', session.user.id);
      }, 1500);
      return () => clearTimeout(saveDataTimer); 
    }
  }, [themeColor, themeTextColor, dailyGoal, tags, allWorks, session, dataLoaded]);

  // --- 타이머 ---
  const [timerMode, setTimerMode] = useState('timer'); 
  const [time, setTime] = useState(25 * 60); 
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(prevTime => {
          if (timerMode === 'stopwatch') return prevTime + 1;
          if (prevTime > 0) return prevTime - 1;
          setIsRunning(false); 
          return 0;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerMode]);

  const switchTimerMode = (mode) => { setIsRunning(false); setTimerMode(mode); setTime(mode === 'timer' ? 25 * 60 : 0); };
  const resetTimer = () => { setIsRunning(false); setTime(timerMode === 'timer' ? 25 * 60 : 0); };

  // --- 데이터 제어 ---
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [selectedFilterTag, setSelectedFilterTag] = useState(null);

  const displayedWorks = selectedFilterTag ? allWorks.filter(w => w.tagId === selectedFilterTag) : allWorks.filter(w => w.date === dateKey);
  const totalCurrent = displayedWorks.reduce((sum, w) => sum + (Number(w.current) || 0), 0);
  const progressPercent = Math.max(0, Math.min(Math.round((totalCurrent / (dailyGoal || 1)) * 100), 100));

  const tagStats = allWorks.reduce((acc, work) => {
    const t = work.tagId;
    if (!t) return acc;
    if (!acc[t]) acc[t] = { target: 0, current: 0 };
    acc[t].target += (Number(work.target) || 0);
    acc[t].current += (Number(work.current) || 0);
    return acc;
  }, {});

  const updateWork = (id, field, value) => setAllWorks(allWorks.map(w => w.id === id ? { ...w, [field]: value } : w));
  const deleteWork = (id) => setAllWorks(allWorks.filter(w => w.id !== id));
  const addWorkRow = () => setAllWorks([...allWorks, { id: Date.now(), date: dateKey, tagId: tags[0]?.id || '', title: '', memo: '', deadline: '', target: 0, current: 0, done: false }]);

  const handleToggleDone = (id, isChecked, targetAmount) => {
    setAllWorks(allWorks.map(w => w.id === id ? { ...w, done: isChecked, current: isChecked ? targetAmount : w.current } : w));
  };

  const postponeWork = (id) => {
    const tomorrow = new Date(selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setAllWorks(allWorks.map(w => w.id === id ? { ...w, date: getDateString(tomorrow) } : w));
    setOpenActionId(null);
  };

  if (!session) {
    return (
      <div className="auth-root">
        <div className="auth-card">
          <h1 className="auth-logo">WorkSpace.</h1>
          <button className="google-btn" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>구글로 시작하기</button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>작업실을 불러오는 중...</div>;

  return (
    <div className="app-root" style={{ '--point-color': themeColor, '--point-text': themeTextColor }} onClick={() => { setOpenDropdownId(null); setOpenActionId(null); setIsTagModalOpen(false); }}>
      
      <header className="main-header">
        <div className="header-left">
          <h1 className="logo">WorkSpace.</h1>
          <span className="welcome">{nickname} 작가님</span>
        </div>
        
        <div className="date-navigator">
          <button className="nav-arrow" onClick={(e) => { e.stopPropagation(); setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1))); }}>&lt;</button>
          <span className="date-label">{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</span>
          <button className="nav-arrow" onClick={(e) => { e.stopPropagation(); setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1))); }}>&gt;</button>
          <button className="today-btn" onClick={(e) => { e.stopPropagation(); setSelectedDate(new Date()); }}>오늘</button>
        </div>

        <div className="header-right">
          <button className="logout-btn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          <div className="theme-pickers">
            <label className="picker-label" title="버튼 및 표 배경색"><input type="color" className="theme-color-button" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} /></label>
            <label className="picker-label" title="버튼 및 표 글자색"><input type="color" className="theme-color-button" value={themeTextColor} onChange={(e) => setThemeTextColor(e.target.value)} /></label>
          </div>
          <button className="settings-btn" onClick={(e) => { e.stopPropagation(); setIsTagModalOpen(true); }}>⚙️ 태그 설정</button>
        </div>
      </header>

      <div className="tag-stats-container">
        <span className="tag-stats-title">작품별 진행도 📊</span>
        <div className="tag-badges">
          {tags.map(tag => {
            const stats = tagStats[tag.id] || { current: 0, target: 0 };
            return (
              <div key={tag.id} className={`tag-badge ${selectedFilterTag === tag.id ? 'active-filter' : ''}`} style={{ '--badge-color': tag.color }} onClick={(e) => { e.stopPropagation(); setSelectedFilterTag(selectedFilterTag === tag.id ? null : tag.id); }}>
                <span className="t-dot" style={{ background: tag.color }}></span>
                <span className="t-name">{tag.name}</span>
                <span className="t-nums">{stats.current.toLocaleString()}자</span>
              </div>
            )
          })}
        </div>
      </div>

      <main className="dashboard-grid">
        <div className="col-table pro-card">
          <div className="card-header">
            <h2>{selectedFilterTag ? '히스토리' : '오늘의 원고'}</h2>
            <button className="add-row-btn theme-bg" onClick={(e) => { e.stopPropagation(); addWorkRow(); }}>+ 항목 추가</button>
          </div>
          
          <div className="table-container">
            <table className="work-table">
              {/* ✨ 달성 칸을 8%로 늘려 숨통을 틔워줬습니다! ✨ */}
              <colgroup>
                <col width="11%" /><col width="24%" /><col width="24%" /><col width="11%" /><col width="9%" /><col width="9%" /><col width="8%" /><col width="4%" />
              </colgroup>
              <thead>
                <tr>
                  <th>태그</th><th>제목</th><th>메모</th><th>마감일</th><th>목표</th><th>현재</th><th>달성</th><th></th>
                </tr>
              </thead>
              <tbody>
                {displayedWorks.map(work => {
                  const workTag = tags.find(t => t.id === work.tagId);
                  return (
                    <tr key={work.id} className={work.done ? 'row-done' : ''}>
                      <td className="center-td">
                        <div className="custom-dropdown-wrap">
                          <div className="custom-dropdown-trigger" style={{ borderLeft: `3px solid ${workTag?.color || '#eee'}` }} onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === work.id ? null : work.id); setOpenActionId(null); }}>
                            {workTag?.name || '선택'}
                          </div>
                          {openDropdownId === work.id && (
                            <div className="custom-dropdown-menu">
                              <div className="dropdown-item" onClick={() => { updateWork(work.id, 'tagId', ''); setOpenDropdownId(null); }}>선택 해제</div>
                              {tags.map(t => <div key={t.id} className="dropdown-item" onClick={() => { updateWork(work.id, 'tagId', t.id); setOpenDropdownId(null); }}><span className="color-dot" style={{backgroundColor: t.color}}></span>{t.name}</div>)}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td>
                        <AutoResizeTextarea value={work.title} onChange={(e) => updateWork(work.id, 'title', e.target.value)} placeholder="제목" disabled={work.done} />
                      </td>
                      <td>
                        <AutoResizeTextarea value={work.memo} onChange={(e) => updateWork(work.id, 'memo', e.target.value)} placeholder="메모" disabled={work.done} />
                      </td>
                      
                      <td>
                        <div className="custom-date-wrapper">
                          <span className="date-text">{formatMMDD(work.deadline)}</span>
                          <input 
                            type="date" 
                            className="overlay-date-input" 
                            value={work.deadline || ''} 
                            onClick={(e) => {
                              if (e.target.showPicker) {
                                // ✨ 배포 에러를 발생시키던 주범(err)을 안전하게 처리했습니다! ✨
                                try { e.target.showPicker(); } catch(error) { console.log(error); }
                              }
                            }}
                            onChange={(e) => updateWork(work.id, 'deadline', e.target.value)} 
                            disabled={work.done} 
                          />
                        </div>
                      </td>

                      <td><input type="number" className="invisible-input num-input" value={work.target} onChange={(e) => updateWork(work.id, 'target', Number(e.target.value))} disabled={work.done} /></td>
                      <td><input type="number" className="invisible-input num-input" value={work.current} onChange={(e) => updateWork(work.id, 'current', Number(e.target.value))} disabled={work.done} /></td>
                      
                      <td>
                        <div className="actions-wrapper">
                          <input type="checkbox" className="done-checkbox" checked={work.done} onChange={(e) => handleToggleDone(work.id, e.target.checked, work.target)} />
                        </div>
                      </td>

                      <td className="more-action-td">
                        <div className="custom-dropdown-wrap">
                          <button className="more-btn" onClick={(e) => { e.stopPropagation(); setOpenActionId(openActionId === work.id ? null : work.id); setOpenDropdownId(null); }}>⋮</button>
                          {openActionId === work.id && (
                            <div className="custom-dropdown-menu right-aligned">
                               <div className="dropdown-item" onClick={() => postponeWork(work.id)}>➡️ 내일로 미루기</div>
                               <div className="dropdown-item delete-text" onClick={() => deleteWork(work.id)}>🗑️ 삭제하기</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="col-widgets">
          <div className="pro-card widget-card">
            <div className="widget-title-row">
              <h3>일일 목표</h3>
              <div className="goal-setting"><input type="number" className="goal-setting-input" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} /> 자</div>
            </div>
            <div className="progress-ring-container">
              <div className="progress-ring" style={{ background: `conic-gradient(var(--point-color) ${progressPercent}%, var(--border-line) 0)` }}><div className="ring-inner"><span>{progressPercent}%</span></div></div>
            </div>
            <div className="goal-text"><b>{totalCurrent.toLocaleString()}</b> / {dailyGoal.toLocaleString()} 자</div>
          </div>

          <div className="pro-card widget-card timer-card">
            <div className="timer-tabs">
              <button className={timerMode === 'timer' ? 'active' : ''} onClick={() => switchTimerMode('timer')}>뽀모도로</button>
              <button className={timerMode === 'stopwatch' ? 'active' : ''} onClick={() => switchTimerMode('stopwatch')}>스톱워치</button>
            </div>
            <div className="timer-display">{String(Math.floor(time / 60)).padStart(2, '0')}:{String(time % 60).padStart(2, '0')}</div>
            <div className="timer-btns">
              <button className={`t-btn ${isRunning ? 'stop' : 'start'}`} onClick={() => setIsRunning(!isRunning)}>{isRunning ? '정지' : '시작'}</button>
              <button className="t-btn reset" onClick={resetTimer}>초기화</button>
            </div>
          </div>
        </aside>
      </main>

      {isTagModalOpen && (
        <div className="tag-modal" onClick={(e) => e.stopPropagation()}>
          <div className="tag-modal-header"><h3>태그 관리</h3><button className="modal-close" onClick={() => setIsTagModalOpen(false)}>✕</button></div>
          <div className="tag-list">
            {tags.map(tag => (
              <div key={tag.id} className="tag-list-item">
                <input type="color" className="tag-color-input" value={tag.color} onChange={(e) => setTags(tags.map(t => t.id === tag.id ? {...t, color: e.target.value} : t))} />
                <input type="text" className="tag-name-input" value={tag.name} onChange={(e) => setTags(tags.map(t => t.id === tag.id ? {...t, name: e.target.value} : t))} />
                <button className="tag-delete-btn" onClick={() => setTags(tags.filter(t => t.id !== tag.id))}>✕</button>
              </div>
            ))}
          </div>
          <button className="add-row-btn theme-bg" style={{width:'100%', marginTop:'10px'}} onClick={() => setTags([...tags, { id: Date.now(), name: '새 태그', color: '#eeeeee' }])}>+ 추가</button>
        </div>
      )}
    </div>
  );
}

export default App;