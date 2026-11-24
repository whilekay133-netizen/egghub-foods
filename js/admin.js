(function(){
  var pass = null; // kept in memory only, never stored
  var $ = function(id){ return document.getElementById(id); };
  var ngn = function(n){ return '₦' + (Number(n)||0).toLocaleString('en-NG'); };
  function call(body){
    return fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; }); });
  }
  function msg(el, text, cls){ el.textContent = text; el.className = 'msg' + (cls ? ' ' + cls : ''); }
  function preview(){ $('pvBig').textContent = ngn($('big').value); $('pvMed').textContent = ngn($('medium').value); }
  function show(d){
    $('loginCard').hidden = true; $('editCard').hidden = false;
    $('big').value = d.prices.big; $('medium').value = d.prices.medium; preview();
    $('dStore').className = 'dot' + (d.storage ? ' on' : ''); $('tStore').textContent = d.storage ? '— connected' : '— not connected yet (prices cannot be saved)';
    $('dMail').className = 'dot' + (d.email ? ' on' : ''); $('tMail').textContent = d.email ? '— on' : '— off (customers use their own email app)';
    $('tUpd').textContent = d.prices.updatedAt ? 'Last changed: ' + new Date(d.prices.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Showing the default prices.';
    $('big').focus();
  }
  $('loginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var b = $('loginBtn'), pw = $('pw').value; b.disabled = true; msg($('loginMsg'), '');
    call({ action: 'login', password: pw }).then(function(d){
      if(d.ok){ pass = pw; $('pw').value = ''; show(d); }
      else msg($('loginMsg'), d.error || 'Could not sign in.', 'bad');
    }).catch(function(){ msg($('loginMsg'), 'Network error. Check your connection.', 'bad'); })
      .then(function(){ b.disabled = false; });
  });
  ['big','medium'].forEach(function(id){ $(id).addEventListener('input', preview); });
  $('priceForm').addEventListener('submit', function(e){
    e.preventDefault();
    var big = parseInt($('big').value, 10), medium = parseInt($('medium').value, 10);
    var ok = function(n){ return n >= 1000 && n <= 50000; };
    if(!ok(big) || !ok(medium)){ msg($('saveMsg'), 'Prices must be between ₦1,000 and ₦50,000.', 'bad'); return; }
    if(!confirm('Update the website to Big ' + ngn(big) + ' and Medium ' + ngn(medium) + '?')) return;
    var b = $('saveBtn'); b.disabled = true; msg($('saveMsg'), 'Saving…');
    call({ action: 'save', password: pass, big: big, medium: medium }).then(function(d){
      if(d.ok){ msg($('saveMsg'), 'Saved. The website now shows ' + ngn(big) + ' and ' + ngn(medium) + '.', 'ok'); $('tUpd').textContent = 'Last changed: just now'; }
      else if(d.status === 401){ pass = null; $('editCard').hidden = true; $('loginCard').hidden = false; msg($('loginMsg'), 'Please sign in again.', 'bad'); }
      else msg($('saveMsg'), d.error || 'Could not save.', 'bad');
    }).catch(function(){ msg($('saveMsg'), 'Network error. Prices were not saved.', 'bad'); })
      .then(function(){ b.disabled = false; });
  });
  $('logout').onclick = function(){ pass = null; location.reload(); };
})();
