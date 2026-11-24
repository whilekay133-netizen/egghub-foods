(function(){
  var WA = '2348069133358';
  var waUrl = function(t){ return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t); };
  window.EGG_PRICES = { big: 5200, medium: 4800 }; // fallback if the price sheet can't be reached
  // Prices are read from the owner's Google Sheet (cell B2 = big, B3 = medium)
  var SHEET_ID = '1K72CHDNc5YXoUs12Sfu6lXfljheoXYmj-rNJY3XwiPw';
  function applyPrices(){
    var P = window.EGG_PRICES;
    document.querySelectorAll('[data-p]').forEach(function(el){ el.textContent = P[el.dataset.p].toLocaleString('en-NG'); });
    document.querySelectorAll('[data-wa]').forEach(function(a){
      var t = a.dataset.wa.replace('{big}', P.big.toLocaleString('en-NG')).replace('{medium}', P.medium.toLocaleString('en-NG'));
      a.href = waUrl(t); a.target = '_blank'; a.rel = 'noopener';
    });
    if(document.getElementById('total') && window.__renderReady) render();
  }
  function loadPrices(){
    if(!SHEET_ID || SHEET_ID.indexOf('PASTE') === 0) return;
    fetch('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&range=A2:B3&t=' + Date.now())
      .then(function(r){ if(!r.ok) throw 0; return r.text(); })
      .then(function(csv){
        var rows = csv.trim().split(/\r?\n/).map(function(l){ return l.split('","').map(function(c){ return c.replace(/"/g,''); }); });
        var num = function(v){ return parseInt(String(v).replace(/[^\d]/g,''), 10); };
        var big = num(rows[0] && rows[0][1]), med = num(rows[1] && rows[1][1]);
        var ok = function(n){ return n >= 1000 && n <= 50000; };
        if(ok(big) && ok(med)){ window.EGG_PRICES = { big: big, medium: med }; applyPrices(); }
      }).catch(function(){});
  }
  applyPrices();

  var hdr = document.getElementById('hdr');
  addEventListener('scroll', function(){ hdr.classList.toggle('scrolled', scrollY > 8); }, {passive:true});

  var mb = document.getElementById('menuBtn'), links = document.getElementById('links');
  mb.addEventListener('click', function(){ var o = links.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
  links.addEventListener('click', function(e){ if(e.target.tagName === 'A'){ links.classList.remove('open'); mb.setAttribute('aria-expanded', false); } });

  var PRICES = window.EGG_PRICES;
  var NAMES = { big: 'Big eggs', medium: 'Medium eggs' };
  var qty = document.getElementById('qty'), total = document.getElementById('total'),
      eggs = document.getElementById('eggs'), form = document.getElementById('builder'),
      cname = document.getElementById('cname'), cphone = document.getElementById('cphone'),
      err = document.getElementById('formErr');
  var fmt = function(n){ return n.toLocaleString('en-NG'); };
  var naira = function(n){ return '₦' + fmt(n); };
  var val = function(name){ return document.querySelector('input[name=' + name + ']:checked').value; };
  function clamp(n){ n = Math.round(+n); return isNaN(n) ? 1 : Math.max(1, Math.min(1000, n)); }
  function render(){
    var q = clamp(qty.value), size = val('size'); PRICES = window.EGG_PRICES;
    total.textContent = naira(q * PRICES[size]);
    eggs.textContent = fmt(q * 30) + ' eggs';
  }
  function set(n){ qty.value = clamp(n); render(); }
  document.getElementById('minus').onclick = function(){ set(clamp(qty.value) - 1); };
  document.getElementById('plus').onclick = function(){ set(clamp(qty.value) + 1); };
  qty.addEventListener('input', render);
  qty.addEventListener('blur', function(){ set(qty.value); });
  document.querySelectorAll('.quick button').forEach(function(b){ b.onclick = function(){ set(b.dataset.q); }; });
  document.querySelectorAll('#builder input[type=radio]').forEach(function(r){ r.addEventListener('change', render); });
  window.__renderReady = true; render();
  loadPrices();

  // ---- invoice ----
  var order = null, back = document.getElementById('invBack'), lastFocus = null;
  function $(id){ return document.getElementById(id); }
  function invoiceNo(d){
    var p = function(n){ return String(n).padStart(2,'0'); };
    return 'EGH-' + String(d.getFullYear()).slice(2) + p(d.getMonth()+1) + p(d.getDate()) + '-' + Math.floor(1000 + Math.random()*9000);
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = cname.value.replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,60), phone = cphone.value.replace(/[^0-9+ ()-]/g,'').trim().slice(0,20), digits = phone.replace(/\D/g,'');
    cname.classList.toggle('bad', !name); cphone.classList.toggle('bad', digits.length < 10);
    if(!name || digits.length < 10){ err.textContent = !name ? 'Please enter your name.' : 'Please enter a valid phone number.'; (!name ? cname : cphone).focus(); return; }
    err.textContent = '';
    var q = clamp(qty.value), size = val('size'), d = new Date(); PRICES = window.EGG_PRICES;
    order = { no: invoiceNo(d), date: d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), name: name, phone: phone,
              item: NAMES[size], qty: q, price: PRICES[size], total: q * PRICES[size] };
    $('invNo').textContent = order.no; $('invName').textContent = order.name; $('invPhone').textContent = order.phone;
    $('invDate').textContent = order.date; $('invItem').innerHTML = ''; $('invItem').append(order.item + ' (crate of 30)'); var sm = document.createElement('small'); sm.textContent = fmt(order.qty) + ' × ' + naira(order.price); $('invItem').appendChild(sm);
    $('invQty').textContent = fmt(order.qty); $('invPrice').textContent = naira(order.price);
    $('invAmt').textContent = naira(order.total); $('invTotal').textContent = naira(order.total);
    var msg = 'Hello Egghub Foods, I just placed an order on your website.\n\nInvoice: ' + order.no + '\nName: ' + order.name + '\nPhone: ' + order.phone +
      '\nOrder: ' + fmt(order.qty) + ' ' + (order.qty === 1 ? 'crate' : 'crates') + ' of ' + order.item + ' @ ' + naira(order.price) + '\nTotal: ' + naira(order.total) + '\nPickup: Mowe';
    $('invWa').href = waUrl(msg);
    lastFocus = document.activeElement; back.hidden = false; document.body.style.overflow = 'hidden'; $('invClose').focus();
  });
  function closeInv(){ back.hidden = true; document.body.style.overflow = ''; if(lastFocus) lastFocus.focus(); }
  $('invClose').onclick = closeInv;
  back.addEventListener('click', function(e){ if(e.target === back) closeInv(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !back.hidden) closeInv(); });

  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function imgData(src){ return fetch(src).then(function(r){ return r.blob(); }).then(function(b){ return new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.readAsDataURL(b); }); }); }
  $('invImg').onclick = function(){
    if(!order) return;
    var btn = this, label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Preparing image…';
    (window.html2canvas ? Promise.resolve() : loadScript('js/html2canvas.min.js')).then(function(){
      return window.html2canvas($('invoice'), { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    }).then(function(canvas){
      var a = document.createElement('a'); a.download = 'Egghub-Invoice-' + order.no + '.png'; a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a); a.click(); a.remove();
    }).catch(function(){ alert('Could not create the image. Please try Download PDF instead.'); })
      .then(function(){ btn.disabled = false; btn.innerHTML = label; });
  };
  $('invPdf').onclick = function(){
    if(!order) return;
    var btn = this, label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Preparing PDF…';
    Promise.all([ window.jspdf ? null : loadScript('js/jspdf.umd.min.js'), imgData('images/logo.jpg') ]).then(function(r){
      var logo = r[1], doc = new window.jspdf.jsPDF({ unit:'pt', format:'a5' }), W = 420, M = 32, y;
      var N = function(n){ return 'NGN ' + fmt(n); };
      doc.setFillColor(31,44,212); doc.rect(0,0,W,92,'F');
      doc.addImage(logo,'JPEG',M,22,44,44);
      doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(255,255,255); doc.text('Egg', M+54, 42);
      doc.setTextColor(255,197,61); doc.text('hub', M+54+doc.getTextWidth('Egg'), 42);
      doc.setTextColor(255,255,255); doc.text(' Foods', M+54+doc.getTextWidth('Egghub'), 42);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(211,215,255); doc.text('Fresh eggs. Healthy living.', M+54, 56);
      doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(255,255,255); doc.text('INVOICE', W-M, 44, {align:'right'});
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(211,215,255); doc.text(order.no, W-M, 58, {align:'right'});
      y = 124; doc.setFontSize(7); doc.setTextColor(91,96,120);
      doc.text('BILLED TO', M, y); doc.text('DATE', 220, y); doc.text('STATUS', 310, y);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(13,17,38);
      doc.text(order.name, M, y+14); doc.text(order.date, 220, y+14);
      doc.setTextColor(138,90,0); doc.setFontSize(8); doc.text('Awaiting confirmation', 310, y+14);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(43,48,80); doc.text(order.phone, M, y+27);
      y = 176; doc.setFillColor(246,247,251); doc.rect(M, y, W-2*M, 22, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(91,96,120);
      doc.text('ITEM', M+8, y+14); doc.text('QTY', 220, y+14, {align:'right'}); doc.text('PRICE', 300, y+14, {align:'right'}); doc.text('AMOUNT', W-M-8, y+14, {align:'right'});
      y += 40; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(13,17,38);
      doc.text(order.item + ' (crate of 30)', M+8, y); doc.text(fmt(order.qty), 220, y, {align:'right'}); doc.text(N(order.price), 300, y, {align:'right'}); doc.text(N(order.total), W-M-8, y, {align:'right'});
      y += 14; doc.setDrawColor(230,232,240); doc.line(M, y, W-M, y);
      y += 20; doc.setFillColor(238,240,255); doc.roundedRect(200, y, W-M-200, 40, 6, 6, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Total', 212, y+25);
      doc.setTextColor(31,44,212); doc.setFontSize(14); doc.text(N(order.total), W-M-12, y+26, {align:'right'});
      y += 80; doc.setFontSize(7); doc.setTextColor(91,96,120); doc.text('PICKUP POINT', M, y); doc.text('CONTACT', 220, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(43,48,80);
      doc.text(['KM 1, Lotto-Simawa Road,','Lotto Bus-Stop, Mowe, Ogun State'], M, y+13); doc.text(['+234 806 913 3358','egghubfoods@gmail.com','Instagram: @egghubfoods'], 220, y+13);
      y += 64; doc.setFontSize(7.5); doc.setTextColor(91,96,120);
      doc.text(doc.splitTextToSize('Payment details are shared on WhatsApp. Your order is confirmed once Egghub Foods replies.', W-2*M), M, y);
      doc.setFillColor(255,197,61); doc.rect(0, 585, W, 10, 'F');
      doc.save('Egghub-Invoice-' + order.no + '.pdf');
    }).catch(function(){ alert('Could not create the PDF. Please check your connection and try again.'); })
      .then(function(){ btn.disabled = false; btn.innerHTML = label; });
  };

  var els = document.querySelectorAll('.rv');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); }, {threshold:.1, rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){ io.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('in'); }); }


  var rw = document.querySelector('.rot-word'), words = ['packed with care.','priced right.','ready for pickup.','fresh every day.'], wi = 0;
  if(rw && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    setInterval(function(){
      rw.classList.add('out');
      setTimeout(function(){ wi = (wi + 1) % words.length; rw.textContent = words[wi]; rw.classList.remove('out'); rw.classList.add('in');
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ rw.classList.remove('in'); }); }); }, 450);
    }, 2800);
  }
    // ---- gallery ----
  (function(){
    var grid = document.getElementById('gTrack'), lb = document.getElementById('lightbox');
    if(!grid || !lb || typeof lb.showModal !== 'function') return;
    var btns = Array.prototype.slice.call(grid.querySelectorAll('.gbtn')), media = document.getElementById('lbMedia'),
        cap = document.getElementById('lbCap'), count = document.getElementById('lbCount'), thumbs = document.getElementById('lbThumbs'), cur = 0;
    btns.forEach(function(b, i){
      var t = document.createElement('button'); t.type = 'button'; t.setAttribute('aria-label', 'Show ' + b.dataset.title);
      var im = document.createElement('img'); im.alt = ''; im.src = b.dataset.kind === 'video' ? 'images/stock-poster.jpg' : b.dataset.src;
      t.appendChild(im); t.addEventListener('click', function(){ show(i); }); thumbs.appendChild(t);
    });
    var tbs = Array.prototype.slice.call(thumbs.children);
    function show(i){
      cur = (i + btns.length) % btns.length; var b = btns[cur], el;
      media.textContent = '';
      if(b.dataset.kind === 'video'){ el = document.createElement('video'); el.src = b.dataset.src; el.autoplay = true; el.muted = true; el.loop = true; el.playsInline = true; el.controls = true; }
      else { el = document.createElement('img'); el.src = b.dataset.src; el.alt = b.dataset.alt || ''; }
      media.appendChild(el); cap.textContent = b.dataset.title;
      count.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(btns.length).padStart(2, '0');
      tbs.forEach(function(t, k){ t.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      if(tbs[cur].scrollIntoView) tbs[cur].scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function open(i){ show(i); lb.showModal(); document.body.style.overflow = 'hidden'; }
    btns.forEach(function(b, i){ b.addEventListener('click', function(){ open(i); }); });
    var all = document.getElementById('gOpenAll'); if(all) all.addEventListener('click', function(){ open(0); });
    lb.addEventListener('close', function(){ media.textContent = ''; document.body.style.overflow = ''; });
    document.getElementById('lbClose').onclick = function(){ lb.close(); };
    document.getElementById('lbPrev').onclick = function(){ show(cur - 1); };
    document.getElementById('lbNext').onclick = function(){ show(cur + 1); };
    lb.addEventListener('click', function(e){ if(e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function(e){ if(e.key === 'ArrowLeft') show(cur - 1); if(e.key === 'ArrowRight') show(cur + 1); });
    var sx = null; lb.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function(e){ if(sx === null) return; var dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
  })();
  document.getElementById('yr').textContent = new Date().getFullYear();
})();
