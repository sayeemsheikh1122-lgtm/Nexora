const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "public", "uploads");
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const DB_FILE = path.join(DATA, "db.json");
const initialDb = {
  users: [],
  listings: [],
  messages: [],
  orders: [],
  settings: { commissionPercent: 5, siteName: "NEXORA" }
};
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));

function db() { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
function save(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function id() { return crypto.randomUUID(); }

function seed() {
  const d = db();
  if (d.users.length) return;
  const adminId = id(), agencyId = id(), sellerId = id();
  d.users.push(
    { id: adminId, name: "NEXORA Admin", email: "admin@nexora.local", password: bcrypt.hashSync("Admin123!", 10), role: "admin", verified: true, createdAt: Date.now() },
    { id: agencyId, name: "NEXORA Agency", email: "agency@nexora.local", password: bcrypt.hashSync("Agency123!", 10), role: "agency", verified: true, createdAt: Date.now() },
    { id: sellerId, name: "Demo Seller", email: "seller@nexora.local", password: bcrypt.hashSync("Seller123!", 10), role: "seller", verified: true, createdAt: Date.now() }
  );
  d.listings.push(
    { id:id(), sellerId, title:"Premium Gaming Asset", category:"Gaming", price:1499, description:"Demo listing. No passwords, OTPs or private credentials are collected.", images:[], status:"approved", createdAt:Date.now() },
    { id:id(), sellerId, title:"Creator Brand Package", category:"Creator", price:4999, description:"Verified creator asset listing demo.", images:[], status:"approved", createdAt:Date.now() }
  );
  save(d);
}
seed();

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure: process.env.NODE_ENV === "production", maxAge: 1000*60*60*24*7 }
}));
app.use(express.static(path.join(ROOT,"public")));

const storage = multer.diskStorage({
  destination: (_,__,cb)=>cb(null, UPLOADS),
  filename: (_,file,cb)=>cb(null, Date.now()+"-"+crypto.randomBytes(6).toString("hex")+path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits:{fileSize:4*1024*1024, files:3},
  fileFilter: (_,file,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

function currentUser(req) {
  if (!req.session.userId) return null;
  return db().users.find(u=>u.id===req.session.userId) || null;
}
function requireAuth(req,res,next){ if(!currentUser(req)) return res.status(401).json({error:"Login required"}); next(); }
function requireRole(...roles){
  return (req,res,next)=>{
    const u=currentUser(req);
    if(!u) return res.status(401).json({error:"Login required"});
    if(!roles.includes(u.role)) return res.status(403).json({error:"Permission denied"});
    next();
  };
}
function sanitizeUser(u){ return u && ({id:u.id,name:u.name,email:u.email,role:u.role,verified:u.verified,createdAt:u.createdAt}); }

// Blocks off-platform contact details in marketplace chat.
// This is a safety feature, not a guarantee against fraud.
const blockedPatterns = [
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:wa\.me|t\.me|telegram|whatsapp|messenger|imo)\b/i,
  /(?:\+?880|0)1[3-9]\d{8}\b/,
  /\b\d{10,13}\b/,
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i
];
function safeMessage(text){
  return typeof text==="string" && text.length<=1000 && !blockedPatterns.some(r=>r.test(text));
}

app.get("/api/me",(req,res)=>res.json({user:sanitizeUser(currentUser(req))}));

app.post("/api/register",async(req,res)=>{
  const {name,email,password}=req.body;
  if(!name || !email || !password || password.length<8) return res.status(400).json({error:"Name, email and an 8+ character password are required."});
  const d=db(); const e=email.trim().toLowerCase();
  if(d.users.some(u=>u.email===e)) return res.status(409).json({error:"Email already registered."});
  const user={id:id(),name:name.trim().slice(0,60),email:e,password:await bcrypt.hash(password,10),role:"user",verified:false,createdAt:Date.now()};
  d.users.push(user); save(d); req.session.userId=user.id;
  res.json({user:sanitizeUser(user)});
});

app.post("/api/login",async(req,res)=>{
  const {email,password}=req.body; const d=db(); const u=d.users.find(x=>x.email===String(email||"").trim().toLowerCase());
  if(!u || !(await bcrypt.compare(String(password||""),u.password))) return res.status(401).json({error:"Invalid email or password."});
  req.session.userId=u.id; res.json({user:sanitizeUser(u)});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/listings",(req,res)=>{
  const d=db(); const q=String(req.query.q||"").toLowerCase(); const category=String(req.query.category||"");
  let list=d.listings.filter(x=>x.status==="approved");
  if(q) list=list.filter(x=>(x.title+" "+x.description+" "+x.category).toLowerCase().includes(q));
  if(category && category!=="All") list=list.filter(x=>x.category===category);
  list=list.map(x=>({...x,seller:d.users.find(u=>u.id===x.sellerId)?.name||"Seller"})).sort((a,b)=>b.createdAt-a.createdAt);
  res.json({listings:list});
});

app.post("/api/listings",requireAuth,upload.array("images",3),(req,res)=>{
  const u=currentUser(req); const {title,category,price,description}=req.body;
  if(!title || !category || !price || !description) return res.status(400).json({error:"All listing fields are required."});
  const images=(req.files||[]).map(f=>"/uploads/"+f.filename);
  const d=db();
  const listing={id:id(),sellerId:u.id,title:title.trim().slice(0,100),category,price:Number(price),description:description.trim().slice(0,1500),images,status:(u.role==="admin"?"approved":"pending"),createdAt:Date.now()};
  d.listings.push(listing); save(d);
  res.json({listing});
});

app.get("/api/my-listings",requireAuth,(req,res)=>{
  const u=currentUser(req); const d=db(); res.json({listings:d.listings.filter(x=>x.sellerId===u.id).sort((a,b)=>b.createdAt-a.createdAt)});
});

app.post("/api/orders",requireAuth,(req,res)=>{
  const {listingId}=req.body; const d=db(); const u=currentUser(req); const l=d.listings.find(x=>x.id===listingId && x.status==="approved");
  if(!l) return res.status(404).json({error:"Listing not found."});
  if(l.sellerId===u.id) return res.status(400).json({error:"You cannot buy your own listing."});
  const order={id:id(),listingId,buyerId:u.id,sellerId:l.sellerId,amount:l.price,status:"pending_review",createdAt:Date.now()};
  d.orders.push(order); save(d); res.json({order});
});

app.get("/api/orders",requireAuth,(req,res)=>{
  const u=currentUser(req); const d=db();
  const orders=d.orders.filter(o=>o.buyerId===u.id||o.sellerId===u.id).map(o=>({...o,listing:d.listings.find(l=>l.id===o.listingId)?.title||"Listing"}));
  res.json({orders});
});

app.get("/api/chat/:listingId",requireAuth,(req,res)=>{
  const u=currentUser(req); const d=db(); const l=d.listings.find(x=>x.id===req.params.listingId);
  if(!l) return res.status(404).json({error:"Listing not found."});
  if(u.role!=="admin" && u.role!=="agency" && l.sellerId!==u.id) {
    const hasOrder=d.orders.some(o=>o.listingId===l.id && o.buyerId===u.id);
    if(!hasOrder) return res.status(403).json({error:"Chat is available after starting a platform transaction."});
  }
  const msgs=d.messages.filter(m=>m.listingId===l.id).map(m=>({...m,user:sanitizeUser(d.users.find(x=>x.id===m.userId))}));
  res.json({messages:msgs});
});
app.post("/api/chat/:listingId",requireAuth,(req,res)=>{
  const u=currentUser(req); const d=db(); const l=d.listings.find(x=>x.id===req.params.listingId);
  if(!l) return res.status(404).json({error:"Listing not found."});
  const text=String(req.body.text||"").trim();
  if(!safeMessage(text)) return res.status(400).json({error:"For safety, links, phone numbers, emails and off-platform contact handles are not allowed in chat."});
  const allowed=u.role==="admin"||u.role==="agency"||l.sellerId===u.id||d.orders.some(o=>o.listingId===l.id&&o.buyerId===u.id);
  if(!allowed) return res.status(403).json({error:"Start a transaction first."});
  const m={id:id(),listingId:l.id,userId:u.id,text,createdAt:Date.now()}; d.messages.push(m); save(d); res.json({message:{...m,user:sanitizeUser(u)}});
});

app.get("/api/admin/summary",requireRole("admin","agency"),(req,res)=>{
  const d=db(); const pending=d.listings.filter(x=>x.status==="pending").length;
  res.json({users:d.users.length,listings:d.listings.length,pending,orders:d.orders.length,messages:d.messages.length,commissionPercent:d.settings.commissionPercent});
});
app.get("/api/admin/listings",requireRole("admin","agency"),(req,res)=>{
  const d=db(); res.json({listings:d.listings.map(l=>({...l,seller:sanitizeUser(d.users.find(u=>u.id===l.sellerId))})).sort((a,b)=>b.createdAt-a.createdAt)});
});
app.post("/api/admin/listings/:id/status",requireRole("admin"),(req,res)=>{
  const d=db(); const l=d.listings.find(x=>x.id===req.params.id);
  if(!l) return res.status(404).json({error:"Listing not found."});
  if(!["approved","rejected","pending","sold"].includes(req.body.status)) return res.status(400).json({error:"Invalid status."});
  l.status=req.body.status; save(d); res.json({listing:l});
});
app.get("/api/admin/orders",requireRole("admin","agency"),(req,res)=>{
  const d=db(); res.json({orders:d.orders.map(o=>({...o,listing:d.listings.find(l=>l.id===o.listingId)?.title||"Listing",buyer:d.users.find(u=>u.id===o.buyerId)?.name,seller:d.users.find(u=>u.id===o.sellerId)?.name})).sort((a,b)=>b.createdAt-a.createdAt)});
});
app.post("/api/admin/orders/:id/status",requireRole("admin"),(req,res)=>{
  const d=db(); const o=d.orders.find(x=>x.id===req.params.id);
  if(!o) return res.status(404).json({error:"Order not found."});
  if(!["pending_review","approved","completed","cancelled","disputed"].includes(req.body.status)) return res.status(400).json({error:"Invalid status."});
  o.status=req.body.status; save(d); res.json({order:o});
});

app.get("/api/admin/users",requireRole("admin"),(req,res)=>{
  const d=db(); res.json({users:d.users.map(sanitizeUser)});
});
app.post("/api/admin/users/:id/role",requireRole("admin"),(req,res)=>{
  const d=db(); const u=d.users.find(x=>x.id===req.params.id);
  if(!u) return res.status(404).json({error:"User not found."});
  if(!["user","seller","agency","admin"].includes(req.body.role)) return res.status(400).json({error:"Invalid role."});
  u.role=req.body.role; save(d); res.json({user:sanitizeUser(u)});
});

app.get("/health",(req,res)=>res.json({ok:true,service:"NEXORA",time:new Date().toISOString()}));
app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"public","index.html")));

app.listen(PORT,()=>console.log(`NEXORA running on http://localhost:${PORT}`));
