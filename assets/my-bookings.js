(function(){
  "use strict";

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function fmtHour(h){
    var period = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':00 ' + period;
  }

  function fmtDate(key){
    var d = new Date(key + 'T00:00:00');
    return MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function bookingCard(b){
    var div = document.createElement('div');
    div.className = 'booking-card';
    div.innerHTML =
      '<div class="bk-main">' +
        '<h3>' + b.service + '</h3>' +
        '<div class="bk-meta">' + fmtDate(b.date) + ' · ' + fmtHour(b.hour) + '</div>' +
        '<div class="bk-id">Confirmation #' + b.id + '</div>' +
      '</div>' +
      '<div class="bk-total">' +
        '<span class="amt">$' + Number(b.total).toFixed(2) + '</span>' +
        '<span class="bk-status paid">Paid</span>' +
      '</div>';
    return div;
  }

  function render(){
    var user = window.SolarM.currentUser();
    var gate = document.getElementById('signinGate');
    var wrap = document.getElementById('bookingsWrap');

    if (!user){
      gate.style.display = 'block';
      wrap.style.display = 'none';
      return;
    }
    gate.style.display = 'none';
    wrap.style.display = 'block';

    var mine = window.SolarM.getBookings().filter(function(b){
      return b.customer && b.customer.email && b.customer.email.toLowerCase() === user.email.toLowerCase();
    });

    var tKey = (function(){ var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'); })();
    var upcoming = mine.filter(function(b){ return b.date >= tKey; })
      .sort(function(a,b){ return a.date.localeCompare(b.date) || a.hour - b.hour; });
    var past = mine.filter(function(b){ return b.date < tKey; })
      .sort(function(a,b){ return b.date.localeCompare(a.date) || b.hour - a.hour; });

    var upcomingList = document.getElementById('upcomingList');
    var pastList = document.getElementById('pastList');
    upcomingList.innerHTML = '';
    pastList.innerHTML = '';
    upcoming.forEach(function(b){ upcomingList.appendChild(bookingCard(b)); });
    past.forEach(function(b){ pastList.appendChild(bookingCard(b)); });

    document.getElementById('upcomingWrap').style.display = upcoming.length ? 'block' : 'none';
    document.getElementById('pastWrap').style.display = past.length ? 'block' : 'none';
    document.getElementById('emptyState').style.display = mine.length ? 'none' : 'block';
  }

  document.getElementById('gateSignIn').addEventListener('click', function(){
    window.SolarM.openAuth('signin');
  });
  document.addEventListener('solarm:authchange', render);
  render();
})();
