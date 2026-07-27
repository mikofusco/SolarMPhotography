/* ── SITE CONFIG ──────────────────────────────────────────────
   TEMPORARY: switched to Stripe TEST mode to verify the booking
   flow without a real card. Swap back to the pk_live_... key
   (and STRIPE_SECRET_KEY back to sk_live_... on Render) once the
   test booking is confirmed working. See SETUP.md.
------------------------------------------------------------- */
window.SOLARM_CONFIG = {
  API_BASE: 'https://solarm-photography.onrender.com',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_51Rfu5qEV9HE8YRsnQKjxpB1ESxRoX05wsBn7DrbfJagIxuC2QmTTOMgyq5MFNhhjKv7M9VVcmj026fAQuaNZwmfe00SUkzzrSV'
};

window.SolarM = (function(){
  "use strict";

  /* ── DEMO-DATA NOTICE ─────────────────────────────────────────
     Accounts and the "My Bookings" view are still stored in the
     browser (localStorage) for demo purposes — see SETUP.md for
     the recommended path to real server-side auth. Payments and
     the finished booking record now go through the real backend
     in /server, since those two genuinely require server-side
     secrets (Stripe secret key, email API key).
  ------------------------------------------------------------- */

  var USERS_KEY = 'solarm_users';
  var SESSION_KEY = 'solarm_session';
  var BOOKINGS_KEY = 'solarm_bookings';
  var MEMBER_CODE = 'SOLARMEMBER15';

  /* ── STORAGE HELPERS ────────────────────────────────────── */
  function loadJSON(key, fallback){
    try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; }
    catch(e){ return fallback; }
  }
  function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function getUsers(){ return loadJSON(USERS_KEY, {}); }
  function saveUsers(users){ saveJSON(USERS_KEY, users); }
  function getBookings(){ return loadJSON(BOOKINGS_KEY, []); }
  function saveBookings(bookings){ saveJSON(BOOKINGS_KEY, bookings); }
  function getSession(){ return localStorage.getItem(SESSION_KEY); }
  function setSession(email){ localStorage.setItem(SESSION_KEY, email); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }
  function currentUser(){
    var email = getSession();
    if (!email) return null;
    return getUsers()[email] || null;
  }

  /* ── STAR FIELD ─────────────────────────────────────────── */
  function initStars(){
    var el = document.getElementById('stars');
    if (!el) return;
    var layer = document.createElement('div');
    layer.className = 'layer';
    var shadows = [];
    for (var i = 0; i < 160; i++){
      var x = Math.random()*100, y = Math.random()*100, spread = Math.random() < 0.15 ? 1 : 0;
      var o = (Math.random()*0.6 + 0.3).toFixed(2);
      shadows.push(x+'vw '+y+'vh 0 '+spread+'px rgba(255,255,255,'+o+')');
    }
    layer.style.width = '1px';
    layer.style.height = '1px';
    layer.style.borderRadius = '50%';
    layer.style.boxShadow = shadows.join(',');
    el.appendChild(layer);
  }

  /* ── TOAST ──────────────────────────────────────────────── */
  var toastTimer;
  function toast(msg){
    var toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 3200);
  }

  /* ── NAV / AUTH UI ──────────────────────────────────────── */
  function avatarInitial(user){
    return ((user.firstName || '?')[0] || '?').toUpperCase();
  }

  function paintAvatar(el, user){
    if (!el) return;
    if (user.avatar){
      el.style.backgroundImage = 'url(' + user.avatar + ')';
      el.textContent = '';
    } else {
      el.style.backgroundImage = 'none';
      el.textContent = avatarInitial(user);
    }
  }

  function updateAuthUI(){
    var user = currentUser();
    var out = document.getElementById('signedOutActions');
    var inn = document.getElementById('signedInActions');
    var mOut = document.getElementById('mobileSignedOutActions');
    var mInn = document.getElementById('mobileSignedInActions');
    if (!out || !inn) return;
    if (user){
      out.style.display = 'none';
      inn.style.display = 'flex';
      if (mOut) mOut.classList.add('is-hidden');
      if (mInn) mInn.classList.remove('is-hidden');
      var navName = document.getElementById('navUserName');
      var navNameMobile = document.getElementById('navUserNameMobile');
      if (navName) navName.textContent = user.firstName;
      if (navNameMobile) navNameMobile.textContent = user.firstName;
      paintAvatar(document.getElementById('navAvatar'), user);
    } else {
      out.style.display = 'flex';
      inn.style.display = 'none';
      if (mOut) mOut.classList.remove('is-hidden');
      if (mInn) mInn.classList.add('is-hidden');
    }
    document.dispatchEvent(new CustomEvent('solarm:authchange', { detail: { user: user } }));
  }

  function openAuth(tab){
    var authOverlay = document.getElementById('authOverlay');
    if (!authOverlay) return;
    authOverlay.classList.add('open');
    switchAuthTab(tab || 'signin');
  }
  function closeAuth(){
    var authOverlay = document.getElementById('authOverlay');
    if (authOverlay) authOverlay.classList.remove('open');
  }
  function switchAuthTab(tab){
    document.querySelectorAll('.modal-tab').forEach(function(t){
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    var signin = document.getElementById('paneSignin');
    var signup = document.getElementById('paneSignup');
    if (signin) signin.classList.toggle('active', tab === 'signin');
    if (signup) signup.classList.toggle('active', tab === 'signup');
  }

  function signOut(){
    clearSession();
    updateAuthUI();
    toast('Signed out.');
  }

  function on(id, evt, fn){
    var el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }

  function sendMembershipEmail(user){
    fetch(window.SOLARM_CONFIG.API_BASE + '/api/send-membership-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, firstName: user.firstName, code: MEMBER_CODE })
    }).catch(function(){
      // Non-fatal: the account is created either way. See SETUP.md if emails
      // never arrive (backend not running / RESEND_API_KEY not configured).
      console.warn('Could not reach the email service — is the backend running? See SETUP.md.');
    });
  }

  function wireNav(){
    on('hamburgerBtn', 'click', function(){
      document.getElementById('navLinks').classList.toggle('mobile-open');
    });
    document.querySelectorAll('#navLinks a').forEach(function(a){
      a.addEventListener('click', function(){ document.getElementById('navLinks').classList.remove('mobile-open'); });
    });

    // Account dropdown (desktop)
    var accountMenu = document.getElementById('signedInActions');
    on('accountTrigger', 'click', function(e){
      e.stopPropagation();
      accountMenu.classList.toggle('open');
    });
    document.addEventListener('click', function(e){
      if (accountMenu && !accountMenu.contains(e.target)) accountMenu.classList.remove('open');
    });

    on('openSignIn', 'click', function(){ openAuth('signin'); });
    on('openSignUp', 'click', function(){ openAuth('signup'); });
    on('openSignUpBanner', 'click', function(){ openAuth('signup'); });
    on('openSignInMobile', 'click', function(){ document.getElementById('navLinks').classList.remove('mobile-open'); openAuth('signin'); });
    on('openSignUpMobile', 'click', function(){ document.getElementById('navLinks').classList.remove('mobile-open'); openAuth('signup'); });
    on('closeAuth', 'click', closeAuth);
    var authOverlay = document.getElementById('authOverlay');
    if (authOverlay) authOverlay.addEventListener('click', function(e){ if (e.target === authOverlay) closeAuth(); });
    document.querySelectorAll('.modal-tab').forEach(function(t){
      t.addEventListener('click', function(){ switchAuthTab(t.dataset.tab); });
    });

    var signUpForm = document.getElementById('signUpForm');
    if (signUpForm) signUpForm.addEventListener('submit', function(e){
      e.preventDefault();
      var first = document.getElementById('suFirst').value.trim();
      var last = document.getElementById('suLast').value.trim();
      var email = document.getElementById('suEmail').value.trim().toLowerCase();
      var pass = document.getElementById('suPassword').value;
      var member = document.getElementById('suMember').checked;
      var msg = document.getElementById('suMsg');
      if (!first || !last || !email || !pass){ msg.textContent = 'Please fill out all fields.'; msg.className='auth-msg err'; return; }
      var users = getUsers();
      if (users[email]){ msg.textContent = 'An account with that email already exists.'; msg.className='auth-msg err'; return; }
      users[email] = { firstName:first, lastName:last, email:email, password:pass, member:member, phone:'', avatar:'' };
      saveUsers(users);
      setSession(email);
      msg.textContent = 'Account created!'; msg.className='auth-msg ok';
      updateAuthUI();
      closeAuth();
      if (member){
        sendMembershipEmail(users[email]);
        toast('Welcome to SolarM Membership — check your email for your 15% off code.');
      } else {
        toast('Account created. Welcome!');
      }
      signUpForm.reset();
      document.getElementById('suMember').checked = true;
    });

    var signInForm = document.getElementById('signInForm');
    if (signInForm) signInForm.addEventListener('submit', function(e){
      e.preventDefault();
      var email = document.getElementById('siEmail').value.trim().toLowerCase();
      var pass = document.getElementById('siPassword').value;
      var msg = document.getElementById('siMsg');
      var users = getUsers();
      var user = users[email];
      if (!user || user.password !== pass){ msg.textContent = 'Incorrect email or password.'; msg.className='auth-msg err'; return; }
      setSession(email);
      msg.textContent = 'Signed in!'; msg.className='auth-msg ok';
      updateAuthUI();
      closeAuth();
      toast('Welcome back, ' + user.firstName + '.');
      signInForm.reset();
    });

    on('signOutBtn', 'click', signOut);
    on('signOutBtnMobile', 'click', function(){
      document.getElementById('navLinks').classList.remove('mobile-open');
      signOut();
    });
  }

  function init(){
    initStars();
    wireNav();
    updateAuthUI();
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    MEMBER_CODE: MEMBER_CODE,
    getUsers: getUsers,
    saveUsers: saveUsers,
    getBookings: getBookings,
    saveBookings: saveBookings,
    getSession: getSession,
    setSession: setSession,
    currentUser: currentUser,
    toast: toast,
    openAuth: openAuth,
    paintAvatar: paintAvatar,
    avatarInitial: avatarInitial,
    updateAuthUI: updateAuthUI
  };
})();
