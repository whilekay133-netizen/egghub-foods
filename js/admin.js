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
    $('loginCard').hidden = true; $('setupCard').hidden = true; $('editCard').hidden = false;
    $('big').value = d.prices.big; $('medium').value = d.prices.medium; preview();
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
  call({ action: 'status' }).then(function(d){
    $('loading').hidden = true;
    if(d.setup) $('setupCard').hidden = false;
    else if(d.status === 200) $('loginCard').hidden = false;
    else { $('loginCard').hidden = false; msg($('loginMsg'), d.error || 'Admin is not available right now.', 'bad'); }
  }).catch(function(){ $('loading').textContent = 'Network error. Refresh the page.'; });
  $('setupForm').addEventListener('submit', function(e){
    e.preventDefault();
    var a = $('np1').value, b2 = $('np2').value;
    if(a.length < 8){ msg($('setupMsg'), 'Use at least 8 characters.', 'bad'); return; }
    if(a !== b2){ msg($('setupMsg'), 'The two passwords do not match.', 'bad'); return; }
    var b = $('setupBtn'); b.disabled = true;
    call({ action: 'setup', password: a }).then(function(d){
      if(d.ok){ pass = a; $('np1').value = $('np2').value = ''; show(d); msg($('saveMsg'), 'Password created. Keep it safe.', 'ok'); }
      else msg($('setupMsg'), d.error || 'Could not create the password.', 'bad');
    }).catch(function(){ msg($('setupMsg'), 'Network error.', 'bad'); }).then(function(){ b.disabled = false; });
  });
  $('chgForm').addEventListener('submit', function(e){
    e.preventDefault();
    var np = $('cp').value, b = $('chgBtn'); if(np.length < 8){ msg($('chgMsg'), 'Use at least 8 characters.', 'bad'); return; }
    b.disabled = true;
    call({ action: 'change', password: pass, newPassword: np }).then(function(d){
      if(d.ok){ pass = np; $('cp').value = ''; msg($('chgMsg'), 'Password changed.', 'ok'); } else msg($('chgMsg'), d.error || 'Could not change it.', 'bad');
    }).catch(function(){ msg($('chgMsg'), 'Network error.', 'bad'); }).then(function(){ b.disabled = false; });
  });
  $('logout').onclick = function(){ pass = null; location.reload(); };
})();
