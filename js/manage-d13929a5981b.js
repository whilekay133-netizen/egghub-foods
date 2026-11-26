(function(){
  var $ = function(id){ return document.getElementById(id); };
  var ngn = function(n){ return '₦' + (Number(n)||0).toLocaleString('en-NG'); };
  function call(body){
    return fetch('/api/admin', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Egghub-Admin': '1' }, body: JSON.stringify(body) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; }); });
  }
  function msg(el, text, cls){ el.textContent = text; el.className = 'msg' + (cls ? ' ' + cls : ''); }
  function only(id){ ['setupCard','loginCard','editCard'].forEach(function(c){ $(c).hidden = c !== id; }); $('loading').hidden = true; }
  function preview(){ $('pvBig').textContent = ngn($('big').value); $('pvMed').textContent = ngn($('medium').value); }
  function show(d){
    only('editCard');
    $('big').value = d.prices.big; $('medium').value = d.prices.medium; preview();
    $('dMail').className = 'dot' + (d.email ? ' on' : ''); $('tMail').textContent = d.email ? '— on' : '— off (customers use Share PDF or their own email app)';
    $('tUpd').textContent = d.prices.updatedAt ? 'Last changed: ' + new Date(d.prices.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Showing the default prices.';
    $('weak').hidden = !d.weak; if(d.weak) $('chgForm').parentNode.open = true;
  }
  function signedOut(text){ only('loginCard'); if(text) msg($('loginMsg'), text, 'bad'); $('pw').focus(); }

  call({ action: 'status' }).then(function(d){
    if(d.loggedIn) show(d); else if(d.locked) only('setupCard'); else if(d.status === 200) signedOut(); else signedOut(d.error || 'Admin is not available right now.');
  }).catch(function(){ $('loading').textContent = 'Network error. Refresh the page.'; });

  $('loginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var b = $('loginBtn'); b.disabled = true; msg($('loginMsg'), '');
    call({ action: 'login', password: $('pw').value }).then(function(d){
      $('pw').value = '';
      if(d.ok) show(d); else msg($('loginMsg'), d.error || 'Could not sign in.', 'bad');
    }).catch(function(){ msg($('loginMsg'), 'Network error. Check your connection.', 'bad'); }).then(function(){ b.disabled = false; });
  });

  $('setupForm').addEventListener('submit', function(e){
    e.preventDefault();
    var a = $('np1').value;
    if(a.length < 12){ msg($('setupMsg'), 'Use at least 12 characters.', 'bad'); return; }
    if(a !== $('np2').value){ msg($('setupMsg'), 'The two passwords do not match.', 'bad'); return; }
    var b = $('setupBtn'); b.disabled = true;
    call({ action: 'setup', code: $('code').value, password: a }).then(function(d){
      $('code').value = $('np1').value = $('np2').value = '';
      if(d.ok){ show(d); msg($('saveMsg'), 'Password created.', 'ok'); } else msg($('setupMsg'), d.error || 'Could not create the password.', 'bad');
    }).catch(function(){ msg($('setupMsg'), 'Network error.', 'bad'); }).then(function(){ b.disabled = false; });
  });

  ['big','medium'].forEach(function(id){ $(id).addEventListener('input', preview); });
  $('priceForm').addEventListener('submit', function(e){
    e.preventDefault();
    var big = parseInt($('big').value, 10), medium = parseInt($('medium').value, 10);
    var ok = function(n){ return n >= 1000 && n <= 50000; };
    if(!ok(big) || !ok(medium)){ msg($('saveMsg'), 'Prices must be between ₦1,000 and ₦50,000.', 'bad'); return; }
    if(!confirm('Update the website to Big ' + ngn(big) + ' and Medium ' + ngn(medium) + '?')) return;
    var b = $('saveBtn'); b.disabled = true; msg($('saveMsg'), 'Saving…');
    call({ action: 'save', big: big, medium: medium }).then(function(d){
      if(d.ok){ msg($('saveMsg'), 'Saved. The website now shows ' + ngn(big) + ' and ' + ngn(medium) + '.', 'ok'); $('tUpd').textContent = 'Last changed: just now'; }
      else if(d.status === 401) signedOut('Your session ended. Please sign in again.');
      else msg($('saveMsg'), d.error || 'Could not save.', 'bad');
    }).catch(function(){ msg($('saveMsg'), 'Network error. Prices were not saved.', 'bad'); }).then(function(){ b.disabled = false; });
  });

  $('chgForm').addEventListener('submit', function(e){
    e.preventDefault();
    var np = $('cp').value, b = $('chgBtn');
    if(np.length < 12){ msg($('chgMsg'), 'Use at least 12 characters.', 'bad'); return; }
    b.disabled = true;
    call({ action: 'change', current: $('cur').value, newPassword: np }).then(function(d){
      if(d.ok){ $('cur').value = $('cp').value = ''; $('weak').hidden = true; msg($('chgMsg'), 'Password changed. Other devices are now signed out.', 'ok'); }
      else if(d.status === 401 && /sign in/i.test(d.error||'')) signedOut(d.error);
      else msg($('chgMsg'), d.error || 'Could not change it.', 'bad');
    }).catch(function(){ msg($('chgMsg'), 'Network error.', 'bad'); }).then(function(){ b.disabled = false; });
  });

  $('logout').onclick = function(){ call({ action: 'logout' }).then(function(){ location.reload(); }); };
})();
