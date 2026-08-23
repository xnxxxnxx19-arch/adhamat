/* ============================================================================
   hub.js — نقطة الربط المشتركة بين كل تطبيقات البرنامج
   ----------------------------------------------------------------------------
   كل التطبيقات مفتوحة كـ iframes جوه index.html من نفس الأصل (origin)، يعني
   كلها فعليًا بتشوف نفس localStorage. الملف ده بيعرّف مخزن مشترك واحد
   (program_hub_v1) وواجهة بسيطة (window.HUB) عشان أي تطبيق يقدر:
     - يبعت بيانات (كلمات / أكواد / لغات / مشاريع / تنبيهات) للمخزن المشترك
     - يقرأ كل البيانات اللي بعتتها باقي التطبيقات
     - يشترك في تحديثات لحظية لما أي تطبيق تاني يضيف حاجة

   التحديث اللحظي بيتم بطريقتين مع بعض:
     1) حدث "storage" الطبيعي في المتصفح: بيتفعل تلقائيًا في كل iframe التاني
        (مش في اللي عمل التعديل نفسه) لما localStorage يتغيّر — مفيش حاجة
        إضافية مطلوبة عشانه، هو خاصية أصلية في المتصفح.
     2) CustomEvent محلي ('hub:update') عشان نفس الصفحة اللي كتبت التحديث
        تقدر تحدّث واجهتها هي كمان فورًا من غير ما تستنى حدث storage.
   ============================================================================ */
(function (global) {
  var HUB_KEY = 'program_hub_v1';
  var EVT = 'hub:update';

  function emptyData() {
    return { words: [], codes: [], languages: [], projects: [], alerts: [], goals: [], plans: [], achievements: [], logs: [], theme: 'ocean' };
  }

  function load() {
    try {
      var raw = localStorage.getItem(HUB_KEY);
      var data = raw ? JSON.parse(raw) : emptyData();
      return {
        words: Array.isArray(data.words) ? data.words : [],
        codes: Array.isArray(data.codes) ? data.codes : [],
        languages: Array.isArray(data.languages) ? data.languages : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        goals: Array.isArray(data.goals) ? data.goals : [],
        plans: Array.isArray(data.plans) ? data.plans : [],
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        logs: Array.isArray(data.logs) ? data.logs : [],
        theme: data.theme || 'ocean'
      };
    } catch (e) {
      return emptyData();
    }
  }

  function persist(data) {
    try { localStorage.setItem(HUB_KEY, JSON.stringify(data)); } catch (e) {}
    try { global.dispatchEvent(new CustomEvent(EVT, { detail: data })); } catch (e) {}
    // لو التطبيق شغال جوه iframe في index.html، نبلّغ الأب فورًا (أسرع من انتظار storage)
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ type: 'HUB_DATA_UPDATE' }, '*');
      }
    } catch (e) {}
  }

  function upsert(arr, item, keyFn) {
    var k = keyFn(item);
    var idx = -1;
    for (var i = 0; i < arr.length; i++) { if (keyFn(arr[i]) === k) { idx = i; break; } }
    if (idx === -1) { arr.push(item); return true; }
    arr[idx] = Object.assign({}, arr[idx], item);
    return false;
  }

  function rid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------- كلمات (English / Vocab) ---------------- */
  function addWords(words, source) {
    if (!words) return 0;
    if (!Array.isArray(words)) words = [words];
    var data = load(), added = 0;
    words.forEach(function (w) {
      if (!w || !String(w.term || '').trim()) return;
      var entry = {
        id: w.id || rid('word'),
        term: String(w.term).trim(),
        meaning: String(w.meaning || '').trim(),
        example: String(w.example || '').trim(),
        section: w.section || '',
        source: source || w.source || 'unknown',
        addedAt: Date.now()
      };
      var isNew = upsert(data.words, entry, function (x) { return String(x.term || '').trim().toLowerCase(); });
      if (isNew) added++;
    });
    if (added) persist(data);
    return added;
  }

  /* ---------------- أكواد / مذكرات (Code Library / Editor) ---------------- */
  function addCode(entry, source) {
    var data = load();
    var e = {
      id: entry.id || rid('code'),
      title: entry.title || 'بدون عنوان',
      language: entry.language || entry.lang || '',
      summary: entry.summary || '',
      source: source || entry.source || 'unknown',
      addedAt: Date.now()
    };
    upsert(data.codes, e, function (x) { return x.title + '::' + x.source; });
    persist(data);
    return e;
  }

  // يستبدل كل الأكواد الجاية من مصدر معيّن بقائمة محدّثة (مفيد للمزامنة الكاملة عند كل حفظ)
  function syncCodes(list, source) {
    var data = load();
    data.codes = data.codes.filter(function (c) { return c.source !== source; });
    (list || []).forEach(function (item) {
      data.codes.push({
        id: item.id || rid('code'),
        title: item.title || 'بدون عنوان',
        language: item.language || '',
        summary: item.summary || '',
        source: source,
        addedAt: Date.now()
      });
    });
    persist(data);
  }

  /* ---------------- لغات برمجة جديدة ---------------- */
  function addLanguage(name, source) {
    if (!name || !String(name).trim()) return false;
    var data = load();
    var isNew = upsert(
      data.languages,
      { name: String(name).trim(), source: source || 'unknown', addedAt: Date.now() },
      function (x) { return String(x.name || '').trim().toLowerCase(); }
    );
    if (isNew) persist(data);
    return isNew;
  }

  /* ---------------- مشاريع ---------------- */
  function addProject(entry, source) {
    var data = load();
    var e = {
      id: entry.id || rid('proj'),
      name: entry.name || 'بدون اسم',
      note: entry.note || '',
      source: source || entry.source || 'unknown',
      addedAt: Date.now()
    };
    upsert(data.projects, e, function (x) { return x.name + '::' + x.source; });
    persist(data);
    return e;
  }

  function syncProjects(list, source) {
    var data = load();
    data.projects = data.projects.filter(function (p) { return p.source !== source; });
    (list || []).forEach(function (item) {
      data.projects.push({
        id: item.id || rid('proj'),
        name: item.name || 'بدون اسم',
        note: item.note || '',
        source: source,
        addedAt: Date.now()
      });
    });
    persist(data);
  }

  /* ---------------- تنبيهات (زي نقص مخزون الورشة) ---------------- */
  function addAlert(alert) {
    var data = load();
    var a = {
      id: alert.id || rid('alert'),
      level: alert.level || 'info', // info | warning | critical
      title: alert.title || 'تنبيه',
      message: alert.message || '',
      source: alert.source || 'unknown',
      key: alert.key || null,
      at: Date.now(),
      resolved: false,
      read: false
    };
    var dupe = data.alerts.some(function (x) {
      return !x.resolved && x.source === a.source && x.key && a.key && x.key === a.key;
    });
    if (dupe) return false;
    data.alerts.unshift(a);
    data.alerts = data.alerts.slice(0, 200);
    persist(data);
    return true;
  }

  // يزامن كل التنبيهات النشطة الجاية من مصدر معيّن دفعة واحدة (الأنسب لتنبيهات نقص المخزون
  // اللي بتتغيّر كل ما يتغيّر رقم الكمية): بيقفل القديم اللي معادش موجود، ويضيف الجديد بس.
  function syncAlertsForSource(source, activeAlerts) {
    var data = load();
    var activeKeys = {};
    (activeAlerts || []).forEach(function (a) { activeKeys[a.key] = true; });
    data.alerts.forEach(function (a) {
      if (a.source === source && a.key && !activeKeys[a.key] && !a.resolved) a.resolved = true;
    });
    (activeAlerts || []).forEach(function (a) {
      var existing = data.alerts.some(function (x) { return x.source === source && x.key === a.key && !x.resolved; });
      if (!existing) {
        data.alerts.unshift({
          id: rid('alert'),
          level: a.level || 'warning',
          title: a.title || 'تنبيه',
          message: a.message || '',
          source: source,
          key: a.key,
          at: Date.now(),
          resolved: false,
          read: false
        });
      }
    });
    data.alerts = data.alerts.slice(0, 200);
    persist(data);
  }

  function markAlertRead(id) {
    var data = load();
    var a = data.alerts.find(function (x) { return x.id === id; });
    if (a) { a.read = true; persist(data); }
  }

  /* ============================================================================
     سجلّات رقمية عامة (وزن الجسم / وقت مذاكرة / صفحات قراءة / تجارب مكوّنات /
     تسجيل أجهزة جديدة / دروس مرور وقيادة / تدريب برمجي ... إلخ).
     كل تطبيق (أو مركز القيادة نفسه) يقدر يسجّل أي رقم بنوع محدد، وبعدين
     الأهداف (خصوصًا من نوع "مدى" أو "وقت") بتتغذى تلقائيًا من هذه السجلات.
     ============================================================================ */
  var LOG_TYPES = {
    weight:               { label: 'وزن الجسم',            unit: 'كجم',   icon: '⚖️', direction: 'down' },
    study_minutes:        { label: 'وقت المذاكرة',          unit: 'دقيقة', icon: '📚', direction: 'up' },
    reading_pages:        { label: 'صفحات القراءة',         unit: 'صفحة', icon: '📖', direction: 'up' },
    coding_minutes:       { label: 'وقت التدريب البرمجي',    unit: 'دقيقة', icon: '💻', direction: 'up' },
    component_test:       { label: 'تجربة على مكوّن',        unit: 'تجربة', icon: '🔬', direction: 'up' },
    equipment_registered: { label: 'جهاز جديد مسجّل',        unit: 'جهاز', icon: '🖥️', direction: 'up' },
    driving_lesson:       { label: 'درس مرور / قيادة',       unit: 'درس',  icon: '🚗', direction: 'up' },
    workout_minutes:      { label: 'وقت رياضة',             unit: 'دقيقة', icon: '🏃', direction: 'up' },
    water_glasses:        { label: 'أكواب مياه',            unit: 'كوب',  icon: '💧', direction: 'up' },
    sleep_hours:          { label: 'ساعات النوم',           unit: 'ساعة', icon: '🌙', direction: 'up' },
    custom:               { label: 'نوع مخصص',              unit: '',     icon: '✦', direction: 'up' }
  };

  function addLog(entry, source) {
    if (!entry) return null;
    var data = load();
    var e = {
      id: rid('log'),
      type: entry.type || 'custom',
      label: entry.label || (LOG_TYPES[entry.type] || {}).label || entry.type,
      value: Number(entry.value) || 0,
      unit: entry.unit || (LOG_TYPES[entry.type] || {}).unit || '',
      note: entry.note || '',
      source: source || entry.source || 'unknown',
      at: Date.now()
    };
    data.logs.unshift(e);
    data.logs = data.logs.slice(0, 1000);
    evaluateGoals(data);
    persist(data);
    return e;
  }

  function removeLog(id) {
    var data = load();
    data.logs = data.logs.filter(function (l) { return l.id !== id; });
    persist(data);
  }

  function getLogs(type) {
    var data = load();
    var list = type ? data.logs.filter(function (l) { return l.type === type; }) : data.logs.slice();
    return list.slice().sort(function (a, b) { return a.at - b.at; });
  }

  function getLatestLog(type) {
    var list = getLogs(type);
    return list.length ? list[list.length - 1] : null;
  }

  function getLogSummary(type) {
    var list = getLogs(type);
    var total = list.reduce(function (s, l) { return s + l.value; }, 0);
    return {
      count: list.length,
      total: total,
      avg: list.length ? total / list.length : 0,
      first: list.length ? list[0] : null,
      latest: list.length ? list[list.length - 1] : null
    };
  }

  /* ============================================================================
     أهداف عامة بأربعة أنواع:
       - counter   : عدّاد تراكمي مبني على إحصائية جاهزة (كلمات/أكواد/لغات/مشاريع/نشاطات) — النوع الأصلي.
       - range     : مدى رقمي بين قيمة بداية وقيمة هدف (مثال: نزول الوزن من 90 إلى 80 كجم قبل تاريخ معيّن).
       - time      : وقت متراكم من نوع سجل معيّن (مثال: 20 ساعة مذاكرة، أو 600 دقيقة تدريب برمجي).
       - checklist : قائمة عناصر يتم إنجازها واحدًا واحدًا (مثال: قائمة كتب، أو تجارب مطلوبة على مكوّنات).
     ============================================================================ */
  function addGoal(goal) {
    var data = load();
    var g = {
      id: goal.id || rid('goal'),
      kind: 'counter',
      title: goal.title || 'هدف جديد',
      metric: goal.metric || 'words', // words | codes | languages | projects | activities
      target: Number(goal.target) || 10,
      createdAt: Date.now(),
      completedAt: null
    };
    data.goals.push(g);
    evaluateGoals(data);
    persist(data);
    return g;
  }

  function addRangeGoal(goal) {
    var data = load();
    var g = {
      id: rid('goal'),
      kind: 'range',
      title: goal.title || 'هدف رقمي جديد',
      logType: goal.logType || 'weight',
      startValue: Number(goal.startValue) || 0,
      targetValue: Number(goal.targetValue) || 0,
      unit: goal.unit || (LOG_TYPES[goal.logType] || {}).unit || '',
      direction: goal.direction || (LOG_TYPES[goal.logType] || {}).direction || (Number(goal.targetValue) < Number(goal.startValue) ? 'down' : 'up'),
      deadline: goal.deadline || null,
      createdAt: Date.now(),
      completedAt: null
    };
    data.goals.push(g);
    evaluateGoals(data);
    persist(data);
    return g;
  }

  function addTimeGoal(goal) {
    var data = load();
    var g = {
      id: rid('goal'),
      kind: 'time',
      title: goal.title || 'هدف وقت جديد',
      logType: goal.logType || 'study_minutes',
      target: Number(goal.minutesTarget || goal.target) || 60,
      deadline: goal.deadline || null,
      createdAt: Date.now(),
      completedAt: null
    };
    data.goals.push(g);
    evaluateGoals(data);
    persist(data);
    return g;
  }

  function addChecklistGoal(goal) {
    var data = load();
    var items = (goal.items || []).map(function (t) {
      return { id: rid('item'), title: typeof t === 'string' ? t : (t.title || ''), done: !!(t && t.done) };
    }).filter(function (it) { return it.title.trim(); });
    var g = {
      id: rid('goal'),
      kind: 'checklist',
      title: goal.title || 'قائمة جديدة',
      items: items,
      createdAt: Date.now(),
      completedAt: null
    };
    data.goals.push(g);
    evaluateGoals(data);
    persist(data);
    return g;
  }

  function addChecklistItem(goalId, title) {
    if (!title || !String(title).trim()) return;
    var data = load();
    var g = data.goals.find(function (x) { return x.id === goalId; });
    if (!g || g.kind !== 'checklist') return;
    if (!Array.isArray(g.items)) g.items = [];
    g.items.push({ id: rid('item'), title: String(title).trim(), done: false });
    g.completedAt = null;
    evaluateGoals(data);
    persist(data);
  }

  function toggleChecklistItem(goalId, itemId) {
    var data = load();
    var g = data.goals.find(function (x) { return x.id === goalId; });
    if (!g || g.kind !== 'checklist') return;
    var it = (g.items || []).find(function (x) { return x.id === itemId; });
    if (!it) return;
    it.done = !it.done;
    evaluateGoals(data);
    persist(data);
  }

  function removeGoal(id) {
    var data = load();
    data.goals = data.goals.filter(function (g) { return g.id !== id; });
    persist(data);
  }

  function computeGoalProgress(g, data, stats) {
    if (g.kind === 'range') {
      var logs = data.logs.filter(function (l) { return l.type === g.logType; });
      var current = logs.length ? logs[logs.length - 1].value : g.startValue;
      var span = Math.abs(g.targetValue - g.startValue) || 1;
      var moved = g.direction === 'down' ? (g.startValue - current) : (current - g.startValue);
      var percent = Math.max(0, Math.min(100, Math.round((moved / span) * 100)));
      var extra = {};
      if (g.deadline) {
        var daysLeft = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
        extra.daysLeft = daysLeft;
        var remaining = g.direction === 'down' ? (current - g.targetValue) : (g.targetValue - current);
        if (daysLeft > 0 && remaining > 0) extra.pace = Math.round((remaining / daysLeft) * 100) / 100;
      }
      return { current: Math.round(current * 100) / 100, target: g.targetValue, percent: percent, done: percent >= 100, extra: extra };
    }
    if (g.kind === 'time') {
      var sum = data.logs.filter(function (l) { return l.type === g.logType; }).reduce(function (s, l) { return s + l.value; }, 0);
      var pct = g.target > 0 ? Math.max(0, Math.min(100, Math.round((sum / g.target) * 100))) : 0;
      return { current: Math.round(sum * 100) / 100, target: g.target, percent: pct, done: pct >= 100, extra: {} };
    }
    if (g.kind === 'checklist') {
      var items = g.items || [];
      var done = items.filter(function (it) { return it.done; }).length;
      var pct2 = items.length ? Math.round((done / items.length) * 100) : 0;
      return { current: done, target: items.length, percent: pct2, done: items.length > 0 && pct2 >= 100, extra: {} };
    }
    // counter (default / legacy)
    var cur = (stats.byMetric[g.metric] || 0);
    var pct3 = g.target > 0 ? Math.min(100, Math.round((cur / g.target) * 100)) : 0;
    return { current: cur, target: g.target, percent: pct3, done: pct3 >= 100, extra: {} };
  }

  function evaluateGoals(data) {
    var stats = computeStats(data);
    (data.goals || []).forEach(function (g) {
      var p = computeGoalProgress(g, data, stats);
      if (p.done && !g.completedAt) {
        g.completedAt = Date.now();
        addAchievementInternal(data, { title: 'حققت هدف: ' + g.title, icon: '🎯', source: g.kind || 'goal' });
      } else if (!p.done && g.completedAt) {
        // لو رجعت السجلات لأقل من الهدف (مثال: زاد الوزن تاني)، نلغي علامة الاكتمال بهدوء
        g.completedAt = null;
      }
    });
  }

  function getGoals() {
    var data = load();
    var stats = computeStats(data);
    evaluateGoals(data);
    return data.goals.map(function (g) {
      var p = computeGoalProgress(g, data, stats);
      return Object.assign({}, g, p);
    });
  }

  /* ============================================================================
     ثيمات موحّدة على مستوى البرنامج كله — مركز القيادة هو المتحكم الوحيد فيها.
     كل ثيم عبارة عن مجموعة ألوان "قياسية" (tokens): bg/panel/panel2/line/text/
     muted/cyan/violet/green/orange/red. كل تطبيق له تعيين خاص (APP_VAR_MAPS)
     من هذه الـ tokens لأسماء متغيرات الـ CSS الحقيقية بتاعته (لأن كل تطبيق
     مصمم بأسماء متغيرات مختلفة). التطبيق يستدعي applyTheme(name, appKey)
     فيتحول لونه فورًا، وأي تغيير من مركز القيادة ينتشر لكل التطبيقات المفتوحة
     تلقائيًا عبر نفس آلية storage/hub:update المستخدمة للبيانات.
     ============================================================================ */
  var THEMES = {
    ocean:    { label:'محيط هادئ',      bg:'#09111d', panel:'#101c2d', panel2:'#14243a', line:'#243954', text:'#edf5ff', muted:'#8ea5c1', cyan:'#52d8e8', violet:'#a987ff', green:'#56dc9a', orange:'#ffb45d', red:'#ff7182' },
    sunset:   { label:'غروب دافئ',      bg:'#211117', panel:'#331b25', panel2:'#472332', line:'#704052', text:'#fff2e8', muted:'#d8a9aa', cyan:'#ff9d67', violet:'#e7a3ff', green:'#8fe3a5', orange:'#ffd166', red:'#ff6b6b' },
    forest:   { label:'غابة النمو',     bg:'#0b1915', panel:'#12261f', panel2:'#19362a', line:'#315846', text:'#effff4', muted:'#9fc3ae', cyan:'#69d99c', violet:'#8db5ff', green:'#b7e86b', orange:'#f5c46b', red:'#ff7a6b' },
    lavender: { label:'لافندر ليلي',    bg:'#141126', panel:'#211b3b', panel2:'#2d2550', line:'#4e437b', text:'#f5f0ff', muted:'#b7add4', cyan:'#b8a0ff', violet:'#ff91c8', green:'#86e5c0', orange:'#ffd38a', red:'#ff7d95' },
    sand:     { label:'ورق رملي',       bg:'#201b16', panel:'#332a20', panel2:'#473a2a', line:'#6b5439', text:'#fff6e8', muted:'#d1b995', cyan:'#73d4d0', violet:'#c5a1ff', green:'#a9d98e', orange:'#f6bd67', red:'#e3705a' },
    library:  { label:'مكتبة الأدوات',  bg:'#f3efe5', panel:'#fffdf8', panel2:'#e5eee8', line:'#d6d8ce', text:'#16433d', muted:'#6d837d', cyan:'#299b8a', violet:'#7183b7', green:'#4da789', orange:'#d9a63a', red:'#b9694d' },
    midnight: { label:'منتصف الليل',    bg:'#050810', panel:'#0c1220', panel2:'#111a2e', line:'#1f2c47', text:'#e7ecff', muted:'#7c88ad', cyan:'#4fd1ff', violet:'#9d7bff', green:'#4fe0b0', orange:'#ffb454', red:'#ff5d7a' },
    rosegold: { label:'ذهبي وردي',      bg:'#1c1416', panel:'#2b1e21', panel2:'#3a262b', line:'#5c3d43', text:'#fdece6', muted:'#c9a3a0', cyan:'#f2b6b0', violet:'#e8a6c9', green:'#c9d492', orange:'#e8b968', red:'#e46b6b' },
    emerald:  { label:'زمردي فاخر',     bg:'#04140f', panel:'#0a2119', panel2:'#0f3226', line:'#1e4d3c', text:'#eafff5', muted:'#7fbba3', cyan:'#38e0c1', violet:'#7ee0a8', green:'#2ee694', orange:'#d9c15b', red:'#ff6f6f' },
    cyberpunk:{ label:'سايبربانك',      bg:'#0a0014', panel:'#170028', panel2:'#22013b', line:'#4a1470', text:'#f6e8ff', muted:'#b98ce0', cyan:'#00e6f6', violet:'#ff2fd0', green:'#39ff9c', orange:'#ffb400', red:'#ff2b52' },
    coffee:   { label:'قهوة الصباح',    bg:'#1c140f', panel:'#2b201a', panel2:'#3a2c22', line:'#5c4534', text:'#fbeee1', muted:'#c7a98f', cyan:'#c99a5b', violet:'#a97a56', green:'#9caf6b', orange:'#e0993d', red:'#c1543a' },
    arctic:   { label:'قطبي بارد',      bg:'#eef4f8', panel:'#ffffff', panel2:'#e4edf3', line:'#cfdde6', text:'#0f2a3a', muted:'#5c7c8d', cyan:'#1c8fb0', violet:'#5f6fbb', green:'#28a68a', orange:'#d98b31', red:'#c14a4a' },
    volcano:  { label:'بركاني',         bg:'#180706', panel:'#2a0e0b', panel2:'#3c1410', line:'#63251c', text:'#fff1e8', muted:'#d69a8a', cyan:'#ff8a4c', violet:'#ff5c5c', green:'#8fbf5a', orange:'#ffb02e', red:'#ff3b30' },
    galaxy:   { label:'مجرّة',          bg:'#0a0a1e', panel:'#12123a', panel2:'#1a1a52', line:'#33337a', text:'#eeeeff', muted:'#9a9ad0', cyan:'#7de8ff', violet:'#c68fff', green:'#6bffb0', orange:'#ffd580', red:'#ff7ab0' },
    mint:     { label:'نعناع منعش',     bg:'#f2fbf7', panel:'#ffffff', panel2:'#e3f5ec', line:'#c9e8da', text:'#0f3d2e', muted:'#5c8c78', cyan:'#1fa98a', violet:'#5a7fd8', green:'#22c58a', orange:'#e0a23a', red:'#d1544a' },
    autumn:   { label:'خريف ذهبي',      bg:'#1a1209', panel:'#2b1e10', panel2:'#3d2b15', line:'#674a24', text:'#fff3dd', muted:'#d3b688', cyan:'#e0a344', violet:'#c97a4a', green:'#a3a13d', orange:'#f2871f', red:'#c44536' },
    slate:    { label:'رمادي أنيق',     bg:'#111418', panel:'#1a1f26', panel2:'#232a33', line:'#3a4552', text:'#eef2f6', muted:'#93a3b3', cyan:'#5cb8d8', violet:'#8a93d8', green:'#5fbf8e', orange:'#d9a05c', red:'#d16565' },
    sakura:   { label:'زهر الكرز',      bg:'#1f1418', panel:'#2e1c22', panel2:'#3f2830', line:'#664050', text:'#ffeef2', muted:'#d9a8b7', cyan:'#8fd6d0', violet:'#ff9dc2', green:'#a3d68c', orange:'#f2b95b', red:'#e8607a' },
    desertdusk:{label:'غروب الصحراء',   bg:'#1a100c', panel:'#2b1c14', panel2:'#3d281c', line:'#66442e', text:'#ffefe0', muted:'#d4ac8c', cyan:'#e8916b', violet:'#c76b8a', green:'#9aad5e', orange:'#f2a03d', red:'#d94e3f' },
    obsidian: { label:'حجر الأوبسيديان',bg:'#08090b', panel:'#101215', panel2:'#181b1f', line:'#2c3037', text:'#eef1f4', muted:'#8a94a1', cyan:'#4fc3d9', violet:'#8a7ffb', green:'#4fd991', orange:'#e0a24f', red:'#e0555a' }
  };
  var THEME_ORDER = ['ocean','sunset','forest','lavender','sand','library','midnight','rosegold','emerald','cyberpunk','coffee','arctic','volcano','galaxy','mint','autumn','slate','sakura','desertdusk','obsidian'];

  // تعيين tokens الثيم القياسية لأسماء متغيرات CSS الحقيقية في كل تطبيق (كل تطبيق مصمم بأسماء مختلفة)
  var APP_VAR_MAPS = {
    'command-center':        { bg:'--bg', panel:'--panel', panel2:'--panel2', line:'--line', text:'--text', muted:'--muted', cyan:'--cyan', violet:'--violet', green:'--green', orange:'--orange', red:'--red' },
    'meal-tracker':           { bg:'--bg', panel:'--card', panel2:'--ticket', line:'--edge', text:'--ink', muted:'--ink-dim', cyan:'--blueish', violet:'--tomato', green:'--olive', orange:'--gold', red:'--danger' },
    'drawing':                { bg:'--paper', panel:'--surface', panel2:'--surface-soft', line:'--rule', text:'--ink', muted:'--ink-soft', cyan:'--accent', violet:'--accent-dark', green:'--tint', orange:'--accent', red:'--danger' },
    'mindmap':                { bg:'--paper', panel:'--paper-card', panel2:'--surface-soft', line:'--rule', text:'--ink', muted:'--ink-soft', cyan:'--accent', violet:'--accent-dark', green:'--tint', orange:'--marker', red:'--danger' },
    'instruction_reference':  { bg:'--bg', panel:'--panel', panel2:'--elevated', line:'--border', text:'--text', muted:'--muted', cyan:'--accent', violet:'--accent2', green:'--accent', orange:'--accent2', red:'--danger' },
    'equipment':              { bg:'--bg', panel:'--panel', panel2:'--panel2', line:'--border', text:'--text', muted:'--dim', cyan:'--blue', violet:'--amber', green:'--green', orange:'--amber', red:'--red' },
    'code_library':           { bg:'--paper', panel:'--paper-card', panel2:'--paper-shadow', line:'--rule', text:'--ink', muted:'--ink-soft', cyan:'--accent', violet:'--accent-dark', green:'--accent', orange:'--marker', red:'--danger' },
    'editor':                 { bg:'--bg', panel:'--bg-card', panel2:'--bg-muted', line:'--border', text:'--fg', muted:'--fg-muted', cyan:'--primary', violet:'--primary-dim', green:'--primary', orange:'--primary-dim', red:'--fg-dim' },
    'english':                { bg:'--paper', panel:'--paper', panel2:'--paper', line:'--ink', muted:'--ink', cyan:'--teal', violet:'--purple', green:'--green', orange:'--orange', red:'--red' },
    'vocab-app':               { bg:'--paper', panel:'--card', panel2:'--card', line:'--line', text:'--ink', muted:'--ink-soft', cyan:'--teal', violet:'--gold-deep', green:'--teal', orange:'--gold', red:'--red' },
    'workshop':                { bg:'--bg', panel:'--panel', panel2:'--panel2', line:'--border', text:'--text', muted:'--dim', cyan:'--blue', violet:'--amber', green:'--green', orange:'--amber', red:'--red' }
  };

  function getThemeList() {
    return THEME_ORDER.map(function (id) { return Object.assign({ id: id }, THEMES[id]); });
  }

  function getTheme() { return load().theme || 'ocean'; }

  function setTheme(name, appKey) {
    if (!THEMES[name]) return false;
    var data = load();
    data.theme = name;
    persist(data);
    applyTheme(name, appKey);
    return true;
  }

  // يطبّق ألوان الثيم على الصفحة الحالية فورًا (بدون ما يغيّر التخزين لو appKey بس محلي)
  function applyTheme(name, appKey) {
    var theme = THEMES[name] || THEMES.ocean;
    var map = APP_VAR_MAPS[appKey];
    if (!map) return;
    try {
      var root = document.documentElement.style;
      Object.keys(map).forEach(function (token) {
        if (theme[token]) root.setProperty(map[token], theme[token]);
      });
    } catch (e) {}
  }

  function onThemeChange(cb) {
    onChange(function (data) { cb(data.theme || 'ocean'); });
  }

  /* ---------------- خطط متسلسلة عبر عدة تطبيقات (خطوة بخطوة) ---------------- */
  function addPlan(title, steps) {
    var data = load();
    var p = {
      id: rid('plan'),
      title: title || 'خطة جديدة',
      steps: (steps || []).map(function (s, i) {
        return { id: rid('step'), app: s.app || 'unknown', label: s.label || ('خطوة ' + (i + 1)), done: false };
      }),
      cursor: 0,
      createdAt: Date.now(),
      completedAt: null
    };
    data.plans.push(p);
    persist(data);
    return p;
  }

  function advancePlanStep(planId) {
    var data = load();
    var p = data.plans.find(function (x) { return x.id === planId; });
    if (!p) return null;
    var step = p.steps[p.cursor];
    if (step) { step.done = true; p.cursor++; }
    if (p.cursor >= p.steps.length && !p.completedAt) {
      p.completedAt = Date.now();
      addAchievementInternal(data, { title: 'أنجزت خطة: ' + p.title, icon: '🏆', source: 'plan' });
    }
    persist(data);
    return p;
  }

  function getPlans() { return load().plans; }

  function removePlan(id) {
    var data = load();
    data.plans = data.plans.filter(function (p) { return p.id !== id; });
    persist(data);
  }

  /* ---------------- إنجازات تُسجَّل تلقائيًا أو يدويًا ---------------- */
  function addAchievementInternal(data, ach) {
    var a = {
      id: rid('ach'),
      title: ach.title || 'إنجاز جديد',
      icon: ach.icon || '🏆',
      source: ach.source || 'unknown',
      at: Date.now()
    };
    data.achievements.unshift(a);
    data.achievements = data.achievements.slice(0, 200);
    return a;
  }

  function addAchievement(ach) {
    var data = load();
    var a = addAchievementInternal(data, ach || {});
    persist(data);
    return a;
  }

  function getAchievements() { return load().achievements; }

  /* ---------------- إحصائيات مجمّعة على مستوى البرنامج كله ---------------- */
  function computeStats(data) {
    data = data || load();
    var activities = [];
    try { activities = JSON.parse(localStorage.getItem('command_center_activity_v1') || '[]'); } catch (e) {}
    var byApp = {};
    function bump(source, field, n) {
      if (!byApp[source]) byApp[source] = { words: 0, codes: 0, languages: 0, projects: 0, alerts: 0, activities: 0 };
      byApp[source][field] += n;
    }
    data.words.forEach(function (w) { bump(w.source || 'unknown', 'words', 1); });
    data.codes.forEach(function (c) { bump(c.source || 'unknown', 'codes', 1); });
    data.languages.forEach(function (l) { bump(l.source || 'unknown', 'languages', 1); });
    data.projects.forEach(function (p) { bump(p.source || 'unknown', 'projects', 1); });
    data.alerts.forEach(function (a) { if (a.resolved) bump(a.source || 'unknown', 'alerts', 1); });
    activities.forEach(function (a) { bump(a.app || 'unknown', 'activities', 1); });
    return {
      byApp: byApp,
      byMetric: {
        words: data.words.length,
        codes: data.codes.length,
        languages: data.languages.length,
        projects: data.projects.length,
        activities: activities.length,
        alertsResolved: data.alerts.filter(function (a) { return a.resolved; }).length,
        plansCompleted: data.plans.filter(function (p) { return p.completedAt; }).length,
        achievements: data.achievements.length
      }
    };
  }

  function getStats() { return computeStats(load()); }

  /* ---------------- قراءة + الاشتراك في التحديثات ---------------- */
  function getAll() { return load(); }

  function onChange(cb) {
    global.addEventListener(EVT, function () { cb(load()); });
    global.addEventListener('storage', function (e) { if (e.key === HUB_KEY) cb(load()); });
  }

  global.HUB = {
    KEY: HUB_KEY,
    getAll: getAll,
    addWords: addWords,
    addCode: addCode,
    syncCodes: syncCodes,
    addLanguage: addLanguage,
    addProject: addProject,
    syncProjects: syncProjects,
    addAlert: addAlert,
    syncAlertsForSource: syncAlertsForSource,
    markAlertRead: markAlertRead,
    onChange: onChange,
    THEMES: THEMES,
    THEME_ORDER: THEME_ORDER,
    getThemeList: getThemeList,
    getTheme: getTheme,
    setTheme: setTheme,
    applyTheme: applyTheme,
    onThemeChange: onThemeChange,
    addGoal: addGoal,
    addRangeGoal: addRangeGoal,
    addTimeGoal: addTimeGoal,
    addChecklistGoal: addChecklistGoal,
    addChecklistItem: addChecklistItem,
    toggleChecklistItem: toggleChecklistItem,
    removeGoal: removeGoal,
    getGoals: getGoals,
    LOG_TYPES: LOG_TYPES,
    addLog: addLog,
    removeLog: removeLog,
    getLogs: getLogs,
    getLatestLog: getLatestLog,
    getLogSummary: getLogSummary,
    addPlan: addPlan,
    advancePlanStep: advancePlanStep,
    getPlans: getPlans,
    removePlan: removePlan,
    addAchievement: addAchievement,
    getAchievements: getAchievements,
    getStats: getStats
  };

  // عند تحميل أي تطبيق، طبّق الثيم المحفوظ فورًا لو التطبيق ده معرّف نفسه بمفتاح مسجّل في APP_VAR_MAPS
  // (كل تطبيق يستدعي applyTheme(HUB.getTheme(), 'مفتاحه') بنفسه في سكربت صغير بعد تحميل هذا الملف)
})(window);
