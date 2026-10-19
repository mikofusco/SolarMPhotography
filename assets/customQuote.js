(function(){
  "use strict";

  var P = window.CustomQuotePricing;
  var MIN_DESCRIPTION_LENGTH = 100;

  /* ── STATE ──────────────────────────────────────────────── */
  var state = {
    lang: 'en',
    coverageType: null,
    hours: P.MIN_HOURS,
    secondShooter: false,
    audioAddon: false,
    photoEditing: { highlights:false, standard:false, fullHalfDays:0, retouchQty:0, sameNight:false, rush:false },
    videoEditing: { highlightClipQty:0, recapFilm:false, talkEditQty:0, captionsQty:0, altRatioQty:0, extraRevisionQty:0, rawFootage:false, rush:false },
    usageRights: { paidAds:'none', partnerUseQty:0, exclusivity:false, buyout:false },
    payMethod: null,
    clientSecret: null,
    paymentIntentId: null
  };

  var stripe = window.Stripe ? Stripe(window.SOLARM_CONFIG.STRIPE_PUBLISHABLE_KEY) : null;
  var elements = null, paymentElement = null;

  /* ── HELPERS ────────────────────────────────────────────── */
  function t(obj){ if (!obj) return ''; return obj[state.lang] || obj.en || ''; }

  function priceLabel(n){
    n = Math.round(n * 100) / 100;
    if (Math.abs(n - Math.round(n)) < 0.001) return '$' + Math.round(n).toLocaleString('en-US');
    return '$' + n.toFixed(2);
  }

  function buildSelections(){
    return {
      coverageType: state.coverageType,
      hours: state.hours,
      secondShooter: state.secondShooter,
      audioAddon: state.audioAddon,
      photoEditing: state.photoEditing,
      videoEditing: state.videoEditing,
      usageRights: state.usageRights
    };
  }

  function fieldError(input, msg){
    if (!input) return;
    input.classList.toggle('field-error', !!msg);
    var errEl = input.parentElement.querySelector('.error-text');
    if (errEl) errEl.textContent = msg || '';
  }

  /* ── GENERIC ROW BUILDERS ───────────────────────────────── */
  function renderBoolRow(container, item, priceText, getChecked, setChecked){
    var row = document.createElement('label');
    row.className = 'option-row';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!getChecked();
    var main = document.createElement('span');
    main.className = 'option-main';
    var lab = document.createElement('span');
    lab.className = 'option-label';
    lab.textContent = t(item.label);
    main.appendChild(lab);
    if (item.desc && (item.desc.en || item.desc.ko)){
      var desc = document.createElement('span');
      desc.className = 'option-desc';
      desc.textContent = t(item.desc);
      main.appendChild(desc);
    }
    row.appendChild(cb);
    row.appendChild(main);
    if (priceText){
      var price = document.createElement('span');
      price.className = 'option-price';
      price.textContent = priceText;
      row.appendChild(price);
    }
    row.classList.toggle('selected', cb.checked);
    cb.addEventListener('change', function(){
      setChecked(cb.checked);
      row.classList.toggle('selected', cb.checked);
      renderReceipt();
    });
    container.appendChild(row);
    return row;
  }

  function renderQtyRow(container, item, priceText, getQty, setQty){
    var row = document.createElement('div');
    row.className = 'option-row option-row-qty';
    var main = document.createElement('span');
    main.className = 'option-main';
    var lab = document.createElement('span');
    lab.className = 'option-label';
    lab.textContent = t(item.label);
    main.appendChild(lab);
    if (item.desc && (item.desc.en || item.desc.ko)){
      var desc = document.createElement('span');
      desc.className = 'option-desc';
      desc.textContent = t(item.desc);
      main.appendChild(desc);
    }
    row.appendChild(main);
    if (priceText){
      var price = document.createElement('span');
      price.className = 'option-price';
      price.textContent = priceText;
      row.appendChild(price);
    }
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.className = 'option-qty-input';
    input.value = getQty() || 0;
    row.appendChild(input);
    row.classList.toggle('selected', (getQty() || 0) > 0);
    input.addEventListener('input', function(){
      var v = P.clampQty(input.value);
      input.value = v;
      setQty(v);
      row.classList.toggle('selected', v > 0);
      renderReceipt();
    });
    container.appendChild(row);
    return row;
  }

  /* ── COVERAGE ───────────────────────────────────────────── */
  var hokHoursEl = document.getElementById('hokHours');

  function renderHoursSelect(){
    var current = state.hours;
    hokHoursEl.innerHTML = '';
    for (var h = P.MIN_HOURS; h <= P.MAX_HOURS; h++){
      var opt = document.createElement('option');
      opt.value = h;
      opt.textContent = state.lang === 'ko' ? (h + '시간') : (h + (h === 1 ? ' hour' : ' hours'));
      hokHoursEl.appendChild(opt);
    }
    hokHoursEl.value = current;
  }

  hokHoursEl.addEventListener('change', function(){
    state.hours = P.clampHours(hokHoursEl.value);
    renderCoverageOptions();
    renderCoverageAddons();
    renderReceipt();
  });

  function renderCoverageOptions(){
    var container = document.getElementById('coverageOptions');
    container.innerHTML = '';
    P.COVERAGE_OPTIONS.forEach(function(c){
      var row = document.createElement('label');
      row.className = 'option-row';
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'coverageType';
      radio.value = c.id;
      radio.checked = state.coverageType === c.id;
      var main = document.createElement('span');
      main.className = 'option-main';
      var lab = document.createElement('span');
      lab.className = 'option-label';
      lab.textContent = t(c.label);
      main.appendChild(lab);
      var price = document.createElement('span');
      price.className = 'option-price';
      price.textContent = priceLabel(Math.max(c.hourlyRate * state.hours, c.minPrice));
      row.appendChild(radio);
      row.appendChild(main);
      row.appendChild(price);
      row.classList.toggle('selected', radio.checked);
      radio.addEventListener('change', function(){
        state.coverageType = c.id;
        renderCoverageOptions();
        renderReceipt();
      });
      container.appendChild(row);
    });
  }

  function renderCoverageAddons(){
    var container = document.getElementById('coverageAddons');
    container.innerHTML = '';

    var ss = P.SECOND_SHOOTER;
    var ssRow = document.createElement('label');
    ssRow.className = 'option-row';
    ssRow.style.marginTop = '14px';
    var ssCb = document.createElement('input');
    ssCb.type = 'checkbox';
    ssCb.checked = state.secondShooter;
    var ssMain = document.createElement('span');
    ssMain.className = 'option-main';
    var ssLab = document.createElement('span');
    ssLab.className = 'option-label';
    ssLab.textContent = t(ss.label);
    ssMain.appendChild(ssLab);
    var ssPrice = document.createElement('span');
    ssPrice.className = 'option-price';
    ssPrice.textContent = '+' + priceLabel(Math.max(ss.hourlyRate * state.hours, ss.minPrice));
    ssRow.appendChild(ssCb);
    ssRow.appendChild(ssMain);
    ssRow.appendChild(ssPrice);
    ssRow.classList.toggle('selected', ssCb.checked);
    ssCb.addEventListener('change', function(){
      state.secondShooter = ssCb.checked;
      ssRow.classList.toggle('selected', ssCb.checked);
      renderReceipt();
    });
    container.appendChild(ssRow);

    var aa = P.AUDIO_ADDON;
    var aaRow = document.createElement('label');
    aaRow.className = 'option-row';
    aaRow.style.marginTop = '10px';
    var aaCb = document.createElement('input');
    aaCb.type = 'checkbox';
    aaCb.checked = state.audioAddon;
    var aaMain = document.createElement('span');
    aaMain.className = 'option-main';
    var aaLab = document.createElement('span');
    aaLab.className = 'option-label';
    aaLab.textContent = t(aa.label);
    aaMain.appendChild(aaLab);
    aaRow.appendChild(aaCb);
    aaRow.appendChild(aaMain);
    aaRow.classList.toggle('selected', aaCb.checked);
    aaCb.addEventListener('change', function(){
      state.audioAddon = aaCb.checked;
      aaRow.classList.toggle('selected', aaCb.checked);
      renderReceipt();
    });
    container.appendChild(aaRow);
  }

  /* ── PHOTO / VIDEO EDITING ──────────────────────────────── */
  function renderPhotoEditingOptions(){
    var container = document.getElementById('photoEditingOptions');
    container.innerHTML = '';
    P.PHOTO_EDITING_ITEMS.forEach(function(item){
      if (item.type === 'bool'){
        renderBoolRow(container, item, '+' + priceLabel(item.price),
          function(){ return state.photoEditing[item.id]; },
          function(v){ state.photoEditing[item.id] = v; });
      } else if (item.type === 'qty'){
        renderQtyRow(container, item, priceLabel(item.pricePerUnit) + (state.lang === 'ko' ? ' / 장' : ' ea.'),
          function(){ return state.photoEditing[item.id + 'Qty']; },
          function(v){ state.photoEditing[item.id + 'Qty'] = v; });
      } else if (item.type === 'halfDays'){
        renderQtyRow(container, item, priceLabel(item.pricePerUnit) + (state.lang === 'ko' ? ' / 반나절' : ' / half day'),
          function(){ return state.photoEditing[item.id + 'HalfDays']; },
          function(v){ state.photoEditing[item.id + 'HalfDays'] = v; });
      }
    });
    renderBoolRow(container, { label: P.PHOTO_RUSH.label }, null,
      function(){ return state.photoEditing.rush; },
      function(v){ state.photoEditing.rush = v; });
  }

  function renderVideoEditingOptions(){
    var container = document.getElementById('videoEditingOptions');
    container.innerHTML = '';
    P.VIDEO_EDITING_ITEMS.forEach(function(item){
      if (item.id === 'highlightClip'){
        renderQtyRow(container, item, null,
          function(){ return state.videoEditing.highlightClipQty; },
          function(v){ state.videoEditing.highlightClipQty = v; });
      } else if (item.type === 'bool'){
        renderBoolRow(container, item, '+' + priceLabel(item.price),
          function(){ return state.videoEditing[item.id]; },
          function(v){ state.videoEditing[item.id] = v; });
      } else if (item.type === 'qty'){
        renderQtyRow(container, item, priceLabel(item.pricePerUnit) + (state.lang === 'ko' ? ' / 개' : ' ea.'),
          function(){ return state.videoEditing[item.id + 'Qty']; },
          function(v){ state.videoEditing[item.id + 'Qty'] = v; });
      }
    });
    renderBoolRow(container, { label: P.VIDEO_RUSH.label }, null,
      function(){ return state.videoEditing.rush; },
      function(v){ state.videoEditing.rush = v; });
  }

  /* ── USAGE RIGHTS ───────────────────────────────────────── */
  function renderUsageRightsOptions(){
    var container = document.getElementById('usageRightsOptions');
    container.innerHTML = '';

    var paidAdsItem = P.USAGE_ITEMS.paidAds;
    var row1 = document.createElement('div');
    row1.className = 'option-row option-row-qty';
    var main1 = document.createElement('span');
    main1.className = 'option-main';
    var lab1 = document.createElement('span');
    lab1.className = 'option-label';
    lab1.textContent = t(paidAdsItem.label);
    var desc1 = document.createElement('span');
    desc1.className = 'option-desc';
    desc1.textContent = t(paidAdsItem.desc);
    main1.appendChild(lab1);
    main1.appendChild(desc1);
    row1.appendChild(main1);
    var select1 = document.createElement('select');
    select1.className = 'option-select';
    paidAdsItem.options.forEach(function(o){
      var opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = t(o.label);
      select1.appendChild(opt);
    });
    select1.value = state.usageRights.paidAds;
    row1.appendChild(select1);
    row1.classList.toggle('selected', state.usageRights.paidAds !== 'none');
    select1.addEventListener('change', function(){
      state.usageRights.paidAds = select1.value;
      row1.classList.toggle('selected', select1.value !== 'none');
      renderReceipt();
    });
    container.appendChild(row1);

    var partnerItem = P.USAGE_ITEMS.partnerUse;
    renderQtyRow(container, partnerItem, priceLabel(partnerItem.pricePerUnit) + (state.lang === 'ko' ? ' / 업체' : ' ea.'),
      function(){ return state.usageRights.partnerUseQty; },
      function(v){ state.usageRights.partnerUseQty = v; });

    var exclItem = P.USAGE_ITEMS.exclusivity;
    renderBoolRow(container, exclItem, '+' + priceLabel(exclItem.price),
      function(){ return state.usageRights.exclusivity; },
      function(v){ state.usageRights.exclusivity = v; });

    var buyoutItem = P.USAGE_ITEMS.buyout;
    renderBoolRow(container, buyoutItem, state.lang === 'ko' ? '별도 견적' : 'Custom quote',
      function(){ return state.usageRights.buyout; },
      function(v){ state.usageRights.buyout = v; });
  }

  /* ── EVENT DESCRIPTION ──────────────────────────────────── */
  var descInput = document.getElementById('cqDescription');
  var descCounter = document.getElementById('cqDescCounter');

  function updateDescCounter(){
    var len = descInput.value.trim().length;
    var ok = len >= MIN_DESCRIPTION_LENGTH;
    descCounter.textContent = len + ' / ' + MIN_DESCRIPTION_LENGTH;
    descCounter.classList.toggle('ok', ok);
    if (len > 0) fieldError(descInput, ok ? '' : (state.lang === 'ko' ? '최소 100자 이상 입력해 주세요' : 'Please write at least 100 characters'));
  }
  descInput.addEventListener('input', updateDescCounter);

  /* ── RECEIPT ────────────────────────────────────────────── */
  function lineLabel(line){
    var lbl = t(line.label);
    if (line.variant) lbl += ' — ' + t(line.variant);
    return lbl;
  }

  function lineQtyText(line){
    if (line.section === 'coverage' && line.id !== 'audio'){
      return line.qty + (state.lang === 'ko' ? '시간' : (line.qty === 1 ? ' hour' : ' hours'));
    }
    if (line.qty > 1) return '× ' + line.qty;
    return '';
  }

  function renderReceipt(){
    var result = P.computeTotal(buildSelections());
    var linesEl = document.getElementById('hokReceiptLines');
    linesEl.innerHTML = '';
    if (result.lines.length === 0){
      var empty = document.createElement('div');
      empty.className = 'hok-receipt-empty';
      empty.textContent = state.lang === 'ko' ? '아직 선택된 항목이 없습니다.' : 'Nothing selected yet.';
      linesEl.appendChild(empty);
    } else {
      result.lines.forEach(function(line){
        var row = document.createElement('div');
        row.className = 'hok-receipt-line';
        var left = document.createElement('span');
        var lbl = document.createElement('span');
        lbl.className = 'hrl-label';
        lbl.textContent = lineLabel(line);
        left.appendChild(lbl);
        var qtyText = lineQtyText(line);
        if (qtyText){
          var qty = document.createElement('span');
          qty.className = 'hrl-qty';
          qty.textContent = qtyText;
          left.appendChild(qty);
        }
        var amt = document.createElement('span');
        amt.className = 'hrl-amt';
        amt.textContent = priceLabel(line.amount);
        row.appendChild(left);
        row.appendChild(amt);
        linesEl.appendChild(row);
      });
    }
    document.getElementById('hokReceiptTotal').textContent = priceLabel(result.total);
    document.getElementById('hokBuyoutNoteEn').style.display = result.buyoutInterest ? 'block' : 'none';
    document.getElementById('hokBuyoutNoteKo').style.display = result.buyoutInterest ? 'block' : 'none';
    return result;
  }

  /* ── VALIDATION ─────────────────────────────────────────── */
  function validateForm(){
    var msgEl = document.getElementById('hokMsg');
    var valid = true;
    var missing = [];

    if (!state.coverageType){ valid = false; missing.push(state.lang === 'ko' ? '촬영 종류' : 'Coverage type'); }

    var descLen = descInput.value.trim().length;
    updateDescCounter();
    if (descLen < MIN_DESCRIPTION_LENGTH){
      valid = false;
      missing.push(state.lang === 'ko' ? '설명 (최소 100자)' : 'Description (100 characters minimum)');
    }

    var dateInput = document.getElementById('hokDate');
    var timeInput = document.getElementById('hokTime');
    fieldError(dateInput, dateInput.value ? '' : (state.lang === 'ko' ? '필수' : 'Required'));
    fieldError(timeInput, timeInput.value ? '' : (state.lang === 'ko' ? '필수' : 'Required'));
    if (!dateInput.value || !timeInput.value) valid = false;

    var nameInput = document.getElementById('hokName');
    var emailInput = document.getElementById('hokEmail');
    var phoneInput = document.getElementById('hokPhone');
    fieldError(nameInput, nameInput.value.trim() ? '' : (state.lang === 'ko' ? '필수' : 'Required'));
    fieldError(emailInput, /^\S+@\S+\.\S+$/.test(emailInput.value.trim()) ? '' : (state.lang === 'ko' ? '올바른 이메일을 입력해 주세요' : 'Valid email required'));
    fieldError(phoneInput, phoneInput.value.trim().length >= 7 ? '' : (state.lang === 'ko' ? '올바른 전화번호를 입력해 주세요' : 'Valid phone required'));
    if (!nameInput.value.trim() || !/^\S+@\S+\.\S+$/.test(emailInput.value.trim()) || phoneInput.value.trim().length < 7) valid = false;

    var termsBox = document.getElementById('hokTerms');
    if (!termsBox.checked){ valid = false; missing.push(state.lang === 'ko' ? '계약 조건 동의' : 'Terms agreement'); }

    if (!state.payMethod){ valid = false; missing.push(state.lang === 'ko' ? '결제 방법' : 'Payment method'); }

    if (!valid){
      msgEl.className = 'auth-msg err';
      msgEl.textContent = (state.lang === 'ko' ? '다음 항목을 확인해 주세요: ' : 'Please check: ') +
        (missing.length ? missing.join(', ') : (state.lang === 'ko' ? '위 표시된 필수 입력란' : 'the required fields marked above'));
    } else {
      msgEl.textContent = '';
    }
    return valid;
  }

  function collectPayload(){
    return {
      lang: state.lang,
      selections: buildSelections(),
      description: descInput.value.trim(),
      date: document.getElementById('hokDate').value,
      time: document.getElementById('hokTime').value,
      customer: {
        name: document.getElementById('hokName').value.trim(),
        email: document.getElementById('hokEmail').value.trim(),
        phone: document.getElementById('hokPhone').value.trim()
      },
      payMethod: state.payMethod,
      termsAccepted: document.getElementById('hokTerms').checked
    };
  }

  /* ── PAYMENT METHODS ────────────────────────────────────── */
  function memoLineHtml(refId){
    if (refId){
      return '<p class="memo-note lang-en">Reference: <code>' + refId + '</code> — include this in your payment\'s memo/message so it can be matched to your request.</p>' +
             '<p class="memo-note lang-ko">참조번호: <code>' + refId + '</code> — 결제 메모/메시지에 이 번호를 포함해 주세요.</p>';
    }
    return '<p class="memo-note lang-en">A reference number will appear here once you submit the request below — include it in your payment\'s memo/message.</p>' +
           '<p class="memo-note lang-ko">아래에서 요청을 제출하시면 참조번호가 표시됩니다 — 결제 메모/메시지에 포함해 주세요.</p>';
  }

  function renderPayDetail(){
    var detail = document.getElementById('hokPayDetail');
    detail.innerHTML = '';
    if (!state.payMethod) return;
    var total = P.computeTotal(buildSelections()).total;

    var wrap = document.createElement('div');
    wrap.className = 'hok-pay-detail';

    if (state.payMethod === 'zelle'){
      wrap.innerHTML =
        '<p class="lang-en">Send <strong>' + priceLabel(total) + '</strong> via Zelle to <code>845-443-6001</code>.</p>' +
        '<p class="lang-ko">Zelle로 <code>845-443-6001</code>에 <strong>' + priceLabel(total) + '</strong>을 송금해 주세요.</p>' +
        '<div id="cqMemoLine">' + memoLineHtml(null) + '</div>';
    } else if (state.payMethod === 'paypal'){
      wrap.innerHTML =
        '<p class="lang-en">Send <strong>' + priceLabel(total) + '</strong> via PayPal to <code>ttv.mikofusco@gmail.com</code>.</p>' +
        '<p class="lang-ko">PayPal로 <code>ttv.mikofusco@gmail.com</code>에 <strong>' + priceLabel(total) + '</strong>을 송금해 주세요.</p>' +
        '<div id="cqMemoLine">' + memoLineHtml(null) + '</div>';
    } else if (state.payMethod === 'bank'){
      wrap.innerHTML =
        '<p class="lang-en">Wire <strong>' + priceLabel(total) + '</strong> to one of the accounts below.</p>' +
        '<p class="lang-ko">아래 계좌 중 하나로 <strong>' + priceLabel(total) + '</strong>을 송금해 주세요.</p>' +
        '<p><strong class="lang-en">Korea — Hana Bank</strong><strong class="lang-ko">한국 — 하나은행</strong><br>' +
        '<span class="lang-en">Account: </span><span class="lang-ko">계좌번호: </span><code>340-910425-87107</code></p>' +
        '<p><strong class="lang-en">US — JP Morgan Chase</strong><strong class="lang-ko">미국 — JP모건 체이스</strong><br>' +
        '<span class="lang-en">Account: </span><span class="lang-ko">계좌번호: </span><code>505613110</code><br>' +
        '<span class="lang-en">Routing: </span><span class="lang-ko">라우팅 번호: </span><code>022300173</code><br>' +
        '<span class="lang-en">SWIFT (international transfers): </span><span class="lang-ko">SWIFT (해외 송금용): </span><code>CHASUS33</code></p>' +
        '<div id="cqMemoLine">' + memoLineHtml(null) + '</div>';
    } else if (state.payMethod === 'stripe'){
      wrap.innerHTML = '<div id="hokStripeElement"></div><div class="auth-msg" id="hokStripeMsg" style="margin-top:10px;"></div>';
    }

    detail.appendChild(wrap);

    if (state.payMethod === 'stripe'){
      startStripePayment();
    } else {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-gold';
      btn.id = 'hokSubmitBtn';
      btn.innerHTML = '<span class="lang-en">Submit Quote Request</span><span class="lang-ko">견적 요청 제출</span>';
      btn.addEventListener('click', submitNonStripe);
      wrap.appendChild(btn);
    }
  }

  document.querySelectorAll('#hokPayMethods .option-row').forEach(function(row){
    row.addEventListener('click', function(){
      document.querySelectorAll('#hokPayMethods .option-row').forEach(function(r){ r.classList.remove('selected'); });
      row.classList.add('selected');
      row.querySelector('input').checked = true;
      state.payMethod = row.dataset.pay;
      renderPayDetail();
    });
  });

  function submitNonStripe(){
    if (!validateForm()) return;
    var btn = document.getElementById('hokSubmitBtn');
    var msgEl = document.getElementById('hokMsg');
    btn.disabled = true;
    msgEl.className = 'auth-msg';
    msgEl.textContent = state.lang === 'ko' ? '제출 중…' : 'Submitting…';

    fetch(window.SOLARM_CONFIG.API_BASE + '/api/custom-quote/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectPayload())
    })
      .then(function(res){
        if (!res.ok) return res.json().then(function(b){ throw new Error(b.error || 'Could not submit.'); });
        return res.json();
      })
      .then(function(data){
        msgEl.className = 'auth-msg ok';
        msgEl.textContent = state.lang === 'ko'
          ? '견적 요청이 접수되었습니다. 결제 확인 후 담당자가 연락드리겠습니다. (참조번호: ' + data.id + ')'
          : 'Quote request received. We will confirm once payment is received. (Reference: ' + data.id + ')';
        var memoWrap = document.getElementById('cqMemoLine');
        if (memoWrap) memoWrap.innerHTML = memoLineHtml(data.id);
        if (window.SolarM && window.SolarM.toast) window.SolarM.toast(state.lang === 'ko' ? '제출되었습니다.' : 'Submitted.');
        btn.disabled = false;
      })
      .catch(function(err){
        msgEl.className = 'auth-msg err';
        msgEl.textContent = err.message || (state.lang === 'ko' ? '제출 중 오류가 발생했습니다.' : 'Something went wrong submitting this.');
        btn.disabled = false;
      });
  }

  /* ── STRIPE PAYMENT ─────────────────────────────────────── */
  function startStripePayment(){
    var container = document.getElementById('hokStripeElement');
    var msgEl = document.getElementById('hokStripeMsg');
    if (!stripe){
      if (container) container.textContent = 'Stripe.js failed to load — check your internet connection.';
      return;
    }
    if (!validateForm()){
      if (msgEl) msgEl.textContent = state.lang === 'ko' ? '먼저 위 필수 항목을 완료해 주세요.' : 'Please complete the required fields above first.';
      return;
    }
    container.textContent = state.lang === 'ko' ? '결제 양식을 불러오는 중…' : 'Loading payment form…';

    fetch(window.SOLARM_CONFIG.API_BASE + '/api/custom-quote/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectPayload())
    })
      .then(function(res){
        if (!res.ok) return res.json().then(function(b){ throw new Error(b.error || 'Could not start payment.'); });
        return res.json();
      })
      .then(function(data){
        state.clientSecret = data.clientSecret;
        state.paymentIntentId = data.paymentIntentId;

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
        container.innerHTML = '';
        paymentElement.mount('#hokStripeElement');

        var payBtn = document.createElement('button');
        payBtn.type = 'button';
        payBtn.className = 'btn btn-gold';
        payBtn.id = 'hokStripePayBtn';
        payBtn.style.marginTop = '14px';
        payBtn.innerHTML = '<span class="lang-en">Pay ' + priceLabel(data.amount / 100) + '</span><span class="lang-ko">' + priceLabel(data.amount / 100) + ' 결제</span>';
        payBtn.addEventListener('click', confirmStripePayment);
        container.parentElement.insertBefore(payBtn, document.getElementById('hokStripeMsg'));
      })
      .catch(function(err){
        container.textContent = '';
        msgEl.textContent = err.message || (state.lang === 'ko' ? '결제 서버에 연결할 수 없습니다.' : 'Could not reach the payment server.');
      });
  }

  function confirmStripePayment(){
    if (!stripe || !elements) return;
    var payBtn = document.getElementById('hokStripePayBtn');
    var msgEl = document.getElementById('hokStripeMsg');
    payBtn.disabled = true;
    payBtn.textContent = state.lang === 'ko' ? '처리 중…' : 'Processing…';
    msgEl.textContent = '';

    stripe.confirmPayment({ elements: elements, redirect: 'if_required' }).then(function(result){
      if (result.error){
        msgEl.textContent = result.error.message;
        payBtn.disabled = false;
        payBtn.innerHTML = '<span class="lang-en">Pay</span><span class="lang-ko">결제</span>';
        return;
      }
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded'){
        finalizeStripeBooking(result.paymentIntent.id);
      } else {
        msgEl.textContent = state.lang === 'ko' ? '결제가 완료되지 않았습니다.' : 'Payment did not complete.';
        payBtn.disabled = false;
      }
    }).catch(function(err){
      msgEl.textContent = err.message || (state.lang === 'ko' ? '결제 확인 중 오류가 발생했습니다.' : 'Something went wrong confirming payment.');
      payBtn.disabled = false;
    });
  }

  function finalizeStripeBooking(paymentIntentId){
    var msgEl = document.getElementById('hokStripeMsg');
    var payload = collectPayload();
    payload.paymentIntentId = paymentIntentId;
    fetch(window.SOLARM_CONFIG.API_BASE + '/api/custom-quote/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(res){
        if (!res.ok) return res.json().then(function(b){ throw new Error(b.error || 'Could not save.'); });
        return res.json();
      })
      .then(function(data){
        msgEl.className = 'auth-msg ok';
        msgEl.textContent = state.lang === 'ko'
          ? '결제가 완료되었습니다! 확인 메일을 보내드립니다. (참조번호: ' + data.id + ')'
          : 'Payment received! A confirmation will follow by email. (Reference: ' + data.id + ')';
        if (window.SolarM && window.SolarM.toast) window.SolarM.toast(state.lang === 'ko' ? '결제가 완료되었습니다.' : 'Payment received.');
      })
      .catch(function(err){
        // Payment already succeeded — the Stripe webhook (server/src/routes/webhook.js)
        // picks this up server-side even if this save request fails.
        console.warn('Quote save failed after successful payment:', err.message);
        msgEl.className = 'auth-msg ok';
        msgEl.textContent = state.lang === 'ko'
          ? '결제가 완료되었습니다. 확인을 위해 연락드리겠습니다.'
          : 'Payment received. We will follow up to confirm details.';
      });
  }

  /* ── LANGUAGE TOGGLE ────────────────────────────────────── */
  function setLang(lang){
    state.lang = lang;
    document.body.classList.toggle('lang-is-ko', lang === 'ko');
    document.getElementById('langToggle').textContent = lang === 'ko' ? 'EN / 한국어' : '한국어 / EN';
    renderHoursSelect();
    renderCoverageOptions();
    renderCoverageAddons();
    renderPhotoEditingOptions();
    renderVideoEditingOptions();
    renderUsageRightsOptions();
    updateDescCounter();
    renderReceipt();
    renderPayDetail();
  }

  document.getElementById('langToggle').addEventListener('click', function(){
    setLang(state.lang === 'en' ? 'ko' : 'en');
  });

  /* ── INIT ───────────────────────────────────────────────── */
  var yearEl2 = document.getElementById('year2');
  if (yearEl2) yearEl2.textContent = new Date().getFullYear();

  setLang('en');
})();
