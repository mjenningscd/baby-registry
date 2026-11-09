(function(){
const CATS=["Baby gear","Feeding","Sleeping","Nappies","Health & safety","Clothing","Playing","Nursery & decor","Mum","Bathing","General"];
const TINT={"Baby gear":["#f3dfb0","#a0732a"],"Feeding":["#d6e5ef","#4f7591"],"Sleeping":["#dde6d2","#5f7a52"],"Nappies":["#f3dfb0","#a0732a"],"Health & safety":["#d6e5ef","#4f7591"],"Clothing":["#dde6d2","#5f7a52"],"Playing":["#f3dfb0","#a0732a"],"Nursery & decor":["#d6e5ef","#4f7591"],"Mum":["#dde6d2","#5f7a52"],"Bathing":["#d6e5ef","#4f7591"],"General":["#f3dfb0","#a0732a"]};
const ICON={
 "Baby gear":'<circle cx="17" cy="44" r="5"/><circle cx="45" cy="44" r="5"/><path d="M8 14h8l6 22h26l6-18H20"/><path d="M38 18c0-8 7-12 14-10"/>',
 "Feeding":'<path d="M24 6h12v6H24z"/><path d="M22 12h16l3 8v30a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4V20z"/><path d="M19 28h22M19 38h22"/>',
 "Sleeping":'<path d="M40 8a20 20 0 1 0 14 34A18 18 0 0 1 40 8z"/><path d="M14 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>',
 "Nappies":'<path d="M8 18h48v8c0 14-10 24-24 24S8 40 8 26z"/><path d="M8 18c6 6 14 8 24 8s18-2 24-8"/>',
 "Health & safety":'<path d="M32 8l20 8v14c0 12-9 20-20 24C21 50 12 42 12 30V16z"/><path d="M32 22v16M24 30h16"/>',
 "Clothing":'<path d="M22 8l10 6 10-6 12 10-6 8-4-3v29H20V23l-4 3-6-8z"/>',
 "Playing":'<circle cx="32" cy="34" r="16"/><circle cx="20" cy="14" r="6"/><circle cx="44" cy="14" r="6"/><circle cx="26" cy="32" r="1.5"/><circle cx="38" cy="32" r="1.5"/><path d="M28 40c2 2 6 2 8 0"/>',
 "Nursery & decor":'<path d="M12 54V24l20-14 20 14v30z"/><path d="M26 54V38h12v16"/><path d="M44 14V6"/>',
 "Mum":'<path d="M32 52S10 38 10 22a11 11 0 0 1 22-3 11 11 0 0 1 22 3c0 16-22 30-22 30z"/>',
 "Bathing":'<path d="M8 30h48v6c0 9-7 16-16 16H24c-9 0-16-7-16-16z"/><path d="M14 30V14a6 6 0 0 1 12 0"/><circle cx="40" cy="18" r="3"/><circle cx="48" cy="12" r="2"/>',
 "General":'<rect x="10" y="22" width="44" height="30" rx="3"/><path d="M8 14h48v8H8zM32 14v38"/><path d="M32 14c-4-8-14-8-12 0M32 14c4-8 14-8 12 0"/>'
};
const PICKS=new Set(["maxicosi-monitor","eufy-s1-pro","bunjie-bundle","momcozy-kleanpal","teddy-clouds","babybjorn-carrier-mini","jengo-bouncer","sable-nappybag"]);

let BASE=[], CATALOG=[], custom=[], removed=new Set(), wanted={}, purchases=[], images={}, overrides={}, lastState="";
const loadedPhotos=new Set();
window.__photoOk=(el,id)=>{loadedPhotos.add(id);el.parentNode.classList.add("has-photo")};
let isOwner=false, managing=false, adminKey=null;
let cat="All", show="needed", query="", sort="rec";

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null?"":"$"+(v%1?Number(v).toFixed(2):Number(v).toFixed(0));
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(_){return "the store"}};
const wantOf=it=>wanted[it.id]!=null?wanted[it.id]:it.qty;
const gotOf=it=>purchases.filter(p=>p.itemId===it.id).reduce((a,p)=>a+(p.qty||0),0);
const leftOf=it=>Math.max(0,wantOf(it)-gotOf(it));
const buyUrl=it=>it.url||("https://www.google.com/search?tbm=shop&gl=au&q="+encodeURIComponent(it.name));
const buyLabel=it=>it.url?("Buy at "+it.store):"Find it online";
const photoOf=it=>images[it.id]||it.image||(it.custom?(it.image||null):(it.url?"/api/img/"+encodeURIComponent(it.id)+(images.v?"?v="+images.v:""):null));

async function api(path,opts={}){
  const headers={"content-type":"application/json"};
  if(adminKey)headers["x-admin-key"]=adminKey;
  const r=await fetch("/api/"+path,Object.assign({headers},opts));
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(data.error||"Something went wrong.");e.status=r.status;e.data=data;throw e}
  return data;
}

function rebuild(){
  const extra=custom.map(c=>Object.assign({qty:1,cat:"General",order:100000},c,{custom:true,name:c.name||("New item from "+host(c.url)),store:c.store||host(c.url),pending:!c.name||c.price==null}));
  CATALOG=BASE.map(it=>overrides[it.id]?Object.assign({},it,overrides[it.id]):it).concat(extra).filter(it=>!removed.has(it.id));
}
function icon(it,cls){const fg=(TINT[it.cat]||TINT.General)[1];return `<svg class="${cls||"ic"}" viewBox="0 0 64 64" fill="none" stroke="${fg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[it.cat]||ICON.General}</svg>`}
function media(it,cls){
  const p=photoOf(it);
  return icon(it,cls)+(p?`<img class="photo" src="${esc(p)}" alt="" referrerpolicy="no-referrer" decoding="async" onload="__photoOk(this,'${it.id}')" onerror="this.remove()">`:"");
}

/* Hero sky */
(function sky(){
  const c=$("#sky"),x=c.getContext("2d");let w,h,st=[];
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(){w=c.width=c.offsetWidth*devicePixelRatio;h=c.height=c.offsetHeight*devicePixelRatio;st=Array.from({length:46},()=>({x:Math.random()*w,y:Math.random()*h,r:(Math.random()*1.4+.4)*devicePixelRatio,p:Math.random()*6.28,s:Math.random()*.004+.001}))}
  function draw(t){x.clearRect(0,0,w,h);const col=getComputedStyle(document.documentElement).getPropertyValue("--dusk").trim();
    for(const s of st){x.globalAlpha=.25+.35*Math.sin(s.p+t*s.s);x.fillStyle=col;x.beginPath();x.arc(s.x,s.y,s.r,0,6.28);x.fill()}
    if(!reduce)requestAnimationFrame(draw)}
  size();addEventListener("resize",size);requestAnimationFrame(draw);
})();

/* Confetti */
function confetti(fromEl){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const c=$("#confetti"),x=c.getContext("2d"),dpr=devicePixelRatio||1;
  c.width=innerWidth*dpr;c.height=innerHeight*dpr;
  const r=fromEl?fromEl.getBoundingClientRect():{left:innerWidth/2,top:innerHeight*.7,width:0,height:0};
  const ox=(r.left+r.width/2)*dpr, oy=(r.top+r.height/2)*dpr;
  const cols=["#e3b459","#f0c862","#9cb08a","#b7c9a5","#a9c6dc","#f3dfb0","#fffdf7"];
  const ps=[];
  const burst=(x0,y0,n,spread)=>{for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*spread,v=(Math.random()*14+9)*dpr;
    ps.push({x:x0,y:y0,vx:Math.cos(a)*v,vy:Math.sin(a)*v,w:(Math.random()*7+5)*dpr,h:(Math.random()*4+3)*dpr,rot:Math.random()*6.28,vr:(Math.random()-.5)*.35,c:cols[i%cols.length],shape:Math.random()<.25?"c":"r",life:0})}};
  burst(ox,oy,140,2.2);
  setTimeout(()=>{burst(0,c.height*.9,70,1.2);burst(c.width,c.height*.9,70,1.2)},180);
  ps.forEach(p=>{if(p.x===0)p.vx=Math.abs(p.vx);});
  let last=performance.now();
  (function tick(now){
    const dt=Math.min(32,now-last)/16;last=now;x.clearRect(0,0,c.width,c.height);
    let alive=0;
    for(const p of ps){p.life+=dt;p.vy+=.38*dpr*dt;p.vx*=.992;p.vy*=.992;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
      if(p.y<c.height+40){alive++;x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.globalAlpha=Math.max(0,1-p.life/220);x.fillStyle=p.c;
        if(p.shape==="c"){x.beginPath();x.arc(0,0,p.h*.8,0,6.28);x.fill()}else{x.scale(1,Math.cos(p.life*.18));x.fillRect(-p.w/2,-p.h/2,p.w,p.h)}x.restore()}}
    if(alive)requestAnimationFrame(tick);else x.clearRect(0,0,c.width,c.height);
  })(last);
}

function renderStats(){
  const totW=CATALOG.reduce((a,it)=>a+wantOf(it),0),got=CATALOG.reduce((a,it)=>a+Math.min(gotOf(it),wantOf(it)),0);
  const pct=totW?Math.round(got/totW*100):0;
  $("#statLeft").textContent=totW-got;$("#statGiven").textContent=got;
  $("#ringPct").textContent=pct+"%";$("#ringArc").style.strokeDashoffset=226.2*(1-pct/100);
}
function renderCats(){
  const counts={All:CATALOG.filter(it=>leftOf(it)>0).length};
  CATS.forEach(c=>counts[c]=CATALOG.filter(it=>it.cat===c&&leftOf(it)>0).length);
  $("#cats").innerHTML=["All",...CATS].filter(c=>c==="All"||CATALOG.some(it=>it.cat===c)).map(c=>`<button type="button" class="cat" data-cat="${esc(c)}" aria-pressed="${c===cat}">${esc(c)} <span class="num" style="opacity:.6">${counts[c]}</span></button>`).join("");
}
function card(it,i){
  const want=wantOf(it),got=Math.min(gotOf(it),want),left=want-got,done=left===0;
  const bg=(TINT[it.cat]||TINT.General)[0];
  const dots=want<=6&&want>0?`<span class="dots">${Array.from({length:want},(_,k)=>`<i class="${k<got?"on":""}"></i>`).join("")}</span>`:"";
  const needTxt=done?"All gifted, thank you":`Still needed: <b class="num">${left}</b> of ${want}`;
  const badge=PICKS.has(it.id)&&!done?`<span class="badge most">Most wanted</span>`:(want>1&&!done?`<span class="badge">Need ${want}</span>`:"");
  const pend=isOwner&&it.pending?`<span class="badge" style="top:auto;bottom:12px">Needs a name &amp; price</span>`:"";
  const owner=managing?`<div class="owner-qty"><span>Wanted</span><span class="stepper"><button type="button" data-wq="${it.id}" data-d="-1" aria-label="Fewer">−</button><output class="num">${want}</output><button type="button" data-wq="${it.id}" data-d="1" aria-label="More">+</button></span></div>
    <div class="acts"><button class="btn" type="button" data-edit="${it.id}">Edit details</button><button class="btn" type="button" data-remove="${it.id}" style="color:#a04545">Remove</button></div>`:"";
  return `<article class="card ${done?"done":""}" style="animation-delay:${Math.min(i,16)*30}ms">
    <button class="tile ${loadedPhotos.has(it.id)?"has-photo":""}" style="background:${bg}" data-open="${it.id}" aria-label="More about ${esc(it.name)}">${media(it)}${badge}${pend}${done?'<span class="stamp">Gifted ♡</span>':""}</button>
    <div class="body">
      <div class="store">${esc(it.store||"Available online")}</div>
      <button class="name" data-open="${it.id}">${esc(it.name)}</button>
      <div class="row"><span class="price num">${money(it.price)}</span><span class="need">${dots}${needTxt}</span></div>
      ${owner}
      <div class="acts">
        <a class="btn" href="${esc(buyUrl(it))}" target="_blank" rel="noopener" ${done?'aria-disabled="true"':""}>${esc(buyLabel(it))} ↗</a>
        <button class="btn primary" type="button" data-buy="${it.id}" ${done?'aria-disabled="true"':""}>I bought this</button>
      </div>
    </div></article>`;
}
function render(){
  rebuild();renderStats();renderCats();
  let list=CATALOG.filter(it=>(cat==="All"||it.cat===cat)&&(!query||it.name.toLowerCase().includes(query)||(it.store||"").toLowerCase().includes(query)));
  if(show==="needed")list=list.filter(it=>leftOf(it)>0);
  if(show==="gifted")list=list.filter(it=>gotOf(it)>0);
  const by={rec:(a,b)=>(PICKS.has(b.id)-PICKS.has(a.id))||a.order-b.order,lo:(a,b)=>(a.price??1e9)-(b.price??1e9),hi:(a,b)=>(b.price??-1)-(a.price??-1)}[sort];
  list.sort(by);
  let html="";
  if(!list.length)html=`<div class="grid"><p class="empty">${show==="gifted"?"Nothing has been gifted yet.":"Nothing matches. Try another category or search."}</p></div>`;
  else if(cat==="All"&&sort==="rec"&&!query){CATS.forEach(c=>{const g=list.filter(it=>it.cat===c);if(g.length)html+=`<div class="section-h"><h2>${esc(c)}</h2><span class="num">${g.length} item${g.length>1?"s":""}</span></div><div class="grid">${g.map(card).join("")}</div>`})}
  else html=`<div class="grid">${list.map(card).join("")}</div>`;
  $("#main").innerHTML=html;
}

/* Sheets */
function openSheet(html){$("#sheet").innerHTML=`<button class="close" type="button" data-close aria-label="Close">×</button>`+html;$("#sheet").classList.add("on");$("#scrim").classList.add("on");setTimeout(()=>{const f=$("#sheet input, #sheet button:not(.close)");f&&f.focus()},250)}
function closeSheet(){$("#sheet").classList.remove("on");$("#scrim").classList.remove("on");$("#sheet").onclick=null}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("on"),3000)}

function openDetail(it){
  const bg=(TINT[it.cat]||TINT.General)[0],left=leftOf(it),want=wantOf(it);
  const given=purchases.filter(p=>p.itemId===it.id);
  const list=given.length?`<ul class="gifters">${given.map(p=>`<li><b>${p.surprise&&!isOwner?"A surprise gift":esc(p.name||"Someone special")}</b> · ${p.qty} ${p.qty>1?"items":"item"}${p.message?`<small>“${esc(p.message)}”</small>`:""}${isOwner?`<small><button class="btn" style="padding:4px 10px;margin-top:6px" data-undo="${p.id}">Remove this purchase</button></small>`:""}</li>`).join("")}</ul>`:"";
  openSheet(`<div class="detail-tile tile ${loadedPhotos.has(it.id)?"has-photo":""}" style="background:${bg}">${media(it,"")}</div>
    <span class="eyebrow">${esc(it.cat)}</span><h3 id="sheetTitle">${esc(it.name)}</h3>
    <p class="sub">${it.price!=null?`<b class="num">${money(it.price)}</b> at ${esc(it.store)} · `:""}${left?`Still needed: <b>${left}</b> of ${want}`:"All gifted, thank you"}</p>
    <div class="acts"><a class="btn" href="${esc(buyUrl(it))}" target="_blank" rel="noopener">${esc(buyLabel(it))} ↗</a><button class="btn primary" type="button" data-buy="${it.id}" ${left?"":'aria-disabled="true"'}>I bought this</button></div>${list}`);
}

function openBuy(it,fromEl){
  const left=leftOf(it);if(!left)return;let n=1;
  let saved={};try{saved=JSON.parse(localStorage.getItem("gifter")||"{}")}catch(_){}
  openSheet(`<span class="eyebrow">Thank you</span><h3 id="sheetTitle">${esc(it.name)}</h3>
    <p class="sub">Let us know how many you bought, and we'll take them off the list so nobody doubles up.</p>
    <form id="buyForm">
      <div class="field"><label>How many did you buy?</label><span class="stepper"><button type="button" data-n="-1" aria-label="One fewer">−</button><output class="num" id="nOut">1</output><button type="button" data-n="1" aria-label="One more">+</button></span><small style="color:var(--muted)">${left} still needed</small></div>
      <div class="field"><label for="gName">Your name</label><input id="gName" required maxlength="60" autocomplete="name" placeholder="e.g. Aunty Jo" value="${esc(saved.name||"")}"></div>
      <div class="field"><label for="gMsg">A note for Matt &amp; Grace (optional)</label><textarea id="gMsg" rows="2" maxlength="280"></textarea></div>
      <label class="check"><input type="checkbox" id="gSurprise"> <span>Keep it a surprise. Matt &amp; Grace will see that it's been bought, but not who bought it until they choose to look.</span></label>
      <button class="btn primary" style="width:100%;padding:14px" type="submit">Tick it off the registry</button>
    </form>`);
  $("#sheet").onclick=e=>{const b=e.target.closest("[data-n]");if(b){n=Math.min(left,Math.max(1,n+ +b.dataset.n));$("#nOut").textContent=n}};
  $("#buyForm").onsubmit=async e=>{
    e.preventDefault();const btn=e.submitter||$("#buyForm button[type=submit]");btn.disabled=true;btn.textContent="Saving…";
    const name=$("#gName").value.trim();
    try{
      await api("purchase",{method:"POST",body:JSON.stringify({itemId:it.id,qty:n,name,message:$("#gMsg").value.trim(),surprise:$("#gSurprise").checked})});
      try{localStorage.setItem("gifter",JSON.stringify({name}))}catch(_){}
      closeSheet();confetti(fromEl);toast("Thank you! It's been ticked off.");await load();
    }catch(err){btn.disabled=false;btn.textContent="Tick it off the registry";toast(err.message);if(err.status===409){closeSheet();load()}}
  };
}

/* Owner tools */
function openLogin(){
  openSheet(`<span class="eyebrow">For Matt &amp; Grace</span><h3 id="sheetTitle">Manage the registry</h3><p class="sub">Enter the registry password to add, edit and remove items.</p>
  <form id="loginForm"><div class="field"><label for="pw">Password</label><input id="pw" type="password" required autocomplete="current-password"></div><button class="btn primary" style="width:100%;padding:14px" type="submit">Sign in</button></form>`);
  $("#loginForm").onsubmit=async e=>{e.preventDefault();adminKey=$("#pw").value;
    try{await api("admin/check");try{localStorage.setItem("adminKey",adminKey)}catch(_){}isOwner=true;closeSheet();showOwner();await load();toast("Signed in. Your tools are at the top of the page.")}
    catch(_){adminKey=null;toast("That password didn't work.")}};
}
function showOwner(){$("#ownerBar").hidden=false}
function openAdd(prefill){
  let n=1;const p=prefill||{};
  openSheet(`<span class="eyebrow">Add to the registry</span><h3 id="sheetTitle">${p.id?"Edit item":"Add an item"}</h3>
    <p class="sub">${p.id?"Change any details below. For the photo: on the store's product page, right-click (or long-press) the main photo, choose Copy Image Address, and paste it in Photo link.":"Paste a product link and we'll fill in the name, price and photo. Check them, then add it."}</p>
    <form id="addForm">
      <div class="field"><label for="aUrl">Product link</label><input id="aUrl" type="url" required placeholder="https://www.babybunting.com.au/product/…" value="${esc(p.url||"")}"></div>
      <div id="aPreview"></div>
      <div class="field"><label for="aName">Name</label><input id="aName" maxlength="140" value="${esc(p.name||"")}"></div>
      <div class="field"><label for="aPrice">Price ($)</label><input id="aPrice" inputmode="decimal" value="${p.price!=null?p.price:""}"></div>
      <div class="field"><label for="aStore">Store</label><input id="aStore" maxlength="60" value="${esc(p.store||"")}"></div>
      <div class="field"><label for="aImg">Photo</label>
        <div class="acts"><label class="btn" for="aFile" style="cursor:pointer">Choose a photo</label><button class="btn" type="button" id="aPasteBtn">Paste copied photo</button></div>
        <input id="aFile" type="file" accept="image/*" hidden>
        <small style="color:var(--muted)">Copy the photo on the store's page, then tap Paste (or press Cmd+V / Ctrl+V here). A screenshot works too. Or paste a photo link:</small>
        <input id="aImg" type="text" inputmode="url" value="${esc(p.image||"")}" placeholder="https://…"></div>
      <div class="field"><label for="aCat">Category</label><select id="aCat" class="sort" style="border-radius:12px;padding:11px 13px">${CATS.map(c=>`<option ${c===(p.cat||"General")?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
      ${p.id?"":`<div class="field"><label>How many do you want?</label><span class="stepper"><button type="button" data-an="-1" aria-label="One fewer">−</button><output class="num" id="aN">1</output><button type="button" data-an="1" aria-label="One more">+</button></span></div>`}
      <button class="btn primary" style="width:100%;padding:14px" type="submit">${p.id?"Save changes":"Add to registry"}</button>
    </form>`);
  const preview=()=>{const src=$("#aImg").value;$("#aPreview").innerHTML=src?`<div class="tile has-photo" style="background:#fff;border-radius:14px;aspect-ratio:16/10;margin-bottom:14px"><img class="photo" src="${esc(src)}" alt="" referrerpolicy="no-referrer"></div>`:""};
  preview();$("#aImg").addEventListener("input",preview);
  const useFile=async f=>{if(!f||!/^image\//.test(f.type)){toast("That isn't a photo.");return}
    $("#aPreview").innerHTML=`<p class="sub">Uploading photo…</p>`;
    try{const data=await shrink(f);const r=await api("admin/upload",{method:"POST",body:JSON.stringify({data})});$("#aImg").value=r.url;preview();toast("Photo added.")}
    catch(err){$("#aPreview").innerHTML="";toast(err.message||"Couldn't use that photo.")}};
  $("#aFile").addEventListener("change",e=>useFile(e.target.files[0]));
  $("#sheet").addEventListener("paste",e=>{const it=[...(e.clipboardData||{}).items||[]].find(i=>i.type.startsWith("image/"));if(it){e.preventDefault();useFile(it.getAsFile())}});
  $("#aPasteBtn").addEventListener("click",async()=>{try{const items=await navigator.clipboard.read();for(const i of items){const type=i.types.find(x=>x.startsWith("image/"));if(type){useFile(new File([await i.getType(type)],"photo",{type}));return}}toast("No photo copied yet. Copy the photo on the store's page first.")}catch(_){toast("Your browser blocked pasting. Long-press the photo field and choose Paste, or use Choose a photo.")}});
  $("#sheet").onclick=e=>{const b=e.target.closest("[data-an]");if(b){n=Math.max(1,n+ +b.dataset.an);$("#aN").textContent=n}};
  let lastLooked=p.url||"";
  const look=async()=>{const u=$("#aUrl").value.trim();if(!/^https?:\/\//.test(u)||u===lastLooked)return;lastLooked=u;
    $("#aPreview").innerHTML=`<p class="sub">Reading the store page…</p>`;
    try{const r=await api("admin/lookup",{method:"POST",body:JSON.stringify({url:u})});
      const got=[];
      if(r.image){$("#aImg").value=r.image;got.push("photo")}
      if(r.price!=null){$("#aPrice").value=r.price;got.push("price")}
      $("#aStore").value=r.store||host(u);got.push("store");
      if(r.name&&(!p.id||!$("#aName").value))$("#aName").value=r.name;
      preview();
      const miss=[];if(r.price==null)miss.push("price");if(!r.image)miss.push("photo");
      $("#aPrice").style.borderColor=r.price==null?"#a8772a":"";$("#aPrice").style.background=r.price==null?"#fbf0d6":"";
      if(r.price==null){$("#aPrice").placeholder="Type the price from the store page";}
      toast(miss.length?("Updated the "+got.join(", ")+". "+$("#aStore").value+" doesn't share its "+miss.join(" or ")+", so please add "+(miss.length>1?"them":"it")+" below."):"Updated the "+got.join(", ")+" from the new link.");
      if(!r.image)$("#aPreview").innerHTML=`<p class="sub">This store didn't share its photo. Copy the photo on its page and tap Paste copied photo.</p>`;
    }catch(_){$("#aPreview").innerHTML=`<p class="sub">Couldn't read that page. Add the details below instead.</p>`}};
  $("#aUrl").addEventListener("change",look);$("#aUrl").addEventListener("paste",()=>setTimeout(look,50));
  $("#addForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$("#addForm button[type=submit]");btn.disabled=true;
    const body={id:p.id,url:$("#aUrl").value.trim(),name:$("#aName").value.trim(),price:$("#aPrice").value.replace(/[^0-9.]/g,""),store:$("#aStore").value.trim(),image:$("#aImg").value.trim(),cat:$("#aCat").value,qty:n};
    try{await api(p.id?"admin/edit":"admin/add",{method:"POST",body:JSON.stringify(body)});closeSheet();toast(p.id?"Saved.":"Added to the registry.");await load()}
    catch(err){btn.disabled=false;toast(err.message)}};
}
function openPhoto(it){
  openSheet(`<span class="eyebrow">Photo</span><h3 id="sheetTitle">${esc(it.name)}</h3>
    <p class="sub">Some stores block other sites from reading their photos. On the product page, right-click (or long-press) the main photo, choose <b>Copy Image Address</b>, and paste it here.</p>
    <form id="photoForm"><div class="field"><label for="phUrl">Photo link</label><input id="phUrl" type="url" value="${esc(images[it.id]||"")}" placeholder="https://…jpg"></div>
    <div id="phPrev"></div>
    <div class="acts"><button class="btn" type="button" data-photo-reset="${it.id}">Try the store again</button><button class="btn primary" type="submit">Save photo</button></div></form>`);
  const prev=()=>{const v=$("#phUrl").value;$("#phPrev").innerHTML=v?`<div class="tile has-photo" style="background:#fff;border-radius:14px;aspect-ratio:16/10;margin-bottom:14px"><img class="photo" src="${esc(v)}" alt="" referrerpolicy="no-referrer"></div>`:""};prev();$("#phUrl").addEventListener("input",prev);
  $("#photoForm").onsubmit=async e=>{e.preventDefault();try{await api("admin/photo",{method:"POST",body:JSON.stringify({id:it.id,image:$("#phUrl").value.trim()})});loadedPhotos.delete(it.id);closeSheet();toast("Photo saved.");lastState="";load()}catch(err){toast(err.message)}};
}
function shrink(file){return new Promise((res,rej)=>{const img=new Image();const u=URL.createObjectURL(file);img.onload=()=>{const m=1200,k=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",.85))};img.onerror=()=>rej(new Error("Couldn't read that photo."));img.src=u})}
function openRemove(it){
  openSheet(`<span class="eyebrow">Remove item</span><h3 id="sheetTitle">${esc(it.name)}</h3>
    <p class="sub">This takes it off the registry for everyone. ${gotOf(it)?`<b>${gotOf(it)} already gifted</b>; those gifts stay in your "who gave what" list.`:""}</p>
    <div class="acts"><button class="btn" type="button" data-close>Keep it</button><button class="btn primary" type="button" data-confirm-remove="${it.id}" style="background:#a04545;border-color:#a04545">Remove</button></div>`);
}
function openGifts(){
  const rows=purchases.slice().sort((a,b)=>(b.at||"").localeCompare(a.at||""));
  const hidden=BASE.concat(custom).filter(it=>removed.has(it.id));
  openSheet(`<span class="eyebrow">For Matt &amp; Grace</span><h3 id="sheetTitle">Who gave what</h3><p class="sub">${rows.length} gift${rows.length===1?"":"s"} so far, including surprises.</p>
  ${rows.length?`<ul class="gifters">${rows.map(p=>{const it=BASE.concat(custom).find(x=>x.id===p.itemId);return `<li><b>${esc(p.name||"Someone")}</b>${p.surprise?" · surprise":""}<small>${p.qty} × ${esc(it?it.name:p.itemId)}${p.message?` · “${esc(p.message)}”`:""}</small></li>`}).join("")}</ul>`:'<p class="sub">No gifts yet.</p>'}
  ${hidden.length?`<h3 style="font-size:20px;margin-top:22px">Removed items</h3><ul class="gifters">${hidden.map(it=>`<li>${esc(it.name||it.url)} <small><button class="btn" style="padding:4px 10px;margin-top:6px" data-restore="${it.id}">Put it back</button></small></li>`).join("")}</ul>`:""}`);
}

document.addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-close]")||t===$("#scrim")){closeSheet();return}
  const c=t.closest("[data-cat]");if(c){cat=c.dataset.cat;render();return}
  const s=t.closest("[data-show]");if(s){show=s.dataset.show;document.querySelectorAll("[data-show]").forEach(b=>b.setAttribute("aria-pressed",b===s));render();return}
  const o=t.closest("[data-open]");if(o){openDetail(CATALOG.find(x=>x.id===o.dataset.open));return}
  const b=t.closest("[data-buy]");if(b){openBuy(CATALOG.find(x=>x.id===b.dataset.buy),b);return}
  if(!isOwner)return;
  const w=t.closest("[data-wq]");if(w){const it=CATALOG.find(x=>x.id===w.dataset.wq);const v=Math.max(gotOf(it),Math.max(0,wantOf(it)+ +w.dataset.d));wanted[it.id]=v;render();try{await api("admin/wanted",{method:"POST",body:JSON.stringify({id:it.id,qty:v})})}catch(err){toast(err.message)}return}
  const ed=t.closest("[data-edit]");if(ed){const it=CATALOG.find(x=>x.id===ed.dataset.edit);openAdd(Object.assign({},it,{image:photoOf(it)&&!String(photoOf(it)).startsWith("/api/img/")?photoOf(it):""}));return}
  const ph=t.closest("[data-photo]");if(ph){openPhoto(CATALOG.find(x=>x.id===ph.dataset.photo));return}
  const pr=t.closest("[data-photo-reset]");if(pr){try{await api("admin/refresh-photo",{method:"POST",body:JSON.stringify({id:pr.dataset.photoReset})});loadedPhotos.delete(pr.dataset.photoReset);closeSheet();toast("Checking the store again…");lastState="";load()}catch(err){toast(err.message)}return}
  const rm=t.closest("[data-remove]");if(rm){openRemove(CATALOG.find(x=>x.id===rm.dataset.remove));return}
  const cr=t.closest("[data-confirm-remove]");if(cr){try{await api("admin/remove",{method:"POST",body:JSON.stringify({id:cr.dataset.confirmRemove})});closeSheet();toast("Removed from the registry.");load()}catch(err){toast(err.message)}return}
  const rs=t.closest("[data-restore]");if(rs){try{await api("admin/restore",{method:"POST",body:JSON.stringify({id:rs.dataset.restore})});closeSheet();toast("It's back on the registry.");load()}catch(err){toast(err.message)}return}
  const u=t.closest("[data-undo]");if(u){try{await api("admin/undo",{method:"POST",body:JSON.stringify({id:u.dataset.undo})});closeSheet();toast("Purchase removed.");load()}catch(err){toast(err.message)}return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet()});
$("#q").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();render()});
$("#sort").addEventListener("change",e=>{sort=e.target.value;render()});
$("#manageBtn").onclick=()=>{managing=!managing;$("#manageBtn").textContent=managing?"Done editing":"Edit or remove items";render()};
$("#addBtn").onclick=()=>{if(isOwner)openAdd()};
$("#giftsBtn").onclick=()=>{if(isOwner)openGifts()};
$("#ownerLink").onclick=()=>{if(isOwner){toast("You're already signed in. Your tools are at the top of the page.");scrollTo({top:0,behavior:"smooth"})}else openLogin()};
$("#signOut").onclick=()=>{try{localStorage.removeItem("adminKey")}catch(_){}location.hash="";location.reload()};

async function load(){
  try{const s=await api("state");const sig=JSON.stringify(s);$("#banner").hidden=true;if(sig===lastState)return;lastState=sig;custom=s.items||[];removed=new Set(s.removed||[]);wanted=s.wanted||{};purchases=s.purchases||[];images=s.images||{};overrides=s.overrides||{};render()}
  catch(_){$("#banner").hidden=false;$("#banner").textContent="Couldn't reach the registry just now. It'll keep trying."}
}

(async function init(){
  try{adminKey=localStorage.getItem("adminKey")}catch(_){}
  BASE=await (await fetch("/catalog.json")).json();
  if(adminKey){try{await api("admin/check");isOwner=true;showOwner()}catch(_){adminKey=null;try{localStorage.removeItem("adminKey")}catch(_){}}}
  render();await load();
  if(location.hash==="#manage"&&!isOwner)openLogin();
  addEventListener("hashchange",()=>{if(location.hash==="#manage"&&!isOwner)openLogin()});
  setInterval(()=>{if(!document.hidden&&!$("#sheet").classList.contains("on"))load()},20000);
})();
})();
