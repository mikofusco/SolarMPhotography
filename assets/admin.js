(function(){
  "use strict";

  var KEY_STORAGE = 'solarm_admin_key';
  var API_BASE = window.SOLARM_CONFIG.API_BASE;

  function escapeHtml(str){
    // Booking fields (name, notes, etc.) come straight from the public
    // booking form — never interpolate them into innerHTML unescaped.
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtHour(h){
    if (h == null || isNaN(h)) return '';
    var period = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':00 ' + period;
  }

  function renderTable(bookings){
    document.getElementById('adminCount').textContent =
      bookings.length + (bookings.length === 1 ? ' booking' : ' bookings');
    var tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    bookings.forEach(function(b){
      var c = b.customer || {};
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(b.id) + '</td>' +
        '<td>' + escapeHtml(b.service) + '</td>' +
        '<td>' + escapeHtml(b.date) + '</td>' +
        '<td>' + escapeHtml(fmtHour(b.hour)) + '</td>' +
        '<td>' + escapeHtml((c.firstName || '') + ' ' + (c.lastName || '')) + '</td>' +
        '<td>' + escapeHtml(c.email) + '</td>' +
        '<td>' + escapeHtml(c.phone) + '</td>' +
        '<td>' + escapeHtml(c.contactMethod) + '</td>' +
        '<td>' + escapeHtml(c.gender) + '</td>' +
        '<td>' + escapeHtml(c.notes) + '</td>' +
        '<td>$' + Number(b.total || 0).toFixed(2) + '</td>' +
        '<td>' + escapeHtml(b.createdAt ? new Date(b.createdAt).toLocaleString() : '') + '</td>';
      tbody.appendChild(tr);
    });
  }

  function loadBookings(key){
    var msg = document.getElementById('adminMsg');
    msg.textContent = '';
    fetch(API_BASE + '/api/bookings', { headers: { 'x-admin-key': key } })
      .then(function(res){
        if (res.status === 401) throw new Error('Incorrect admin key.');
        if (!res.ok) throw new Error('Could not load bookings.');
        return res.json();
      })
      .then(function(bookings){
        sessionStorage.setItem(KEY_STORAGE, key);
        renderTable(bookings);
        document.getElementById('adminGate').style.display = 'none';
        document.getElementById('adminTableWrap').style.display = 'block';
      })
      .catch(function(err){
        msg.textContent = err.message || 'Could not reach the backend. Make sure it is running — see SETUP.md.';
        msg.className = 'auth-msg err';
      });
  }

  document.getElementById('adminLoadBtn').addEventListener('click', function(){
    var key = document.getElementById('adminKeyInput').value.trim();
    if (!key) return;
    loadBookings(key);
  });
  document.getElementById('adminKeyInput').addEventListener('keydown', function(e){
    if (e.key === 'Enter') document.getElementById('adminLoadBtn').click();
  });
  document.getElementById('adminRefreshBtn').addEventListener('click', function(){
    var key = sessionStorage.getItem(KEY_STORAGE);
    if (key) loadBookings(key);
  });

  // Re-load automatically if this tab already has the key from earlier this session.
  var savedKey = sessionStorage.getItem(KEY_STORAGE);
  if (savedKey){
    document.getElementById('adminKeyInput').value = savedKey;
    loadBookings(savedKey);
  }
})();
