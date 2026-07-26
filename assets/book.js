(function(){
  "use strict";

  var API_BASE = window.SOLARM_CONFIG.API_BASE;

  /* ── CONSTANTS ──────────────────────────────────────────── */
  // Keep this list in sync with server/src/services.js — the server
  // recomputes the authoritative price for the Stripe charge, this copy
  // is only used to render the picker before we know the server total.
  var SERVICES = [
    { id:'headshot', name:'Headshot Standard', price:179, priceLabel:'$179', deposit:179,
      desc:'One standard retouched headshot + raw image. No makeup or styling services.', duration:60 },
    { id:'korean', name:'Korean Style Portraits', price:329, priceLabel:'$329', deposit:329,
      desc:'Seoul-studio-inspired portrait session with a curated set of retouched images.', duration:90 },
    { id:'editorial', name:'Editorial Shoots', price:500, priceLabel:'$500–$750', deposit:500,
      desc:'Full editorial/campaign shoot. Final price scoped to concept & deliverables. $500 deposit due today.', duration:120 }
  ];
  var CLOSED_DAYS = [1]; // Monday closed
  var DAY_START = 9, DAY_END = 17; // 9am - 5pm start times
  var BLOCK_HOURS = 2; // hours blocked after a booked start time
  var MEMBER_CODE = window.SolarM.MEMBER_CODE;

  /* ── STATE ──────────────────────────────────────────────── */
  var state = {
    step: 1,
    service: null,
    date: null,
    time: null,
    customer: {},
    promoApplied: false,
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    serverAmount: null,      // authoritative total (cents) from the backend
    clientSecret: null,
    paymentIntentId: null
  };

  var stripe = null, elements = null, paymentElement = null;
  if (window.Stripe){
    stripe = Stripe(window.SOLARM_CONFIG.STRIPE_PUBLISHABLE_KEY);
  }

  function prefillCustomerFromUser(){
    var user = window.SolarM.currentUser();
    if (!user) return;
    document.getElementById('custFirst').value = user.firstName || '';
    document.getElementById('custLast').value = user.lastName || '';
    document.getElementById('custEmail').value = user.email || '';
    document.getElementById('custPhone').value = user.phone || '';
  }
  prefillCustomerFromUser();

  /* ── STEP NAVIGATION ────────────────────────────────────── */
  function goStep(n){
    state.step = n;
    document.querySelectorAll('.step-panel').forEach(function(p){
      p.classList.toggle('active', +p.dataset.step === n);
    });
    document.querySelectorAll('.step-pill').forEach(function(p){
      var s = +p.dataset.step;
      p.classList.toggle('active', s === n);
      p.classList.toggle('done', s < n);
    });
    document.querySelector('.booking-shell').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  document.querySelectorAll('[data-back]').forEach(function(btn){
    btn.addEventListener('click', function(){ goStep(+btn.dataset.back); });
  });

  /* ── STEP 1: SERVICE CHOICE ─────────────────────────────── */
  var svcGrid = document.getElementById('svcChoiceGrid');
  SERVICES.forEach(function(svc){
    var div = document.createElement('div');
    div.className = 'svc-choice';
    div.dataset.id = svc.id;
    div.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<strong>' + svc.name + '</strong><span class="radio-dot"></span>' +
      '</div>' +
      '<div class="price">' + svc.priceLabel + '</div>' +
      '<div class="desc">' + svc.desc + '</div>';
    div.addEventListener('click', function(){
      state.service = svc;
      document.querySelectorAll('.svc-choice').forEach(function(c){ c.classList.remove('selected'); });
      div.classList.add('selected');
      document.getElementById('toStep2').disabled = false;
    });
    svcGrid.appendChild(div);
  });
  document.getElementById('toStep2').addEventListener('click', function(){
    renderCalendar();
    goStep(2);
  });

  /* ── STEP 2: CALENDAR + TIME SLOTS ──────────────────────── */
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['S','M','T','W','T','F','S'];

  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function dateKey(y,m,d){ return y + '-' + pad(m+1) + '-' + pad(d); }
  function todayKey(){ var t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()); }

  function renderCalendar(){
    var y = state.calYear, m = state.calMonth;
    document.getElementById('monthLabel').textContent = MONTH_NAMES[m] + ' ' + y;
    var grid = document.getElementById('calGrid');
    grid.innerHTML = '';
    DOW.forEach(function(d){
      var el = document.createElement('div');
      el.className = 'dow'; el.textContent = d;
      grid.appendChild(el);
    });
    var firstDow = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m+1, 0).getDate();
    var tKey = todayKey();

    for (var i = 0; i < firstDow; i++){
      var blank = document.createElement('div');
      blank.className = 'cal-day blank';
      grid.appendChild(blank);
    }
    for (var d = 1; d <= daysInMonth; d++){
      var key = dateKey(y, m, d);
      var dow = new Date(y, m, d).getDay();
      var cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      var isPast = key < tKey;
      var isClosed = CLOSED_DAYS.indexOf(dow) !== -1;
      if (key === tKey) cell.classList.add('today');
      if (isPast || isClosed){
        cell.classList.add('disabled');
      } else {
        cell.classList.add('selectable');
        cell.addEventListener('click', function(k){
          return function(){ selectDate(k); };
        }(key));
      }
      if (state.date === key) cell.classList.add('selected');
      grid.appendChild(cell);
    }
  }

  document.getElementById('prevMonth').addEventListener('click', function(){
    state.calMonth--; if (state.calMonth < 0){ state.calMonth = 11; state.calYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', function(){
    state.calMonth++; if (state.calMonth > 11){ state.calMonth = 0; state.calYear++; }
    renderCalendar();
  });

  function selectDate(key){
    state.date = key;
    state.time = null;
    document.getElementById('toStep3').disabled = true;
    renderCalendar();
    renderTimeSlots(key);
  }

  function fmtHour(h){
    var period = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':00 ' + period;
  }

  function renderTimeSlots(key){
    var col = document.getElementById('timeSlots');
    var head = document.getElementById('timeHead');
    var d = new Date(key + 'T00:00:00');
    head.textContent = MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    col.innerHTML = '';

    var bookings = window.SolarM.getBookings().filter(function(b){ return b.date === key; });
    var blockedHours = [];
    bookings.forEach(function(b){
      for (var h = b.hour; h < b.hour + BLOCK_HOURS; h++) blockedHours.push(h);
    });

    var any = false;
    for (var h = DAY_START; h <= DAY_END; h++){
      any = true;
      var slot = document.createElement('div');
      var isBlocked = blockedHours.indexOf(h) !== -1;
      slot.className = 'time-slot ' + (isBlocked ? 'blocked' : 'selectable');
      slot.textContent = fmtHour(h);
      if (state.time === h && !isBlocked) slot.classList.add('selected');
      if (!isBlocked){
        slot.addEventListener('click', function(hour){
          return function(){
            state.time = hour;
            renderTimeSlots(key);
            document.getElementById('toStep3').disabled = false;
          };
        }(h));
      }
      col.appendChild(slot);
    }
    if (!any){
      col.innerHTML = '<div class="time-empty">No times available.</div>';
    }
  }

  document.getElementById('toStep3').addEventListener('click', function(){
    prefillCustomerFromUser();
    goStep(3);
  });

  /* ── STEP 3: CUSTOMER INFO ──────────────────────────────── */
  document.getElementById('custGender').addEventListener('change', function(){
    document.getElementById('genderSelfField').style.display = this.value === 'self' ? 'flex' : 'none';
  });

  function fieldError(input, msg){
    input.classList.toggle('field-error', !!msg);
    var errEl = input.parentElement.querySelector('.error-text');
    if (errEl) errEl.textContent = msg || '';
  }

  document.getElementById('toStep4').addEventListener('click', function(){
    var first = document.getElementById('custFirst');
    var last = document.getElementById('custLast');
    var email = document.getElementById('custEmail');
    var phone = document.getElementById('custPhone');
    var valid = true;

    fieldError(first, first.value.trim() ? '' : 'Required');
    fieldError(last, last.value.trim() ? '' : 'Required');
    fieldError(email, /^\S+@\S+\.\S+$/.test(email.value.trim()) ? '' : 'Valid email required');
    fieldError(phone, phone.value.trim().length >= 7 ? '' : 'Valid phone required');
    [first,last,email,phone].forEach(function(f){ if (f.classList.contains('field-error')) valid = false; });
    if (!valid) return;

    var genderSel = document.getElementById('custGender').value;
    var gender = genderSel === 'self' ? (document.getElementById('custGenderSelf').value.trim() || 'Self-described') : genderSel;

    state.customer = {
      firstName: first.value.trim(),
      lastName: last.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      contactMethod: document.querySelector('input[name=contactMethod]:checked').value,
      gender: gender,
      notes: document.getElementById('custNotes').value.trim()
    };
    renderReview();
    goStep(4);
    startPaymentStep();
  });

  /* ── STEP 4: REVIEW + PROMO + STRIPE PAYMENT ────────────── */
  function renderReview(){
    var d = new Date(state.date + 'T00:00:00');
    var dateStr = MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    var isEditorial = state.service.id === 'editorial';
    var box = document.getElementById('reviewBox');

    // Until the server confirms the authoritative amount, show the sticker
    // price / naive 15% estimate. It's swapped for the server total in
    // startPaymentStep() once /api/create-payment-intent responds.
    var base = state.service.deposit;
    var discount = state.promoApplied ? Math.round(base * 0.15 * 100) / 100 : 0;
    var total = state.serverAmount != null ? state.serverAmount / 100 : Math.round((base - discount) * 100) / 100;

    box.innerHTML =
      row('Service', state.service.name) +
      row('Date', dateStr) +
      row('Time', fmtHour(state.time)) +
      row('Name', state.customer.firstName + ' ' + state.customer.lastName) +
      row('Contact', state.customer.email + ' · ' + state.customer.phone) +
      row('Preferred contact', state.customer.contactMethod) +
      (isEditorial ? row(state.service.priceLabel + ' — deposit today', '$' + base.toFixed(2)) : row('Price', '$' + base.toFixed(2))) +
      (state.promoApplied ? row('Membership discount (15%)', '-$' + discount.toFixed(2)) : '') +
      rowTotal('Total due today', '$' + total.toFixed(2));
    function row(k,v){ return '<div class="review-row"><span class="k">'+k+'</span><span>'+v+'</span></div>'; }
    function rowTotal(k,v){ return '<div class="review-row total"><span class="k">'+k+'</span><span>'+v+'</span></div>'; }
  }

  document.getElementById('applyPromoBtn').addEventListener('click', function(){
    var code = document.getElementById('promoInput').value.trim().toUpperCase();
    var msg = document.getElementById('promoMsg');
    if (code === MEMBER_CODE){
      state.promoApplied = true;
      msg.textContent = '15% membership discount applied.';
      msg.className = 'promo-msg ok';
    } else {
      state.promoApplied = false;
      msg.textContent = 'That code is not valid.';
      msg.className = 'promo-msg err';
    }
    renderReview();
    // The discount changes the amount actually charged, so the PaymentIntent
    // has to be recreated — Stripe Elements is tied to one client secret.
    startPaymentStep();
  });

  var paymentMessageEl = document.getElementById('paymentMessage');
  var payBtn = document.getElementById('payBtn');

  function showPaymentMessage(msg){
    paymentMessageEl.textContent = msg || '';
  }

  function startPaymentStep(){
    if (!stripe){
      document.getElementById('payment-element').textContent = 'Stripe.js failed to load — check your internet connection.';
      return;
    }
    payBtn.disabled = true;
    showPaymentMessage('');
    document.getElementById('payment-element').textContent = 'Loading payment form…';

    fetch(API_BASE + '/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: state.service.id,
        promoCode: state.promoApplied ? MEMBER_CODE : null,
        customerEmail: state.customer.email,
        date: state.date,
        hour: state.time,
        customer: state.customer
      })
    })
      .then(function(res){
        if (!res.ok) return res.json().then(function(body){ throw new Error(body.error || 'Could not start payment.'); });
        return res.json();
      })
      .then(function(data){
        state.clientSecret = data.clientSecret;
        state.paymentIntentId = data.paymentIntentId;
        state.serverAmount = data.amount;
        renderReview();

        elements = stripe.elements({
          clientSecret: state.clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#cda34a',
              colorBackground: '#0a0e1f',
              colorText: '#f7f7f9',
              colorDanger: '#e2685a',
              fontFamily: 'Inter, sans-serif',
              borderRadius: '9px'
            }
          }
        });
        paymentElement = elements.create('payment');
        document.getElementById('payment-element').innerHTML = '';
        paymentElement.mount('#payment-element');
        payBtn.disabled = false;
      })
      .catch(function(err){
        document.getElementById('payment-element').textContent = '';
        showPaymentMessage(err.message || 'Could not reach the payment server. Make sure the backend in /server is running — see SETUP.md.');
      });
  }

  payBtn.addEventListener('click', function(){
    if (!stripe || !elements) return;
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    showPaymentMessage('');

    stripe.confirmPayment({
      elements: elements,
      redirect: 'if_required'
    }).then(function(result){
      if (result.error){
        showPaymentMessage(result.error.message);
        payBtn.disabled = false;
        payBtn.textContent = 'Confirm & Pay';
        return;
      }
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded'){
        finalizeBooking(result.paymentIntent.id);
      } else {
        showPaymentMessage('Payment did not complete (status: ' + (result.paymentIntent && result.paymentIntent.status) + ').');
        payBtn.disabled = false;
        payBtn.textContent = 'Confirm & Pay';
      }
    }).catch(function(err){
      showPaymentMessage(err.message || 'Something went wrong confirming payment.');
      payBtn.disabled = false;
      payBtn.textContent = 'Confirm & Pay';
    });
  });

  /* ── STEP 5: PERSIST BOOKING + CONFIRMATION ─────────────── */
  function finalizeBooking(paymentIntentId){
    fetch(API_BASE + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId,
        service: { id: state.service.id, name: state.service.name },
        date: state.date,
        hour: state.time,
        customer: state.customer
      })
    })
      .then(function(res){
        if (!res.ok) return res.json().then(function(body){ throw new Error(body.error || 'Could not save the booking.'); });
        return res.json();
      })
      .then(function(data){
        showConfirmation(data.id, data.total);
      })
      .catch(function(err){
        // Payment already succeeded at this point — don't strand the customer
        // on the payment screen. Show the confirmation with a locally
        // generated reference and flag it for manual reconciliation; the
        // Stripe webhook (see server/src/routes/webhook.js) will also pick
        // this payment up server-side even if this request fails entirely.
        console.warn('Booking save failed after successful payment:', err.message);
        showConfirmation(paymentIntentId.replace('pi_', 'SM-').slice(0, 12).toUpperCase(), state.serverAmount / 100);
      });
  }

  function showConfirmation(confirmId, total){
    var bookings = window.SolarM.getBookings();
    bookings.push({
      id: confirmId,
      date: state.date,
      hour: state.time,
      service: state.service.name,
      total: total,
      customer: state.customer
    });
    window.SolarM.saveBookings(bookings);

    var d = new Date(state.date + 'T00:00:00');
    var dateStr = MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();

    document.getElementById('confirmId').textContent = 'Confirmation #' + confirmId;
    document.getElementById('confirmSummary').innerHTML =
      '<div class="review-row"><span class="k">Service</span><span>' + state.service.name + '</span></div>' +
      '<div class="review-row"><span class="k">Date</span><span>' + dateStr + '</span></div>' +
      '<div class="review-row"><span class="k">Time</span><span>' + fmtHour(state.time) + '</span></div>' +
      '<div class="review-row total"><span class="k">Paid</span><span>$' + total.toFixed(2) + '</span></div>';

    payBtn.disabled = false;
    payBtn.textContent = 'Confirm & Pay';
    goStep(5);
  }

  document.getElementById('bookAnotherBtn').addEventListener('click', function(){
    state.service = null; state.date = null; state.time = null; state.promoApplied = false;
    state.serverAmount = null; state.clientSecret = null; state.paymentIntentId = null;
    document.querySelectorAll('.svc-choice').forEach(function(c){ c.classList.remove('selected'); });
    document.getElementById('toStep2').disabled = true;
    document.getElementById('toStep3').disabled = true;
    document.getElementById('customerForm').reset();
    document.getElementById('promoInput').value = '';
    document.getElementById('promoMsg').textContent = '';
    document.getElementById('payment-element').innerHTML = '';
    goStep(1);
  });
})();
