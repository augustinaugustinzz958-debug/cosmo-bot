// Dashboard logic — expects Firebase compat libs to be loaded.
// If Firebase app is already initialized by login/register pages, this will reuse it.

const DEBUG = false;

function log(...args){ if(DEBUG) console.log(...args); }

// Utility: format date/time
function formatDateTime(date){
  const opts = { year:'numeric',month:'short',day:'numeric' };
  const dt = date.toLocaleDateString(undefined,opts);
  const t = date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return {date:dt,time:t};
}

// Check Firebase
function ensureFirebase(){
  if(window.firebase && firebase.apps && firebase.apps.length>0){
    log('Firebase already initialized');
    return true;
  }
  if(window.firebase && window.firebaseConfig){
    firebase.initializeApp(window.firebaseConfig);
    return true;
  }
  const container = document.querySelector('.dashboard-container');
  const err = document.createElement('div');
  err.className = 'glass-card';
  err.style.margin = '24px';
  err.style.border = '2px dashed rgba(255,80,80,0.12)';
  err.innerHTML = '<strong>Firebase not initialized.</strong> Reverting to mock localStorage mode.';
  container.prepend(err);
  return false;
}

function el(id){ return document.getElementById(id); }

async function main(){
  const isFirebase = window.firebase && firebase.apps && firebase.apps.length > 0;

  if (isFirebase) {
    const auth = firebase.auth();
    // Auth guard
    auth.onAuthStateChanged(user => {
      if(!user){
        window.location.href = 'login.html';
        return;
      }
      const tasksRef = firebase.firestore().collection('users').doc(user.uid).collection('tasks');
      initForUser(user, tasksRef, async () => {
        await firebase.auth().signOut();
      });
    });
  } else {
    console.log("Firebase not detected. Running dashboard in mock localStorage demo mode.");
    
    // Retrieve mock user from localStorage or create demo user
    const mockUser = JSON.parse(localStorage.getItem('currentUser') || '{"displayName": "Cosmo Cadet", "email": "cadet@cosmobot.io", "uid": "mock_user_123", "class": "5"}');
    
    // Mock tasks collection object matching firestore APIs
    const mockTasksRef = {
      add: async (payload) => {
        const tasks = JSON.parse(localStorage.getItem('cosmo_tasks') || '[]');
        payload.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        payload.createdAt = { toDate: () => new Date() };
        tasks.unshift(payload);
        localStorage.setItem('cosmo_tasks', JSON.stringify(tasks));
        if (mockTasksRef._onSnapshotListener) {
          mockTasksRef._onSnapshotListener(tasks);
        }
      },
      doc: (id) => {
        return {
          update: async (changes) => {
            const tasks = JSON.parse(localStorage.getItem('cosmo_tasks') || '[]');
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1) {
              tasks[idx] = { ...tasks[idx], ...changes };
              localStorage.setItem('cosmo_tasks', JSON.stringify(tasks));
              if (mockTasksRef._onSnapshotListener) {
                mockTasksRef._onSnapshotListener(tasks);
              }
            }
          },
          delete: async () => {
            const tasks = JSON.parse(localStorage.getItem('cosmo_tasks') || '[]');
            const filtered = tasks.filter(t => t.id !== id);
            localStorage.setItem('cosmo_tasks', JSON.stringify(filtered));
            if (mockTasksRef._onSnapshotListener) {
              mockTasksRef._onSnapshotListener(filtered);
            }
          }
        };
      },
      orderBy: () => {
        return {
          onSnapshot: (callback) => {
            mockTasksRef._onSnapshotListener = (tasksList) => {
              const snapshot = tasksList.map(task => ({
                id: task.id,
                data: () => ({
                  ...task,
                  createdAt: task.createdAt && typeof task.createdAt.toDate === 'function' ? task.createdAt : { toDate: () => new Date() }
                })
              }));
              callback(snapshot);
            };
            const initialTasks = JSON.parse(localStorage.getItem('cosmo_tasks') || '[]');
            mockTasksRef._onSnapshotListener(initialTasks);
          }
        };
      }
    };

    initForUser(mockUser, mockTasksRef, async () => {
      localStorage.removeItem('currentUser');
    });
  }
}

let currentTasks = [];
let scheduledReminders = new Map();

function initForUser(user, tasksRef, onLogout){
  // Apply dynamic color theme based on user configuration
  const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (savedUser.theme) {
    applyTheme(savedUser.theme);
  }

  // UI refs
  const displayNameVal = savedUser.displayName || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  el('user-name').textContent = displayNameVal;
  el('user-email').textContent = user.email || '';
  el('profile-initial').textContent = (savedUser.displayName || user.displayName || user.email || 'U')[0].toUpperCase();
  if (el('welcome-user-name')) {
    el('welcome-user-name').textContent = displayNameVal;
  }

  // logout
  el('logoutBtn').addEventListener('click', async ()=>{
    if (onLogout) await onLogout();
    window.location.href = 'index.html';
  });

  // date/time clock
  startClock();

  // tasks form submission
  const form = el('taskForm');
  if (form) {
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const title = el('taskTitle').value.trim();
      if(!title) return alert('Please enter a title');
      const description = el('taskDesc').value.trim();
      const category = el('taskCategory').value;
      const date = el('taskDate').value || null;
      const time = el('taskTime').value || null;
      const priority = el('taskPriority').value;
      const audioReminder = el('taskAudio').checked;
      const reminderMessage = el('taskReminderMsg').value.trim();

      const timestampValue = (window.firebase && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : { toDate: () => new Date() };

      const payload = {
        title, description, category, date, time, priority, completed:false, audioReminder, reminderMessage, createdAt: timestampValue
      };
      try{
        await tasksRef.add(payload);
        form.reset();
      }catch(err){ console.error(err); alert('Failed to save task'); }
    });
  }

  const clearFormBtn = el('clearForm');
  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', ()=> el('taskForm').reset());
  }

  // real-time listener
  tasksRef.orderBy('createdAt','desc').onSnapshot(snapshot=>{
    const tasks = [];
    snapshot.forEach(doc=>{
      const data = doc.data(); data.id = doc.id; tasks.push(data);
    });
    currentTasks = tasks;
    renderTasks(tasks, tasksRef);
    renderCalendar();
    renderAnalytics();
  });

  // request notification permission
  if('Notification' in window && Notification.permission !== 'granted'){
    Notification.requestPermission();
  }

  // Initialize Navigation Tabs & Panels
  initPanelsNav();
  initCalendarNav();

  // Landing sequence complete trigger (flowing water transition removed)
  window.restoreDashboardAfterCrash = () => {
    const liquidOverlay = document.getElementById('liquid-overlay');
    if (liquidOverlay) {
      liquidOverlay.style.display = 'none';
    }

    const dashContainer = document.querySelector('.dashboard-container');
    const botWidget = document.getElementById('cosmobot-widget');

    if (dashContainer) {
      dashContainer.style.pointerEvents = 'all';
    }
    if (botWidget) {
      initCosmoBot();
    }
    
    // Trigger navigation stagger load
    gsap.fromTo('.holographic-nav, .panel-header, .active-widget, .active-view', 
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }
    );
  };
}

function applyTheme(theme) {
  const themeHexMap = {
    grey:   '#a8adb8',
    orange: '#ffa500',
    red:    '#ff5500',
    yellow: '#ffe57f',
    blue:   '#3b82f6',
    cyan:   '#00f0ff',
    brown:  '#bf7a50',
    gold:   '#ffdf00'
  };
  const color = themeHexMap[theme] || themeHexMap.blue;
  document.documentElement.style.setProperty('--neon-blue', color);
  document.documentElement.style.setProperty('--neon-cyan', color);
  document.documentElement.style.setProperty('--glass-border', `rgba(${hexToRgb(color)}, 0.25)`);
  document.documentElement.style.setProperty('--glow-blue', `0 0 15px rgba(${hexToRgb(color)}, 0.35)`);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
    : '59, 130, 246';
}

function initPanelsNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.workspace-panel');
  const widgets = document.querySelectorAll('.widget-card');

  const widgetIdMap = {
    'panel-syllabus': 'widget-syllabus',
    'panel-tasks': 'widget-tasks',
    'panel-planner': 'widget-planner',
    'panel-calendar': 'widget-calendar',
    'panel-analytics': 'widget-analytics'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPanelId = item.getAttribute('data-panel');

      // Toggle active states on tabs
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Toggle active states on sidebar widgets
      widgets.forEach(w => {
        if (w.id === widgetIdMap[targetPanelId]) {
          w.classList.add('active-widget');
          gsap.fromTo(w,
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
          );
        } else {
          w.classList.remove('active-widget');
        }
      });

      // Toggle active states on panels
      panels.forEach(p => {
        if (p.id === targetPanelId) {
          p.classList.add('active-view');
          
          // Animate entry of panel children
          const innerElements = p.querySelectorAll('.panel-header, .glass-card, form, .syllabus-tree, .syllabus-workspace, .stat-card, .time-bar-row');
          gsap.fromTo(innerElements, 
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
          );

          // Custom updates when a specific tab opens
          if (targetPanelId === 'panel-calendar') {
            renderCalendar();
          } else if (targetPanelId === 'panel-analytics') {
            renderAnalytics();
          }
        } else {
          p.classList.remove('active-view');
        }
      });
    });
  });

  // Syllabus Explorer interactive bindings
  initSyllabusExplorer();
}

function initSyllabusExplorer() {
  const subjects = document.querySelectorAll('.syllabus-subject');
  
  subjects.forEach(sub => {
    const titleRow = sub.querySelector('.subject-title-row');
    const arrow = sub.querySelector('.toggle-arrow');
    
    titleRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = sub.classList.toggle('collapsed');
      if (arrow) {
        arrow.textContent = isCollapsed ? '▶' : '▼';
      }
    });
  });

  // Chapter Node clicks
  const nodes = document.querySelectorAll('.chapter-node');
  const emptyState = document.getElementById('syllabus-empty-state');
  const contentArea = document.getElementById('syllabus-content-area');
  const studyTitle = document.getElementById('study-chapter-title');
  const studyStatus = document.getElementById('study-chapter-status');
  const studyProgress = document.getElementById('study-chapter-progress-text');
  const studySummary = document.getElementById('study-chapter-summary');
  const btnAskTutor = document.getElementById('btn-study-ask-tutor');
  const btnComplete = document.getElementById('btn-study-complete');

  const chapterDetails = {
    'math': {
      'Algebra': {
        summary: 'Algebra is the study of mathematical symbols and the rules for manipulating these symbols. In this lesson, we review limits and continuity. Limits represent the value that a function approaches as the input approaches some value. Continuity means that a small change in the input results in a small change in the output, with no sudden jumps.',
        progress: '100% (Completed)',
        status: 'Completed',
        statusClass: 'tag-low'
      },
      'Calculus': {
        summary: 'Calculus focuses on limits, functions, derivatives, integrals, and infinite series. Here we explore derivatives, which represent the instantaneous rate of change of a function, and easing curves used in smooth UI animations. The derivative of x² is 2x. Easing curves like cubic-bezier are mathematical functions mapped to time.',
        progress: '42% (In Progress)',
        status: 'Active',
        statusClass: 'tag-study'
      },
      'Trigonometry': {
        summary: 'Trigonometry studies relationships between side lengths and angles of triangles. This module covers trigonometric identities, periodic wave formulas, and coordinates translation.',
        progress: '0% (Locked)',
        status: 'Locked',
        statusClass: 'tag-high'
      },
      'Statistics': {
        summary: 'Statistics covers data collection, analysis, interpretation, presentation, and organization. This chapter focuses on probability distributions, including normal distribution curves and standard deviation variance.',
        progress: '0% (Locked)',
        status: 'Locked',
        statusClass: 'tag-high'
      }
    },
    'science': {
      'Physics': {
        summary: 'Physics is the natural science that studies matter, its motion and behavior through space and time. This chapter reviews the Laws of Thermodynamics, heat transfer, and entropy principles.',
        progress: '100% (Completed)',
        status: 'Completed',
        statusClass: 'tag-low'
      },
      'Chemistry': {
        summary: 'Chemistry explores the properties and behavior of matter. This chapter covers atomic bonding, electron valence shells, and molecular configurations.',
        progress: '54% (In Progress)',
        status: 'Active',
        statusClass: 'tag-study'
      },
      'Biology': {
        summary: 'Biology is the study of life and living organisms. This chapter covers cellular structures, DNA transcription, and genetic inheritances.',
        progress: '0% (Locked)',
        status: 'Locked',
        statusClass: 'tag-high'
      }
    },
    'english': {
      'Literature': {
        summary: 'Explore advanced literary analysis. We study Shakespearean plays, act structures, and iambic pentameter (da-DUM da-DUM rhythm) used in natural yet elevated dialogues.',
        progress: '100% (Completed)',
        status: 'Completed',
        statusClass: 'tag-low'
      },
      'Composition': {
        summary: 'Learn composition writing. Focuses on narrative voice, point of view (first vs third person), and outlining thematic transitions.',
        progress: '90% (In Progress)',
        status: 'Active',
        statusClass: 'tag-study'
      }
    },
    'social': {
      'History': {
        summary: 'Examine historical movements. This chapter covers the French Revolution, the storming of the Bastille, and the political transition to modern democracy.',
        progress: '100% (Completed)',
        status: 'Completed',
        statusClass: 'tag-low'
      },
      'Geography': {
        summary: 'Study economic geography and global resources. Focuses on the Industrial Revolution, industrial cities distribution, and global trade routing.',
        progress: '82% (In Progress)',
        status: 'Active',
        statusClass: 'tag-study'
      }
    },
    'computer': {
      'Algorithms': {
        summary: 'Computer Science algorithms. Covers bubble sort, quicksort, and merge sort, analyzing their time complexity using Big O notation.',
        progress: '100% (Completed)',
        status: 'Completed',
        statusClass: 'tag-low'
      },
      'Structures': {
        summary: 'Explore complex data structures. This chapter details binary search trees (BST), graph traversals, and memory allocations.',
        progress: '75% (In Progress)',
        status: 'Active',
        statusClass: 'tag-study'
      }
    }
  };

  nodes.forEach(node => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Select node
      nodes.forEach(n => n.classList.remove('selected-node'));
      node.classList.add('selected-node');

      const subject = node.getAttribute('data-subject');
      const chapter = node.getAttribute('data-chapter');

      const details = chapterDetails[subject]?.[chapter];
      if (details) {
        // Toggle view
        emptyState.style.display = 'none';
        contentArea.style.display = 'block';

        // Update text
        studyTitle.textContent = `${node.querySelector('.node-title').textContent}`;
        studyStatus.textContent = details.status;
        
        studyStatus.className = 'tag';
        studyStatus.classList.add(details.statusClass || 'tag-study');
        
        studyProgress.textContent = `Progress: ${details.progress}`;
        studySummary.textContent = details.summary;

        // Reset click handlers
        const askHandler = () => {
          const chat = document.getElementById('cosmobot-chat');
          const bubble = document.getElementById('cosmobot-bubble');
          if (chat && bubble) {
            chat.classList.add('active');
            bubble.style.opacity = '0';
            
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
              chatInput.value = `Explain the chapter: "${node.querySelector('.node-title').textContent}"`;
              const chatSend = document.getElementById('chat-send');
              if (chatSend) chatSend.click();
            }
          }
        };

        const completeHandler = () => {
          if (details.status !== 'Completed') {
            details.status = 'Completed';
            details.progress = '100% (Completed)';
            details.statusClass = 'tag-low';
            
            studyStatus.textContent = 'Completed';
            studyStatus.className = 'tag tag-low';
            studyProgress.textContent = `Progress: 100% (Completed)`;
            
            node.classList.remove('active-node');
            node.classList.add('studied');
            node.querySelector('.node-icon').textContent = '✓';
            
            alert('Congratulations on completing this chapter!');
            renderAnalytics();
          } else {
            alert('This chapter is already completed!');
          }
        };

        const newAskBtn = btnAskTutor.cloneNode(true);
        btnAskTutor.parentNode.replaceChild(newAskBtn, btnAskTutor);
        newAskBtn.addEventListener('click', askHandler);

        const newCompleteBtn = btnComplete.cloneNode(true);
        btnComplete.parentNode.replaceChild(newCompleteBtn, btnComplete);
        newCompleteBtn.addEventListener('click', completeHandler);
      }
    });
  });
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function renderCalendar() {
  const daysGrid = document.getElementById('calendar-days-grid');
  const monthYearLabel = document.getElementById('calendar-month-year');
  if (!daysGrid || !monthYearLabel) return;

  daysGrid.innerHTML = '';

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  monthYearLabel.textContent = `${months[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty-day';
    daysGrid.appendChild(emptyCell);
  }

  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    if (today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
      dayCell.classList.add('current-day');
    }

    const numSpan = document.createElement('span');
    numSpan.className = 'day-number';
    numSpan.textContent = day;
    dayCell.appendChild(numSpan);

    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateQuery = `${currentYear}-${monthStr}-${dayStr}`;

    const dayTasks = currentTasks.filter(t => t.date === dateQuery);
    if (dayTasks.length > 0) {
      const indicators = document.createElement('div');
      indicators.className = 'day-indicators';
      dayTasks.forEach(() => {
        const dot = document.createElement('span');
        dot.className = 'task-dot';
        indicators.appendChild(dot);
      });
      dayCell.appendChild(indicators);

      dayCell.addEventListener('click', () => {
        const titles = dayTasks.map(t => `- ${t.title} (${t.priority} Priority)`).join('\n');
        alert(`Objectives for ${months[currentMonth]} ${day}:\n${titles}`);
      });
    }

    daysGrid.appendChild(dayCell);
  }
}

function initCalendarNav() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }
}

function renderAnalytics() {
  const completedText = document.getElementById('completion-rate-text');
  const completionRing = document.getElementById('completion-ring');
  const streakText = document.getElementById('analytics-streak-days');

  if (!completedText || !completionRing) return;

  const total = currentTasks.length;
  const completed = currentTasks.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 75;

  completedText.textContent = `${rate}%`;

  const circumference = 251.2;
  const offset = circumference - (rate / 100) * circumference;
  
  completionRing.style.transition = 'stroke-dashoffset 0.8s ease-in-out';
  completionRing.style.strokeDashoffset = offset;

  if (streakText) {
    const completions = currentTasks.filter(t => t.completed).length;
    streakText.textContent = String(5 + completions);
  }
}

function renderTasks(tasks, tasksRef){
  const list = el('tasksList');
  if (!list) return;
  list.innerHTML = '';
  
  if(tasks.length===0){ 
    list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 2rem;">[ No active objectives ]</div>'; 
    return; 
  }
  
  tasks.forEach(task=>{
    const item = document.createElement('div');
    item.className = 'task-item';
    if(task.completed) item.style.opacity = '0.55';

    const left = document.createElement('div');
    left.className = 'task-left';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = task.completed;
    check.addEventListener('change', async () => {
      await tasksRef.doc(task.id).update({completed: check.checked});
    });

    const info = document.createElement('div');
    info.className = 'task-info';

    const title = document.createElement('h4');
    title.textContent = task.title;
    if (task.completed) title.style.textDecoration = 'line-through';

    const desc = document.createElement('p');
    desc.textContent = task.description || '';

    // Metadata & Tags
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    // Category Tag
    const catTag = document.createElement('span');
    const catClass = (task.category || 'Study').toLowerCase();
    catTag.className = `tag tag-${catClass}`;
    catTag.textContent = task.category || 'Study';
    meta.appendChild(catTag);

    // Priority Tag
    const prioTag = document.createElement('span');
    const prioClass = (task.priority || 'Low').toLowerCase();
    prioTag.className = `tag tag-${prioClass}`;
    prioTag.textContent = task.priority || 'Low';
    meta.appendChild(prioTag);

    // Time Tag
    if (task.date || task.time) {
      const timeTag = document.createElement('span');
      timeTag.className = 'tag';
      timeTag.style.background = 'rgba(255,255,255,0.06)';
      timeTag.style.color = 'var(--text-muted)';
      timeTag.textContent = `${task.date || ''} ${task.time || ''}`.trim();
      meta.appendChild(timeTag);
    }

    info.appendChild(title);
    if (task.description) info.appendChild(desc);
    info.appendChild(meta);

    left.appendChild(check);
    left.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.title = 'Edit Title/Desc';
    editBtn.innerHTML = '✏️';
    editBtn.addEventListener('click', () => openEditPrompt(task, tasksRef));

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.title = 'Delete Objective';
    delBtn.innerHTML = '🗑️';
    delBtn.addEventListener('click', async () => {
      if(confirm('Delete this task?')) await tasksRef.doc(task.id).delete();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);
    list.appendChild(item);

    // Schedule audio reminder
    scheduleIfNeeded(task, tasksRef);
  });
}

function openEditPrompt(task, tasksRef){
  const newTitle = prompt('Edit title', task.title);
  if(newTitle===null) return;
  const newDesc = prompt('Edit description', task.description||'') || '';
  tasksRef.doc(task.id).update({title:newTitle, description:newDesc});
}

function scheduleIfNeeded(task, tasksRef){
  if(!task.audioReminder) return;
  if(task.completed) return;
  if(!task.date || !task.time) return;
  const when = new Date(task.date + 'T' + task.time);
  const now = new Date();
  const delay = when - now;
  if(delay<=0) return;
  if(scheduledReminders.has(task.id)) return;
  const to = setTimeout(()=>{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('CosmoBot Reminder', { body: task.reminderMessage || ('Reminder: ' + task.title) });
    }
    const msg = task.reminderMessage || ('Reminder. ' + task.title + '.');
    if('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(msg);
      speechSynthesis.speak(u);
    }
    scheduledReminders.delete(task.id);
  }, delay);
  scheduledReminders.set(task.id, to);
}

function startClock(){
  const dt = el('date-time');
  if (!dt) return;
  function tick(){
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    dt.textContent = `${dateStr} // ${timeStr}`;
  }
  tick(); setInterval(tick,1000);
}

function initCosmoBot() {
  const widget = el('cosmobot-widget');
  const bubble = el('cosmobot-bubble');
  const chat = el('cosmobot-chat');
  const closeChat = el('close-chat');
  const chatBody = el('chat-body');
  const chatInput = el('chat-input');
  const chatSend = el('chat-send');
  const avatar = el('cosmobot-img');
  
  // Voice UI controls
  const chatMic = el('chat-mic');
  const voiceToggle = el('voice-toggle');
  const voiceStatusSpan = el('chat-voice-status');

  if (!widget) return;

  // Reveal chatbot trigger widget after landing page resolves
  widget.style.display = 'block';

  // Spin avatar on click with back-easing effect (permanently docked chat)
  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    gsap.fromTo(avatar, 
      { rotation: 0 },
      { rotation: 360, duration: 0.8, ease: 'back.out(1.2)' }
    );
  });

  // Close chat pane (guarded for docked layout compatibility)
  if (closeChat) {
    closeChat.addEventListener('click', (e) => {
      e.stopPropagation();
      chat.classList.remove('active');
      if (bubble) bubble.style.opacity = '1';
    });
  }

  // Chat actions click listeners
  const actionButtons = document.querySelectorAll('.chat-action-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      handleBotAction(action);
    });
  });

  // Chat send listeners
  chatSend.addEventListener('click', () => {
    if (isRecording) {
      shouldSendAfterStop = true;
      recognition.stop();
    } else {
      sendMessage();
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (isRecording) {
        shouldSendAfterStop = true;
        recognition.stop();
      } else {
        sendMessage();
      }
    }
  });

  // Gemini API Configuration
  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
  const activeKey = GEMINI_API_KEY;

  // We define the model list in order of preference (latest first)
  const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  let currentModelIndex = 0;
  
  // Maintain conversation history in memory
  let conversationHistory = [];

  // Speech Recognition and Speech Synthesis State
  let isRecording = false;
  let shouldSendAfterStop = false;
  let voiceStatusState = ''; // 'listening', 'processing', 'speaking', or ''
  let recognition = null;
  let voices = [];

  function updateVoiceStatus(text, stateClass) {
    voiceStatusState = stateClass;
    if (!voiceStatusSpan) return;
    
    let displayStatus = '';
    if (stateClass === 'listening') displayStatus = '🎤 Listening...';
    else if (stateClass === 'processing') displayStatus = '🧠 Thinking...';
    else if (stateClass === 'speaking') displayStatus = '🔊 Speaking...';
    
    voiceStatusSpan.textContent = displayStatus;
    voiceStatusSpan.className = 'chat-voice-status';
    if (stateClass) {
      voiceStatusSpan.classList.add(stateClass);
    }
  }

  function getBestVoice() {
    const allVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const femaleKeywords = ['zira', 'hazel', 'susan', 'female', 'google us english', 'natural'];
    const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
    
    for (const kw of femaleKeywords) {
      const found = enVoices.find(v => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }
    
    const enUS = enVoices.find(v => v.lang === 'en-US' || v.lang.replace('_', '-').startsWith('en-US'));
    if (enUS) return enUS;
    
    return enVoices[0] || null;
  }

  function speakResponse(text) {
    if (!('speechSynthesis' in window)) {
      updateVoiceStatus('', '');
      return;
    }
    
    window.speechSynthesis.cancel();
    
    if (!voiceToggle || !voiceToggle.checked) {
      updateVoiceStatus('', '');
      return;
    }
    
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getBestVoice();
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.onstart = () => {
      updateVoiceStatus('Speaking...', 'speaking');
    };
    
    utterance.onend = () => {
      if (voiceStatusState === 'speaking') {
        updateVoiceStatus('', '');
      }
    };
    
    utterance.onerror = (e) => {
      console.error('[Speech Synthesis Error]', e);
      if (voiceStatusState === 'speaking') {
        updateVoiceStatus('', '');
      }
    };
    
    window.speechSynthesis.speak(utterance);
  }

  // Populate voices dynamically
  if ('speechSynthesis' in window) {
    voices = window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
      };
    }
  }

  // Voice toggle change listener to interrupt speech immediately
  if (voiceToggle) {
    voiceToggle.addEventListener('change', () => {
      if (!voiceToggle.checked && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        if (voiceStatusState === 'speaking') {
          updateVoiceStatus('', '');
        }
      }
    });
  }

  // Initialize Speech Recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecording = true;
      if (chatMic) chatMic.classList.add('recording');
      updateVoiceStatus('Listening...', 'listening');
      chatInput.value = '';
    };

    recognition.onend = () => {
      isRecording = false;
      if (chatMic) chatMic.classList.remove('recording');
      if (shouldSendAfterStop) {
        shouldSendAfterStop = false;
        sendMessage();
      } else {
        if (voiceStatusState !== 'processing' && voiceStatusState !== 'speaking') {
          updateVoiceStatus('', '');
        }
      }
    };

    recognition.onresult = (event) => {
      let currentText = '';
      for (let i = 0; i < event.results.length; i++) {
        currentText += event.results[i][0].transcript;
      }
      if (chatInput) chatInput.value = currentText;
    };

    recognition.onerror = (event) => {
      console.error('[Speech Recognition Error Details]', event);
      if (event.error === 'not-allowed') {
        alert("Microphone permission denied. Please allow microphone access in your browser settings.");
        appendMessage("CosmoBot: Microphone permission denied. Please allow microphone access in your browser settings.", 'bot');
      } else if (event.error !== 'no-speech') {
        appendMessage(`CosmoBot: Speech recognition error: ${event.error}`, 'bot');
      }
      updateVoiceStatus('', '');
    };
  }

  // Bind microphone click events
  if (chatMic) {
    if (!recognition) {
      chatMic.style.opacity = '0.4';
      chatMic.title = 'Speech input not supported in this browser';
      chatMic.addEventListener('click', (e) => {
        e.stopPropagation();
        appendMessage("CosmoBot: Speech recognition is not supported in this browser.", 'bot');
      });
    } else {
      chatMic.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRecording) {
          shouldSendAfterStop = false;
          recognition.stop();
        } else {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          isRecording = true;
          shouldSendAfterStop = false;
          recognition.start();
        }
      });
    }
  }

  async function sendMessage(overrideText = null) {
    // Interrupt any active speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (voiceStatusState === 'speaking' || voiceStatusState === 'listening') {
      updateVoiceStatus('', '');
    }

    const text = overrideText || chatInput.value.trim();
    if (!text) return;

    if (!overrideText) {
      chatInput.value = '';
    }

    appendMessage(text, 'user');
    
    // Add user message to history
    conversationHistory.push({ role: 'user', parts: [{ text: text }] });

    // Show typing indicator with animated bouncing dots
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message bot typing-indicator';
    typingIndicator.innerHTML = `
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    chatBody.appendChild(typingIndicator);
    
    // Smooth scroll to latest
    chatBody.scrollTo({
      top: chatBody.scrollHeight,
      behavior: 'smooth'
    });

    // Show voice status: Thinking...
    updateVoiceStatus('Thinking...', 'processing');

    let success = false;
    let reply = "";
    
    while (currentModelIndex < models.length && !success) {
      const modelName = models[currentModelIndex];
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;

      console.log(`[Gemini Request] Model name: ${modelName}`);
      console.log(`[Gemini Request] Request status: SENDING`);
      console.log(`[Gemini Request] History size: ${conversationHistory.length}`);
      
      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: conversationHistory,
            systemInstruction: {
              parts: [{
                text: "You are CosmoBot, a friendly and helpful AI study companion for students. You help them learn concepts, solve homework doubts, and stay motivated. Keep your responses concise, clear, encouraging, and format them nicely using clean markdown."
              }]
            }
          })
        });

        console.log(`[Gemini Response] Response status: ${response.status}`);
        console.log(`[Gemini Response] Model used: ${modelName}`);

        if (!response.ok) {
          let errorData = null;
          try {
            errorData = await response.json();
          } catch (e) {}

          const errorMsg = errorData?.error?.message || `API returned status ${response.status}`;
          console.error("[Gemini Error] Full error details:", errorData || errorMsg);

          // If the model is not found, try the next model in the list
          if (response.status === 404 || errorMsg.toLowerCase().includes("not found") || errorMsg.toLowerCase().includes("invalid model")) {
            console.warn(`Model ${modelName} not found. Trying fallback model...`);
            currentModelIndex++;
            continue; // Loop back and try the next model
          }

          // If the API key is invalid
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            const isKeyInvalid = errorMsg.toLowerCase().includes("api key") ||
                                errorMsg.toLowerCase().includes("apikey") ||
                                errorMsg.toLowerCase().includes("key not valid") ||
                                errorMsg.toLowerCase().includes("invalid_argument") ||
                                errorMsg.toLowerCase().includes("unauthorized");
            if (isKeyInvalid) {
              typingIndicator.remove();
              appendMessage("Gemini API key invalid.", 'bot');
              updateVoiceStatus('', '');
              return;
            }
          }
          
          throw new Error(errorMsg);
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          reply = data.candidates[0].content.parts[0].text;
          console.log("[Gemini Response] Received reply of length:", reply.length);
          success = true;
        } else {
          throw new Error("Invalid response format received from Gemini API");
        }
      } catch (error) {
        console.error("[Gemini Error] Full error details:", error);
        
        // If we have tried all models, or if it is not a model-not-found error, propagate the error
        if (currentModelIndex >= models.length - 1) {
          typingIndicator.remove();
          appendMessage("CosmoBot AI is temporarily unavailable.", 'bot');
          updateVoiceStatus('', '');
          return;
        }
        
        // Try the next model
        currentModelIndex++;
      }
    }

    if (success) {
      typingIndicator.remove();
      conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
      appendMessage(reply, 'bot');
      speakResponse(reply);
    } else {
      typingIndicator.remove();
      appendMessage("CosmoBot AI is temporarily unavailable.", 'bot');
      updateVoiceStatus('', '');
    }
  }

  function appendMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `chat-message ${sender}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // Support basic markdown style rendering
    const formattedText = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    contentDiv.innerHTML = formattedText;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msg.appendChild(contentDiv);
    msg.appendChild(timeSpan);
    
    chatBody.appendChild(msg);
    
    // Smooth scroll to latest
    chatBody.scrollTo({
      top: chatBody.scrollHeight,
      behavior: 'smooth'
    });
  }

  function handleBotAction(action) {
    let promptText = '';
    if (action === 'doubts') {
      promptText = "I need help understanding a study concept. Can you explain a complex topic?";
    } else if (action === 'reminders') {
      promptText = "Give me a quick tip on study timing and reminders.";
    } else if (action === 'homework') {
      promptText = "How can you help me solve a homework problem step-by-step?";
    } else if (action === 'motivation') {
      promptText = "Give me some space-themed study motivation!";
    }

    if (promptText) {
      sendMessage(promptText);
    }
  }
}

// Start
main();
