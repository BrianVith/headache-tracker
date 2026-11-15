(function () {
  const SLOTS = [
    { key: 'morning', label: 'Morning', time: '08:00' },
    { key: 'midday', label: 'Midday', time: '13:00' },
    { key: 'evening', label: 'Evening', time: '19:00' }
  ];
  const STORAGE_KEY = 'headache-tracker-entries-v1';

  const todayLabel = document.getElementById('today-label');
  const slotsEl = document.getElementById('slots');
  const slotTemplate = document.getElementById('slot-template');
  const questionCard = document.getElementById('question-card');
  const questionSlot = document.getElementById('question-slot');
  const btnYes = document.getElementById('btn-yes');
  const btnNo = document.getElementById('btn-no');
  const btnCancel = document.getElementById('btn-cancel');
  const rangeSelect = document.getElementById('range');
  const statsSummary = document.getElementById('stats-summary');
  const historyEl = document.getElementById('history');
  const notifBtn = document.getElementById('btn-notif');
  const notifStatus = document.getElementById('notif-status');

  let activeSlotKey = null;

  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateKey(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function formatDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function todayKey() { return toDateKey(new Date()); }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
  function entryId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function getEntry(entries, dateKey, slotKey) {
    return entries.find(e => e.date === dateKey && e.slot === slotKey) || null;
  }
  function upsertEntry(dateKey, slotKey, answer) {
    const entries = loadEntries();
    const existing = getEntry(entries, dateKey, slotKey);
    const now = new Date().toISOString();
    if (existing) {
      existing.answer = answer;
      existing.recordedAt = now;
    } else {
      entries.push({ id: entryId(), date: dateKey, slot: slotKey, answer: answer, recordedAt: now });
    }
    saveEntries(entries);
  }

  function slotLabel(key) {
    const s = SLOTS.find(x => x.key === key);
    return s ? s.label : key;
  }

  function renderToday() {
    const key = todayKey();
    const entries = loadEntries();
    todayLabel.textContent = formatDateKey(key);
    slotsEl.innerHTML = '';

    SLOTS.forEach(slot => {
      const node = slotTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.slot-name').textContent = slot.label;
      node.querySelector('.slot-time').textContent = 'Around ' + slot.time;
      const statusEl = node.querySelector('.slot-status');
      const btn = node.querySelector('.slot-action');
      const entry = getEntry(entries, key, slot.key);

      if (!entry) {
        statusEl.textContent = 'Not logged yet';
        statusEl.className = 'slot-status status-none';
        btn.textContent = 'Log';
      } else if (entry.answer === 'yes') {
        statusEl.textContent = 'Headache: Yes';
        statusEl.className = 'slot-status status-yes';
        btn.textContent = 'Change';
      } else {
        statusEl.textContent = 'Headache: No';
        statusEl.className = 'slot-status status-no';
        btn.textContent = 'Change';
      }

      btn.addEventListener('click', function () { openQuestion(slot.key); });
      slotsEl.appendChild(node);
    });
  }

  function openQuestion(slotKey) {
    activeSlotKey = slotKey;
    const s = SLOTS.find(x => x.key === slotKey);
    questionSlot.textContent = (s ? s.label : slotKey) + ' check-in';
    questionCard.classList.remove('hidden');
    questionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function closeQuestion() {
    activeSlotKey = null;
    questionCard.classList.add('hidden');
  }

  btnYes.addEventListener('click', function () {
    if (!activeSlotKey) return;
    upsertEntry(todayKey(), activeSlotKey, 'yes');
    closeQuestion();
    renderToday();
    renderStats();
  });
  btnNo.addEventListener('click', function () {
    if (!activeSlotKey) return;
    upsertEntry(todayKey(), activeSlotKey, 'no');
    closeQuestion();
    renderToday();
    renderStats();
  });
  btnCancel.addEventListener('click', closeQuestion);

  function withinLastDays(dateKey, days) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = (start - dt) / (24 * 3600 * 1000);
    return diff >= 0 && diff < days;
  }

  function renderStats() {
    const days = parseInt(rangeSelect.value, 10) || 30;
    const entries = loadEntries().filter(e => withinLastDays(e.date, days));
    const total = entries.length;
    const yes = entries.filter(e => e.answer === 'yes').length;
    const no = entries.filter(e => e.answer === 'no').length;
    const uniqueDays = new Set(entries.filter(e => e.answer === 'yes').map(e => e.date)).size;

    const bySlot = {};
    SLOTS.forEach(s => bySlot[s.key] = { yes: 0, no: 0, total: 0 });
    entries.forEach(e => {
      if (!bySlot[e.slot]) bySlot[e.slot] = { yes: 0, no: 0, total: 0 };
      bySlot[e.slot].total++;
      if (e.answer === 'yes') bySlot[e.slot].yes++; else bySlot[e.slot].no++;
    });

    const cards = [
      { label: 'Logged check-ins', value: String(total) },
      { label: 'Headache = Yes', value: String(yes) },
      { label: 'Headache = No', value: String(no) },
      { label: 'Days with headache', value: String(uniqueDays) }
    ];
    statsSummary.innerHTML = cards.map(c =>
      '<div class="stat"><div class="stat-value">' + c.value + '</div><div class="stat-label">' + c.label + '</div></div>'
    ).join('') + SLOTS.map(s => {
      const b = bySlot[s.key] || { yes: 0, no: 0, total: 0 };
      return '<div class="stat"><div class="stat-value">' + b.yes + '/' + b.total + '</div><div class="stat-label">' + s.label + ' (yes/logged)</div></div>';
    }).join('');

    const recent = loadEntries().slice().sort((a, b) => {
      const ka = a.date + ' ' + (a.recordedAt || '');
      const kb = b.date + ' ' + (b.recordedAt || '');
      return kb.localeCompare(ka);
    }).slice(0, 30);

    if (recent.length === 0) {
      historyEl.innerHTML = '<p class="empty">No entries yet.</p>';
      return;
    }
    historyEl.innerHTML = recent.map(e => {
      const badgeClass = e.answer === 'yes' ? 'badge-yes' : 'badge-no';
      const answerText = e.answer === 'yes' ? 'Yes' : 'No';
      const when = e.recordedAt ? new Date(e.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="history-item"><div><strong>' + formatDateKey(e.date) + '</strong> · ' + slotLabel(e.slot) +
        (when ? ' <span class="subtle">(' + when + ')</span>' : '') +
        '</div><span class="badge ' + badgeClass + '">' + answerText + '</span></div>';
    }).join('');
  }

  rangeSelect.addEventListener('change', renderStats);

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', function () {
      const view = btn.getAttribute('data-view');
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
      if (view === 'stats') renderStats();
      if (view === 'today') renderToday();
    });
  });

  function updateNotifStatus() {
    if (!('Notification' in window)) {
      notifStatus.textContent = 'Notifications are not supported in this browser.';
      notifBtn.disabled = true;
      return;
    }
    const p = Notification.permission;
    if (p === 'granted') notifStatus.textContent = 'Notifications are enabled (best effort when the app/browser allows).';
    else if (p === 'denied') notifStatus.textContent = 'Notifications are blocked. You can change this in browser/site settings.';
    else notifStatus.textContent = 'Notifications are not enabled yet.';
  }
  notifBtn.addEventListener('click', async function () {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      updateNotifStatus();
      if (perm === 'granted') {
        new Notification('Headache Tracker', { body: 'Notifications enabled. Remember: exact-time reminders are best set as phone alarms.' });
      }
    } catch (_) { updateNotifStatus(); }
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  updateNotifStatus();
  renderToday();
  renderStats();
})();
