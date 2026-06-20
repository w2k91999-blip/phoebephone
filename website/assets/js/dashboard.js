/* ============================================================
   Phone Phoebe — User Dashboard JS
   ============================================================ */
(function () {
  var SB_URL  = 'https://lrxuflxfnyiqzjqzjcsa.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHVmbHhmbnlpcXpqcXpqY3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTM4ODUsImV4cCI6MjA5NzQyOTg4NX0.iDvQ5arYqxAaKA406qH3snUjKMMQJOyxFkQFNUZX-EI';
  var sb = window.supabase.createClient(SB_URL, SB_ANON);

  var user, profile, business;
  var allCalls = [];

  /* ── AUTH GUARD ─────────────────────────────────────── */
  sb.auth.getSession().then(function (r) {
    if (!r.data || !r.data.session) { window.location.href = 'index.html'; return; }
    user = r.data.session.user;
    boot();
  });

  function boot() {
    Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('businesses').select('*').eq('owner_id', user.id).limit(1).maybeSingle()
    ]).then(function (res) {
      profile  = res[0].data || {};
      business = res[1].data || null;
      renderSidebar();
      renderTopbar();
      renderBanner();
      renderSetup();
      loadStats();
      loadHomeCalls();
      loadNextBooking();
      renderAgentStatus();
      populateAgentForm();
      populateProfileForm();
      loadPayments();
      hideGuard();
      showSection('home');
    });
  }

  function hideGuard() {
    var g = document.getElementById('dashGuard');
    if (g) g.style.display = 'none';
  }

  /* ── SECTION NAV ─────────────────────────────────────── */
  var TITLES = { home:'Home', calls:'Call logs', bookings:'Bookings', agent:'My agent', sub:'Subscription', account:'Account' };
  var sectionIds = { home:'secHome', calls:'secCalls', bookings:'secBookings', agent:'secAgent', sub:'secSub', account:'secAccount' };

  function showSection(name) {
    Object.keys(sectionIds).forEach(function (k) {
      var el = document.getElementById(sectionIds[k]);
      if (el) el.classList.toggle('active', k === name);
    });
    document.querySelectorAll('.snav').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-section') === name);
    });
    var t = document.getElementById('topbarTitle');
    if (t) t.textContent = TITLES[name] || name;
    if (name === 'calls')    loadCalls();
    if (name === 'bookings') loadBookings();
    if (name === 'sub')      markCurrentPlan();
    window.scrollTo(0,0);
  }

  document.querySelectorAll('[data-section]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var sec = el.getAttribute('data-section');
      if (!sec) return;
      e.preventDefault();
      showSection(sec);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  document.getElementById('burgerBtn').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    sb.auth.signOut().then(function () { window.location.href = 'index.html'; });
  });

  /* ── SIDEBAR / TOPBAR ────────────────────────────────── */
  function renderSidebar() {
    var name = profile.full_name || user.user_metadata.full_name || user.email.split('@')[0];
    var plan = profile.plan || 'trial';
    document.getElementById('sidebarName').textContent   = name;
    document.getElementById('sidebarPlan').textContent   = capitalise(plan);
    document.getElementById('sidebarAvatar').textContent = name.charAt(0).toUpperCase();
  }

  function renderTopbar() {
    var plan = profile.plan || 'trial';
    var right = document.getElementById('topbarRight');
    if (plan === 'trial') {
      var days = trialDaysLeft();
      right.innerHTML = '<span class="trial-pill">⏳ ' + days + ' days left</span>' +
        '<button class="btn-primary" style="font-size:.8rem;padding:.35rem .85rem" data-section="sub">Upgrade</button>';
      right.querySelectorAll('[data-section]').forEach(function (el) {
        el.addEventListener('click', function () { showSection(el.getAttribute('data-section')); });
      });
    }
  }

  function trialDaysLeft() {
    if (!profile.trial_ends_at) return 7;
    return Math.max(0, Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000));
  }

  /* ── BANNER ─────────────────────────────────────────── */
  function renderBanner() {
    var plan = profile.plan || 'trial';
    var banner = document.getElementById('planBanner');
    if (plan !== 'trial' || sessionStorage.getItem('banner_dismissed')) return;
    var days = trialDaysLeft();
    document.getElementById('planBannerTitle').textContent = days > 0
      ? 'Your free trial ends in ' + days + ' day' + (days === 1 ? '' : 's') + '.'
      : 'Your free trial has ended.';
    document.getElementById('planBannerSub').textContent = 'Pick a plan to keep Phoebe answering your calls.';
    banner.style.display = '';
  }
  document.getElementById('dismissBanner').addEventListener('click', function () {
    document.getElementById('planBanner').style.display = 'none';
    sessionStorage.setItem('banner_dismissed', '1');
  });

  /* ── SETUP CHECKLIST ─────────────────────────────────── */
  function renderSetup() {
    var card      = document.getElementById('setupCard');
    var agentDone = !!(business && business.name);
    var fwdDone   = !!(business && business.forward_number);
    var steps     = [true, agentDone, fwdDone];
    var done      = steps.filter(Boolean).length;
    if (done === steps.length) return; // fully set up — hide
    card.style.display = '';
    var pct = Math.round((done / steps.length) * 100);
    document.getElementById('setupFill').style.width = pct + '%';
    document.getElementById('setupPct').textContent  = pct + '%';
    if (agentDone) document.getElementById('sstepAgent').classList.add('done');
    if (fwdDone)   document.getElementById('sstepForward').classList.add('done');
  }

  /* ── STATS ───────────────────────────────────────────── */
  function loadStats() {
    if (!business) { setStats(0, 0, 0, '—'); return; }
    var start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    Promise.all([
      sb.from('calls').select('duration_seconds', { count:'exact' }).eq('business_id', business.id).gte('started_at', start.toISOString()),
      sb.from('bookings').select('id', { count:'exact' }).eq('business_id', business.id).gte('created_at', start.toISOString())
    ]).then(function (r) {
      var callCount = r[0].count || 0;
      var bookCount = r[1].count || 0;
      var secs = (r[0].data || []).reduce(function (a, c) { return a + (c.duration_seconds || 0); }, 0);
      setStats(callCount, bookCount, Math.round(secs / 60), callCount > 0 ? Math.round((bookCount / callCount) * 100) + '%' : '—');
    });
  }
  function setStats(c, b, m, r) {
    document.getElementById('hStatCalls').textContent = c;
    document.getElementById('hStatBooks').textContent = b;
    document.getElementById('hStatMins').textContent  = m;
    document.getElementById('hStatRate').textContent  = r;
  }

  /* ── HOME RECENT CALLS ───────────────────────────────── */
  function loadHomeCalls() {
    if (!business) return;
    sb.from('calls').select('*').eq('business_id', business.id)
      .order('started_at', { ascending: false }).limit(5)
      .then(function (r) {
        var rows = r.data || [];
        if (!rows.length) return;
        document.getElementById('hCallsEmpty').style.display = 'none';
        document.getElementById('hCallsTable').style.display = '';
        document.getElementById('hCallsBody').innerHTML = rows.map(miniCallRow).join('');
      });
  }
  function miniCallRow(c) {
    return '<tr><td>' + fmtDt(c.started_at) + '</td>' +
      '<td>' + esc(c.caller_name || c.caller_number || 'Unknown') + '</td>' +
      '<td>' + fmtDur(c.duration_seconds) + '</td>' +
      '<td><span class="badge badge--' + statusCol(c.status) + '">' + esc(c.status || '—') + '</span></td></tr>';
  }

  /* ── NEXT BOOKING ────────────────────────────────────── */
  function loadNextBooking() {
    if (!business) return;
    sb.from('bookings').select('*').eq('business_id', business.id)
      .eq('status', 'confirmed').gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true }).limit(1)
      .then(function (r) {
        var b = r.data && r.data[0];
        if (!b) return;
        document.getElementById('nextBookingCard').style.display = '';
        document.getElementById('nbDate').textContent    = fmtDt(b.scheduled_at);
        document.getElementById('nbName').textContent    = b.customer_name || '—';
        document.getElementById('nbService').textContent = b.service || '';
      });
  }

  /* ── AGENT STATUS CARD ───────────────────────────────── */
  function renderAgentStatus() {
    var namEl   = document.getElementById('agentStatusName');
    var badgeEl = document.getElementById('agentStatusBadge');
    if (business && business.name) {
      namEl.textContent = business.agent_name || 'Phoebe';
      badgeEl.innerHTML = '<span class="dot dot--green"></span> Active';
      document.getElementById('asdBiz').textContent   = business.name;
      document.getElementById('asdHours').textContent = business.hours || '—';
      document.getElementById('asdPlan').textContent  = capitalise(profile.plan || 'trial');
    } else {
      badgeEl.innerHTML = '<span class="dot dot--grey"></span> Not configured';
    }
  }

  /* ── CALL LOGS ───────────────────────────────────────── */
  function loadCalls() {
    if (!business || allCalls.length) { renderCalls(allCalls); return; }
    sb.from('calls').select('*').eq('business_id', business.id)
      .order('started_at', { ascending: false }).limit(300)
      .then(function (r) { allCalls = r.data || []; renderCalls(allCalls); });
  }
  function renderCalls(rows) {
    var empty = document.getElementById('callsEmpty');
    var tbl   = document.getElementById('callsTable');
    var body  = document.getElementById('callsBody');
    if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
    empty.style.display = 'none'; tbl.style.display = '';
    body.innerHTML = rows.map(function (c) {
      return '<tr><td>' + fmtDt(c.started_at) + '</td>' +
        '<td>' + esc(c.caller_name || c.caller_number || 'Unknown') + '</td>' +
        '<td>' + fmtDur(c.duration_seconds) + '</td>' +
        '<td><span class="badge badge--' + statusCol(c.status) + '">' + esc(c.status || '—') + '</span></td>' +
        '<td style="max-width:240px;white-space:normal;font-size:.82rem;color:#5a6672">' + esc(c.summary || '—') + '</td></tr>';
    }).join('');
  }
  document.getElementById('callSearch').addEventListener('input', function (e) {
    var q = e.target.value.toLowerCase();
    renderCalls(allCalls.filter(function (c) {
      return (c.caller_name || '').toLowerCase().includes(q) || (c.caller_number || '').includes(q);
    }));
  });

  /* ── BOOKINGS ────────────────────────────────────────── */
  function loadBookings() {
    if (!business) return;
    var f = document.getElementById('bookingFilter').value;
    var q = sb.from('bookings').select('*').eq('business_id', business.id);
    var now = new Date().toISOString();
    if (f === 'upcoming')  q = q.gte('scheduled_at', now).order('scheduled_at', { ascending: true });
    if (f === 'completed') q = q.eq('status', 'completed').order('scheduled_at', { ascending: false });
    if (f === 'all')       q = q.order('scheduled_at', { ascending: false });
    q.limit(300).then(function (r) {
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
  }
  document.getElementById('bookingFilter').addEventListener('change', loadBookings);

  /* ── SUBSCRIPTION ────────────────────────────────────── */
  function markCurrentPlan() {
    var plan = profile.plan || 'trial';
    var cpName   = document.getElementById('cpName');
    var cpStatus = document.getElementById('cpStatus');
    cpName.textContent   = capitalise(plan);
    cpStatus.innerHTML   = plan === 'trial'
      ? '⏳ Trial — ' + trialDaysLeft() + ' days remaining'
      : '✅ Active';

    // Highlight current plan card
    ['basic','pro','premium'].forEach(function (k) {
      var card = document.getElementById('pc' + capitalise(k === 'pro' ? 'Pro' : k));
      if (card) card.classList.remove('plan-card--active');
    });
    if (plan === 'basic')        document.getElementById('pcBasic').classList.add('plan-card--active');
    if (plan === 'professional') document.getElementById('pcPro').classList.add('plan-card--active');
    if (plan === 'premium')      document.getElementById('pcPremium').classList.add('plan-card--active');

    // Show cancel zone if on a paid plan
    if (plan !== 'trial') document.getElementById('cancelZone').style.display = '';

    // Right-hand info
    document.getElementById('cpRight').innerHTML = plan === 'trial'
      ? '<button class="btn-white" data-section="sub" style="font-size:.88rem">Upgrade now</button>'
      : '<span style="opacity:.7;font-size:.88rem">Cancel anytime</span>';
  }

  // Plan select buttons
  document.querySelectorAll('[data-plan]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var plan = btn.getAttribute('data-plan');
      confirmAction(
        'Switch to ' + capitalise(plan) + ' plan?',
        'Stripe checkout will open — you\'ll only be charged after your trial ends.',
        function () {
          alert('Stripe checkout for ' + plan + ' coming soon! We\'ll email you when billing is live.');
        }
      );
    });
  });

  // Cancel subscription
  document.getElementById('cancelToggle').addEventListener('click', function () {
    var body = document.getElementById('cancelBody');
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    document.getElementById('cancelToggle').textContent = isOpen ? 'Show' : 'Hide';
  });
  document.getElementById('cancelSubBtn').addEventListener('click', function () {
    confirmAction(
      'Cancel subscription?',
      'Your access continues to the end of the current period. You can re-subscribe at any time.',
      function () {
        // In production: call Stripe API via your backend
        alert('Cancellation request sent. Our team will process it within 24 hours.');
      }
    );
  });

  /* ── PAYMENTS ────────────────────────────────────────── */
  function loadPayments() {
    sb.from('payments').select('*').eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(function (r) {
        var rows  = r.data || [];
        var empty = document.getElementById('paymentsEmpty');
        var tbl   = document.getElementById('paymentsTable');
        var body  = document.getElementById('paymentsBody');
        if (!rows.length) { empty.style.display = ''; tbl.style.display = 'none'; return; }
        empty.style.display = 'none'; tbl.style.display = '';
        body.innerHTML = rows.map(function (p) {
          var amt = '£' + (p.amount_pence / 100).toFixed(2);
          return '<tr><td>' + fmtDt(p.paid_at || p.created_at) + '</td>' +
            '<td style="text-transform:capitalize">' + esc(p.plan || '—') + '</td>' +
            '<td>' + amt + '</td>' +
            '<td><span class="badge badge--' + payCol(p.status) + '">' + esc(p.status) + '</span></td>' +
            '<td>—</td></tr>';
        }).join('');
      });
  }

  /* ── AGENT FORM ──────────────────────────────────────── */
  function populateAgentForm() {
    if (!business) return;
    sv('aBizName', business.name);
    sv('aAgentName', business.agent_name);
    sv('aHours', business.hours);
    sv('aAreas', business.areas);
    sv('aServices', business.services);
    sv('aRate', business.hourly_rate);
    sv('aAvail', business.availability);
    sv('aForward', business.forward_number);
    sv('aCalKey', business.calcom_api_key);
    sv('aCalEvent', business.calcom_event_type_id);
    sv('aVoiceId', business.eleven_voice_id);
    renderFaq(business.faq || []);
  }
  function sv(id, val) { var el = document.getElementById(id); if (el && val != null) el.value = val; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  document.getElementById('saveAgentBtn').addEventListener('click', saveAgent);
  function saveAgent() {
    var btn = document.getElementById('saveAgentBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    var payload = {
      name: gv('aBizName'), agent_name: gv('aAgentName'), hours: gv('aHours'),
      areas: gv('aAreas'), services: gv('aServices'), hourly_rate: gv('aRate'),
      availability: gv('aAvail'), forward_number: gv('aForward'),
      calcom_api_key: gv('aCalKey'),
      calcom_event_type_id: parseInt(gv('aCalEvent')) || null,
      eleven_voice_id: gv('aVoiceId'),
      faq: collectFaq()
    };
    var op = business
      ? sb.from('businesses').update(payload).eq('id', business.id)
      : sb.from('businesses').insert(Object.assign({ owner_id: user.id }, payload)).select().single();
    op.then(function (r) {
      btn.disabled = false; btn.textContent = 'Save changes';
      if (r.error) { alert('Error: ' + r.error.message); return; }
      if (!business && r.data) business = r.data;
      else if (business) Object.assign(business, payload);
      var ok = document.getElementById('agentOk');
      ok.style.display = ''; setTimeout(function () { ok.style.display = 'none'; }, 3000);
      renderAgentStatus(); renderSetup();
    });
  }

  function renderFaq(items) {
    var list = document.getElementById('faqList');
    list.innerHTML = '';
    (items || []).forEach(function (i) { addFaqRow(i.q, i.a); });
  }
  function addFaqRow(q, a) {
    var list = document.getElementById('faqList');
    var row  = document.createElement('div');
    row.className = 'faq-row';
    row.innerHTML = '<input type="text" class="faq-q" placeholder="Question" value="' + esc(q || '') + '" />' +
      '<input type="text" class="faq-a" placeholder="Answer" value="' + esc(a || '') + '" />' +
      '<button type="button" class="faq-del" title="Remove">✕</button>';
    row.querySelector('.faq-del').addEventListener('click', function () { list.removeChild(row); });
    list.appendChild(row);
  }
  function collectFaq() {
    return Array.from(document.querySelectorAll('.faq-row')).map(function (r) {
      return { q: r.querySelector('.faq-q').value.trim(), a: r.querySelector('.faq-a').value.trim() };
    }).filter(function (i) { return i.q || i.a; });
  }
  document.getElementById('addFaqBtn').addEventListener('click', function () { addFaqRow('', ''); });

  /* ── PROFILE FORM ────────────────────────────────────── */
  function populateProfileForm() {
    sv('pName',  profile.full_name);
    sv('pBiz',   profile.business_name);
    sv('pPhone', profile.phone);
    var email = document.getElementById('acctEmail');
    if (email) email.textContent = user.email;
  }
  document.getElementById('saveProfileBtn').addEventListener('click', function () {
    var btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;
    sb.from('profiles').update({
      full_name: gv('pName'), business_name: gv('pBiz'), phone: gv('pPhone')
    }).eq('id', user.id).then(function (r) {
      btn.disabled = false;
      if (r.error) { alert(r.error.message); return; }
      Object.assign(profile, { full_name: gv('pName'), business_name: gv('pBiz'), phone: gv('pPhone') });
      var ok = document.getElementById('profileOk');
      ok.style.display = ''; setTimeout(function () { ok.style.display = 'none'; }, 3000);
      renderSidebar();
    });
  });

  // Change email
  document.getElementById('emailForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var newEmail = gv('newEmail');
    if (!newEmail) return;
    var btn = document.getElementById('changeEmailBtn');
    btn.disabled = true;
    sb.auth.updateUser({ email: newEmail }).then(function (r) {
      btn.disabled = false;
      var ok  = document.getElementById('emailOk');
      var err = document.getElementById('emailErr');
      if (r.error) { err.textContent = r.error.message; err.style.display = ''; ok.style.display = 'none'; return; }
      err.style.display = 'none'; ok.style.display = '';
    });
  });

  // Change password
  document.getElementById('passwordForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var np = gv('newPass'), cp = gv('confPass');
    var err = document.getElementById('passErr');
    if (np.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = ''; return; }
    if (np !== cp) { err.textContent = 'Passwords do not match.'; err.style.display = ''; return; }
    err.style.display = 'none';
    var btn = document.getElementById('changePassBtn');
    btn.disabled = true;
    sb.auth.updateUser({ password: np }).then(function (r) {
      btn.disabled = false;
      if (r.error) { err.textContent = r.error.message; err.style.display = ''; return; }
      var ok = document.getElementById('passOk');
      ok.style.display = ''; setTimeout(function () { ok.style.display = 'none'; }, 3000);
      document.getElementById('newPass').value = '';
      document.getElementById('confPass').value = '';
    });
  });

  // Danger zone toggles
  document.getElementById('deleteToggle').addEventListener('click', function () {
    var b = document.getElementById('deleteBody');
    var open = b.style.display !== 'none';
    b.style.display = open ? 'none' : '';
    document.getElementById('deleteToggle').textContent = open ? 'Show' : 'Hide';
  });
  document.getElementById('deleteAcctBtn').addEventListener('click', function () {
    confirmAction(
      'Delete your account?',
      'This is permanent. All your data, calls and bookings will be deleted immediately. This cannot be undone.',
      function () { alert('Please email support@phonephoebe.co.uk to delete your account.'); }
    );
  });

  /* ── CONFIRM MODAL ───────────────────────────────────── */
  var pendingCallback = null;
  function confirmAction(title, body, cb) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmBody').textContent  = body;
    pendingCallback = cb;
    document.getElementById('confirmOverlay').classList.add('open');
  }
  document.getElementById('confirmNo').addEventListener('click',  closeConfirm);
  document.getElementById('confirmYes').addEventListener('click', function () {
    closeConfirm();
    if (pendingCallback) pendingCallback();
  });
  function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('open'); }

  /* ── UTILS ───────────────────────────────────────────── */
  function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmtDt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }
  function fmtDur(secs) {
    if (!secs) return '—';
    var m = Math.floor(secs / 60), s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function statusCol(s) { if (!s) return 'grey'; s=s.toLowerCase(); return s==='ended'||s==='completed'?'green':s==='failed'?'red':s.includes('progress')?'yellow':'grey'; }
  function bookCol(s)   { return { confirmed:'green', completed:'green', cancelled:'red', rescheduled:'yellow', no_show:'red' }[s] || 'grey'; }
  function payCol(s)    { return { succeeded:'green', pending:'yellow', failed:'red', refunded:'grey' }[s] || 'grey'; }
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
