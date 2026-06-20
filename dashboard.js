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
  // no firebase app found — show error overlay
  const container = document.querySelector('.dashboard-container');
  const err = document.createElement('div');
  err.className = 'glass-card';
  err.style.margin = '24px';
  err.style.border = '2px dashed rgba(255,80,80,0.12)';
  err.innerHTML = '<strong>Firebase not initialized.</strong> Please ensure your existing Firebase config is loaded before this script (the login/register pages already do). Dashboard requires the existing Firebase initialization.';
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
    const mockUser = JSON.parse(localStorage.getItem('currentUser') || '{"displayName": "Cosmo Cadet", "email": "cadet@cosmobot.io", "uid": "mock_user_123"}');
    
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

let scheduledReminders = new Map();

function initForUser(user, tasksRef, onLogout){
  // UI refs
  el('user-name').textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  el('user-email').textContent = user.email || '';
  el('profile-initial').textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
  el('welcome-name').textContent = user.displayName || (user.email?user.email.split('@')[0]:'User');

  // logout
  el('logoutBtn').addEventListener('click', async ()=>{
    if (onLogout) await onLogout();
    window.location.href = 'index.html';
  });

  // date/time clock
  startClock();

  // form
  const form = el('taskForm');
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

  el('clearForm').addEventListener('click', ()=> el('taskForm').reset());

  // real-time listener
  tasksRef.orderBy('createdAt','desc').onSnapshot(snapshot=>{
    const tasks = [];
    snapshot.forEach(doc=>{
      const data = doc.data(); data.id = doc.id; tasks.push(data);
    });
    renderTasks(tasks, tasksRef);
    updateAnalytics(tasks);
  });

  // request notification permission and speak
  if('Notification' in window && Notification.permission !== 'granted'){
    Notification.requestPermission();
  }
}

function renderTasks(tasks, tasksRef){
  const list = el('tasksList');
  list.innerHTML = '';
  if(tasks.length===0){ list.textContent = 'No tasks yet.'; return; }
  tasks.forEach(task=>{
    const card = document.createElement('div'); card.className = 'task-card';
    if(task.completed) card.classList.add('completed');

    const left = document.createElement('div'); left.style.flex='1';
    const h = document.createElement('div'); h.style.display='flex'; h.style.justifyContent='space-between';
    const title = document.createElement('div'); title.textContent = task.title; title.style.fontWeight='800';
    const badge = document.createElement('div'); badge.className = 'priority-badge ' + (task.priority==='High'?'priority-high':(task.priority==='Medium'?'priority-medium':'priority-low')); badge.textContent = task.priority;
    h.appendChild(title); h.appendChild(badge);

    const desc = document.createElement('div'); desc.textContent = task.description || ''; desc.className='task-desc'; desc.style.marginTop='6px';
    const meta = document.createElement('div'); meta.className='task-meta';
    const when = (task.date || task.time) ? `${task.date||''} ${task.time||''}`.trim() : 'No date';
    meta.textContent = `${task.category || ''} • ${when}`;

    left.appendChild(h); left.appendChild(desc); left.appendChild(meta);

    const actions = document.createElement('div'); actions.className='task-actions';

    const markBtn = document.createElement('button'); markBtn.className='small-btn'; markBtn.textContent = task.completed? 'Undo':'Complete';
    markBtn.addEventListener('click', async ()=>{
      await tasksRef.doc(task.id).update({completed: !task.completed});
    });

    const editBtn = document.createElement('button'); editBtn.className='small-btn'; editBtn.textContent='Edit';
    editBtn.addEventListener('click', ()=> openEditPrompt(task, tasksRef));

    const delBtn = document.createElement('button'); delBtn.className='small-btn'; delBtn.textContent='Delete';
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Delete this task?')) return; await tasksRef.doc(task.id).delete();
    });

    actions.appendChild(markBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);

    card.appendChild(left); card.appendChild(actions);
    list.appendChild(card);

    // schedule reminder if needed
    scheduleIfNeeded(task, tasksRef);
  });
}

function openEditPrompt(task, tasksRef){
  const newTitle = prompt('Edit title', task.title);
  if(newTitle===null) return; // cancelled
  const newDesc = prompt('Edit description', task.description||'') || '';
  // For simplicity update title/desc only
  tasksRef.doc(task.id).update({title:newTitle, description:newDesc});
}

function scheduleIfNeeded(task, tasksRef){
  if(!task.audioReminder) return;
  if(task.completed) return;
  if(!task.date || !task.time) return;
  const when = new Date(task.date + 'T' + task.time);
  const now = new Date();
  const delay = when - now;
  if(delay<=0) return; // time passed
  if(scheduledReminders.has(task.id)) return; // already scheduled
  const to = setTimeout(()=>{
    // show notification
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('CosmoBot Reminder', { body: task.reminderMessage || ('Reminder: ' + task.title) });
    }
    // speak
    const msg = task.reminderMessage || ('Reminder. ' + task.title + '.');
    if('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(msg);
      speechSynthesis.speak(u);
    }
    scheduledReminders.delete(task.id);
  }, delay);
  scheduledReminders.set(task.id, to);
}

function updateAnalytics(tasks){
  const total = tasks.length;
  const completed = tasks.filter(t=>t.completed).length;
  const pending = total - completed;
  const today = tasks.filter(t=>{
    if(!t.date) return false;
    const d = new Date(t.date);
    const now = new Date();
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  }).length;
  el('totalTasks').textContent = total;
  el('completedTasks').textContent = completed;
  el('pendingTasks').textContent = pending;
  el('todayTasks').textContent = today;
}

function startClock(){
  const dt = el('date-time');
  function tick(){
    const now = new Date();
    dt.textContent = now.toLocaleString();
  }
  tick(); setInterval(tick,1000);
}

// start
main();
