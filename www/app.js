(function () {
  const SLOTS = [
    { key: 'morning', label: 'Morning', time: '08:00', hour: 8, minute: 0, notifId: 1001 },
    { key: 'midday', label: 'Midday', time: '13:00', hour: 13, minute: 0, notifId: 1002 },
    { key: 'evening', label: 'Evening', time: '19:00', hour: 19, minute: 0, notifId: 1003 }
  ];
  const STORAGE_KEY = 'headache-tracker-entries-v1';
  const SCHEDULE_KEY = 'headache-tracker-reminders-scheduled-v1';

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
  const notifTestBtn = document.getElementById('btn-test-notif');
  const notifTestStatus = document.getElementById('notif-test-status');

  let activeSlotKey = null;

  function getCapacitor() {
    return window.Capacitor || null;
  }
  function isNativeApp() {
    const cap = getCapacitor();
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }
  function getLocalNotifications() {
    const cap = getCapacitor();
    return cap && cap.Plugins ? cap.Plugins.LocalNotifications : null;
  }

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

  function showTodayView() {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === 'today'));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-today'));
  }

  function getRequestedSlot() {
    try {
      const params = new URLSearchParams(window.location.search);
      let slot = params.get('slot');
      if (!slot && window.location.hash) {
        const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        slot = h.get('slot');
      }
      if (!slot) return null;
      slot = String(slot).toLowerCase();
      return SLOTS.some(s => s.key === slot) ? slot : null;
    } catch (_) { return null; }
  }

  function clearRequestedSlotFromUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('slot');
      if (url.hash) {
        const h = new URLSearchParams(url.hash.replace(/^#/, ''));
        if (h.has('slot')) {
          h.delete('slot');
          url.hash = h.toString() ? ('#' + h.toString()) : '';
        }
      }
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function openSlotFromIntent() {
    const slot = getRequestedSlot();
    if (!slot) return;
    showTodayView();
    renderToday();
    openQuestion(slot);
    clearRequestedSlotFromUrl();
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

  async function scheduleDailyReminders() {
    const LN = getLocalNotifications();
    if (!LN) return { ok: false, reason: 'unavailable' };
    try {
      const perm = await LN.requestPermissions();
      const granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
      if (!granted) return { ok: false, reason: 'denied' };

      try { await LN.cancel({ notifications: SLOTS.map(s => ({ id: s.notifId })) }); } catch (_) {}

      const notifications = SLOTS.map(s => ({
        id: s.notifId,
        title: 'Headache check-in',
        body: s.label + ': Are you experiencing a headache?',
        schedule: { on: { hour: s.hour, minute: s.minute }, allowWhileIdle: true },
        extra: { slot: s.key },
        smallIcon: 'ic_stat_icon_config_sample',
        actionTypeId: '',
        sound: undefined
      }));
      await LN.schedule({ notifications });
      localStorage.setItem(SCHEDULE_KEY, '1');
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'error' };
    }
  }

  async function setupNativeNotifications() {
    const LN = getLocalNotifications();
    if (!LN) return;
    try {
      const perm = await LN.checkPermissions();
      const granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
      if (granted) await scheduleDailyReminders();

      LN.addListener('localNotificationActionPerformed', function (event) {
        const slot = event && event.notification && event.notification.extra ? event.notification.extra.slot : null;
        if (slot && SLOTS.some(s => s.key === slot)) {
          showTodayView();
          renderToday();
          openQuestion(slot);
        }
      });
    } catch (_) {}
  }

  async function updateNotifStatus() {
    if (isNativeApp()) {
      const LN = getLocalNotifications();
      if (!LN) {
        notifStatus.textContent = 'Notifications are not available in this app build.';
        notifBtn.disabled = true;
        return;
      }
      try {
        const perm = await LN.checkPermissions();
        const granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
        if (granted) {
          notifStatus.textContent = 'Daily reminders are enabled (08:00, 13:00, 19:00). Tapping a reminder opens that check-in.';
        } else if (perm && perm.display === 'denied') {
          notifStatus.textContent = 'Notifications are blocked. You can enable them in Android app settings.';
        } else {
          notifStatus.textContent = 'Notifications are not enabled yet. Tap below to enable daily reminders.';
        }
      } catch (_) {
        notifStatus.textContent = 'Tap below to enable daily reminders.';
      }
      notifBtn.disabled = false;
      notifBtn.textContent = 'Enable daily reminders';
      return;
    }

    if (!('Notification' in window)) {
      notifStatus.textContent = 'Notifications are not supported in this browser.';
      notifBtn.disabled = true;
      return;
    }
    const p = Notification.permission;
    if (p === 'granted') notifStatus.textContent = 'Notifications are enabled (best effort in browser). For reliable times, use phone alarms or the Android app.';
    else if (p === 'denied') notifStatus.textContent = 'Notifications are blocked. You can change this in browser/site settings.';
    else notifStatus.textContent = 'Notifications are not enabled yet.';
    notifBtn.textContent = 'Enable notifications';
  }

  notifBtn.addEventListener('click', async function () {
    if (isNativeApp()) {
      const res = await scheduleDailyReminders();
      await updateNotifStatus();
      if (res && res.ok) {
        notifStatus.textContent = 'Daily reminders scheduled for 08:00, 13:00, and 19:00.';
      } else if (res && res.reason === 'denied') {
        notifStatus.textContent = 'Permission not granted. Please allow notifications in Android settings for this app.';
      } else {
        notifStatus.textContent = 'Could not schedule reminders. Please allow notifications and try again.';
      }
      return;
    }

    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      await updateNotifStatus();
      if (perm === 'granted') {
        new Notification('Headache Tracker', { body: 'Notifications enabled. For reliable exact-time reminders, use the Android app or phone alarms.' });
      }
    } catch (_) { await updateNotifStatus(); }
  });

  async function sendTestNotification() {
    if (notifTestStatus) notifTestStatus.textContent = '';

    if (isNativeApp()) {
      const LN = getLocalNotifications();
      if (!LN) {
        if (notifTestStatus) notifTestStatus.textContent = 'Notifications are not available in this app build.';
        return;
      }
      try {
        let perm = await LN.checkPermissions();
        let granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
        if (!granted) {
          perm = await LN.requestPermissions();
          granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
        }
        if (!granted) {
          if (notifTestStatus) notifTestStatus.textContent = 'Permission not granted. Allow notifications in Android settings, then try again.';
          await updateNotifStatus();
          return;
        }
        const id = Math.floor(Date.now() % 100000) + 2000;
        await LN.schedule({
          notifications: [{
            id: id,
            title: 'Headache Tracker test',
            body: 'Notifications are working on this phone.',
            schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            extra: { test: true }
          }]
        });
        if (notifTestStatus) notifTestStatus.textContent = 'Test notification scheduled. It should appear in about 1–2 seconds.';
        await updateNotifStatus();
      } catch (e) {
        if (notifTestStatus) notifTestStatus.textContent = 'Could not send test notification. Check notification permission/settings and try again.';
      }
      return;
    }

    if (!('Notification' in window)) {
      if (notifTestStatus) notifTestStatus.textContent = 'Notifications are not supported in this browser.';
      return;
    }
    try {
      let perm = Notification.permission;
      if (perm !== 'granted') perm = await Notification.requestPermission();
      await updateNotifStatus();
      if (perm === 'granted') {
        new Notification('Headache Tracker test', { body: 'Notifications are working in this browser.' });
        if (notifTestStatus) notifTestStatus.textContent = 'Test notification sent.';
      } else {
        if (notifTestStatus) notifTestStatus.textContent = 'Permission not granted. Enable notifications to test.';
      }
    } catch (_) {
      if (notifTestStatus) notifTestStatus.textContent = 'Could not send test notification.';
    }
  }

  if (notifTestBtn) {
    notifTestBtn.addEventListener('click', sendTestNotification);
  }

  // Register service worker (web/PWA only)
  if (!isNativeApp() && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  // Initialize
  renderToday();
  renderStats();
  updateNotifStatus();
  openSlotFromIntent();
  if (isNativeApp()) {
    setupNativeNotifications();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') openSlotFromIntent();
  });
  window.addEventListener('focus', openSlotFromIntent);
})();
