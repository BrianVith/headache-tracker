(function () {
  const SLOTS = [
    { key: 'morning', label: 'Morgen', time: '08:00', hour: 8, minute: 0, notifId: 1001 },
    { key: 'midday', label: 'Middag', time: '13:00', hour: 13, minute: 0, notifId: 1002 },
    { key: 'evening', label: 'Aften', time: '19:00', hour: 19, minute: 0, notifId: 1003 }
  ];
  const STORAGE_KEY = 'headache-tracker-entries-v1';
  const SCHEDULE_KEY = 'headache-tracker-reminders-scheduled-v1';

  const todayLabel = document.getElementById('today-label');
  const slotsEl = document.getElementById('slots');
  const slotTemplate = document.getElementById('slot-template');
  const questionCard = document.getElementById('question-card');
  const questionSlot = document.getElementById('question-slot');
  const questionProgress = document.getElementById('question-progress');
  const questionText = document.getElementById('question-text');
  const questionOptions = document.getElementById('question-options');
  const btnBack = document.getElementById('btn-back');
  const btnCancel = document.getElementById('btn-cancel');
  const rangeSelect = document.getElementById('range');
  const statsSummary = document.getElementById('stats-summary');
  const historyEl = document.getElementById('history');
  const notifBtn = document.getElementById('btn-notif');
  const notifStatus = document.getElementById('notif-status');
  const notifTestBtn = document.getElementById('btn-test-notif');
  const notifTestStatus = document.getElementById('notif-test-status');

  let activeSlotKey = null;
  let formDraft = null;
  let currentStepKey = null;

  function getCapacitor() { return window.Capacitor || null; }
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
    return dt.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function todayKey() { return toDateKey(new Date()); }

  function normalizeEntry(e) {
    if (!e || typeof e !== 'object') return null;
    const out = Object.assign({}, e);
    if (!out.headache) {
      if (out.answer === 'yes') out.headache = 'ja';
      else if (out.answer === 'no') out.headache = 'nej';
      else out.headache = null;
    }
    if (out.headache !== 'ja' && out.headache !== 'nej') out.headache = null;
    if (out.headache === 'ja') {
      const sev = parseInt(out.severity, 10);
      out.severity = (sev >= 1 && sev <= 5) ? sev : null;
    } else {
      out.severity = null;
    }
    if (out.atWork !== 'ja' && out.atWork !== 'nej') out.atWork = null;
    if (out.atWork === 'ja') {
      out.workType = (out.workType === 'moeder' || out.workType === 'skaermarbejde') ? out.workType : null;
      out.glasses = (out.glasses === 'ja' || out.glasses === 'nej') ? out.glasses : null;
    } else {
      out.workType = null;
      out.glasses = null;
    }
    return out;
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.map(normalizeEntry).filter(Boolean);
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
  function upsertEntry(dateKey, slotKey, data) {
    const entries = loadEntries();
    const existing = getEntry(entries, dateKey, slotKey);
    const now = new Date().toISOString();
    const payload = {
      headache: data.headache,
      severity: data.severity,
      atWork: data.atWork,
      workType: data.workType,
      glasses: data.glasses,
      // legacy compatibility
      answer: data.headache === 'ja' ? 'yes' : 'no'
    };
    if (existing) {
      Object.assign(existing, payload, { recordedAt: now });
    } else {
      entries.push(Object.assign({ id: entryId(), date: dateKey, slot: slotKey, recordedAt: now }, payload));
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

  function computeSteps(draft) {
    const steps = ['headache'];
    if (draft.headache === 'ja') steps.push('severity');
    steps.push('atWork');
    if (draft.atWork === 'ja') {
      steps.push('workType');
      steps.push('glasses');
    }
    return steps;
  }

  function stepConfig(key) {
    if (key === 'headache') {
      return { text: 'Har du hovedpine?', type: 'choices', layout: 'two-col', options: [
        { value: 'ja', label: 'Ja', cls: 'btn-yes' },
        { value: 'nej', label: 'Nej', cls: 'btn-no' }
      ]};
    }
    if (key === 'severity') {
      return { text: 'Hvor stærk er hovedpinen? (1-5)', type: 'scale', layout: 'scale', options: [1,2,3,4,5].map(n => ({ value: n, label: String(n), cls: 'btn-option btn-scale' })) };
    }
    if (key === 'atWork') {
      return { text: 'Var du på arbejde i dag?', type: 'choices', layout: 'two-col', options: [
        { value: 'ja', label: 'Ja', cls: 'btn-option' },
        { value: 'nej', label: 'Nej', cls: 'btn-option' }
      ]};
    }
    if (key === 'workType') {
      return { text: 'Har du haft flest møder eller mest skærmarbejde?', type: 'choices', layout: '', options: [
        { value: 'moeder', label: 'Flest møder', cls: 'btn-option' },
        { value: 'skaermarbejde', label: 'Mest skærmarbejde', cls: 'btn-option' }
      ]};
    }
    if (key === 'glasses') {
      return { text: 'Har du husket at bruge dine skærmbriller?', type: 'choices', layout: 'two-col', options: [
        { value: 'ja', label: 'Ja', cls: 'btn-option' },
        { value: 'nej', label: 'Nej', cls: 'btn-option' }
      ]};
    }
    return { text: '', options: [] };
  }

  function isDraftComplete(draft) {
    if (draft.headache !== 'ja' && draft.headache !== 'nej') return false;
    if (draft.headache === 'ja' && !(draft.severity >= 1 && draft.severity <= 5)) return false;
    if (draft.atWork !== 'ja' && draft.atWork !== 'nej') return false;
    if (draft.atWork === 'ja') {
      if (draft.workType !== 'moeder' && draft.workType !== 'skaermarbejde') return false;
      if (draft.glasses !== 'ja' && draft.glasses !== 'nej') return false;
    }
    return true;
  }

  function renderQuestionStep() {
    if (!formDraft || !currentStepKey) return;
    const steps = computeSteps(formDraft);
    const idx = Math.max(0, steps.indexOf(currentStepKey));
    const cfg = stepConfig(currentStepKey);
    questionProgress.textContent = 'Trin ' + (idx + 1) + ' af ' + steps.length;
    questionText.textContent = cfg.text;
    questionOptions.innerHTML = '';
    questionOptions.className = 'options' + (cfg.layout ? ' ' + cfg.layout : '');

    const currentVal = formDraft[currentStepKey];
    cfg.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (opt.cls || 'btn-option');
      btn.textContent = opt.label;
      if (currentVal === opt.value) btn.classList.add('selected');
      btn.addEventListener('click', function () { onAnswer(currentStepKey, opt.value); });
      questionOptions.appendChild(btn);
    });

    btnBack.disabled = idx === 0;
  }

  function onAnswer(stepKey, value) {
    if (!formDraft) return;
    formDraft[stepKey] = value;
    // clear dependent fields when prerequisites change
    if (stepKey === 'headache' && value === 'nej') formDraft.severity = null;
    if (stepKey === 'atWork' && value === 'nej') { formDraft.workType = null; formDraft.glasses = null; }

    const steps = computeSteps(formDraft);
    const idx = steps.indexOf(stepKey);
    const next = (idx >= 0 && idx < steps.length - 1) ? steps[idx + 1] : null;
    if (next) {
      currentStepKey = next;
      renderQuestionStep();
    } else if (isDraftComplete(formDraft)) {
      upsertEntry(todayKey(), activeSlotKey, formDraft);
      closeQuestion();
      renderToday();
      renderStats();
    } else {
      // should not happen, but re-render to show current state
      currentStepKey = steps[steps.length - 1] || stepKey;
      renderQuestionStep();
    }
  }

  function openQuestion(slotKey) {
    activeSlotKey = slotKey;
    const s = SLOTS.find(x => x.key === slotKey);
    questionSlot.textContent = (s ? s.label : slotKey) + ' check-in';
    const existing = normalizeEntry(getEntry(loadEntries(), todayKey(), slotKey) || {});
    formDraft = {
      headache: existing && (existing.headache === 'ja' || existing.headache === 'nej') ? existing.headache : null,
      severity: existing ? existing.severity : null,
      atWork: existing && (existing.atWork === 'ja' || existing.atWork === 'nej') ? existing.atWork : null,
      workType: existing ? existing.workType : null,
      glasses: existing ? existing.glasses : null
    };
    currentStepKey = 'headache';
    questionCard.classList.remove('hidden');
    renderQuestionStep();
    questionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeQuestion() {
    activeSlotKey = null;
    formDraft = null;
    currentStepKey = null;
    questionCard.classList.add('hidden');
  }

  btnBack.addEventListener('click', function () {
    if (!formDraft || !currentStepKey) return;
    const steps = computeSteps(formDraft);
    const idx = steps.indexOf(currentStepKey);
    if (idx > 0) {
      currentStepKey = steps[idx - 1];
      renderQuestionStep();
    }
  });
  btnCancel.addEventListener('click', closeQuestion);

  function renderToday() {
    const key = todayKey();
    const entries = loadEntries();
    todayLabel.textContent = formatDateKey(key);
    slotsEl.innerHTML = '';

    SLOTS.forEach(slot => {
      const node = slotTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.slot-name').textContent = slot.label;
      node.querySelector('.slot-time').textContent = slot.time;
      const statusEl = node.querySelector('.slot-status');
      const extraEl = node.querySelector('.slot-extra');
      const btn = node.querySelector('.slot-action');
      const entry = normalizeEntry(getEntry(entries, key, slot.key));

      extraEl.innerHTML = '';
      extraEl.className = 'slot-extra subtle';

      if (!entry || (entry.headache !== 'ja' && entry.headache !== 'nej')) {
        statusEl.textContent = 'Ikke registreret';
        statusEl.className = 'slot-status status-none';
        btn.textContent = 'Log';
      } else {
        if (entry.headache === 'ja') {
          statusEl.textContent = 'Hovedpine: Ja' + (entry.severity ? ' (' + entry.severity + '/5)' : '');
          statusEl.className = 'slot-status status-yes';
        } else {
          statusEl.textContent = 'Hovedpine: Nej';
          statusEl.className = 'slot-status status-no';
        }

        const lines = [];
        if (entry.atWork === 'ja' || entry.atWork === 'nej') {
          lines.push('Arbejde: ' + (entry.atWork === 'ja' ? 'Ja' : 'Nej'));
        }
        if (entry.atWork === 'ja' && (entry.glasses === 'ja' || entry.glasses === 'nej')) {
          lines.push('Skærmbriller: ' + (entry.glasses === 'ja' ? 'Ja' : 'Nej'));
        }
        if (lines.length) extraEl.innerHTML = lines.join('<br>');
        btn.textContent = 'Ret';
      }

      btn.addEventListener('click', function () { openQuestion(slot.key); });
      slotsEl.appendChild(node);
    });
  }

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
    const entries = loadEntries().map(normalizeEntry).filter(e => e && withinLastDays(e.date, days));
    const total = entries.length;
    const headacheYes = entries.filter(e => e.headache === 'ja');
    const yes = headacheYes.length;
    const no = entries.filter(e => e.headache === 'nej').length;
    const uniqueDays = new Set(headacheYes.map(e => e.date)).size;
    const sevVals = headacheYes.map(e => e.severity).filter(v => v >= 1 && v <= 5);
    const avgSev = sevVals.length ? (sevVals.reduce((a,b)=>a+b,0) / sevVals.length) : null;
    const atWorkYes = entries.filter(e => e.atWork === 'ja').length;
    const meetings = entries.filter(e => e.atWork === 'ja' && e.workType === 'moeder').length;
    const screens = entries.filter(e => e.atWork === 'ja' && e.workType === 'skaermarbejde').length;
    const glassesYes = entries.filter(e => e.atWork === 'ja' && e.glasses === 'ja').length;

    const cards = [
      { label: 'Registreringer', value: String(total) },
      { label: 'Hovedpine = Ja', value: String(yes) },
      { label: 'Hovedpine = Nej', value: String(no) },
      { label: 'Dage med hovedpine', value: String(uniqueDays) },
      { label: 'Gns. styrke (1-5)', value: avgSev ? avgSev.toFixed(1) : '-' },
      { label: 'På arbejde (Ja)', value: String(atWorkYes) },
      { label: 'Flest møder / skærm', value: meetings + ' / ' + screens },
      { label: 'Skærmbriller brugt', value: String(glassesYes) }
    ];
    statsSummary.innerHTML = cards.map(c =>
      '<div class="stat"><div class="stat-value">' + c.value + '</div><div class="stat-label">' + c.label + '</div></div>'
    ).join('');

    const recent = loadEntries().map(normalizeEntry).filter(Boolean).slice().sort((a, b) => {
      const ka = a.date + ' ' + (a.recordedAt || '');
      const kb = b.date + ' ' + (b.recordedAt || '');
      return kb.localeCompare(ka);
    }).slice(0, 30);

    if (recent.length === 0) {
      historyEl.innerHTML = '<p class="empty">Ingen registreringer endnu.</p>';
      return;
    }
    historyEl.innerHTML = recent.map(e => {
      const hasHeadache = e.headache === 'ja';
      const badgeClass = hasHeadache ? 'badge-yes' : (e.headache === 'nej' ? 'badge-no' : 'badge-none');
      const answerText = hasHeadache ? ('Ja' + (e.severity ? ' (' + e.severity + '/5)' : '')) : (e.headache === 'nej' ? 'Nej' : '-');
      const when = e.recordedAt ? new Date(e.recordedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '';
      const details = [];
      if (e.atWork === 'ja') {
        details.push('Arbejde: Ja');
        if (e.workType === 'moeder') details.push('Flest møder');
        else if (e.workType === 'skaermarbejde') details.push('Mest skærmarbejde');
        if (e.glasses === 'ja') details.push('Skærmbriller: Ja');
        else if (e.glasses === 'nej') details.push('Skærmbriller: Nej');
      } else if (e.atWork === 'nej') {
        details.push('Arbejde: Nej');
      }
      return '<div class="history-item"><div><strong>' + formatDateKey(e.date) + '</strong> · ' + slotLabel(e.slot) +
        (when ? ' <span class="subtle">(' + when + ')</span>' : '') +
        (details.length ? '<div class="history-details">' + details.join(' · ') + '</div>' : '') +
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

  function openSlotFromIntent() {
    const slot = getRequestedSlot();
    if (!slot) return;
    showTodayView();
    renderToday();
    openQuestion(slot);
    clearRequestedSlotFromUrl();
  }

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
        title: 'Hovedpine-tjek',
        body: s.label + ': Har du hovedpine? Tryk for at svare.',
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
        notifStatus.textContent = 'Notifikationer er ikke tilgængelige i denne app-version.';
        notifBtn.disabled = true;
        return;
      }
      try {
        const perm = await LN.checkPermissions();
        const granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
        if (granted) {
          notifStatus.textContent = 'Daglige påmindelser er aktiveret (08:00, 13:00, 19:00). Tryk på en påmindelse for at svare.';
        } else if (perm && perm.display === 'denied') {
          notifStatus.textContent = 'Notifikationer er blokeret. Du kan aktivere dem i Android-indstillinger.';
        } else {
          notifStatus.textContent = 'Notifikationer er ikke aktiveret endnu. Tryk nedenfor for at aktivere.';
        }
      } catch (_) {
        notifStatus.textContent = 'Tryk nedenfor for at aktivere daglige påmindelser.';
      }
      notifBtn.disabled = false;
      notifBtn.textContent = 'Aktivér daglige påmindelser';
      return;
    }

    if (!('Notification' in window)) {
      notifStatus.textContent = 'Notifikationer understøttes ikke i denne browser.';
      notifBtn.disabled = true;
      return;
    }
    const p = Notification.permission;
    if (p === 'granted') notifStatus.textContent = 'Notifikationer er aktiveret (bedst muligt i browser). For pålidelige tidspunkter, brug Android-appen eller telefonalarmer.';
    else if (p === 'denied') notifStatus.textContent = 'Notifikationer er blokeret. Du kan ændre dette i browserens/sideindstillinger.';
    else notifStatus.textContent = 'Notifikationer er ikke aktiveret endnu.';
    notifBtn.textContent = 'Aktivér notifikationer';
  }

  notifBtn.addEventListener('click', async function () {
    if (isNativeApp()) {
      const res = await scheduleDailyReminders();
      await updateNotifStatus();
      if (res && res.ok) {
        notifStatus.textContent = 'Daglige påmindelser planlagt kl. 08:00, 13:00 og 19:00.';
      } else if (res && res.reason === 'denied') {
        notifStatus.textContent = 'Tilladelse ikke givet. Tillad notifikationer i Android-indstillinger for appen.';
      } else {
        notifStatus.textContent = 'Kunne ikke planlægge påmindelser. Tillad notifikationer og prøv igen.';
      }
      return;
    }

    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      await updateNotifStatus();
      if (perm === 'granted') {
        new Notification('Headache Tracker', { body: 'Notifikationer aktiveret. For pålidelige tidspunkter, brug Android-appen eller telefonalarmer.' });
      }
    } catch (_) { await updateNotifStatus(); }
  });

  async function sendTestNotification() {
    if (notifTestStatus) notifTestStatus.textContent = '';

    if (isNativeApp()) {
      const LN = getLocalNotifications();
      if (!LN) {
        if (notifTestStatus) notifTestStatus.textContent = 'Notifikationer er ikke tilgængelige i denne app-version.';
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
          if (notifTestStatus) notifTestStatus.textContent = 'Tilladelse ikke givet. Tillad notifikationer i Android-indstillinger og prøv igen.';
          await updateNotifStatus();
          return;
        }
        const id = Math.floor(Date.now() % 100000) + 2000;
        await LN.schedule({
          notifications: [{
            id: id,
            title: 'Test-notifikation',
            body: 'Notifikationer virker på denne telefon.',
            schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            extra: { test: true }
          }]
        });
        if (notifTestStatus) notifTestStatus.textContent = 'Test-notifikation planlagt. Den burde vises om ca. 1–2 sekunder.';
        await updateNotifStatus();
      } catch (e) {
        if (notifTestStatus) notifTestStatus.textContent = 'Kunne ikke sende test-notifikation. Tjek notifikationstilladelser/indstillinger og prøv igen.';
      }
      return;
    }

    if (!('Notification' in window)) {
      if (notifTestStatus) notifTestStatus.textContent = 'Notifikationer understøttes ikke i denne browser.';
      return;
    }
    try {
      let perm = Notification.permission;
      if (perm !== 'granted') perm = await Notification.requestPermission();
      await updateNotifStatus();
      if (perm === 'granted') {
        new Notification('Test-notifikation', { body: 'Notifikationer virker i denne browser.' });
        if (notifTestStatus) notifTestStatus.textContent = 'Test-notifikation sendt.';
      } else {
        if (notifTestStatus) notifTestStatus.textContent = 'Tilladelse ikke givet. Aktivér notifikationer for at teste.';
      }
    } catch (_) {
      if (notifTestStatus) notifTestStatus.textContent = 'Kunne ikke sende test-notifikation.';
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