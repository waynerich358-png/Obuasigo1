(function(){
  const KEY='obuasigo_cookie_choice';
  function addFooter(){
    if(document.querySelector('.site-footer')) return;
    const f=document.createElement('footer');
    f.className='site-footer';
    f.innerHTML='<div><strong>ObuasiGo</strong><br><span>Everything Obuasi Needs.</span></div><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refund Policy</a><a href="/cookies">Cookies</a></nav><small>© '+new Date().getFullYear()+' ObuasiGo. Business/legal details must be completed before public launch.</small>';
    document.body.appendChild(f);
  }
  function analytics(id){
    if(!id || window.__obuAnalyticsLoaded) return;
    window.__obuAnalyticsLoaded=true;
    const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',id,{anonymize_ip:true});
  }
  function banner(){
    if(localStorage.getItem(KEY)) return;
    const b=document.createElement('div');b.className='cookie-banner';b.setAttribute('role','dialog');b.setAttribute('aria-label','Cookie and analytics preferences');
    b.innerHTML='<div><strong>Privacy choices</strong><p>ObuasiGo uses necessary storage to keep the service working. Optional analytics helps us understand site usage. You can accept or decline optional analytics.</p></div><div class="cookie-actions"><button id="cookieDecline" type="button">Decline</button><button id="cookieAccept" type="button">Accept analytics</button></div>';
    document.body.appendChild(b);
    const save=(v)=>{localStorage.setItem(KEY,v);b.remove();if(v==='accepted')loadAnalytics()};
    document.getElementById('cookieAccept').onclick=()=>save('accepted');
    document.getElementById('cookieDecline').onclick=()=>save('declined');
  }
  async function loadAnalytics(){try{const r=await fetch('/api/public-config',{cache:'no-store'});const d=await r.json();analytics(d.analyticsId)}catch{}}
  function init(){addFooter();banner();if(localStorage.getItem(KEY)==='accepted')loadAnalytics();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
