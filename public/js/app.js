const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let me=null, currentCategory="All";

async function api(url,opt={}){
  const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Request failed");
  return data;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function money(n){return "৳ "+Number(n||0).toLocaleString("en-BD");}
function modal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden");}
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")$("#modal").classList.add("hidden")});

async function loadMe(){
  const d=await api("/api/me"); me=d.user;
  $("#loginBtn").classList.toggle("hidden",!!me);$("#signupBtn").classList.toggle("hidden",!!me);
  $("#userBtn").classList.toggle("hidden",!me);
  if(me){$("#userBtn").textContent=me.name.slice(0,1).toUpperCase();$("#userBtn").onclick=openAccount;}
}
async function loadStats(){
  try{const d=await api("/api/admin/summary");$("#sListings").textContent=d.listings;$("#sUsers").textContent=d.users;$("#sOrders").textContent=d.orders}catch{}
}
async function loadListings(){
  const q=$("#search").value.trim();
  const d=await api(`/api/listings?q=${encodeURIComponent(q)}&category=${encodeURIComponent(currentCategory)}`);
  $("#listings").innerHTML=d.listings.map(l=>`
  <article class="card"><div class="cover ${l.category.toLowerCase()}"><span>VERIFIED</span><i class="fa-solid ${l.category==="Gaming"?"fa-gamepad":l.category==="Creator"?"fa-youtube":l.category==="Design"?"fa-palette":l.category==="Web"?"fa-code":"fa-layer-group"}"></i></div>
  <div class="body"><small>${esc(l.category)}</small><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p>
  <div class="seller"><b>${esc(l.seller[0]||"S")}</b><div><strong>${esc(l.seller)}</strong><span><i class="fa-solid fa-shield"></i> Platform verified</span></div></div>
  <div class="bottom"><div><small>PRICE</small><strong>${money(l.price)}</strong></div><button class="details" onclick="openListing('${l.id}')">View</button></div></div></article>`).join("");
  $("#empty").classList.toggle("hidden",!d.listings.length);
}
async function openListing(listingId){
  const d=await api("/api/listings"); const l=d.listings.find(x=>x.id===listingId); if(!l)return;
  modal(`<h2>${esc(l.title)}</h2><div class="notice"><b>${esc(l.category)}</b> · Seller: ${esc(l.seller)} · ${money(l.price)}</div><p style="color:#8894a4;font-size:12px;margin:14px 0">${esc(l.description)}</p>
  <div class="notice">For safety, NEXORA does not ask sellers to submit passwords, OTPs, recovery codes or other private credentials.</div>
  <button class="primary" style="width:100%;margin-top:12px" onclick="startOrder('${l.id}')">Start Protected Order</button>`);
}
async function startOrder(id){
  if(!me){return loginModal("Login required","Please login to start an order.");}
  try{const d=await api("/api/orders",{method:"POST",body:JSON.stringify({listingId:id})});alert("Order created: "+d.order.id+"\nStatus: pending review");$("#modal").classList.add("hidden");}catch(e){alert(e.message)}
}
function loginModal(title="Login",extra=""){
  modal(`<h2>${title}</h2>${extra?`<div class="notice">${esc(extra)}</div>`:""}<form class="form" id="loginForm"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" minlength="8" required><button class="primary">Login</button><div class="notice">Demo accounts are listed in README.txt. Change/delete demo credentials before production.</div></form>`);
  $("#loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});$("#modal").classList.add("hidden");await loadMe();location.reload()}catch(x){alert(x.message)}};
}
function signupModal(){
  modal(`<h2>Create Account</h2><form class="form" id="signupForm"><label>Name</label><input name="name" maxlength="60" required><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" minlength="8" required><div class="notice">Never use this marketplace to collect or transfer passwords, OTPs, recovery codes or stolen accounts.</div><button class="primary">Create Account</button></form>`);
  $("#signupForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/api/register",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});$("#modal").classList.add("hidden");location.reload()}catch(x){alert(x.message)}};
}
function sellModal(){
  if(!me)return loginModal("Login to sell","You need an account before creating a listing.");
  modal(`<h2>Create Listing</h2><form class="form" id="sellForm" enctype="multipart/form-data"><label>Title</label><input name="title" maxlength="100" required><label>Category</label><select name="category"><option>Gaming</option><option>Creator</option><option>Digital</option><option>Design</option><option>Web</option><option>Services</option></select><label>Price (BDT)</label><input name="price" type="number" min="1" required><label>Description</label><textarea name="description" maxlength="1500" required></textarea><label>Up to 3 screenshots (image only)</label><input name="images" type="file" accept="image/*" multiple><div class="notice">Listings may require admin review. Do not upload passwords, OTPs, recovery codes or other private credentials.</div><button class="primary">Submit Listing</button></form>`);
  $("#sellForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const r=await fetch("/api/listings",{method:"POST",body:fd});const d=await r.json();if(!r.ok)return alert(d.error);alert("Listing submitted. Status: "+d.listing.status);$("#modal").classList.add("hidden");loadListings()};
}
async function openAccount(){
  if(!me)return;
  let extra=`<div class="dash"><div class="dash-card"><span>${esc(me.name)}</span><span class="status">${esc(me.role)}</span></div><div class="dash-card"><span>${esc(me.email)}</span><span>${me.verified?"Verified":"Unverified"}</span></div>`;
  try{const d=await api("/api/orders");extra+=d.orders.map(o=>`<div class="dash-card"><div><b>${esc(o.listing)}</b><small>Order ${esc(o.id.slice(0,8))}</small></div><span class="status">${esc(o.status)}</span></div>`).join("")}catch{}
  if(["admin","agency"].includes(me.role))extra+=`<button class="primary" onclick="openDashboard()">Open ${me.role==="admin"?"Admin":"Agency"} Dashboard</button>`;
  extra+=`<button class="ghost" style="width:100%;margin-top:5px" onclick="logout()">Logout</button></div>`;
  modal(`<h2>My Account</h2>${extra}`);
}
async function logout(){await api("/api/logout",{method:"POST"});location.reload()}
async function openDashboard(){
  if(!me||!["admin","agency"].includes(me.role))return;
  try{
    const [s,l,o]=await Promise.all([api("/api/admin/summary"),api("/api/admin/listings"),api("/api/admin/orders")]);
    modal(`<h2>${me.role==="admin"?"Admin":"Agency"} Dashboard</h2><div class="dash">
    <div class="dash-card"><span>Users</span><b>${s.users}</b></div><div class="dash-card"><span>Listings</span><b>${s.listings}</b></div><div class="dash-card"><span>Pending</span><b>${s.pending}</b></div><div class="dash-card"><span>Orders</span><b>${s.orders}</b></div>
    <h3 style="margin:10px 0">Listings</h3>${l.listings.slice(0,12).map(x=>`<div class="dash-card"><div><b>${esc(x.title)}</b><small>${esc(x.seller?.name||"Seller")} · ${money(x.price)}</small></div><span class="status">${esc(x.status)}${me.role==="admin"&&x.status==="pending"?` <button style="margin-left:6px" onclick="approve('${x.id}')">Approve</button>`:""}</span></div>`).join("")}
    <h3 style="margin:10px 0">Orders</h3>${o.orders.slice(0,10).map(x=>`<div class="dash-card"><div><b>${esc(x.listing)}</b><small>${esc(x.buyer||"Buyer")} → ${esc(x.seller||"Seller")}</small></div><span class="status">${esc(x.status)}</span></div>`).join("")}</div>`);
  }catch(e){alert(e.message)}
}
async function approve(id){try{await api("/api/admin/listings/"+id+"/status",{method:"POST",body:JSON.stringify({status:"approved"})});openDashboard()}catch(e){alert(e.message)}}

$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentCategory=b.dataset.cat;loadListings()});
$("#searchBtn").onclick=loadListings;$("#search").addEventListener("keydown",e=>{if(e.key==="Enter")loadListings()});
$("#loginBtn").onclick=()=>loginModal();$("#signupBtn").onclick=signupModal;$("#sellBtn").onclick=sellModal;$("#footerLogin").onclick=e=>{e.preventDefault();loginModal()};$("#footerSignup").onclick=e=>{e.preventDefault();signupModal()};

(async()=>{await loadMe();await loadListings();try{await loadStats()}catch{}})();
