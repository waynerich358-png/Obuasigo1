var express = require('express');
var cors = require('cors');
var jwt = require('jsonwebtoken');
var path = require('path');
var crypto = require('crypto');
var twilio = require('twilio');
var pg = require('pg');
var Pool = pg.Pool;
var multer = require('multer');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
var webpush = require('web-push');
var QRCode = require('qrcode');
require('dotenv').config();

var app = express();
var PORT = process.env.PORT || 3000;
var JWT_SECRET = process.env.JWT_SECRET;
var SIGNING_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!JWT_SECRET) console.warn('WARNING: JWT_SECRET not set.');

app.set('trust proxy', 1);
var allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: function(origin, cb){
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

var apiLimiter = rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
var authLimiter = rateLimit({ windowMs: 900000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny', index: false }));
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6*1024*1024 } });

var pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
}

function q(text, params) {
  if (!pool) return Promise.reject(new Error('DATABASE_NOT_CONFIGURED'));
  return pool.query(text, params || []).then(function(r){ return r.rows; });
}

function initDb() {
  if (!pool) {
    console.warn('No DATABASE_URL - running in memory mode.');
    return Promise.resolve();
  }
  var sql =
    "create extension if not exists pgcrypto;" +
    "create table if not exists users (id uuid primary key default gen_random_uuid(), phone text unique not null, email text, full_name text, role text default 'customer', verified boolean default false, status text default 'active', created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists orders (id text primary key, customer_phone text not null, customer_name text, vendor text not null, items jsonb default '[]', subtotal numeric default 0, delivery_fee numeric default 8, total numeric default 0, currency text default 'GHS', status text default 'Order created', rider_phone text, pickup_code text, delivery_pin text, pickup_token text, pickup_scanned_at timestamptz, vendor_accepted_at timestamptz, rider_accepted_at timestamptz, rider_commission numeric default 15, delivery_address jsonb, note text, created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists bookings (id text primary key, customer_phone text not null, customer_name text, hotel text not null, room text not null, check_in date, check_out date, nights int default 1, guests int default 1, total numeric default 0, currency text default 'GHS', status text default 'BOOKED', checkin_code text not null, checked_in_at timestamptz, checked_in_by text, created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists rider_earnings (id bigserial primary key, rider_phone text not null, order_id text not null, amount numeric default 0, day date default current_date, created_at timestamptz default now());" +
    "create table if not exists audit_logs (id bigserial primary key, actor text, action text, entity_type text, entity_id text, meta jsonb, created_at timestamptz default now());" +
    "create index if not exists orders_customer_idx on orders(customer_phone, created_at desc);" +
    "create index if not exists orders_rider_idx on orders(rider_phone, updated_at desc);" +
    "create index if not exists bookings_hotel_idx on bookings(hotel, created_at desc);" +
    "create index if not exists earnings_rider_day_idx on rider_earnings(rider_phone, day);";
  return pool.query(sql).catch(function(e){ console.warn('DB init warning:', e.message); });
}

var mem = { users: new Map(), orders: new Map(), bookings: new Map(), earnings: [], audit: [] };

function normalizePhone(p) { return String(p || '').replace(/[\s()\-]/g, ''); }
function validE164(p) { return /^\+[1-9]\d{7,14}$/.test(p); }

var twilioOk = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
var twilioClient = twilioOk ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

function sendOtp(phone) {
  if (twilioOk) {
    return twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phone, channel: 'sms' })
      .then(function(v){ return { provider: 'twilio', status: v.status }; });
  }
  if (process.env.DEV_OTP === 'true') {
    global.devOtps = global.devOtps || new Map();
    var code = String(Math.floor(100000 + Math.random() * 900000));
    global.devOtps.set(phone, { code: code, expires: Date.now() + 300000 });
    console.log('[DEV OTP]', phone, code);
    return Promise.resolve({ provider: 'development', status: 'pending', devOtp: code });
  }
  var err = new Error('OTP service not configured');
  err.statusCode = 503;
  return Promise.reject(err);
}

function verifyOtp(phone, code) {
  if (twilioOk) {
    return twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code: code })
      .then(function(r){ return { status: r.status }; });
  }
  var rec = global.devOtps ? global.devOtps.get(phone) : null;
  if (!rec || Date.now() > rec.expires) return Promise.resolve({ status: 'canceled' });
  global.devOtps.delete(phone);
  return Promise.resolve({ status: rec.code === code ? 'approved' : 'pending' });
}

function configuredRole(phone) {
  var admins = (process.env.ADMIN_PHONES || '').split(',').map(normalizePhone).filter(Boolean);
  return admins.indexOf(phone) !== -1 ? 'admin' : 'customer';
}

function getUser(phone) {
  if (pool) return q('select * from users where phone=$1', [phone]).then(function(r){ return r[0]; });
  return Promise.resolve(mem.users.get(phone));
}

function upsertUser(phone) {
  var role = configuredRole(phone);
  if (pool) {
    return q("insert into users(phone,role,verified) values($1,$2,true) on conflict(phone) do update set verified=true, role=case when $2='admin' then 'admin' else users.role end returning *", [phone, role])
      .then(function(r){ return r[0]; });
  }
  var u = mem.users.get(phone) || { phone: phone, role: role, verified: true };
  u.verified = true;
  if (role === 'admin') u.role = 'admin';
  mem.users.set(phone, u);
  return Promise.resolve(u);
}

function auth(req, res, next) {
  try {
    var tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    req.user = jwt.verify(tok, SIGNING_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

function roles() {
  var allowed = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (allowed.indexOf(req.user.role) !== -1) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

var adminOnly = roles('admin', 'superadmin');

function audit(actor, action, type, id, meta) {
  if (pool) return q('insert into audit_logs(actor,action,entity_type,entity_id,meta) values($1,$2,$3,$4,$5)', [actor, action, type, id, JSON.stringify(meta || {})]).catch(function(){});
  mem.audit.push({ actor: actor, action: action, type: type, id: id, meta: meta || {}, at: new Date().toISOString() });
  return Promise.resolve();
}

app.get('/api/health', function(req, res) {
  res.json({
    ok: true,
    service: 'ObuasiGo API',
    database: pool ? 'postgres' : 'memory',
    otp: twilioOk ? 'twilio-verify' : (process.env.DEV_OTP === 'true' ? 'development' : 'not-configured'),
    payments: process.env.FLW_SECRET_KEY ? 'flutterwave' : 'not-configured',
    push: process.env.VAPID_PUBLIC_KEY ? 'web-push' : 'not-configured',
    time: new Date().toISOString()
  });
});

app.post('/api/auth/request-otp', authLimiter, function(req, res) {
  var phone = normalizePhone(req.body.phone);
  if (!validE164(phone)) return res.status(400).json({ error: 'Use international format e.g. +233241234567' });
  sendOtp(phone).then(function(r){
    var out = { ok: true, provider: r.provider };
    if (r.devOtp) out.devOtp = r.devOtp;
    res.json(out);
  }).catch(function(e){ res.status(e.statusCode || 502).json({ error: 'Could not send OTP' }); });
});

app.post('/api/auth/verify-otp', authLimiter, function(req, res) {
  var phone = normalizePhone(req.body.phone);
  var code = String(req.body.code || '').trim();
  if (!validE164(phone) || !/^[0-9]{4,10}$/.test(code)) return res.status(400).json({ error: 'Invalid phone or OTP' });
  verifyOtp(phone, code).then(function(c){
    if (c.status !== 'approved') return res.status(400).json({ error: 'Incorrect or expired OTP' });
    return upsertUser(phone).then(function(user){
      var token = jwt.sign({ phone: user.phone, role: user.role || 'customer', verified: true }, SIGNING_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, token: token, user: user });
    });
  }).catch(function(){ res.status(502).json({ error: 'Could not verify OTP' }); });
});

app.get('/api/me', auth, function(req, res) {
  getUser(req.user.phone).then(function(u){ res.json({ user: u || req.user }); });
});

app.patch('/api/me', auth, function(req, res) {
  var fullName = String(req.body.fullName || '').slice(0, 120);
  var email = String(req.body.email || '').slice(0, 200);
  if (pool) {
    q('update users set full_name=$1,email=$2,updated_at=now() where phone=$3 returning *', [fullName, email, req.user.phone])
      .then(function(r){ res.json({ user: r[0] }); });
    return;
  }
  var u = mem.users.get(req.user.phone) || { phone: req.user.phone, role: 'customer' };
  u.full_name = fullName; u.email = email;
  mem.users.set(u.phone, u);
  res.json({ user: u });
});

var CATALOG = {
  restaurants: [
    { id: 'r1', name: 'Obuasi Kitchen', emoji: '🍗', tags: 'Jollof · Chicken', eta: '25-35 min',
      items: [
        { id: 'i1', name: 'Jollof + Chicken', price: 38, emoji: '🍗' },
        { id: 'i2', name: 'Fried Rice + Beef', price: 42, emoji: '🍛' },
        { id: 'i3', name: 'Chicken Wings (6pc)', price: 30, emoji: '🍗' },
        { id: 'i4', name: 'Soft Drink', price: 8, emoji: '🥤' }
      ]},
    { id: 'r2', name: 'Pizza Hub Obuasi', emoji: '🍕', tags: 'Pizza · Fast food', eta: '30-40 min',
      items: [
        { id: 'i5', name: 'Pepperoni Pizza', price: 65, emoji: '🍕' },
        { id: 'i6', name: 'Margherita', price: 55, emoji: '🍕' },
        { id: 'i7', name: 'Garlic Bread', price: 20, emoji: '🥖' }
      ]},
    { id: 'r3', name: 'Ashanti Chop Bar', emoji: '🥘', tags: 'Local food · Home style', eta: '20-30 min',
      items: [
        { id: 'i8', name: 'Fufu + Light Soup', price: 34, emoji: '🥘' },
        { id: 'i9', name: 'Banku + Tilapia', price: 48, emoji: '🐟' },
        { id: 'i10', name: 'Waakye Special', price: 32, emoji: '🍚' }
      ]}
  ],
  hotels: [
    { id: 'h1', name: 'Obuasi Royal Hotel', room: 'Executive Room', perks: 'Wi-Fi · Breakfast', price: 450 },
    { id: 'h2', name: 'Golden View Lodge', room: 'Comfort Room', perks: 'Parking · Pool', price: 320 }
  ]
};

app.get('/api/catalog', function(req, res){ res.json(CATALOG); });

var ORDER_FLOW = [
  'Order created','Payment confirmed','Restaurant accepted','Preparing','Food ready',
  'Rider assigned','Rider accepted','Rider arrived','Food picked up','Going to customer',
  'Arrived at customer','Customer PIN verified','Completed'
];

function makeId(prefix, digits) {
  var n = digits || 5;
  var min = Math.pow(10, n - 1);
  var range = Math.pow(10, n) - min;
  return prefix + Math.floor(min + Math.random() * range);
}

app.post('/api/orders', auth, function(req, res) {
  var items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  var subtotal = 0;
  for (var i = 0; i < items.length; i++) subtotal += Number(items[i].price || 0) * Number(items[i].qty || 0);
  var deliveryFee = Number(req.body.deliveryFee != null ? req.body.deliveryFee : 8);
  var total = Number(req.body.total != null ? req.body.total : (subtotal + deliveryFee));

  var order = {
    id: makeId('OBU-'),
    customer_phone: req.user.phone,
    customer_name: req.body.customerName || null,
    vendor: String(req.body.vendor || 'Obuasi Kitchen').slice(0, 80),
    items: items,
    subtotal: subtotal,
    delivery_fee: deliveryFee,
    total: total,
    currency: 'GHS',
    status: 'Order created',
    pickup_code: String(1000 + Math.floor(Math.random() * 9000)),
    delivery_pin: String(1000 + Math.floor(Math.random() * 9000)),
    delivery_address: req.body.deliveryAddress || { text: '' },
    note: String(req.body.note || '').slice(0, 300)
  };

  if (pool) {
    q("insert into orders(id,customer_phone,customer_name,vendor,items,subtotal,delivery_fee,total,status,pickup_code,delivery_pin,delivery_address,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [order.id, order.customer_phone, order.customer_name, order.vendor, JSON.stringify(items), subtotal, deliveryFee, total, order.status, order.pickup_code, order.delivery_pin, JSON.stringify(order.delivery_address), order.note])
      .then(function(){
        audit(req.user.phone, 'order.created', 'order', order.id, { total: total });
        res.status(201).json(order);
      }).catch(function(e){ res.status(500).json({ error: e.message }); });
    return;
  }
  mem.orders.set(order.id, order);
  res.status(201).json(order);
});

app.get('/api/orders', auth, function(req, res) {
  if (pool) {
    q('select * from orders where customer_phone=$1 order by created_at desc', [req.user.phone]).then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(v){ if (v.customer_phone === req.user.phone) arr.push(v); });
  res.json(arr);
});

app.post('/api/orders/:id/pay', auth, function(req, res) {
  if (pool) {
    q("update orders set status='Payment confirmed', updated_at=now() where id=$1 and customer_phone=$2 returning *", [req.params.id, req.user.phone])
      .then(function(r){
        if (!r[0]) return res.status(404).json({ error: 'Order not found' });
        res.json(r[0]);
      });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Payment confirmed';
  res.json(o);
});

// Vendor endpoints
app.get('/api/vendor/orders', auth, roles('vendor','admin','superadmin'), function(req, res) {
  var vendorName = req.query.vendor || 'Obuasi Kitchen';
  if (pool) {
    q("select * from orders where vendor=$1 order by created_at desc limit 50", [vendorName]).then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(o){ if (o.vendor === vendorName) arr.push(o); });
  res.json(arr);
});

app.post('/api/orders/:id/vendor-accept', auth, roles('vendor','admin','superadmin'), function(req, res) {
  var pickupToken = 'PCK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  if (pool) {
    q("update orders set status='Restaurant accepted', pickup_token=$1, vendor_accepted_at=now(), updated_at=now() where id=$2 returning *", [pickupToken, req.params.id])
      .then(function(r){
        if (!r[0]) return res.status(404).json({ error: 'Order not found' });
        res.json(r[0]);
      });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Restaurant accepted';
  o.pickup_token = pickupToken;
  o.vendor_accepted_at = new Date().toISOString();
  res.json(o);
});

app.post('/api/orders/:id/vendor-reject', auth, roles('vendor','admin','superadmin'), function(req, res) {
  var reason = String(req.body.reason || 'Rejected by vendor').slice(0, 200);
  if (pool) {
    q("update orders set status='Rejected by vendor', note=coalesce(note,'') || ' | Reason: ' || $1, updated_at=now() where id=$2 returning *", [reason, req.params.id])
      .then(function(r){
        if (!r[0]) return res.status(404).json({ error: 'Order not found' });
        res.json(r[0]);
      });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Rejected by vendor';
  o.note = (o.note || '') + ' | Reason: ' + reason;
  res.json(o);
});

app.post('/api/orders/:id/food-ready', auth, roles('vendor','admin','superadmin'), function(req, res) {
  if (pool) {
    q("update orders set status='Food ready', updated_at=now() where id=$1 returning *", [req.params.id])
      .then(function(r){ res.json(r[0] || { error: 'not found' }); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Food ready';
  res.json(o);
});

app.get('/api/orders/:id/pickup-qr', auth, roles('vendor','admin','superadmin','rider'), function(req, res) {
  var getOrder;
  if (pool) getOrder = q('select * from orders where id=$1', [req.params.id]).then(function(r){ return r[0]; });
  else getOrder = Promise.resolve(mem.orders.get(req.params.id));
  getOrder.then(function(order){
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.pickup_token) return res.status(400).json({ error: 'Not yet approved' });
    var token = jwt.sign({ t: 'pickup', id: order.id, code: order.pickup_token }, SIGNING_SECRET);
    return QRCode.toDataURL(token, { width: 512, margin: 1, errorCorrectionLevel: 'M' }).then(function(png){
      res.json({ png: png, code: order.pickup_token, orderId: order.id });
    });
  }).catch(function(e){ res.status(500).json({ error: e.message }); });
});

// Rider endpoints
app.post('/api/orders/:id/rider-arrived', auth, roles('rider','admin','superadmin'), function(req, res) {
  if (pool) {
    q("update orders set status='Rider arrived', rider_phone=$1, updated_at=now() where id=$2 returning *", [req.user.phone, req.params.id])
      .then(function(r){ res.json(r[0] || { error: 'not found' }); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Rider arrived';
  o.rider_phone = req.user.phone;
  res.json(o);
});

app.post('/api/orders/:id/rider-picked-up', auth, roles('rider','admin','superadmin'), function(req, res) {
  if (pool) {
    q("update orders set status='Food picked up', pickup_scanned_at=now(), updated_at=now() where id=$1 returning *", [req.params.id])
      .then(function(r){ res.json(r[0] || { error: 'not found' }); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Food picked up';
  res.json(o);
});

app.post('/api/orders/:id/rider-arrived-customer', auth, roles('rider','admin','superadmin'), function(req, res) {
  if (pool) {
    q("update orders set status='Arrived at customer', updated_at=now() where id=$1 returning *", [req.params.id])
      .then(function(r){ res.json(r[0] || { error: 'not found' }); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Arrived at customer';
  res.json(o);
});

app.post('/api/orders/:id/verify-delivery', auth, roles('rider','admin','superadmin'), function(req, res) {
  var pin = String(req.body.pin || '').trim();
  var getOrder;
  if (pool) getOrder = q('select * from orders where id=$1', [req.params.id]).then(function(r){ return r[0]; });
  else getOrder = Promise.resolve(mem.orders.get(req.params.id));
  getOrder.then(function(order){
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.delivery_pin && order.delivery_pin !== pin) return res.status(400).json({ error: 'Wrong delivery PIN' });
    var commission = Number(order.rider_commission || 15);
    var owner = order.rider_phone || req.user.phone;
    if (pool) {
      return q("update orders set status='Completed', updated_at=now() where id=$1", [order.id])
        .then(function(){ return q("insert into rider_earnings(rider_phone,order_id,amount,day) values($1,$2,$3,current_date)", [owner, order.id, commission]); })
        .then(function(){ res.json({ ok: true, commission: commission }); });
    }
    order.status = 'Completed';
    mem.earnings.push({ rider_phone: owner, order_id: order.id, amount: commission, day: new Date().toISOString().slice(0,10) });
    res.json({ ok: true, commission: commission });
  });
});

app.post('/api/rider/pickup', auth, roles('rider','admin','superadmin'), function(req, res) {
  var raw = String(req.body.qr || '').trim();
  var code = String(req.body.code || '').trim().toUpperCase();
  var decoded = null;
  if (raw) {
    try { decoded = jwt.verify(raw, SIGNING_SECRET); }
    catch (e) { return res.status(400).json({ error: 'Invalid QR' }); }
    if (decoded.t !== 'pickup') return res.status(400).json({ error: 'Not a pickup code' });
  }
  var orderId = decoded ? decoded.id : null;
  var tok = decoded ? decoded.code : code;
  if (pool) {
    var sql, params;
    if (orderId) { sql = 'select * from orders where id=$1 and pickup_token=$2'; params = [orderId, tok]; }
    else { sql = 'select * from orders where pickup_token=$1'; params = [tok]; }
    q(sql, params).then(function(r){
      var order = r[0];
      if (!order) return res.status(404).json({ error: 'Order not found or wrong code' });
      return q("update orders set status='Food picked up', rider_phone=$1, pickup_scanned_at=now(), updated_at=now() where id=$2 returning *", [req.user.phone, order.id])
        .then(function(up){ res.json({ ok: true, order: up[0] }); });
    });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(v){ arr.push(v); });
  var found;
  if (orderId) found = arr.filter(function(o){ return o.id === orderId && o.pickup_token === tok; })[0];
  else found = arr.filter(function(o){ return o.pickup_token === tok; })[0];
  if (!found) return res.status(404).json({ error: 'Order not found or wrong code' });
  found.status = 'Food picked up';
  found.rider_phone = req.user.phone;
  res.json({ ok: true, order: found });
});

app.post('/api/rider/online', auth, roles('rider','admin','superadmin'), function(req, res) {
  var code = String(1000 + Math.floor(Math.random() * 9000));
  global.riderCodes = global.riderCodes || new Map();
  global.riderCodes.set(req.user.phone, { code: code, expires: Date.now() + 300000 });
  console.log('[RIDER CODE]', req.user.phone, code);
  res.json({ ok: true, code: code, dev: true });
});

app.post('/api/rider/verify-online', auth, roles('rider','admin','superadmin'), function(req, res) {
  var code = String(req.body.code || '').trim();
  var rec = global.riderCodes ? global.riderCodes.get(req.user.phone) : null;
  if (!rec || Date.now() > rec.expires) return res.status(400).json({ error: 'Code expired' });
  if (rec.code !== code) return res.status(400).json({ error: 'Wrong code' });
  global.riderCodes.delete(req.user.phone);
  res.json({ ok: true });
});

app.get('/api/rider/assigned', auth, roles('rider','admin','superadmin'), function(req, res) {
  var phone = req.user.phone;
  if (pool) {
    q("select * from orders where (rider_phone=$1 or status in ('Food ready','Restaurant accepted','Rider accepted','Rider arrived')) and status <> 'Completed' order by created_at desc", [phone])
      .then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(o){
    if (o.status === 'Completed') return;
    if (o.rider_phone === phone || ['Food ready','Restaurant accepted','Rider accepted','Rider arrived'].indexOf(o.status) !== -1) arr.push(o);
  });
  res.json(arr);
});

app.post('/api/rider/orders/:id/accept', auth, roles('rider','admin','superadmin'), function(req, res) {
  var commission = Number(req.body.commission || 15);
  if (pool) {
    q("update orders set rider_phone=$1, rider_accepted_at=now(), rider_commission=$2, status=case when status in ('Food ready','Restaurant accepted') then 'Rider accepted' else status end, updated_at=now() where id=$3 returning *",
      [req.user.phone, commission, req.params.id]).then(function(r){
        if (!r[0]) return res.status(404).json({ error: 'Order not found' });
        res.json(r[0]);
      });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.rider_phone = req.user.phone;
  o.rider_commission = commission;
  if (['Food ready','Restaurant accepted'].indexOf(o.status) !== -1) o.status = 'Rider accepted';
  res.json(o);
});

app.post('/api/rider/orders/:id/reject', auth, roles('rider','admin','superadmin'), function(req, res) {
  if (pool) {
    q("update orders set status='Restaurant accepted', rider_phone=null, updated_at=now() where id=$1 returning *", [req.params.id])
      .then(function(r){
        if (!r[0]) return res.status(404).json({ error: 'Order not found' });
        res.json(r[0]);
      });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.status = 'Restaurant accepted';
  o.rider_phone = null;
  res.json(o);
});

app.get('/api/rider/summary', auth, roles('rider','admin','superadmin'), function(req, res) {
  var phone = req.user.phone;
  if (pool) {
    Promise.all([
      q("select count(*) n from orders where rider_phone=$1 and status <> 'Completed'", [phone]),
      q("select count(*) n from orders where rider_phone=$1 and status='Completed'", [phone]),
      q('select coalesce(sum(amount),0) n from rider_earnings where rider_phone=$1', [phone])
    ]).then(function(r){
      res.json({ assigned: Number(r[0][0].n), completed: Number(r[1][0].n), earnings: Number(r[2][0].n) });
    });
    return;
  }
  var assigned = 0, completed = 0, earnings = 0;
  mem.orders.forEach(function(o){ if (o.rider_phone === phone){ if (o.status === 'Completed') completed++; else assigned++; } });
  mem.earnings.forEach(function(x){ if (x.rider_phone === phone) earnings += x.amount; });
  res.json({ assigned: assigned, completed: completed, earnings: earnings });
});

app.get('/api/rider/earnings', auth, roles('rider','admin','superadmin'), function(req, res) {
  var phone = req.user.role === 'rider' ? req.user.phone : (req.query.rider || req.user.phone);
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  if (pool) {
    q("select day::text as day, sum(amount)::float as amount, count(*)::int as deliveries from rider_earnings where rider_phone=$1 and day >= current_date - interval '6 days' group by day", [phone])
      .then(function(rows){
        var series = days.map(function(day){
          var r = rows.filter(function(x){ return x.day === day; })[0];
          return { day: day, amount: r ? Number(r.amount) : 0, deliveries: r ? r.deliveries : 0 };
        });
        var total = series.reduce(function(n, s){ return n + s.amount; }, 0);
        res.json({ series: series, total: total, today: series[series.length-1].amount, currency: 'GHS' });
      });
    return;
  }
  var filtered = mem.earnings.filter(function(e){ return e.rider_phone === phone && days.indexOf(e.day) !== -1; });
  var rows = [];
  for (var j = 0; j < filtered.length; j++) {
    var e = filtered[j];
    var row = null;
    for (var k = 0; k < rows.length; k++) if (rows[k].day === e.day) row = rows[k];
    if (!row) { row = { day: e.day, amount: 0, deliveries: 0 }; rows.push(row); }
    row.amount += Number(e.amount);
    row.deliveries += 1;
  }
  var series = days.map(function(day){
    var r = rows.filter(function(x){ return x.day === day; })[0];
    return { day: day, amount: r ? r.amount : 0, deliveries: r ? r.deliveries : 0 };
  });
  var total = series.reduce(function(n, s){ return n + s.amount; }, 0);
  res.json({ series: series, total: total, today: series[series.length-1].amount, currency: 'GHS' });
});

// Bookings
app.post('/api/bookings', auth, function(req, res) {
  var hotel = String(req.body.hotel || '').slice(0, 80);
  var room = String(req.body.room || '').slice(0, 80);
  var checkIn = req.body.checkIn || null;
  var checkOut = req.body.checkOut || null;
  var guests = Math.max(1, Number(req.body.guests || 1));
  var total = Number(req.body.total || 0);
  var nights = 1;
  if (checkIn && checkOut) {
    var diff = new Date(checkOut) - new Date(checkIn);
    if (diff > 0) nights = Math.max(1, Math.round(diff / 86400000));
  }
  var checkinCode = 'OBG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  var booking = {
    id: makeId('OBU-HL-'),
    customer_phone: req.user.phone,
    customer_name: req.body.customerName || null,
    hotel: hotel, room: room, check_in: checkIn, check_out: checkOut,
    nights: nights, guests: guests, total: total, currency: 'GHS',
    status: 'BOOKED', checkin_code: checkinCode
  };
  if (pool) {
    q("insert into bookings(id,customer_phone,customer_name,hotel,room,check_in,check_out,nights,guests,total,status,checkin_code) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'BOOKED',$11)",
      [booking.id, booking.customer_phone, booking.customer_name, hotel, room, checkIn, checkOut, nights, guests, total, checkinCode])
      .then(function(){ res.status(201).json(booking); });
    return;
  }
  mem.bookings.set(booking.id, booking);
  res.status(201).json(booking);
});

app.get('/api/bookings', auth, function(req, res) {
  if (pool) {
    q('select * from bookings where customer_phone=$1 order by created_at desc', [req.user.phone]).then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.bookings.forEach(function(v){ if (v.customer_phone === req.user.phone) arr.push(v); });
  res.json(arr);
});

app.get('/api/bookings/:id/qr', auth, function(req, res) {
  var getBooking;
  if (pool) getBooking = q('select * from bookings where id=$1', [req.params.id]).then(function(r){ return r[0]; });
  else getBooking = Promise.resolve(mem.bookings.get(req.params.id));
  getBooking.then(function(b){
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    if (b.customer_phone !== req.user.phone && ['hotel','admin','superadmin'].indexOf(req.user.role) === -1) return res.status(403).json({ error: 'Not allowed' });
    var token = jwt.sign({ t: 'checkin', id: b.id, code: b.checkin_code, hotel: b.hotel, exp: Date.now() + 1000*60*60*24*30 }, SIGNING_SECRET);
    return QRCode.toDataURL(token, { width: 512, margin: 1, errorCorrectionLevel: 'M' }).then(function(png){
      res.json({ png: png, code: b.checkin_code, bookingId: b.id });
    });
  }).catch(function(e){ res.status(500).json({ error: e.message }); });
});

app.post('/api/portal/checkin', auth, roles('hotel','admin','superadmin'), function(req, res) {
  var raw = String(req.body.qr || '').trim();
  var code = String(req.body.code || '').trim().toUpperCase();
  var findBooking;
  if (raw) {
    var decoded;
    try { decoded = jwt.verify(raw, SIGNING_SECRET); }
    catch (e) { return res.status(400).json({ error: 'Invalid QR' }); }
    if (decoded.t !== 'checkin') return res.status(400).json({ error: 'Not a check-in code' });
    if (decoded.exp && decoded.exp < Date.now()) return res.status(400).json({ error: 'Code expired' });
    if (pool) findBooking = q('select * from bookings where id=$1 and checkin_code=$2', [decoded.id, decoded.code]).then(function(r){ return r[0]; });
    else findBooking = Promise.resolve(mem.bookings.get(decoded.id));
  } else if (code) {
    if (pool) findBooking = q('select * from bookings where checkin_code=$1', [code]).then(function(r){ return r[0]; });
    else {
      var arr = [];
      mem.bookings.forEach(function(v){ arr.push(v); });
      findBooking = Promise.resolve(arr.filter(function(b){ return b.checkin_code === code; })[0]);
    }
  } else {
    return res.status(400).json({ error: 'Send qr or code' });
  }
  findBooking.then(function(b){
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    if (b.status === 'CHECKED IN') return res.json({ ok: true, alreadyCheckedIn: true, booking: b });
    if (pool) {
      q("update bookings set status='CHECKED IN', checked_in_at=now(), checked_in_by=$1, updated_at=now() where id=$2 returning *", [req.user.phone, b.id])
        .then(function(up){ res.json({ ok: true, booking: up[0] }); });
      return;
    }
    b.status = 'CHECKED IN';
    res.json({ ok: true, booking: b });
  });
});

// Portal
app.get('/api/portal/overview', auth, adminOnly, function(req, res) {
  if (pool) {
    Promise.all([
      q("select count(*) n from users where role='customer'"),
      q("select count(*) n from users where role='rider'"),
      q("select count(*) n from users where role='vendor'"),
      q("select count(*) n from users where role='hotel'"),
      q('select count(*) n from orders'),
      q('select count(*) n from bookings'),
      q("select count(*) n from bookings where status='CHECKED IN'"),
      q("select coalesce(sum(total),0) n from orders where status='Completed'")
    ]).then(function(r){
      res.json({
        customers: Number(r[0][0].n), riders: Number(r[1][0].n),
        vendors: Number(r[2][0].n), hotels: Number(r[3][0].n),
        orders: Number(r[4][0].n), bookings: Number(r[5][0].n),
        checkedIn: Number(r[6][0].n), revenue: Number(r[7][0].n)
      });
    });
    return;
  }
  var checkedIn = 0;
  mem.bookings.forEach(function(b){ if (b.status === 'CHECKED IN') checkedIn++; });
  var revenue = 0;
  mem.orders.forEach(function(o){ if (o.status === 'Completed') revenue += o.total; });
  res.json({ customers: 1, riders: 1, vendors: 1, hotels: 2, orders: mem.orders.size, bookings: mem.bookings.size, checkedIn: checkedIn, revenue: revenue });
});

app.get('/api/portal/bookings', auth, roles('hotel','admin','superadmin'), function(req, res) {
  var hotel = req.user.role === 'hotel' ? String(req.query.hotel || '').trim() : '';
  if (pool) {
    if (hotel) {
      q('select * from bookings where hotel=$1 order by created_at desc limit 200', [hotel]).then(function(rows){ res.json(rows); });
      return;
    }
    q('select * from bookings order by created_at desc limit 200').then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.bookings.forEach(function(b){ arr.push(b); });
  if (hotel) arr = arr.filter(function(b){ return b.hotel === hotel; });
  res.json(arr);
});

app.get('/api/portal/orders', auth, roles('vendor','admin','superadmin'), function(req, res) {
  if (req.user.role === 'vendor') {
    var vendorName = String(req.query.vendor || '').trim();
    if (!vendorName) return res.status(400).json({ error: 'vendor query required' });
    if (pool) {
      q('select * from orders where vendor=$1 order by created_at desc limit 100', [vendorName]).then(function(rows){ res.json(rows); });
      return;
    }
    var arr = [];
    mem.orders.forEach(function(o){ if (o.vendor === vendorName) arr.push(o); });
    res.json(arr);
    return;
  }
  if (pool) {
    q('select * from orders order by created_at desc limit 200').then(function(rows){ res.json(rows); });
    return;
  }
  var all = [];
  mem.orders.forEach(function(o){ all.push(o); });
  res.json(all);
});

// Static routes
app.get('/payment-return', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'payment-return.html')); });
app.get('/portal', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'portal.html')); });
app.get('/portal.html', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'portal.html')); });
app.get('/scan', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'scan.html')); });
app.get('/scan.html', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'scan.html')); });
app.get('/rider', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'rider.html')); });
app.get('/rider.html', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'rider.html')); });
app.get('*', function(req, res){ res.sendFile(path.join(__dirname, 'public', 'index.html')); });

var httpServer = require('http').createServer(app);

initDb().then(function(){
  httpServer.listen(PORT, function(){ console.log('ObuasiGo listening on ' + PORT); });
}).catch(function(e){
  console.error('DB init failed', e);
  process.exit(1);
});