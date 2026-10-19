/* ── HAUS OF K custom-quote pricing catalog ────────────────────
   Pure data + pure functions, no DOM access — this file is loaded
   two ways:
     1. As a plain <script> in haus-of-k-quote.html (defines
        window.HausOfKPricing)
     2. Via require() from the backend (server/src/routes/hausOfK.js)
        so the server can recompute the authoritative total itself
        instead of trusting whatever the browser sends.
   Keep both call sites working if you change this file — it's the
   single source of truth for this quote, mirroring the rate card.
------------------------------------------------------------- */
(function(root){
  "use strict";

  var COVERAGE_OPTIONS = [
    { id:'photo', hourlyRate:150, minPrice:300, label:{ en:'Photo only', ko:'사진 촬영' } },
    { id:'video', hourlyRate:200, minPrice:400, label:{ en:'Video only', ko:'영상 촬영' } },
    { id:'both', hourlyRate:275, minPrice:550, label:{ en:'Photo + Video (one shooter)', ko:'사진 + 영상 (촬영자 1인)' } }
  ];
  var SECOND_SHOOTER = { hourlyRate:100, minPrice:200, label:{ en:'Second shooter', ko:'추가 촬영자' } };
  var AUDIO_ADDON = { price:100, label:{ en:'Multiple mics / panel setup (+$100)', ko:'마이크 여러 개 또는 패널 세팅 (+$100)' } };
  var MIN_HOURS = 2;
  var MAX_HOURS = 12;

  // type: 'bool' | 'qty' | 'halfDays' — drives which input the UI renders.
  var PHOTO_EDITING_ITEMS = [
    { id:'highlights', type:'bool', price:150,
      label:{ en:'Highlights set', ko:'하이라이트 세트' },
      desc:{ en:'25 edited images: speakers, room, key moments', ko:'편집 사진 25장: 연사, 행사장, 주요 순간' } },
    { id:'standard', type:'bool', price:275,
      label:{ en:'Standard gallery', ko:'스탠다드 갤러리' },
      desc:{ en:'60 edited images', ko:'편집 사진 60장' } },
    { id:'full', type:'halfDays', pricePerUnit:400,
      label:{ en:'Full gallery', ko:'풀 갤러리' },
      desc:{ en:'Every usable frame edited — $400 per half day covered', ko:'사용 가능한 모든 컷 편집 — 촬영 반나절당 $400' } },
    { id:'retouch', type:'qty', pricePerUnit:20,
      label:{ en:'Headshot / portrait retouching', ko:'프로필 / 인물 사진 리터칭' },
      desc:{ en:'$20 per image — skin, stray hair, background cleanup', ko:'장당 $20 — 피부, 잔머리, 배경 정리' } },
    { id:'sameNight', type:'bool', price:100,
      label:{ en:'Same-night selects', ko:'당일 밤 셀렉 사진' },
      desc:{ en:'10 edited images within 3 hours of wrap', ko:'촬영 종료 후 3시간 이내 편집 사진 10장' } }
  ];
  var PHOTO_RUSH = { percentOfSection:0.25, label:{ en:'Rush delivery (48 hr, +25% of photo editing)', ko:'긴급 납품 (48시간, 사진 편집 총액의 +25%)' } };

  var VIDEO_EDITING_ITEMS = [
    { id:'highlightClip', type:'qty',
      label:{ en:'Event highlight clip (vertical, 30–60 sec)', ko:'행사 하이라이트 클립 (세로형, 30–60초)' },
      desc:{ en:'$150 each, or 3 for $375 (each beyond 3 is $150)', ko:'개당 $150, 3개 $375 (3개 초과분은 개당 $150)' } },
    { id:'recapFilm', type:'bool', price:600,
      label:{ en:'Recap film (2–3 min)', ko:'리캡 영상 (2–3분)' },
      desc:{ en:'Horizontal event recap with speaker soundbites and B-roll', ko:'연사 인터뷰 발췌와 B-roll이 포함된 가로형 행사 리캡' } },
    { id:'talkEdit', type:'qty', pricePerUnit:150,
      label:{ en:'Full talk / panel edit', ko:'강연 / 패널 전체 편집' },
      desc:{ en:'$150 per talk — synced audio, titles, lower thirds', ko:'세션당 $150 — 오디오 싱크, 타이틀, 자막 바 포함' } },
    { id:'captions', type:'qty', pricePerUnit:40,
      label:{ en:'Captions', ko:'자막' },
      desc:{ en:'$40 per video — burned-in or sidecar (.srt) file', ko:'영상당 $40 — 영상 삽입 자막 또는 별도 자막 파일(.srt)' } },
    { id:'altRatio', type:'qty', pricePerUnit:60,
      label:{ en:'Alternate aspect ratio', ko:'추가 화면 비율' },
      desc:{ en:'$60 per video — e.g. a 16:9 recap also as 9:16 or 1:1', ko:'영상당 $60 — 예: 16:9 리캡 영상을 9:16 또는 1:1로도 제공' } },
    { id:'extraRevision', type:'qty', pricePerUnit:25,
      label:{ en:'Extra revision round', ko:'추가 수정' },
      desc:{ en:'$25 per round, after the included round', ko:'회당 $25, 기본 포함 수정 이후' } },
    { id:'rawFootage', type:'bool', price:200,
      label:{ en:'Raw footage delivery', ko:'원본 영상 전달' },
      desc:{ en:'All original clips organized on a shared drive', ko:'모든 원본 클립을 정리하여 공유 드라이브로 전달' } }
  ];
  var VIDEO_RUSH = { percentOfSection:0.30, label:{ en:'Rush delivery (72 hr, +30% of video editing)', ko:'긴급 납품 (72시간, 영상 편집 총액의 +30%)' } };

  var USAGE_ITEMS = {
    paidAds: {
      label:{ en:'Paid advertising', ko:'유료 광고' },
      desc:{ en:'Boosted posts, paid social, or any paid placement', ko:'게시물 부스팅, 유료 SNS 광고 등 모든 유료 게재' },
      options:[
        { value:'none', price:0, label:{ en:'None', ko:'해당 없음' } },
        { value:'6', price:250, label:{ en:'6 months — $250', ko:'6개월 — $250' } },
        { value:'12', price:400, label:{ en:'12 months — $400', ko:'12개월 — $400' } }
      ]
    },
    partnerUse: { type:'qty', pricePerUnit:150,
      label:{ en:'Partner / sponsor use', ko:'파트너 / 스폰서 사용' },
      desc:{ en:'$150 per outside company posting the content on their own channels', ko:'외부 업체당 $150 — 연사 소속 회사, 스폰서, 투자자가 자체 채널에 게시' } },
    exclusivity: { type:'bool', price:100,
      label:{ en:'Exclusivity', ko:'독점 사용' },
      desc:{ en:'The content won’t be licensed to anyone else', ko:'촬영자가 해당 콘텐츠를 다른 곳에 라이선스하지 않음' } },
    buyout: { type:'interest',
      label:{ en:'Full buyout / copyright transfer', ko:'완전 매입 / 저작권 양도' },
      desc:{ en:'Custom quote — check this box and we’ll follow up separately, it’s not included in the total below', ko:'별도 견적 — 체크하시면 별도로 안내드리며, 아래 합계에는 포함되지 않습니다' } }
  };

  function clampHours(hours){
    var n = Math.round(Number(hours));
    if (!Number.isFinite(n)) n = MIN_HOURS;
    return Math.max(MIN_HOURS, Math.min(MAX_HOURS, n));
  }

  function clampQty(n){
    n = Math.round(Number(n));
    if (!Number.isFinite(n) || n < 0) n = 0;
    return n;
  }

  function highlightClipCost(qty){
    qty = clampQty(qty);
    if (qty <= 0) return 0;
    if (qty < 3) return qty * 150;
    return 375 + (qty - 3) * 150;
  }

  // sel is the selections shape described at the top of hausOfK.js.
  // Returns a breakdown of every priced line (for the receipt / email)
  // plus the grand total, in whole dollars (not cents).
  function computeTotal(sel){
    sel = sel || {};
    var lines = [];
    var hours = clampHours(sel.hours);
    var coverage = COVERAGE_OPTIONS.filter(function(c){ return c.id === sel.coverageType; })[0];

    if (coverage){
      var coverageCost = Math.max(coverage.hourlyRate * hours, coverage.minPrice);
      lines.push({ section:'coverage', id:coverage.id, label:coverage.label, qty:hours, amount:coverageCost });

      if (sel.secondShooter){
        var secondCost = Math.max(SECOND_SHOOTER.hourlyRate * hours, SECOND_SHOOTER.minPrice);
        lines.push({ section:'coverage', id:'secondShooter', label:SECOND_SHOOTER.label, qty:hours, amount:secondCost });
      }
      if (sel.audioAddon){
        lines.push({ section:'coverage', id:'audio', label:AUDIO_ADDON.label, qty:1, amount:AUDIO_ADDON.price });
      }
    }

    var pe = sel.photoEditing || {};
    var photoEditingSubtotal = 0;
    PHOTO_EDITING_ITEMS.forEach(function(item){
      var amount = 0, qty = 0;
      if (item.type === 'bool' && pe[item.id]){ amount = item.price; qty = 1; }
      else if (item.type === 'qty'){ qty = clampQty(pe[item.id + 'Qty']); amount = qty * item.pricePerUnit; }
      else if (item.type === 'halfDays'){ qty = clampQty(pe[item.id + 'HalfDays']); amount = qty * item.pricePerUnit; }
      if (amount > 0) {
        lines.push({ section:'photoEditing', id:item.id, label:item.label, qty:qty, amount:amount });
        photoEditingSubtotal += amount;
      }
    });
    if (pe.rush && photoEditingSubtotal > 0){
      var photoRushAmount = Math.round(photoEditingSubtotal * PHOTO_RUSH.percentOfSection * 100) / 100;
      lines.push({ section:'photoEditing', id:'rush', label:PHOTO_RUSH.label, qty:1, amount:photoRushAmount });
      photoEditingSubtotal += photoRushAmount;
    }

    var ve = sel.videoEditing || {};
    var videoEditingSubtotal = 0;
    VIDEO_EDITING_ITEMS.forEach(function(item){
      var amount = 0, qty = 0;
      if (item.id === 'highlightClip'){
        qty = clampQty(ve.highlightClipQty);
        amount = highlightClipCost(qty);
      } else if (item.type === 'bool' && ve[item.id]){ amount = item.price; qty = 1; }
      else if (item.type === 'qty'){ qty = clampQty(ve[item.id + 'Qty']); amount = qty * item.pricePerUnit; }
      if (amount > 0){
        lines.push({ section:'videoEditing', id:item.id, label:item.label, qty:qty, amount:amount });
        videoEditingSubtotal += amount;
      }
    });
    if (ve.rush && videoEditingSubtotal > 0){
      var videoRushAmount = Math.round(videoEditingSubtotal * VIDEO_RUSH.percentOfSection * 100) / 100;
      lines.push({ section:'videoEditing', id:'rush', label:VIDEO_RUSH.label, qty:1, amount:videoRushAmount });
      videoEditingSubtotal += videoRushAmount;
    }

    var ur = sel.usageRights || {};
    if (ur.paidAds && ur.paidAds !== 'none'){
      var adsOpt = USAGE_ITEMS.paidAds.options.filter(function(o){ return o.value === String(ur.paidAds); })[0];
      if (adsOpt && adsOpt.price > 0){
        lines.push({ section:'usageRights', id:'paidAds', label:USAGE_ITEMS.paidAds.label, qty:1, amount:adsOpt.price, variant:adsOpt.label });
      }
    }
    var partnerQty = clampQty(ur.partnerUseQty);
    if (partnerQty > 0){
      lines.push({ section:'usageRights', id:'partnerUse', label:USAGE_ITEMS.partnerUse.label, qty:partnerQty, amount:partnerQty * USAGE_ITEMS.partnerUse.pricePerUnit });
    }
    if (ur.exclusivity){
      lines.push({ section:'usageRights', id:'exclusivity', label:USAGE_ITEMS.exclusivity.label, qty:1, amount:USAGE_ITEMS.exclusivity.price });
    }

    var total = 0;
    lines.forEach(function(l){ total += l.amount; });
    total = Math.round(total * 100) / 100;

    return {
      lines: lines,
      hours: hours,
      buyoutInterest: !!ur.buyout,
      total: total
    };
  }

  var HausOfKPricing = {
    COVERAGE_OPTIONS: COVERAGE_OPTIONS,
    SECOND_SHOOTER: SECOND_SHOOTER,
    AUDIO_ADDON: AUDIO_ADDON,
    MIN_HOURS: MIN_HOURS,
    MAX_HOURS: MAX_HOURS,
    PHOTO_EDITING_ITEMS: PHOTO_EDITING_ITEMS,
    PHOTO_RUSH: PHOTO_RUSH,
    VIDEO_EDITING_ITEMS: VIDEO_EDITING_ITEMS,
    VIDEO_RUSH: VIDEO_RUSH,
    USAGE_ITEMS: USAGE_ITEMS,
    clampHours: clampHours,
    clampQty: clampQty,
    highlightClipCost: highlightClipCost,
    computeTotal: computeTotal
  };

  if (typeof module !== 'undefined' && module.exports){
    module.exports = HausOfKPricing;
  } else {
    root.HausOfKPricing = HausOfKPricing;
  }
})(typeof window !== 'undefined' ? window : this);
