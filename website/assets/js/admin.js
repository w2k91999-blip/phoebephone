/* ============================================================
   Phone Phoebe — Admin Dashboard JS
   ============================================================ */
(function () {
  var SB_URL  = 'https://lrxuflxfnyiqzjqzjcsa.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHVmbHhmbnlpcXpqcXpqY3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTM4ODUsImV4cCI6MjA5NzQyOTg4NX0.iDvQ5arYqxAaKA406qH3snUjKMMQJOyxFkQFNUZX-EI';
  var sb = window.supabase.createClient(SB_URL, SB_ANON);

  var allUsers = [], selectedUser = null;
  var SECTION_TITLES = { overview:'Overview', users:'Users', subs:'Subscriptions' };

  /* ── AUTH + ADMIN GUARD ──────────────────────────────── */
  sb.auth.getSession().then(function (r) {
    if (!r.data || !r.data.session) { window.location.href = 'index.html'; return; }
    sb.from('profiles').select('is_admin').eq('id', r.data.session.user.id).single()
      .then(function (pr) {
        if (!pr.data || !pr.data.is_admin) { window.location.href = 'dashboard.html'; return; }
        boot();
      });
  });

  function boot() {
    loadStats();
    loadRecentUsers();
    hideGuard();
    showSection('overview');
  }

  function hideGuard() { var g = document.getElementById('admGuard'); if (g) g.style.display = 'none'; }

  /* ── SECTION NAV ─────────────────────────────────────── */
  function showSection(name) {
    ['overview','users','subs'].forEach(function (k) {
      var el = document.getElementById('sec' + cap(k));
      if (el) el.classList.toggle('active', k === name);
    });
    document.querySelectorAll('.asnav').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-section') === name);
    });
    document.getElementById('admTitle').textContent = SECTION_TITLES[name] || name;
    if (name === 'users') loadAllUsers();
    if (name === 'subs')  loadSubs();
    window.scrollTo(0,0);
  }

  document.querySelectorAll('[data-section]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var sec = el.getAttribute('data-section');
      if (!sec) return;
      e.preventDefault();
      showSection(sec);
      document.getElementById('admSidebar').classList.remove('open');
    });
  });

  document.getElementById('admBurger').addEventListener('click', function () {
    document.getElementById('admSidebar').classList.toggle('open');
  });
  document.getElementById('admLogout').addEventListener('click', function () {
    sb.auth.signOut().then(function () { window.location.href = 'index.html'; });
  });

  /* ── OVERVIEW STATS ──────────────────────────────────── */
  function loadStats() {
    sb.rpc('admin_get_stats').then(function (r) {
      if (r.error || !r.data) return;
      var s = Array.isArray(r.data) ? r.data[0] : r.data;
      setText('asTotalUsers',  s.total_users    || 0);
      setText('asTrialUsers',  s.trial_users    || 0);
      setText('asPaidUsers',   s.paid_users     || 0);
      setText('asTotalCalls',  s.total_calls    || 0);
      setText('asTotalBooks',  s.total_bookings || 0);
      setText('asPlanBasic',   s.basic_count    || 0);
      setText('asPlanPro',     s.pro_count      || 0);
      setText('asPlanPremium', s.premium_count  || 0);
    });
  }

  /* ── RECENT SIGN-UPS (overview) ─────────────────────── */
  function loadRecentUsers() {
    sb.rpc('admin_get_users').then(function (r) {
      var rows  = (r.data || []).slice(0, 8);
      var empty = document.getElementById('recentEmpty');
      var tbl   = document.getElementById('recentTable');
      var body  = document.getElementById('recentBody');
      if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
      empty.style.display = 'none'; tbl.style.display = '';
      body.innerHTML = rows.map(function (u) {
        return '<tr>' +
          '<td>' + esc(u.full_name || '—') + '</td>' +
          '<td>' + esc(u.email || '—') + '</td>' +
          '<td>' + planBadge(u.plan) + '</td>' +
          '<td>' + fmtDate(u.created_at) + '</td>' +
          '<td><button class="adm-btn-sm quick-manage" data-uid="' + esc(u.id) + '">Manage</button></td>' +
          '</tr>';
      }).join('');
      body.querySelectorAll('.quick-manage').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var u = allUsers.find(function (x) { return x.id === btn.getAttribute('data-uid'); });
          if (u) { showSection('users'); setTimeout(function () { selectUser(u); }, 100); }
          else { loadAllUsers(btn.getAttribute('data-uid')); showSection('users'); }
        });
      });
    });
  }

  /* ── ALL USERS LIST ──────────────────────────────────── */
  function loadAllUsers(autoSelectId) {
    sb.rpc('admin_get_users').then(function (r) {
      allUsers = r.data || [];
      renderUserList(allUsers);
      if (autoSelectId) {
        var u = allUsers.find(function (x) { return x.id === autoSelectId; });
        if (u) selectUser(u);
      }
    });
  }

  function renderUserList(rows) {
    var list = document.getElementById('userList');
    setText('userCount', rows.length + ' user' + (rows.length !== 1 ? 's' : ''));
    if (!rows.length) {
      list.innerHTML = '<div class="empty-state"><span>👥</span><p>No users found.</p></div>';
      return;
    }
    list.innerHTML = rows.map(function (u) {
      var init = (u.full_name || u.email || '?').charAt(0).toUpperCase();
      return '<div class="user-card" data-uid="' + esc(u.id) + '">' +
        '<div class="user-card__av">' + init + '</div>' +
        '<div style="min-width:0">' +
          '<div class="user-card__name">' + esc(u.full_name || u.email || 'Unknown') + '</div>' +
          '<div class="user-card__email">' + esc(u.email || '—') + '</div>' +
          '<div class="user-card__plan">' + planBadge(u.plan) + (u.is_admin ? ' <span class="badge badge--red">Admin</span>' : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    list.querySelectorAll('.user-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var uid = card.getAttribute('data-uid');
        var u   = allUsers.find(function (x) { return x.id === uid; });
        if (u) selectUser(u);
      });
    });
    // restore selection highlight
    if (selectedUser) highlightUserCard(selectedUser.id);
  }

  // Search + plan filter
  function applyFilters() {
    var q    = document.getElementById('userSearch').value.toLowerCase();
    var plan = document.getElementById('planFilter').value;
    renderUserList(allUsers.filter(function (u) {
      var matchText = !q || (u.full_name||'').toLowerCase().includes(q) ||
                            (u.email||'').toLowerCase().includes(q) ||
                            (u.business_name||'').toLowerCase().includes(q);
      var matchPlan = !plan || u.plan === plan;
      return matchText && matchPlan;
    }));
  }
  document.getElementById('userSearch').addEventListener('input', applyFilters);
  document.getElementById('planFilter').addEventListener('change', applyFilters);

  /* ── SELECT USER → LOAD DETAIL ───────────────────────── */
  function selectUser(u) {
    selectedUser = u;
    highlightUserCard(u.id);
    document.getElementById('udpEmpty').style.display   = 'none';
    document.getElementById('udpContent').style.display = '';
    renderUserHeader(u);
    showDetailTab('profile');
    loadUserDetail(u.id);
  }

  function highlightUserCard(uid) {
    document.querySelectorAll('.user-card').forEach(function (c) {
      c.classList.toggle('selected', c.getAttribute('data-uid') === uid);
    });
  }

  function renderUserHeader(u) {
    var init = (u.full_name || u.email || '?').charAt(0).toUpperCase();
    document.getElementById('udpAvatar').textContent = init;
    document.getElementById('udpName').textContent   = u.full_name || '—';
    document.getElementById('udpEmail').textContent  = u.email || '—';
    document.getElementById('udpMeta').innerHTML     = planBadge(u.plan) +
      (u.is_admin ? ' <span class="badge badge--red">Admin</span>' : '') +
      ' <span class="badge badge--grey">Joined ' + fmtDate(u.created_at) + '</span>';
  }

  /* ── LOAD ALL USER DETAIL DATA ───────────────────────── */
  function loadUserDetail(uid) {
    // Profile
    sb.rpc('admin_get_user_detail', { target_id: uid }).then(function (r) {
      var d = r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
      if (!d) return;
      setVal('ufName',  d.full_name);
      setVal('ufBiz',   d.business_name);
      setVal('ufPhone', d.phone);
      setVal('ufEmail', d.email);
      setVal('ufPlan',  d.plan);
      setText('uiJoined',  fmtDate(d.created_at));
      setText('uiTrial',   fmtDate(d.trial_ends_at));
      setText('uiOnboard', d.onboarded ? 'Yes' : 'No');
      setText('uiAdmin',   d.is_admin  ? '✅ Yes' : 'No');
      document.getElementById('adminToggle').checked = !!d.is_admin;
    });

    // Agent
    sb.rpc('admin_get_user_business', { target_id: uid }).then(function (r) {
      var b = r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
      var empty  = document.getElementById('agentEmpty');
      var detail = document.getElementById('agentDetail');
      if (!b) { empty.style.display = ''; detail.style.display = 'none'; return; }
      empty.style.display = 'none'; detail.style.display = '';
      var fields = [
        ['Business', b.name], ['Agent name', b.agent_name], ['Hours', b.hours],
        ['Areas', b.areas], ['Services', b.services], ['Rate', b.hourly_rate],
        ['Availability', b.availability], ['Forward number', b.forward_number],
        ['Cal.com API key', b.calcom_api_key], ['Cal.com event ID', b.calcom_event_type_id],
        ['ElevenLabs voice', b.eleven_voice_id], ['Vapi assistant', b.vapi_assistant_id]
      ];
      document.getElementById('agentDetailGrid').innerHTML = fields
        .filter(function (f) { return f[1]; })
        .map(function (f) {
          return '<div class="agent-detail-item"><div class="agent-detail-item__label">' + esc(f[0]) + '</div>' +
            '<div class="agent-detail-item__value">' + esc(String(f[1])) + '</div></div>';
        }).join('');
      var faq = b.faq || [];
      document.getElementById('agentFaqList').innerHTML = faq.length
        ? faq.map(function (f) {
            return '<div class="faq-item"><div class="faq-item__q">' + esc(f.q || '') + '</div>' +
              '<div class="faq-item__a">' + esc(f.a || '') + '</div></div>';
          }).join('')
        : '<p style="color:var(--muted);font-size:.84rem">No FAQ entries.</p>';
    });

    // Calls
    sb.rpc('admin_get_user_calls', { target_id: uid }).then(function (r) {
      var rows   = r.data || [];
      var empty  = document.getElementById('callsEmpty');
      var tbl    = document.getElementById('callsTable');
      var body   = document.getElementById('callsBody');
      if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
      empty.style.display = 'none'; tbl.style.display = '';
      body.innerHTML = rows.map(function (c) {
        return '<tr><td>' + fmtDt(c.started_at) + '</td>' +
          '<td>' + esc(c.caller_name || c.caller_number || 'Unknown') + '</td>' +
          '<td>' + fmtDur(c.duration_seconds) + '</td>' +
          '<td><span class="badge badge--' + statusCol(c.status) + '">' + esc(c.status || '—') + '</span></td>' +
          '<td style="max-width:200px;white-space:normal;font-size:.8rem;color:#5a6672">' + esc(c.summary || '—') + '</td></tr>';
      }).join('');
    });

    // Bookings
    sb.rpc('admin_get_user_bookings', { target_id: uid }).then(function (r) {
      var rows  = r.data || [];
      var empty = document.getElementById('bookingsEmpty');
      var tbl   = document.getElementById('bookingsTable');
      var body  = document.getElementById('bookingsBody');
      if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
      empty.style.display = 'none'; tbl.style.display = '';
      body.innerHTML = rows.map(function (b) {
        return '<tr><td>' + fmtDt(b.scheduled_at) + '</td>' +
          '<td>' + esc(b.customer_name || '—') + '</td>' +
          '<td>' + esc(b.customer_phone || '—') + '</td>' +
          '<td>' + esc(b.service || '—') + '</td>' +
          '<td><span class="badge badge--' + bookCol(b.status) + '">' + esc(b.status) + '</span></td></tr>';
      }).join('');
    });

    // Payments
    sb.rpc('admin_get_user_payments', { target_id: uid }).then(function (r) {
      var rows  = r.data || [];
      var empty = document.getElementById('paymentsEmpty');
      var tbl   = document.getElementById('paymentsTable');
      var body  = document.getElementById('paymentsBody');
      // Sync billing plan select to current plan
      var curPlan = (selectedUser && selectedUser.plan) || 'trial';
      document.getElementById('billingPlanSelect').value = curPlan;
      if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
      empty.style.display = 'none'; tbl.style.display = '';
      body.innerHTML = rows.map(function (p) {
        return '<tr><td>' + fmtDate(p.paid_at || p.created_at) + '</td>' +
          '<td style="text-transform:capitalize">' + esc(p.plan || '—') + '</td>' +
          '<td>£' + ((p.amount_pence || 0) / 100).toFixed(2) + '</td>' +
          '<td><span class="badge badge--' + payCol(p.status) + '">' + esc(p.status) + '</span></td></tr>';
      }).join('');
    });
  }

  /* ── DETAIL TABS ─────────────────────────────────────── */
  function showDetailTab(name) {
    document.querySelectorAll('.utab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.utab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab' + cap(name));
    });
  }
  document.querySelectorAll('.utab').forEach(function (t) {
    t.addEventListener('click', function () { showDetailTab(t.getAttribute('data-tab')); });
  });

  /* ── SAVE PROFILE ────────────────────────────────────── */
  document.getElementById('saveProfileBtn').addEventListener('click', function () {
    if (!selectedUser) return;
    var btn = this; btn.disabled = true;
    sb.rpc('admin_update_user_profile', {
      target_id:      selectedUser.id,
      p_full_name:    getVal('ufName'),
      p_business_name:getVal('ufBiz'),
      p_phone:        getVal('ufPhone'),
      p_plan:         getVal('ufPlan')
    }).then(function (r) {
      btn.disabled = false;
      if (r.error) { alert('Error: ' + r.error.message); return; }
      // update local cache
      selectedUser.full_name     = getVal('ufName');
      selectedUser.business_name = getVal('ufBiz');
      selectedUser.plan          = getVal('ufPlan');
      var u = allUsers.find(function (x) { return x.id === selectedUser.id; });
      if (u) { u.full_name = selectedUser.full_name; u.plan = selectedUser.plan; }
      renderUserHeader(selectedUser);
      renderUserList(allUsers);
      flashOk('profileOk');
      loadStats();
    });
  });

  /* ── BILLING PLAN ────────────────────────────────────── */
  document.getElementById('saveBillingPlan').addEventListener('click', function () {
    if (!selectedUser) return;
    var plan = document.getElementById('billingPlanSelect').value;
    var btn  = this; btn.disabled = true;
    sb.rpc('admin_set_user_plan', { target_user_id: selectedUser.id, new_plan: plan })
      .then(function (r) {
        btn.disabled = false;
        if (r.error) { alert(r.error.message); return; }
        selectedUser.plan = plan;
        setVal('ufPlan', plan);
        var u = allUsers.find(function (x) { return x.id === selectedUser.id; });
        if (u) u.plan = plan;
        renderUserHeader(selectedUser);
        renderUserList(allUsers);
        flashOk('billingOk');
        loadStats();
      });
  });

  /* ── ADMIN TOGGLE ────────────────────────────────────── */
  document.getElementById('saveAdminBtn').addEventListener('click', function () {
    if (!selectedUser) return;
    var flag = document.getElementById('adminToggle').checked;
    var btn  = this; btn.disabled = true;
    sb.rpc('admin_set_admin', { target_user_id: selectedUser.id, admin_flag: flag })
      .then(function (r) {
        btn.disabled = false;
        if (r.error) { alert(r.error.message); return; }
        selectedUser.is_admin = flag;
        var u = allUsers.find(function (x) { return x.id === selectedUser.id; });
        if (u) u.is_admin = flag;
        setText('uiAdmin', flag ? '✅ Yes' : 'No');
        renderUserHeader(selectedUser);
        renderUserList(allUsers);
        flashOk('adminOk');
      });
  });

  /* ── DELETE USER ─────────────────────────────────────── */
  document.getElementById('deleteUserBtn').addEventListener('click', function () {
    if (!selectedUser) return;
    confirmAction(
      'Delete ' + (selectedUser.full_name || selectedUser.email) + '?',
      'This permanently deletes their account, agent config, calls and bookings. Cannot be undone.',
      function () {
        sb.rpc('admin_delete_user', { target_id: selectedUser.id }).then(function (r) {
          if (r.error) { alert(r.error.message); return; }
          allUsers = allUsers.filter(function (u) { return u.id !== selectedUser.id; });
          selectedUser = null;
          document.getElementById('udpEmpty').style.display   = '';
          document.getElementById('udpContent').style.display = 'none';
          renderUserList(allUsers);
          loadStats();
        });
      }
    );
  });

  /* ── SUBSCRIPTIONS ───────────────────────────────────── */
  function loadSubs() {
    sb.rpc('admin_get_subscriptions').then(function (r) {
      var rows  = r.data || [];
      var empty = document.getElementById('subsEmpty');
      var tbl   = document.getElementById('subsTable');
      var body  = document.getElementById('subsBody');
      if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
      empty.style.display = 'none'; tbl.style.display = '';
      body.innerHTML = rows.map(function (s) {
        return '<tr>' +
          '<td>' + esc(s.owner_name || '—') + '<br><small style="color:var(--muted)">' + esc(s.owner_email || '') + '</small></td>' +
          '<td>' + planBadge(s.plan) + '</td>' +
          '<td><span class="badge badge--' + subCol(s.status) + '">' + esc(s.status) + '</span></td>' +
          '<td>' + fmtDate(s.current_period_end) + '</td>' +
          '<td>' + (s.cancel_at_period_end ? '<span class="badge badge--red">Yes</span>' : '<span class="badge badge--grey">No</span>') + '</td>' +
          '<td><small style="color:var(--muted);word-break:break-all">' + esc(s.stripe_subscription_id || '—') + '</small></td>' +
          '</tr>';
      }).join('');
    });
  }

  /* ── CONFIRM MODAL ───────────────────────────────────── */
  var pendingCb = null;
  function confirmAction(title, body, cb) {
    document.getElementById('admConfirmTitle').textContent = title;
    document.getElementById('admConfirmBody').textContent  = body;
    pendingCb = cb;
    document.getElementById('admConfirmOverlay').classList.add('open');
  }
  document.getElementById('admConfirmNo').addEventListener('click',  closeConfirm);
  document.getElementById('admConfirmYes').addEventListener('click', function () { closeConfirm(); if (pendingCb) pendingCb(); });
  function closeConfirm() { document.getElementById('admConfirmOverlay').classList.remove('open'); }

  /* ── UTILS ───────────────────────────────────────────── */
  function cap(s)      { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function setVal(id, v)  { var el = document.getElementById(id); if (el && v != null) el.value = v; }
  function getVal(id)     { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function flashOk(id)    { var el = document.getElementById(id); if (!el) return; el.style.display = ''; setTimeout(function () { el.style.display = 'none'; }, 3000); }

  function fmtDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
  function fmtDt(iso)   { if (!iso) return '—'; var d = new Date(iso); return fmtDate(iso) + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); }
  function fmtDur(s)    { if (!s) return '—'; var m = Math.floor(s/60), sc = s%60; return m + ':' + (sc<10?'0':'') + sc; }

  function planBadge(p) {
    var cols = { trial:'yellow', basic:'green', professional:'purple', premium:'red' };
    return '<span class="badge badge--' + (cols[p] || 'grey') + '">' + cap(p || '—') + '</span>';
  }
  function statusCol(s) { if (!s) return 'grey'; s=s.toLowerCase(); return s==='ended'||s==='completed'?'green':s==='failed'?'red':s.includes('progress')?'yellow':'grey'; }
  function bookCol(s)   { return { confirmed:'green', completed:'green', cancelled:'red', rescheduled:'yellow', no_show:'red' }[s] || 'grey'; }
  function payCol(s)    { return { succeeded:'green', pending:'yellow', failed:'red', refunded:'grey' }[s] || 'grey'; }
  function subCol(s)    { return { active:'green', trialing:'yellow', past_due:'red', cancelled:'grey', incomplete:'yellow' }[s] || 'grey'; }

  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
})();
