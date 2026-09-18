(function(){
'use strict';

/* ============================================================
   CSS
============================================================ */
const css = `
.obg-menu-btn{position:fixed;left:16px;bottom:90px;width:56px;height:56px;border-radius:50%;background:#fff;border:1px solid #e7ece9;box-shadow:0 10px 28px #10231a22;z-index:41;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:transform .15s}
.obg-menu-btn:active{transform:scale(.94)}
.obg-menu-btn .obg-live{position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:#33d17a;border:3px solid #fff}
.obg-menu{position:fixed;inset:0;background:#f5f7f6;z-index:200;display:none;flex-direction:column;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#10231a}
.obg-menu.open{display:flex}
.obg-menu-header{background:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #e7ece9;position:sticky;top:0;z-index:2}
.obg-back{background:#f0f3f1;width:38px;height:38px;border-radius:50%;border:0;font-size:18px;cursor:pointer;color:#10231a}
.obg-menu-title{font-weight:900;font-size:17px;margin:0}
.obg-menu-body{flex:1;overflow-y:auto;padding:18px 16px 100px}
.obg-section{background:#fff;border:1px solid #e7ece9;border-radius:18px;margin-bottom:14px;overflow:hidden}
.obg-row{display:flex;align-items:center;gap:14px;padding:15px 18px;border-bottom:1px solid #eef2f0;cursor:pointer;background:#fff;width:100%;text-align:left;border-left:0;border-right:0;border-top:0;font:inherit;color:inherit}
.obg-row:last-child{border-bottom:0}
.obg-row:hover{background:#f8fbfa}
.obg-row .obg-ic{width:38px;height:38px;border-radius:11px;background:#edf7f1;color:#087443;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.obg-row .obg-txt{flex:1;min-width:0}
.obg-row .obg-txt b{display:block;font-weight:750;font-size:15px}
.obg-row .obg-txt small{display:block;color:#6d7b74;font-size:12.5px;margin-top:2px}
.obg-row .obg-chev{color:#b9c4bd;font-size:20px;font-weight:400}
.obg-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#087443,#0b9155);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900}
.obg-profile-card{background:#fff;border:1px solid #e7ece9;border-radius:18px;padding:18px;margin-bottom:14px;display:flex;align-items:center;gap:14px}
.obg-label{font-size:12.5px;font-weight:700;color:#374b41;display:block;margin:8px 0 4px}
.obg-input{width:100%;padding:12px;border:1px solid #dce4df;border-radius:11px;font:inherit;outline:0;background:#fff}
.obg-input:focus{border-color:#087443}
.obg-btn{padding:12px 14px;border-radius:11px;font-weight:800;border:0;cursor:pointer;font-size:14px;background:#087443;color:#fff;width:100%}
.obg-btn.secondary{background:#edf3ef;color:#087443}
.obg-btn.danger{background:#fdecec;color:#b02a2a}
.obg-badge{display:inline-block;padding:4px 9px;border-radius:999px;background:#edf7f1;color:#087443;font-size:11.5px;font-weight:800}
.obg-badge.gold{background:#fff4e0;color:#a86a00}
.obg-badge.live{background:#e7f8ee;color:#0e7a3f}
.obg-muted{color:#6d7b74;font-size:13.5px}
.obg-toggle{width:48px;height:28px;border-radius:16px;background:#d9e2dc;padding:3px;border:0;cursor:pointer;transition:.18s;flex-shrink:0}
.obg-toggle span{display:block;width:22px;height:22px;border-radius:50%;background:#fff;transition:.18s}
.obg-toggle.on{background:#087443}
.obg-toggle.on span{transform:translateX(20px)}
.obg-empty{padding:30px;text-align:center;color:#6d7b74;font-size:14px}
.obg-tx{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eef2f0}
.obg-tx:last-child{border-bottom:0}
.obg-tx .obg-tl{flex:1;min-width:0}
.obg-tx .obg-tl b{display:block;font-size:14.5px}
.obg-tx .obg-tl small{color:#6d7b74;font-size:12.5px}
.obg-tx .obg-amt{font-weight:900;font-size:15px;text-align:right}
.obg-menu-footer{padding:0 16px 24px}
/* Live map */
.obg-map{height:280px;border-radius:14px;overflow:hidden;background:#dce5e0;margin-bottom:12px;position:relative}
.obg-map .leaflet-container{border-radius:14px}
.obg-live-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#0e7a3f;background:#e7f8ee;padding:5px 10px;border-radius:999px}
.obg-live-dot{width:8px;height:8px;border-radius:50%;background:#33d17a;animation:obgPulse 1.6s infinite}
@keyframes obgPulse{0%{box-shadow:0 0 0 0 #33d17a99}70%{box-shadow:0 0 0 10px #33d17a00}100%{box-shadow:0 0 0 0 #33d17a00}}
.obg-map-meta{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px}
.obg-map-meta .obg-eta{font-weight:900;font-size:15px}
/* Referral */
.obg-ref-code{font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:900;letter-spacing:4px;background:#edf7f1;color:#087443;border-radius:12px;padding:14px 18px;text-align:center;margin:12px 0;cursor:pointer;user-select:all;border:1px dashed #08744355}
.obg-ref-share{display:flex;gap:8px;margin-top:12px}
.obg-ref-share button{flex:1}
.obg-ref-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.obg-ref-stat{background:#f6faf8;border-radius:14px;padding:14px;text-align:center}
.obg-ref-stat b{display:block;font-size:24px;font-weight:900;margin-top:2px}
/* Cards */
.obg-card-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid #eef2f0}
.obg-card-row:last-child{border-bottom:0}
.obg-card-logo{width:48px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;letter-spacing:.5px;color:#fff;flex-shrink:0}
.obg-card-logo.visa{background:#1a1f71}
.obg-card-logo.mastercard{background:linear-gradient(135deg,#eb001b 0 50%,#f79e1b 50% 100%)}
.obg-card-logo.verve{background:#0b5b8f}
.obg-card-logo.other{background:#455a64}
.obg-card-row .obg-card-info{flex:1;min-width:0}
.obg-card-row .obg-card-info b{display:block;font-size:14.5px}
.obg-card-row .obg-card-info small{color:#6d7b74;font-size:12.5px}
.obg-card-row .obg-card-rm{background:transparent;border:0;color:#b02a2a;font-weight:800;cursor:pointer;font-size:13px}
.obg-info-bar{background:#eef4f1;color:#374b41;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.45}
body.obg-dark{background:#0e1714;color:#fff}
body.obg-dark .obg-menu{background:#0e1714;color:#fff}
body.obg-dark .obg-menu-header,body.obg-dark .obg-section,body.obg-dark .obg-profile-card{background:#18251f;border-color:#2b3c34}
body.obg-dark .obg-row{background:#18251f;color:#fff;border-color:#2b3c34}
body.obg-dark .obg-row:hover{background:#1f2f28}
body.obg-dark .obg-row .obg-ic{background:#1f3a2c;color:#33d17a}
body.obg-dark .obg-input{background:#0f1a16;color:#fff;border-color:#2b3c34}
body.obg-dark .obg-menu-title{color:#fff}
body.obg-dark .obg-back{background:#223029;color:#fff}
body.obg-dark .obg-tx,body.obg-dark .obg-card-row{border-color:#2b3c34}
body.obg-dark .obg-muted,body.obg-dark .obg-row .obg-txt small{color:#9fb2a8}
body.obg-dark .obg-ref-code{background:#0f1a16;color:#33d17a}
body.obg-dark .obg-ref-stat,body.obg-dark .obg-info-bar{background:#1a2620;color:#d9e8e0}
body.obg-dark .obg-map{background:#15221d}
@media(max-width:400px){.obg-menu-btn{left:12px;bottom:84px}}
`;

/* ============================================================
   Helpers
============================================================ */
const state = { stack:['root'], user:null, activeOrder:null, ws:null, map:null, riderMarker:null };
const token = () => localStorage.getItem('obg_token') || '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => 'GH₵' + Number(n||0).toFixed(2);
const getLS = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const setLS = (k,v) => localStorage.setItem(k, JSON.stringify(v));

async function api(path, opts={}){
  const r = await fetch('/api'+path, { ...opts, headers:{ 'Content-Type':'application/json', ...(token()?{Authorization:'Bearer '+token()}:{}) , ...(opts.headers||{}) }});
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

function toast(msg, ms=2400){
  let t = document.querySelector('.obg-toast');
  if (!t){
    t = document.createElement('div'); t.className = 'obg-toast'; document.body.appendChild(t);
    Object.assign(t.style, { position:'fixed', left:'50%', bottom:'110px', transform:'translateX(-50%)', background:'#10231a', color:'#fff', padding:'12px 16px', borderRadius:'12px', zIndex:'300', boxShadow:'0 10px 30px #0004', maxWidth:'90vw', textAlign:'center', fontWeight:'600', fontSize:'14px', display:'none' });
  }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t); t._t = setTimeout(()=>t.style.display='none', ms);
}

function urlBase64ToUint8Array(base64){
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b = (base64 + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* ============================================================
   Views — original
============================================================ */
const views = {};

function row(icon, title, sub, target){
  return `<button class="obg-row" data-target="${target}">
    <span class="obg-ic">${icon}</span>
    <span class="obg-txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
    <span class="obg-chev">›</span>
  </button>`;
}

views.root = () => {
  const u = state.user;
  const initials = ((u?.full_name || u?.phone || 'G').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('') || 'G').toUpperCase();
  const activeBanner = state.activeOrder ? `
    <div class="obg-section" style="background:linear-gradient(135deg,#087443,#0b9155);color:#fff;border:0">
      <button class="obg-row" data-target="track" style="background:transparent;color:#fff;border:0">
        <span class="obg-ic" style="background:#ffffff22;color:#fff">🛵</span>
        <span class="obg-txt">
          <b style="color:#fff">Track your order</b>
          <small style="color:#dff5e9">${esc(state.activeOrder.vendor)} · #${esc(state.activeOrder.id)}</small>
        </span>
        <span class="obg-live-pill"><span class="obg-live-dot"></span> LIVE</span>
      </button>
    </div>` : '';
  return { title: 'Account', html: `
    ${activeBanner}
    <div class="obg-profile-card">
      <div class="obg-avatar">${esc(initials)}</div>
      <div style="flex:1;min-width:0">
        <b style="font-size:16px">${esc(u?.full_name || 'Guest user')}</b>
        <div class="obg-muted" style="margin-top:2px">${esc(u?.phone || 'Tap to sign in')}</div>
        ${u?.email ? `<div class="obg-muted" style="font-size:12.5px">${esc(u.email)}</div>` : ''}
      </div>
      <span class="obg-badge">${esc(u?.role || 'guest')}</span>
    </div>

    <div class="obg-section">
      ${row('👤','Profile','Name, email and phone','profile')}
      ${row('📍','Saved addresses','Home, work and other places','addresses')}
      ${row('💳','Payment methods','MoMo, cards and preferences','payment-methods')}
      ${row('💳','Saved cards','Cards stored for faster checkout','saved-cards')}
      ${row('🧾','Payment history','All your transactions','payment-history')}
    </div>

    <div class="obg-section">
      ${row('🎁','Invite friends','Share your referral code, earn rewards','refer')}
    </div>

    <div class="obg-section">
      ${row('🔔','Notifications','Order updates, offers and push','notifications')}
      ${row('🔒','Security & privacy','Sessions and account protection','security')}
      ${row('🌐','Language','Choose your app language','language')}
      ${row('🌙','Appearance','Light, dark or system','appearance')}
    </div>

    <div class="obg-section">
      ${row('🆘','Help & support','FAQs, chat and report a problem','help')}
      ${row('📄','Terms & privacy','Policies and legal info','legal')}
      ${row('ℹ️','About ObuasiGo','Version, credits and licences','about')}
    </div>

    <div class="obg-menu-footer">
      ${u
        ? `<button class="obg-btn danger" onclick="window.__obgSignOut()">Sign out</button>`
        : `<button class="obg-btn" onclick="window.__obgOpenAuth()">Sign in</button>`}
    </div>`};
};

views.profile = () => {
  const u = state.user || {};
  return { title: 'Profile', html: `
    <div class="obg-profile-card">
      <div class="obg-avatar">${esc((u.full_name||u.phone||'G').trim()[0].toUpperCase())}</div>
      <div style="flex:1"><b>${esc(u.full_name || 'Your name')}</b><div class="obg-muted">${esc(u.phone || '')}</div></div>
    </div>
    <div class="obg-section" style="padding:18px">
      <label class="obg-label">Full name</label>
      <input class="obg-input" id="obgPfName" value="${esc(u.full_name || '')}" placeholder="e.g. Dennis Mensah">
      <label class="obg-label">Email</label>
      <input class="obg-input" id="obgPfEmail" type="email" value="${esc(u.email || '')}" placeholder="you@example.com">
      <label class="obg-label">Phone (cannot be changed)</label>
      <input class="obg-input" value="${esc(u.phone || '')}" disabled>
      <div style="margin-top:14px"><button class="obg-btn" onclick="window.__obgSaveProfile()">Save changes</button></div>
    </div>`};
};

views.addresses = () => {
  const list = getLS('obg_addresses', []);
  return { title: 'Saved addresses', html: `
    ${list.length ? `<div class="obg-section">${list.map((a,i)=>`
      <div class="obg-row" style="cursor:default">
        <span class="obg-ic">${a.icon||'📍'}</span>
        <span class="obg-txt"><b>${esc(a.label)}</b><small>${esc(a.text)}</small></span>
        <button style="background:transparent;border:0;color:#b02a2a;font-weight:800;cursor:pointer" onclick="window.__obgRmAddr(${i})">Remove</button>
      </div>`).join('')}</div>` : '<div class="obg-section"><div class="obg-empty">No saved addresses yet.</div></div>'}
    <div class="obg-section" style="padding:18px">
      <label class="obg-label">Label</label>
      <input class="obg-input" id="obgAdLabel" placeholder="Home, Work, Other">
      <label class="obg-label">Address</label>
      <input class="obg-input" id="obgAdText" placeholder="e.g. Ahinsan Estate, House 12, Obuasi">
      <div style="margin-top:14px"><button class="obg-btn" onclick="window.__obgAddAddr()">Add address</button></div>
    </div>`};
};

views['payment-methods'] = () => {
  const prefs = getLS('obg_payment_prefs', { preferred:'momo', momo:'' });
  return { title: 'Payment methods', html: `
    <div class="obg-section" style="padding:18px">
      <div class="obg-muted" style="margin-bottom:12px">Choose your preferred way to pay.</div>
      <div class="obg-row" style="cursor:pointer" onclick="window.__obgSetPref('momo')">
        <span class="obg-ic">📱</span>
        <span class="obg-txt"><b>Mobile Money</b><small>MTN · Vodafone · AirtelTigo</small></span>
        ${prefs.preferred==='momo'?'<span class="obg-badge">Preferred</span>':''}
      </div>
      <div class="obg-row" style="cursor:pointer" onclick="window.__obgSetPref('card')">
        <span class="obg-ic">💳</span>
        <span class="obg-txt"><b>Card</b><small>Visa · Mastercard · Verve</small></span>
        ${prefs.preferred==='card'?'<span class="obg-badge">Preferred</span>':''}
      </div>
      <div class="obg-row" style="cursor:pointer" onclick="window.__obgSetPref('cash')">
        <span class="obg-ic">💵</span>
        <span class="obg-txt"><b>Cash on delivery</b><small>Pay the rider directly</small></span>
        ${prefs.preferred==='cash'?'<span class="obg-badge">Preferred</span>':''}
      </div>
    </div>
    <div class="obg-section" style="padding:18px">
      <label class="obg-label">Mobile Money number (optional)</label>
      <input class="obg-input" id="obgMomo" placeholder="+233241234567" value="${esc(prefs.momo||'')}">
      <button class="obg-btn secondary" style="margin-top:10px" onclick="window.__obgSaveMomo()">Save MoMo number</button>
    </div>`};
};

views['payment-history'] = () => {
  if (!token()) return { title: 'Payment history', html: '<div class="obg-section"><div class="obg-empty">Sign in to see your transaction history.</div></div>' };
  return { title: 'Payment history', html: '<div class="obg-section" id="obgHistBox"><div class="obg-empty">Loading…</div></div>', onMount: loadHistory };
};

async function loadHistory(){
  const box = document.getElementById('obgHistBox'); if (!box) return;
  try {
    const [orders, bookings] = await Promise.all([api('/orders').catch(()=>[]), api('/bookings').catch(()=>[])]);
    const tx = [
      ...orders.map(o => ({ type:'Order', id:o.id, amount:o.total, status:o.status, at:o.created_at, sub:o.vendor })),
      ...bookings.map(b => ({ type:'Stay',  id:b.id, amount:b.total, status:b.status, at:b.created_at, sub:b.hotel }))
    ].sort((a,b) => new Date(b.at) - new Date(a.at));
    if (!tx.length){ box.innerHTML = '<div class="obg-empty">No transactions yet.</div>'; return; }
    box.innerHTML = tx.map(t => `
      <div class="obg-tx">
        <div class="obg-tl">
          <b>${esc(t.sub || t.type)}</b>
          <small>#${esc(t.id)} · ${new Date(t.at).toLocaleDateString()}</small>
        </div>
        <div>
          <div class="obg-amt">${money(t.amount)}</div>
          <span class="obg-badge ${/Completed|CHECKED IN/.test(t.status)?'':'gold'}">${esc(t.status)}</span>
        </div>
      </div>`).join('');
  } catch(e){ box.innerHTML = `<div class="obg-empty">${esc(e.message)}</div>`; }
}

/* -------- Notifications (with real push toggle) -------- */
views.notifications = () => {
  const p = getLS('obg_notifications', { orders:true, riders:true, offers:false, email:false });
  const pushOn = localStorage.getItem('obg_push_enabled') === 'true';
  const supported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  return { title: 'Notifications', html: `
    <div class="obg-section">
      <div class="obg-row" style="cursor:default">
        <span class="obg-ic">📲</span>
        <span class="obg-txt">
          <b>Push on this device</b>
          <small>${supported ? (pushOn ? 'Receiving alerts on this phone' : 'Tap to enable real push alerts') : 'Not supported by this browser'}</small>
        </span>
        <button class="obg-toggle ${pushOn?'on':''}" ${supported?'':'disabled'} onclick="window.__obgTogglePush(this)"><span></span></button>
      </div>
    </div>
    <div class="obg-section">
      ${toggleRow('orders','🔔','Order updates','Status changes and delivery alerts', p.orders)}
      ${toggleRow('riders','🛵','Rider location','Live tracking notifications', p.riders)}
      ${toggleRow('offers','🎁','Promotions & offers','Deals from ObuasiGo and partners', p.offers)}
      ${toggleRow('email','✉️','Email receipts','Receive order receipts by email', p.email)}
    </div>
    <div class="obg-section" style="padding:18px">
      <div class="obg-muted">Push notifications require permission from your browser. You can revoke it anytime from your phone's settings.</div>
    </div>`};
};

function toggleRow(key, icon, title, sub, on){
  return `<div class="obg-row" style="cursor:default">
    <span class="obg-ic">${icon}</span>
    <span class="obg-txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
    <button class="obg-toggle ${on?'on':''}" onclick="window.__obgToggle('${key}', this)"><span></span></button>
  </div>`;
}

views.security = () => ({ title: 'Security & privacy', html: `
  <div class="obg-section">
    ${row('🔐','Two-factor authentication','Your phone is your second factor','twofa')}
    ${row('📱','Active sessions','Devices signed into your account','sessions')}
    ${row('🗑️','Delete account','Permanently remove your account','delete')}
  </div>
  <div class="obg-section" style="padding:18px">
    <div class="obg-muted">🔒 ObuasiGo uses JWT sessions with a rolling 7-day expiry. Your role is enforced server-side.</div>
  </div>`});

views.language = () => {
  const lang = localStorage.getItem('obg_lang') || 'en';
  const langs = [['en','English'],['tw','Twi (Ashanti)'],['ga','Ga'],['ee','Ewe'],['fr','Français']];
  return { title: 'Language', html: `<div class="obg-section">${langs.map(([code,name]) =>
    `<button class="obg-row" onclick="window.__obgSetLang('${code}')">
      <span class="obg-ic">${lang===code?'✓':''}</span>
      <span class="obg-txt"><b>${esc(name)}</b></span>
      <span class="obg-chev">›</span>
    </button>`).join('')}</div>`};
};

views.appearance = () => {
  const theme = localStorage.getItem('obg_theme') || 'light';
  const opts = [['light','☀️','Light'],['dark','🌙','Dark'],['system','⚙️','System default']];
  return { title: 'Appearance', html: `<div class="obg-section">${opts.map(([code,icon,name]) =>
    `<button class="obg-row" onclick="window.__obgSetTheme('${code}')">
      <span class="obg-ic">${icon}</span>
      <span class="obg-txt"><b>${esc(name)}</b></span>
      ${theme===code?'<span class="obg-badge">Selected</span>':''}
    </button>`).join('')}</div>`};
};

views.help = () => ({ title: 'Help & support', html: `
  <div class="obg-section">
    ${row('❓','Where is my order?','Track and manage active orders','faq-order')}
    ${row('💳','Payment problem','Refunds, failed payments and receipts','faq-payment')}
    ${row('🛵','Rider issue','Report a delivery problem','faq-rider')}
    ${row('🏨','Hotel booking','Check-in, changes and cancellations','faq-hotel')}
    ${row('🚨','Report a safety issue','Something felt unsafe','faq-safety')}
  </div>
  <div class="obg-section" style="padding:18px">
    <div class="obg-muted" style="margin-bottom:12px">Still need help? Our team responds within a few hours.</div>
    <button class="obg-btn" onclick="window.__obgToast('Support chat will open here soon')">💬 Chat with support</button>
  </div>`});

views.legal = () => ({ title: 'Terms & privacy', html: `
  <div class="obg-section" style="padding:18px">
    <b>Terms of Service</b>
    <p class="obg-muted">By using ObuasiGo you agree to our terms of service, including acceptable use, payment terms and delivery conditions.</p>
    <b>Privacy Policy</b>
    <p class="obg-muted">We collect your phone number, order details, delivery address and location to fulfil deliveries. We never sell your data. Payment data is handled by Flutterwave.</p>
    <b>Cookie Policy</b>
    <p class="obg-muted">We use local storage to remember your cart and preferences.</p>
    <p class="obg-muted" style="margin-top:14px;font-size:12px">Replace with reviewed legal documents before public launch.</p>
  </div>`});

views.about = () => ({ title: 'About ObuasiGo', html: `
  <div class="obg-section" style="padding:18px;text-align:center">
    <div style="font-size:56px">🛵</div>
    <h2 style="margin:8px 0 4px">ObuasiGo</h2>
    <div class="obg-muted">Version 1.0.0 · MVP</div>
    <p class="obg-muted" style="margin-top:12px">Food delivery, rider network and hotel bookings for Obuasi and the Ashanti Region.</p>
    <div style="margin-top:16px"><span class="obg-badge">Built for Ghana</span></div>
  </div>
  <div class="obg-section">
    ${row('🌐','Website','obuasigo.app','about-site')}
    ${row('✉️','Contact','hello@obuasigo.app','about-contact')}
    ${row('📜','Licences','Open-source attributions','about-licences')}
  </div>`});

['faq-order','faq-payment','faq-rider','faq-hotel','faq-safety','twofa','sessions','delete','about-site','about-contact','about-licences'].forEach(k => {
  views[k] = () => ({ title: 'Info', html: `<div class="obg-section" style="padding:18px"><p class="obg-muted">This section is a placeholder. Plug your real content here.</p></div>`});
});

/* ============================================================
   NEW — Live order tracking
============================================================ */
views.track = () => ({ title: 'Live tracking', html: `
  <div id="obgTrackBox"><div class="obg-section"><div class="obg-empty">Loading your active order…</div></div></div>`,
  onMount: mountTracker
});

async function mountTracker(){
  const box = document.getElementById('obgTrackBox'); if (!box) return;

  if (!token()){ box.innerHTML = '<div class="obg-section"><div class="obg-empty">Sign in to track your order.</div></div>'; return; }

  let orders = [];
  try { orders = await api('/orders'); } catch(e){ box.innerHTML = `<div class="obg-section"><div class="obg-empty">${esc(e.message)}</div></div>`; return; }

  const active = orders.find(o => o.status !== 'Completed') || orders[0];
  if (!active){ box.innerHTML = '<div class="obg-section"><div class="obg-empty">No active order right now.</div></div>'; return; }
  state.activeOrder = active;

  const stageIdx = ORDER_STAGES.indexOf(active.status);
  box.innerHTML = `
    <div class="obg-map-meta">
      <div>
        <span class="obg-live-pill"><span class="obg-live-dot"></span> LIVE</span>
        <div style="font-weight:900;margin-top:6px">#${esc(active.id)}</div>
        <div class="obg-muted">${esc(active.vendor)} → ${esc(active.delivery_address?.text || 'your address')}</div>
      </div>
      <div style="text-align:right">
        <div class="obg-eta" id="obgEta">—</div>
        <div class="obg-muted" style="font-size:12px">to arrive</div>
      </div>
    </div>
    <div class="obg-map" id="obgMap"></div>
    <div class="obg-section" style="padding:16px">
      <div class="obg-muted" id="obgRiderInfo">Waiting for a rider to accept…</div>
    </div>
    <div class="obg-section" style="padding:16px">
      <div style="font-weight:800;margin-bottom:8px">Delivery progress</div>
      <div class="obg-progress">
        ${ORDER_STAGES.map((s,i) => `
          <div class="obg-row" style="cursor:default;padding:10px 0;border:0">
            <span class="obg-ic" style="background:${i<=stageIdx?'#e7f8ee':'#f0f3f1'};color:${i<=stageIdx?'#0e7a3f':'#b9c4bd'}">${i<=stageIdx?'✓':i+1}</span>
            <span class="obg-txt"><b style="color:${i===stageIdx?'#087443':'inherit'}">${esc(s)}</b></span>
          </div>`).join('')}
      </div>
    </div>
    <button class="obg-btn secondary" onclick="window.__obgStopTracking()">Stop live tracking</button>`;

  // Load Leaflet dynamically
  await ensureLeaflet();
  const map = L.map('obgMap', { zoomControl:false, attributionControl:false }).setView([6.6885, -1.6244], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  state.map = map;

  const riderIcon = L.divIcon({ className:'', html:'<div style="background:#087443;width:36px;height:36px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px #0004">🛵</div>', iconSize:[36,36] });
  const homeIcon  = L.divIcon({ className:'', html:'<div style="background:#f3a11b;width:30px;height:30px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px #0004">📍</div>', iconSize:[30,30] });

  state.riderMarker = L.marker([6.6885, -1.6244], { icon: riderIcon }).addTo(map);

  // Connect WebSocket
  openTrackingSocket(active.id);
}

const ORDER_STAGES = ['Order created','Payment confirmed','Restaurant accepted','Preparing','Food ready','Rider assigned','Rider accepted','Rider arrived','Food picked up','Going to customer','Arrived at customer','Customer PIN verified','Completed'];

function openTrackingSocket(orderId){
  try {
    closeTrackingSocket();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token())}`;
    const ws = new WebSocket(url);
    state.ws = ws;
    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'location' && state.riderMarker){
          state.riderMarker.setLatLng([msg.lat, msg.lng]);
          const eta = document.getElementById('obgEta');
          if (eta) eta.textContent = '~10 min';
          const info = document.getElementById('obgRiderInfo');
          if (info) info.textContent = `Rider is moving · updated ${new Date(msg.at).toLocaleTimeString()}`;
        }
      } catch{}
    };
    ws.onerror = () => {};
    ws.onclose = () => { setTimeout(()=>{ if (state.ws === ws && document.getElementById('obgMap')) openTrackingSocket(orderId); }, 3000); };
  } catch(e){ /* silent */ }
}

function closeTrackingSocket(){
  if (state.ws){ try { state.ws.close(); } catch{} state.ws = null; }
}

function ensureLeaflet(){
  return new Promise(resolve => {
    if (window.L) return resolve();
    if (!document.querySelector('link[href*="leaflet"]')){
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

window.__obgStopTracking = () => {
  closeTrackingSocket();
  if (state.map){ try { state.map.remove(); } catch{} state.map = null; state.riderMarker = null; }
  back();
};

/* ============================================================
   NEW — Referral / Invite friends
============================================================ */
function refCodeFromPhone(phone){
  if (!phone) return 'OBG-GUEST';
  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  let h = 7;
  for (let i=0;i<digits.length;i++) h = (h * 31 + digits.charCodeAt(i)) >>> 0;
  const suffix = h.toString(36).toUpperCase().slice(0,4).padEnd(4,'X');
  return 'OBG-' + last4 + '-' + suffix;
}

views.refer = () => {
  const code = refCodeFromPhone(state.user?.phone);
  const url = `${location.origin}/?ref=${encodeURIComponent(code)}`;
  const stats = getLS('obg_ref_stats', { joined: 0, earned: 0 });
  return { title: 'Invite friends', html: `
    <div class="obg-section" style="padding:22px;text-align:center">
      <div style="font-size:48px">🎁</div>
      <h2 style="margin:8px 0 4px">Invite friends, earn rewards</h2>
      <p class="obg-muted">Share your code — when a friend places their first order, you get GH₵10 off your next delivery.</p>
      <div class="obg-ref-code" id="obgRefCode" onclick="window.__obgCopyRef('${esc(code)}')">${esc(code)}</div>
      <div class="obg-muted" style="font-size:12.5px">Tap to copy</div>
      <div class="obg-ref-share">
        <button class="obg-btn secondary" onclick="window.__obgCopyRef('${esc(code)}')">📋 Copy code</button>
        <button class="obg-btn" onclick="window.__obgShareRef('${esc(url)}')">📤 Share link</button>
      </div>
    </div>
    <div class="obg-section" style="padding:18px">
      <div style="font-weight:800;margin-bottom:8px">Your invite link</div>
      <input class="obg-input" id="obgRefUrl" value="${esc(url)}" readonly onclick="this.select()">
    </div>
    <div class="obg-ref-stats">
      <div class="obg-ref-stat"><div class="obg-muted">Friends joined</div><b>${stats.joined}</b></div>
      <div class="obg-ref-stat"><div class="obg-muted">Rewards earned</div><b>${money(stats.earned)}</b></div>
    </div>
    <div class="obg-section" style="padding:18px;margin-top:14px">
      <div class="obg-info-bar">💡 Your friend must use your code on their first order. Rewards are applied to your account automatically.</div>
    </div>`};
};

window.__obgCopyRef = (code) => {
  navigator.clipboard?.writeText(code).then(
    () => toast('Code copied: ' + code),
    () => toast('Code: ' + code, 4000)
  );
};
window.__obgShareRef = async (url) => {
  const text = 'Get GH₵10 off your first ObuasiGo order with my code!';
  if (navigator.share){
    try { await navigator.share({ title:'ObuasiGo', text, url }); return; } catch {}
  }
  navigator.clipboard?.writeText(url).then(
    () => toast('Link copied to clipboard'),
    () => toast(url, 5000)
  );
};

/* ============================================================
   NEW — Saved cards (Flutterwave-ready)
============================================================ */
views['saved-cards'] = () => ({
  title: 'Saved cards',
  html: '<div id="obgCardsBox"><div class="obg-section"><div class="obg-empty">Loading cards…</div></div></div>',
  onMount: loadCards
});

async function loadCards(){
  const box = document.getElementById('obgCardsBox'); if (!box) return;
  if (!state.user){ box.innerHTML = '<div class="obg-section"><div class="obg-empty">Sign in to save cards.</div></div>'; return; }

  let cards = null;
  try {
    const d = await api('/payments/cards').catch(() => null);
    if (d && Array.isArray(d.cards)) cards = d.cards;
  } catch {}

  if (cards === null) cards = getLS('obg_cards', []);

  const list = cards.map(c => cardRow(c)).join('');
  box.innerHTML = `
    ${cards.length ? `<div class="obg-section">${list}</div>`
                   : `<div class="obg-section"><div class="obg-empty">No cards saved yet.</div></div>`}
    <div class="obg-section" style="padding:18px">
      <button class="obg-btn" onclick="window.__obgAddCard()">➕ Add a card</button>
      <div class="obg-info-bar" style="margin-top:14px">
        🔒 ObuasiGo never stores your full card number. Cards are tokenised by Flutterwave and only a secure reference is kept.
      </div>
    </div>`;
}

function cardRow(c){
  const brand = (c.brand || 'other').toLowerCase();
  const logoCls = ['visa','mastercard','verve'].includes(brand) ? brand : 'other';
  const label = brand.charAt(0).toUpperCase() + brand.slice(1);
  return `<div class="obg-card-row" data-id="${esc(c.id)}">
    <div class="obg-card-logo ${logoCls}">${logoCls==='mastercard'?'MC':label.slice(0,6).toUpperCase()}</div>
    <div class="obg-card-info">
      <b>${esc(label)} •••• ${esc(c.last4 || '····')}</b>
      <small>Expires ${esc(String(c.expMonth||'--').padStart(2,'0'))}/${esc(String(c.expYear||'--').slice(-2))}${c.nickname ? ' · '+esc(c.nickname) : ''}</small>
    </div>
    <button class="obg-card-rm" onclick="window.__obgRmCard('${esc(c.id)}')">Remove</button>
  </div>`;
}

window.__obgAddCard = () => {
  if (!state.user){ toast('Sign in first'); return; }
  state.stack.push('add-card'); render();
};

views['add-card'] = () => ({ title: 'Add a card', html: `
  <div class="obg-section" style="padding:18px">
    <div class="obg-info-bar" style="margin-bottom:14px">
      💡 In production, this form is replaced by Flutterwave's secure checkout — your card details never touch ObuasiGo's servers.
    </div>
    <label class="obg-label">Card nickname</label>
    <input class="obg-input" id="obgCardNick" placeholder="e.g. My Visa" maxlength="30">
    <label class="obg-label">Card number</label>
    <input class="obg-input" id="obgCardNum" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="23">
    <div style="display:flex;gap:10px">
      <div style="flex:1">
        <label class="obg-label">Expiry (MM/YY)</label>
        <input class="obg-input" id="obgCardExp" inputmode="numeric" placeholder="12/27" maxlength="5">
      </div>
      <div style="flex:1">
        <label class="obg-label">CVV</label>
        <input class="obg-input" id="obgCardCvv" inputmode="numeric" placeholder="123" maxlength="4">
      </div>
    </div>
    <button class="obg-btn" style="margin-top:14px" onclick="window.__obgSaveCard()">Save card</button>
  </div>
  <div class="obg-section" style="padding:16px">
    <div class="obg-muted" style="font-size:12.5px">Test cards: Visa 4242 4242 4242 4242 · Mastercard 5555 5555 5555 4444 · Verve 5060 6666 6666 6666 666 · any future expiry · any CVV.</div>
  </div>`});

function detectBrand(num){
  const n = String(num).replace(/\D/g,'');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^506(0|1|2|3|4|5|6|7|8|9)/.test(n) || /^650/.test(n)) return 'verve';
  return 'other';
}

window.__obgSaveCard = async () => {
  const nick  = document.getElementById('obgCardNick').value.trim();
  const num   = document.getElementById('obgCardNum').value.replace(/\s+/g,'');
  const exp   = document.getElementById('obgCardExp').value.trim();
  const cvv   = document.getElementById('obgCardCvv').value.trim();

  if (!/^\d{12,19}$/.test(num)) return toast('Enter a valid card number');
  const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return toast('Expiry must be MM/YY');
  if (!/^\d{3,4}$/.test(cvv)) return toast('Enter a valid CVV');

  const month = parseInt(m[1],10), year = 2000 + parseInt(m[2],10);
  if (month < 1 || month > 12) return toast('Invalid month');

  // ⚠️ This demo NEVER sends the full PAN to the server.
  // The server-side Flutterwave tokenization endpoint would receive the encrypted PAN from FLW's JS SDK.
  // We only persist non-sensitive metadata + a placeholder token.
  const card = {
    id: 'card_' + Math.random().toString(36).slice(2,10),
    brand: detectBrand(num),
    last4: num.slice(-4),
    expMonth: month,
    expYear: year,
    nickname: nick,
    token: 'tok_demo_' + Math.random().toString(36).slice(2,12),
    createdAt: new Date().toISOString()
  };

  // Try server persistence first; fall back to local
  try {
    const r = await api('/payments/cards', { method:'POST', body: JSON.stringify({
      brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear, nickname: card.nickname, token: card.token
    })});
    if (r && r.card) card.id = r.card.id;
  } catch {
    const list = getLS('obg_cards', []); list.push(card); setLS('obg_cards', list);
  }

  toast('Card saved');
  back(); // back to saved-cards list
};

window.__obgRmCard = async (id) => {
  if (!confirm('Remove this card?')) return;
  try {
    await api('/payments/cards/' + encodeURIComponent(id), { method:'DELETE' });
  } catch {
    const list = getLS('obg_cards', []).filter(c => c.id !== id);
    setLS('obg_cards', list);
  }
  toast('Card removed');
  render();
};

/* ============================================================
   Renderer
============================================================ */
function render(){
  const current = state.stack[state.stack.length - 1];
  const view = views[current];
  if (!view){ back(); return; }
  const v = view();
  document.getElementById('obgTitle').textContent = v.title || 'Account';
  document.getElementById('obgBack').textContent = state.stack.length > 1 ? '←' : '×';
  const body = document.getElementById('obgBody');
  body.innerHTML = v.html;
  body.scrollTop = 0;
  body.querySelectorAll('.obg-row[data-target]').forEach(el => {
    el.addEventListener('click', () => { state.stack.push(el.dataset.target); render(); });
  });
  if (typeof v.onMount === 'function') v.onMount();
}

async function refreshUser(){
  if (!token()){ state.user = null; return; }
  try { const d = await api('/me'); state.user = d.user; } catch {}
}

async function refreshActiveOrder(){
  if (!token()){ state.activeOrder = null; return; }
  try {
    const orders = await api('/orders');
    state.activeOrder = orders.find(o => o.status !== 'Completed') || null;
  } catch { state.activeOrder = null; }
}

async function open(){
  document.getElementById('obgMenu').classList.add('open');
  document.body.style.overflow = 'hidden';
  state.stack = ['root'];
  await Promise.all([refreshUser(), refreshActiveOrder()]);
  render();
  updateLiveBadge();
}

function close(){
  closeTrackingSocket();
  if (state.map){ try { state.map.remove(); } catch{} state.map = null; }
  document.getElementById('obgMenu').classList.remove('open');
  document.body.style.overflow = '';
}

function back(){
  // stop tracking when leaving the track screen
  if (state.stack[state.stack.length-1] === 'track') window.__obgStopTracking_light();
  if (state.stack.length <= 1){ close(); return; }
  state.stack.pop(); render();
}
window.__obgStopTracking_light = () => {
  closeTrackingSocket();
  if (state.map){ try { state.map.remove(); } catch{} state.map = null; state.riderMarker = null; }
};

function updateLiveBadge(){
  const btn = document.querySelector('.obg-menu-btn');
  if (!btn) return;
  const existing = btn.querySelector('.obg-live');
  if (state.activeOrder && !existing){
    const dot = document.createElement('span'); dot.className = 'obg-live'; btn.appendChild(dot);
  } else if (!state.activeOrder && existing){
    existing.remove();
  }
}

/* ============================================================
   Window actions (original)
============================================================ */
window.__obgOpenAuth = () => {
  close();
  if (typeof window.openAuth === 'function') window.openAuth();
  else if (typeof window.openSheet === 'function') window.openSheet('auth');
  else toast('Sign in from the main app');
};

window.__obgSignOut = () => {
  if (typeof window.signOut === 'function') window.signOut();
  else { localStorage.removeItem('obg_token'); state.user = null; toast('Signed out'); render(); }
  updateLiveBadge();
};

window.__obgSaveProfile = async () => {
  const fullName = document.getElementById('obgPfName').value.trim();
  const email = document.getElementById('obgPfEmail').value.trim();
  try {
    const d = await api('/me', { method:'PATCH', body: JSON.stringify({ fullName, email }) });
    state.user = d.user; toast('Profile saved'); back();
  } catch(e){ toast(e.message); }
};

window.__obgAddAddr = () => {
  const label = document.getElementById('obgAdLabel').value.trim() || 'Other';
  const text = document.getElementById('obgAdText').value.trim();
  if (!text) return toast('Enter an address');
  const list = getLS('obg_addresses', []);
  list.push({ label, text, icon: label.toLowerCase().includes('home')?'🏠':label.toLowerCase().includes('work')?'💼':'📍' });
  setLS('obg_addresses', list); toast('Address saved'); render();
};
window.__obgRmAddr = (i) => {
  const list = getLS('obg_addresses', []); list.splice(i,1); setLS('obg_addresses', list); toast('Removed'); render();
};
window.__obgSetPref = (p) => {
  const prefs = getLS('obg_payment_prefs', { preferred:'momo', momo:'' });
  prefs.preferred = p; setLS('obg_payment_prefs', prefs); toast('Preferred: ' + p); render();
};
window.__obgSaveMomo = () => {
  const prefs = getLS('obg_payment_prefs', { preferred:'momo', momo:'' });
  prefs.momo = document.getElementById('obgMomo').value.trim(); setLS('obg_payment_prefs', prefs); toast('MoMo number saved');
};
window.__obgToggle = (key, el) => {
  const p = getLS('obg_notifications', { orders:true, riders:true, offers:false, email:false });
  p[key] = !p[key]; setLS('obg_notifications', p); el.classList.toggle('on', p[key]);
};
window.__obgSetLang = (code) => { localStorage.setItem('obg_lang', code); toast('Language set'); render(); };
window.__obgSetTheme = (theme) => { localStorage.setItem('obg_theme', theme); applyTheme(theme); toast('Theme updated'); render(); };
window.__obgToast = toast;

/* ============================================================
   NEW — Push notification toggle
============================================================ */
window.__obgTogglePush = async (el) => {
  const on = el.classList.contains('on');
  if (on){
    // disable
    localStorage.setItem('obg_push_enabled', 'false');
    el.classList.remove('on');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      toast('Push disabled on this device');
    } catch { toast('Push disabled locally'); }
    return;
  }

  // enable
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
    return toast('Push not supported on this device');
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('Permission denied');
    const reg = await navigator.serviceWorker.ready;
    const key = await api('/push/public-key');
    if (!key.configured) return toast('Push not configured on server');
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key.publicKey)
    });
    await api('/push/subscribe', { method:'POST', body: JSON.stringify({ subscription: sub }) });
    localStorage.setItem('obg_push_enabled', 'true');
    el.classList.add('on');
    toast('Push enabled on this device 🎉');
  } catch(e){
    toast('Push failed: ' + (e.message || 'unknown'));
  }
};

/* ============================================================
   Theme
============================================================ */
function applyTheme(theme){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('obg-dark', theme === 'dark' || (theme === 'system' && prefersDark));
}

/* ============================================================
   Shell + Init
============================================================ */
function buildShell(){
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.className = 'obg-menu-btn'; btn.setAttribute('aria-label','Open account menu'); btn.innerHTML = '👤';
  btn.addEventListener('click', open);
  document.body.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'obg-menu'; menu.id = 'obgMenu';
  menu.innerHTML = `
    <div class="obg-menu-header">
      <button class="obg-back" id="obgBack" aria-label="Back">←</button>
      <h1 class="obg-menu-title" id="obgTitle">Account</h1>
    </div>
    <div class="obg-menu-body" id="obgBody"></div>`;
  document.body.appendChild(menu);

  document.getElementById('obgBack').addEventListener('click', back);
}

function init(){
  buildShell();
  applyTheme(localStorage.getItem('obg_theme') || 'light');
  window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // refresh live badge every 30s in case an order completes
  setInterval(() => { if (!document.getElementById('obgMenu').classList.contains('open')) { refreshActiveOrder().then(updateLiveBadge); } }, 30000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();