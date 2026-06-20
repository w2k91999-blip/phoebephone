/* ===========================================================
   Phone Phoebe — Supabase auth module
   Handles login, signup, password reset, session state.
   =========================================================== */
(function () {
  var SUPABASE_URL  = 'https://lrxuflxfnyiqzjqzjcsa.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHVmbHhmbnlpcXpqcXpqY3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTM4ODUsImV4cCI6MjA5NzQyOTg4NX0.iDvQ5arYqxAaKA406qH3snUjKMMQJOyxFkQFNUZX-EI';
  var DASHBOARD_URL = 'dashboard.html';
  var ADMIN_URL     = 'admin.html';

  function redirectAfterAuth(userId) {
    sb.from('profiles').select('is_admin').eq('id', userId).single()
      .then(function (r) {
        window.location.href = (r.data && r.data.is_admin) ? ADMIN_URL : DASHBOARD_URL;
      });
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  /* ---- DOM refs ---- */
  var overlay     = document.getElementById('authModal');
  var modalClose  = document.getElementById('modalClose');
  var tabs        = document.querySelectorAll('.modal__tab');
  var planBadge   = document.getElementById('modalPlanBadge');
  var planLabel   = document.getElementById('modalPlanLabel');
  var errorBox    = document.getElementById('modalError');

  var panelLogin  = document.getElementById('panelLogin');
  var panelSignup = document.getElementById('panelSignup');
  var panelSuccess= document.getElementById('panelSuccess');
  var panelReset  = document.getElementById('panelReset');

  var formLogin   = document.getElementById('formLogin');
  var formSignup  = document.getElementById('formSignup');
  var formReset   = document.getElementById('formReset');

  var loginBtn    = document.getElementById('loginBtn');
  var signupBtn   = document.getElementById('signupBtn');
  var resetBtn    = document.getElementById('resetBtn');

  var signupPlanInput = document.getElementById('signupPlan');

  /* ---- State ---- */
  var currentPanel = 'login';

  /* ---- Helpers ---- */
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
  }
  function clearError() {
    errorBox.classList.remove('visible');
    errorBox.textContent = '';
  }
  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.getAttribute('data-label');
  }

  function showPanel(name) {
    clearError();
    currentPanel = name;
    panelLogin.style.display   = name === 'login'   ? '' : 'none';
    panelSignup.style.display  = name === 'signup'  ? '' : 'none';
    panelSuccess.style.display = name === 'success' ? '' : 'none';
    panelReset.style.display   = name === 'reset'   ? '' : 'none';

    // sync tab active state
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
  }

  function openModal(panel, plan) {
    showPanel(panel || 'login');
    if (plan) {
      signupPlanInput.value = plan;
      var labels = { basic: 'Basic — £39/mo', professional: 'Professional — £89/mo', premium: 'Premium — £189/mo' };
      planLabel.textContent = labels[plan] || plan;
      planBadge.style.display = '';
    } else {
      planBadge.style.display = 'none';
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    clearError();
    setTimeout(function () { showPanel('login'); }, 280);
  }

  /* ---- Store default button labels ---- */
  [loginBtn, signupBtn, resetBtn].forEach(function (btn) {
    btn.setAttribute('data-label', btn.textContent);
  });

  /* ---- Nav buttons ---- */
  var navLogin  = document.getElementById('navLogin');
  var navSignup = document.getElementById('navSignup');
  if (navLogin)  navLogin.addEventListener('click',  function () { openModal('login'); });
  if (navSignup) navSignup.addEventListener('click', function () { openModal('signup'); });

  /* ---- All [data-auth] buttons across the page ---- */
  document.querySelectorAll('[data-auth]').forEach(function (el) {
    el.addEventListener('click', function () {
      var action = el.getAttribute('data-auth');
      var plan   = el.getAttribute('data-plan') || '';
      openModal(action, plan);
    });
  });

  /* ---- Modal close ---- */
  modalClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ---- Tab switch ---- */
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      showPanel(tab.getAttribute('data-tab'));
    });
  });

  /* ---- Panel quick-links ---- */
  document.getElementById('switchToSignup').addEventListener('click', function () { showPanel('signup'); });
  document.getElementById('switchToLogin').addEventListener('click',  function () { showPanel('login'); });
  document.getElementById('forgotLink').addEventListener('click',     function () { showPanel('reset'); });
  document.getElementById('backToLogin').addEventListener('click',    function () { showPanel('login'); });

  /* ---- Login form ---- */
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var email = document.getElementById('loginEmail').value.trim();
    var pass  = document.getElementById('loginPassword').value;
    if (!email || !pass) { showError('Please fill in both fields.'); return; }
    setLoading(loginBtn, true);
    sb.auth.signInWithPassword({ email: email, password: pass })
      .then(function (res) {
        if (res.error) { showError(res.error.message); setLoading(loginBtn, false); return; }
        redirectAfterAuth(res.data.user.id);
      });
  });

  /* ---- Signup form ---- */
  formSignup.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var name     = document.getElementById('signupName').value.trim();
    var biz      = document.getElementById('signupBusiness').value.trim();
    var email    = document.getElementById('signupEmail').value.trim();
    var pass     = document.getElementById('signupPassword').value;
    var plan     = signupPlanInput.value || 'trial';

    if (!name || !biz || !email || !pass) { showError('Please fill in all fields.'); return; }
    if (pass.length < 8) { showError('Password must be at least 8 characters.'); return; }

    setLoading(signupBtn, true);
    sb.auth.signUp({
      email: email,
      password: pass,
      options: {
        data: { full_name: name, business_name: biz, selected_plan: plan },
        emailRedirectTo: window.location.origin + '/' + DASHBOARD_URL
      }
    }).then(function (res) {
      if (res.error) { showError(res.error.message); setLoading(signupBtn, false); return; }
      showPanel('success');
    });
  });

  /* ---- Password reset form ---- */
  formReset.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var email = document.getElementById('resetEmail').value.trim();
    if (!email) { showError('Please enter your email address.'); return; }
    setLoading(resetBtn, true);
    sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/' + DASHBOARD_URL + '?reset=1'
    }).then(function (res) {
      setLoading(resetBtn, false);
      if (res.error) { showError(res.error.message); return; }
      showError(''); // clear
      document.getElementById('resetEmail').value = '';
      showPanel('success');
      document.querySelector('#panelSuccess h3').textContent = 'Check your inbox';
      document.querySelector('#panelSuccess p').textContent  = 'A password reset link is on its way.';
    });
  });

  /* ---- Session check: swap nav buttons if already logged in ---- */
  sb.auth.getSession().then(function (res) {
    if (res.data && res.data.session) {
      var user     = res.data.session.user;
      var actions  = document.getElementById('navActions');
      if (actions) {
        var displayName = (user.user_metadata && user.user_metadata.full_name)
          ? user.user_metadata.full_name.split(' ')[0]
          : user.email.split('@')[0];
        var isAdmin = user.user_metadata && user.user_metadata.is_admin;
        var dashHref = isAdmin ? ADMIN_URL : DASHBOARD_URL;
        actions.innerHTML =
          '<span class="nav__user"><span class="nav__user-name">' + displayName + '</span></span>' +
          '<a href="' + dashHref + '" class="btn btn--primary">Dashboard</a>' +
          '<button class="btn--user-menu" id="navLogout">Log out</button>';
        document.getElementById('navLogout').addEventListener('click', function () {
          sb.auth.signOut().then(function () { window.location.reload(); });
        });
      }
    }
  });
})();
