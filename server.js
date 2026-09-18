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

app.use('/api/', rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
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

var DEMO_USERS = [
  { phone: '+233241111111', role: 'admin',  name: 'Ama Administrator', address: 'Obuasi Central', email: 'admin@obuasigo.app' },
  { phone: '+233242222222', role: 'vendor', name: 'Obuasi Kitchen',    address: 'Market Road, Obuasi', email: 'vendor@obuasigo.app', business_name: 'Obuasi Kitchen Ltd', business_license: 'BL-VEND-2024-118', ghana_card: 'GHA-234567890-1' },
  { phone: '+233243333333', role: 'hotel',  name: 'Obuasi Royal Hotel', address: 'Hospital Road, Obuasi', email: 'hotel@obuasigo.app', business_name: 'Obuasi Royal Ltd', business_license: 'BL-HOT-2023-044', ghana_card: 'GHA-111222333-4' },
  { phone: '+233244444444', role: 'rider',  name: 'Kwame Mensah',      address: 'Ahinsan Estate, Obuasi', email: 'rider@obuasigo.app', ghana_card: 'GHA-555666777-8', driver_license: 'DL-GH-2019-5521', vehicle_reg: 'AS-4821-22', vehicle_license: 'VL-2025-0021' },
  { phone: '+233245555555', role: 'customer', name: 'Dennis Agambila', address: 'New Edubiase Rd, Obuasi', email: 'dennis@example.com' }
];

function initDb() {
  if (!pool) {
    console.warn('No DATABASE_URL - memory mode.');
    return Promise.resolve();
  }
  var sql =
    "create extension if not exists pgcrypto;" +
    "create table if not exists users (id uuid primary key default gen_random_uuid(), phone text unique not null, email text, full_name text, role text default 'customer', verified boolean default false, status text default 'active', address text, business_name text, business_license text, vehicle_reg text, vehicle_license text, ghana_card text, driver_license text, last_login timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists orders (id text primary key, customer_phone text not null, customer_name text, vendor text not null, items jsonb default '[]', subtotal numeric default 0, delivery_fee numeric default 8, total numeric default 0, currency text default 'GHS', status text default 'Order created', rider_phone text, pickup_code text, delivery_pin text, pickup_token text, pickup_scanned_at timestamptz, vendor_accepted_at timestamptz, rider_accepted_at timestamptz, rider_commission numeric default 15, delivery_address jsonb, note text, created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists bookings (id text primary key, customer_phone text not null, customer_name text, hotel text not null, room text not null, check_in date, check_out date, nights int default 1, guests int default 1, total numeric default 0, currency text default 'GHS', status text default 'BOOKED', checkin_code text not null, checked_in_at timestamptz, checked_in_by text, created_at timestamptz default now(), updated_at timestamptz default now());" +
    "create table if not exists rider_earnings (id bigserial primary key, rider_phone text not null, order_id text not null, amount numeric default 0, day date default current_date, created_at timestamptz default now());" +
    "create table if not exists audit_logs (id bigserial primary key, actor text, action text, entity_type text, entity_id text, meta jsonb, created_at timestamptz default now());" +
    "create index if not exists orders_customer_idx on orders(customer_phone, created_at desc);" +
    "create index if not exists orders_rider_idx on orders(rider_phone, updated_at desc);" +
    "create index if not exists bookings_hotel_idx on bookings(hotel, created_at desc);" +
    "create index if not exists earnings_rider_day_idx on rider_earnings(rider_phone, day);";

  var alter =
    "alter table users add column if not exists address text;" +
    "alter table users add column if not exists business_name text;" +
    "alter table users add column if not exists business_license text;" +
    "alter table users add column if not exists vehicle_reg text;" +
    "alter table users add column if not exists vehicle_license text;" +
    "alter table users add column if not exists ghana_card text;" +
    "alter table users add column if not exists driver_license text;" +
    "alter table users add column if not exists last_login timestamptz;";

  return pool.query(sql)
    .then(function(){ return pool.query(alter); })
    .then(function(){
      var ops = DEMO_USERS.map(function(u){
        return pool.query(
          "insert into users(phone, role, verified, full_name, email, address, business_name, business_license, ghana_card, driver_license, vehicle_reg, vehicle_license) " +
          "values($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
          "on conflict(phone) do update set role=$2, verified=true, " +
          "full_name=coalesce(users.full_name,$3), email=coalesce(users.email,$4), " +
          "address=coalesce(users.address,$5), business_name=coalesce(users.business_name,$6), " +
          "business_license=coalesce(users.business_license,$7), ghana_card=coalesce(users.ghana_card,$8), " +
          "driver_license=coalesce(users.driver_license,$9), vehicle_reg=coalesce(users.vehicle_reg,$10), " +
          "vehicle_license=coalesce(users.vehicle_license,$11)",
          [u.phone, u.role, u.name, u.email, u.address || null, u.business_name || null,
           u.business_license || null, u.ghana_card || null, u.driver_license || null,
           u.vehicle_reg || null, u.vehicle_license || null]
        );
      });
      return Promise.all(ops).then(function(){ console.log('Seeded ' + DEMO_USERS.length + ' demo users'); });
    })
    .catch(function(e){ console.warn('DB init warning:', e.message); });
}

var mem = { users: new Map(), orders: new Map(), bookings: new Map(), earnings: [], audit: [] };

function normalizePhone(p) { return String(p || '').replace(/[\s()\-]/g, ''); }
function validE164(p) { return /^\+[1-9]\d{7,14}$/.test(p); }

var twilioOk = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
var twilioClient = twilioOk ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

function sendOtp(phone) {
  if (twilioOk) return twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({ to: phone, channel: 'sms' }).then(function(v){ return { provider: 'twilio' }; });
  if (process.env.DEV_OTP === 'true') {
    global.devOtps = global.devOtps || new Map();
    var code = String(Math.floor(100000 + Math.random() * 900000));
    global.devOtps.set(phone, { code: code, expires: Date.now() + 300000 });
    console.log('[DEV OTP]', phone, code);
    return Promise.resolve({ provider: 'development', devOtp: code });
  }
  var err = new Error('OTP service not configured');
  err.statusCode = 503;
  return Promise.reject(err);
}

function verifyOtp(phone, code) {
  if (twilioOk) return twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({ to: phone, code: code }).then(function(r){ return { status: r.status }; });
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
    return q("insert into users(phone,role,verified,last_login) values($1,$2,true,now()) on conflict(phone) do update set verified=true, last_login=now(), role=case when $2='admin' then 'admin' else users.role end returning *", [phone, role])
      .then(function(r){ return r[0]; });
  }
  var u = mem.users.get(phone) || { phone: phone, role: role, verified: true };
  u.verified = true;
  mem.users.set(phone, u);
  return Promise.resolve(u);
}

function auth(req, res, next) {
  try {
    var tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    req.user = jwt.verify(tok, SIGNING_SECRET);
    next();
  } catch (e) { return res.status(401).json({ error: 'Authentication required' }); }
}
function roles() {
  var allowed = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (allowed.indexOf(req.user.role) !== -1) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
var adminOnly = roles('admin', 'superadmin');

function audit(a, act, t, id, meta) {
  if (pool) return q('insert into audit_logs(actor,action,entity_type,entity_id,meta) values($1,$2,$3,$4,$5)', [a, act, t, id, JSON.stringify(meta || {})]).catch(function(){});
  return Promise.resolve();
}

// =============== ROUTES ===============

app.get('/api/health', function(req, res){
  res.json({ ok: true, database: pool ? 'postgres' : 'memory', time: new Date().toISOString() });
});

// Force seed endpoint
app.post('/api/dev/seed-roles', function(req, res){
  if (!pool) return res.json({ ok: true, memory: true });
  var ops = DEMO_USERS.map(function(u){
    return q("insert into users(phone, role, verified, full_name, email, address, business_name, business_license, ghana_card, driver_license, vehicle_reg, vehicle_license) " +
      "values($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
      "on conflict(phone) do update set role=$2, verified=true, full_name=coalesce(users.full_name,$3), email=coalesce(users.email,$4), address=coalesce(users.address,$5), business_name=coalesce(users.business_name,$6), business_license=coalesce(users.business_license,$7), ghana_card=coalesce(users.ghana_card,$8), driver_license=coalesce(users.driver_license,$9), vehicle_reg=coalesce(users.vehicle_reg,$10), vehicle_license=coalesce(users.vehicle_license,$11)",
      [u.phone, u.role, u.name, u.email, u.address || null, u.business_name || null, u.business_license || null, u.ghana_card || null, u.driver_license || null, u.vehicle_reg || null, u.vehicle_license || null]);
  });
  Promise.all(ops).then(function(){ res.json({ ok: true, seeded: DEMO_USERS.length }); })
    .catch(function(e){ res.status(500).json({ error: e.message }); });
});

app.post('/api/auth/request-otp', authLimiter, function(req, res){
  var phone = normalizePhone(req.body.phone);
  if (!validE164(phone)) return res.status(400).json({ error: 'Use +233241234567' });
  sendOtp(phone).then(function(r){
    var out = { ok: true, provider: r.provider };
    if (r.devOtp) out.devOtp = r.devOtp;
    res.json(out);
  }).catch(function(e){ res.status(e.statusCode || 502).json({ error: 'Could not send OTP' }); });
});

app.post('/api/auth/verify-otp', authLimiter, function(req, res){
  var phone = normalizePhone(req.body.phone);
  var code = String(req.body.code || '').trim();
  if (!validE164(phone) || !/^[0-9]{4,10}$/.test(code)) return res.status(400).json({ error: 'Invalid phone or OTP' });
  verifyOtp(phone, code).then(function(c){
    if (c.status !== 'approved') return res.status(400).json({ error: 'Incorrect or expired OTP' });
    return upsertUser(phone).then(function(user){
      var token = jwt.sign({ phone: user.phone, role: user.role || 'customer', verified: true }, SIGNING_SECRET, { expiresIn: '7d' });
      res.json({ ok: true, token: token, user: user });
    });
  }).catch(function(){ res.status(502).json({ error: 'Could not verify' }); });
});

app.get('/api/me', auth, function(req, res){
  getUser(req.user.phone).then(function(u){ res.json({ user: u || req.user }); });
});

app.patch('/api/me', auth, function(req, res){
  var fields = req.body || {};
  var cols = ['full_name','email','address','business_name','business_license','vehicle_reg','vehicle_license','ghana_card','driver_license'];
  var sets = [];
  var params = [];
  var i = 1;
  cols.forEach(function(c){
    if (fields[c] !== undefined){ sets.push(c + '=$' + i); params.push(fields[c]); i++; }
  });
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.user.phone);
  var sql = 'update users set ' + sets.join(',') + ', updated_at=now() where phone=$' + i + ' returning *';
  if (pool) { q(sql, params).then(function(r){ res.json({ user: r[0] }); }); return; }
  res.json({ ok: true });
});

// =============== ADMIN ===============

app.get('/api/admin/users', auth, adminOnly, function(req, res){
  if (pool) {
    q('select * from users order by created_at desc').then(function(rows){
      var grouped = { customers: [], vendors: [], hotels: [], riders: [], admins: [] };
      rows.forEach(function(u){
        if (u.role === 'customer') grouped.customers.push(u);
        else if (u.role === 'vendor') grouped.vendors.push(u);
        else if (u.role === 'hotel') grouped.hotels.push(u);
        else if (u.role === 'rider') grouped.riders.push(u);
        else grouped.admins.push(u);
      });
      res.json({ all: rows, grouped: grouped });
    });
    return;
  }
  var users = [];
  mem.users.forEach(function(u){ users.push(u); });
  res.json({ all: users, grouped: { customers: users, vendors: [], hotels: [], riders: [], admins: [] } });
});

app.patch('/api/admin/users/:phone', auth, adminOnly, function(req, res){
  var fields = req.body || {};
  var cols = ['full_name','email','role','address','business_name','business_license','vehicle_reg','vehicle_license','ghana_card','driver_license'];
  var sets = [];
  var params = [];
  var i = 1;
  cols.forEach(function(c){
    if (fields[c] !== undefined){ sets.push(c + '=$' + i); params.push(fields[c]); i++; }
  });
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.phone);
  var sql = 'update users set ' + sets.join(',') + ', updated_at=now() where phone=$' + i + ' returning *';
  if (pool) { q(sql, params).then(function(r){ res.json({ user: r[0] }); }); return; }
  res.json({ ok: true });
});

app.get('/api/admin/user-stats/:phone', auth, adminOnly, function(req, res){
  var phone = req.params.phone;
  if (pool) {
    Promise.all([
      q('select count(*) n, coalesce(sum(total),0) s from orders where customer_phone=$1', [phone]),
      q('select count(*) n from orders where rider_phone=$1', [phone]),
      q('select coalesce(sum(amount),0) n from rider_earnings where rider_phone=$1', [phone]),
      q('select count(*) n from bookings where customer_phone=$1', [phone]),
      q('select count(*) n from orders where vendor=(select coalesce(business_name,full_name,phone) from users where phone=$1)', [phone])
    ]).then(function(r){
      res.json({
        customerOrders: Number(r[0][0].n), customerSpend: Number(r[0][0].s),
        riderDeliveries: Number(r[1][0].n), riderEarnings: Number(r[2][0].n),
        bookings: Number(r[3][0].n), vendorOrders: Number(r[4][0].n)
      });
    });
    return;
  }
  res.json({ customerOrders: 0, customerSpend: 0, riderDeliveries: 0, riderEarnings: 0, bookings: 0, vendorOrders: 0 });
});

app.get('/api/portal/overview', auth, adminOnly, function(req, res){
  if (pool) {
    Promise.all([
      q("select count(*) n from users where role='customer'"),
      q("select count(*) n from users where role='rider'"),
      q("select count(*) n from users where role='vendor'"),
      q("select count(*) n from users where role='hotel'"),
      q('select count(*) n from orders'),
      q('select count(*) n from bookings'),
      q("select count(*) n from bookings where status='CHECKED IN'"),
      q("select coalesce(sum(total),0) n from orders where status='Completed'"),
      q("select coalesce(sum(total),0) n from orders where status not in ('Order created','Cancelled by customer','Rejected by vendor')")
    ]).then(function(r){
      res.json({
        customers: Number(r[0][0].n), riders: Number(r[1][0].n),
        vendors: Number(r[2][0].n), hotels: Number(r[3][0].n),
        orders: Number(r[4][0].n), bookings: Number(r[5][0].n),
        checkedIn: Number(r[6][0].n), revenue: Number(r[7][0].n),
        confirmedRevenue: Number(r[8][0].n)
      });
    });
    return;
  }
  res.json({ customers: 0, riders: 0, vendors: 0, hotels: 0, orders: 0, bookings: 0, checkedIn: 0, revenue: 0, confirmedRevenue: 0 });
});

// =============== VENDOR ===============

app.get('/api/vendor/orders', auth, roles('vendor','admin','superadmin'), function(req, res){
  var vendorName = req.query.vendor || 'Obuasi Kitchen';
  if (pool) {
    q('select * from orders where vendor=$1 order by created_at desc limit 100', [vendorName]).then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(o){ if (o.vendor === vendorName) arr.push(o); });
  res.json(arr);
});

// =============== ORDERS ===============

var ORDER_FLOW = ['Order created','Payment confirmed','Restaurant accepted','Preparing','Food ready','Rider assigned','Rider accepted','Rider arrived','Food picked up','Going to customer','Arrived at customer','Customer PIN verified','Completed'];

function makeId(prefix, digits) {
  var n = digits || 5;
  var min = Math.pow(10, n - 1);
  return prefix + Math.floor(min + Math.random() * (Math.pow(10, n) - min));
}

app.post('/api/orders', auth, function(req, res){
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
    items: items, subtotal: subtotal, delivery_fee: deliveryFee, total: total,
    status: 'Order created',
    pickup_code: String(1000 + Math.floor(Math.random() * 9000)),
    delivery_pin: String(1000 + Math.floor(Math.random() * 9000)),
    delivery_address: req.body.deliveryAddress || { text: '' },
    note: String(req.body.note || '').slice(0, 300)
  };

  if (pool) {
    q("insert into orders(id,customer_phone,customer_name,vendor,items,subtotal,delivery_fee,total,status,pickup_code,delivery_pin,delivery_address,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [order.id, order.customer_phone, order.customer_name, order.vendor, JSON.stringify(items), subtotal, deliveryFee, total, order.status, order.pickup_code, order.delivery_pin, JSON.stringify(order.delivery_address), order.note])
      .then(function(){ res.status(201).json(order); })
      .catch(function(e){ res.status(500).json({ error: e.message }); });
    return;
  }
  mem.orders.set(order.id, order);
  res.status(201).json(order);
});

app.get('/api/orders', auth, function(req, res){
  if (pool) { q('select * from orders where customer_phone=$1 order by created_at desc', [req.user.phone]).then(function(rows){ res.json(rows); }); return; }
  var arr = [];
  mem.orders.forEach(function(v){ if (v.customer_phone === req.user.phone) arr.push(v); });
  res.json(arr);
});

app.post('/api/orders/:id/pay', auth, function(req, res){
  if (pool) {
    q("update orders set status='Payment confirmed', updated_at=now() where id=$1 and customer_phone=$2 returning *", [req.params.id, req.user.phone])
      .then(function(r){ if (!r[0]) return res.status(404).json({ error: 'Not found' }); res.json(r[0]); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Payment confirmed';
  res.json(o);
});

app.post('/api/orders/:id/cancel', auth, function(req, res){
  var getOrder = pool ? q('select * from orders where id=$1', [req.params.id]).then(function(r){ return r[0]; }) : Promise.resolve(mem.orders.get(req.params.id));
  getOrder.then(function(order){
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.customer_phone !== req.user.phone && ['admin','superadmin'].indexOf(req.user.role) === -1) return res.status(403).json({ error: 'Not allowed' });
    if (['Food picked up','Going to customer','Arrived at customer','Customer PIN verified','Completed'].indexOf(order.status) !== -1) return res.status(400).json({ error: 'Cannot cancel' });
    if (pool) { q("update orders set status='Cancelled by customer', updated_at=now() where id=$1 returning *", [order.id]).then(function(r){ res.json(r[0]); }); return; }
    order.status = 'Cancelled by customer';
    res.json(order);
  });
});

app.post('/api/orders/:id/vendor-accept', auth, roles('vendor','admin','superadmin'), function(req, res){
  var pickupToken = 'PCK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  if (pool) {
    q("update orders set status='Restaurant accepted', pickup_token=$1, vendor_accepted_at=now(), updated_at=now() where id=$2 returning *", [pickupToken, req.params.id])
      .then(function(r){ if (!r[0]) return res.status(404).json({ error: 'Not found' }); res.json(r[0]); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Restaurant accepted';
  o.pickup_token = pickupToken;
  res.json(o);
});

app.post('/api/orders/:id/vendor-reject', auth, roles('vendor','admin','superadmin'), function(req, res){
  var reason = String(req.body.reason || 'Rejected').slice(0, 200);
  if (pool) {
    q("update orders set status='Rejected by vendor', note=coalesce(note,'') || ' | Reason: ' || $1, updated_at=now() where id=$2 returning *", [reason, req.params.id])
      .then(function(r){ if (!r[0]) return res.status(404).json({ error: 'Not found' }); res.json(r[0]); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Rejected by vendor';
  res.json(o);
});

app.post('/api/orders/:id/food-ready', auth, roles('vendor','admin','superadmin'), function(req, res){
  if (pool) { q("update orders set status='Food ready', updated_at=now() where id=$1 returning *", [req.params.id]).then(function(r){ res.json(r[0] || { error: 'not found' }); }); return; }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Food ready';
  res.json(o);
});

app.get('/api/orders/:id/pickup-qr', auth, roles('vendor','admin','superadmin','rider'), function(req, res){
  var getOrder = pool ? q('select * from orders where id=$1', [req.params.id]).then(function(r){ return r[0]; }) : Promise.resolve(mem.orders.get(req.params.id));
  getOrder.then(function(order){
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (!order.pickup_token) return res.status(400).json({ error: 'Not approved yet' });
    var token = jwt.sign({ t: 'pickup', id: order.id, code: order.pickup_token }, SIGNING_SECRET);
    return QRCode.toDataURL(token, { width: 512, margin: 1 }).then(function(png){
      res.json({ png: png, code: order.pickup_token, orderId: order.id });
    });
  }).catch(function(e){ res.status(500).json({ error: e.message }); });
});

app.post('/api/orders/:id/rider-arrived', auth, roles('rider','admin','superadmin'), function(req, res){
  if (pool) { q("update orders set status='Rider arrived', rider_phone=$1, updated_at=now() where id=$2 returning *", [req.user.phone, req.params.id]).then(function(r){ res.json(r[0] || { error: 'not found' }); }); return; }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Rider arrived';
  o.rider_phone = req.user.phone;
  res.json(o);
});

app.post('/api/orders/:id/rider-picked-up', auth, roles('rider','admin','superadmin'), function(req, res){
  if (pool) { q("update orders set status='Food picked up', pickup_scanned_at=now(), updated_at=now() where id=$1 returning *", [req.params.id]).then(function(r){ res.json(r[0] || { error: 'not found' }); }); return; }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Food picked up';
  res.json(o);
});

app.post('/api/orders/:id/rider-arrived-customer', auth, roles('rider','admin','superadmin'), function(req, res){
  if (pool) { q("update orders set status='Arrived at customer', updated_at=now() where id=$1 returning *", [req.params.id]).then(function(r){ res.json(r[0] || { error: 'not found' }); }); return; }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Arrived at customer';
  res.json(o);
});

app.post('/api/orders/:id/verify-delivery', auth, roles('rider','admin','superadmin'), function(req, res){
  var pin = String(req.body.pin || '').trim();
  var getOrder = pool ? q('select * from orders where id=$1', [req.params.id]).then(function(r){ return r[0]; }) : Promise.resolve(mem.orders.get(req.params.id));
  getOrder.then(function(order){
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.delivery_pin && order.delivery_pin !== pin) return res.status(400).json({ error: 'Wrong PIN' });
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

app.post('/api/rider/pickup', auth, roles('rider','admin','superadmin'), function(req, res){
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
      if (!order) return res.status(404).json({ error: 'Not found' });
      return q("update orders set status='Food picked up', rider_phone=$1, pickup_scanned_at=now(), updated_at=now() where id=$2 returning *", [req.user.phone, order.id]).then(function(up){ res.json({ ok: true, order: up[0] }); });
    });
    return;
  }
  res.status(400).json({ error: 'no db' });
});

app.post('/api/rider/online', auth, roles('rider','admin','superadmin'), function(req, res){
  var code = String(1000 + Math.floor(Math.random() * 9000));
  global.riderCodes = global.riderCodes || new Map();
  global.riderCodes.set(req.user.phone, { code: code, expires: Date.now() + 300000 });
  console.log('[RIDER CODE]', req.user.phone, code);
  res.json({ ok: true, code: code, dev: true });
});

app.post('/api/rider/verify-online', auth, roles('rider','admin','superadmin'), function(req, res){
  var code = String(req.body.code || '').trim();
  var rec = global.riderCodes ? global.riderCodes.get(req.user.phone) : null;
  if (!rec || Date.now() > rec.expires) return res.status(400).json({ error: 'Code expired' });
  if (rec.code !== code) return res.status(400).json({ error: 'Wrong code' });
  global.riderCodes.delete(req.user.phone);
  res.json({ ok: true });
});

app.get('/api/rider/assigned', auth, roles('rider','admin','superadmin'), function(req, res){
  var phone = req.user.phone;
  if (pool) {
    q("select * from orders where (rider_phone=$1 or status in ('Food ready','Restaurant accepted','Rider accepted','Rider arrived')) and status not in ('Completed','Cancelled by customer','Rejected by vendor') order by created_at desc", [phone])
      .then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.orders.forEach(function(o){
    if (['Completed','Cancelled by customer','Rejected by vendor'].indexOf(o.status) !== -1) return;
    if (o.rider_phone === phone || ['Food ready','Restaurant accepted','Rider accepted','Rider arrived'].indexOf(o.status) !== -1) arr.push(o);
  });
  res.json(arr);
});

app.post('/api/rider/orders/:id/accept', auth, roles('rider','admin','superadmin'), function(req, res){
  var commission = Number(req.body.commission || 15);
  if (pool) {
    q("update orders set rider_phone=$1, rider_accepted_at=now(), rider_commission=$2, status=case when status in ('Food ready','Restaurant accepted') then 'Rider accepted' else status end, updated_at=now() where id=$3 returning *", [req.user.phone, commission, req.params.id])
      .then(function(r){ if (!r[0]) return res.status(404).json({ error: 'Not found' }); res.json(r[0]); });
    return;
  }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.rider_phone = req.user.phone;
  o.rider_commission = commission;
  if (['Food ready','Restaurant accepted'].indexOf(o.status) !== -1) o.status = 'Rider accepted';
  res.json(o);
});

app.post('/api/rider/orders/:id/reject', auth, roles('rider','admin','superadmin'), function(req, res){
  if (pool) { q("update orders set status='Restaurant accepted', rider_phone=null, updated_at=now() where id=$1 returning *", [req.params.id]).then(function(r){ res.json(r[0] || { error: 'not found' }); }); return; }
  var o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'Restaurant accepted';
  o.rider_phone = null;
  res.json(o);
});

app.get('/api/rider/summary', auth, roles('rider','admin','superadmin'), function(req, res){
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
  res.json({ assigned: 0, completed: 0, earnings: 0 });
});

app.get('/api/rider/earnings', auth, roles('rider','admin','superadmin'), function(req, res){
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
        res.json({ series: series, total: total, today: series[series.length-1].amount });
      });
    return;
  }
  res.json({ series: days.map(function(d){ return { day: d, amount: 0, deliveries: 0 }; }), total: 0, today: 0 });
});

// =============== BOOKINGS ===============

app.post('/api/bookings', auth, function(req, res){
  var checkinCode = 'OBG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  var nights = 1;
  if (req.body.checkIn && req.body.checkOut) {
    var diff = new Date(req.body.checkOut) - new Date(req.body.checkIn);
    if (diff > 0) nights = Math.max(1, Math.round(diff / 86400000));
  }
  var booking = {
    id: makeId('OBU-HL-'),
    customer_phone: req.user.phone,
    hotel: String(req.body.hotel || '').slice(0, 80),
    room: String(req.body.room || '').slice(0, 80),
    check_in: req.body.checkIn || null,
    check_out: req.body.checkOut || null,
    nights: nights,
    guests: Math.max(1, Number(req.body.guests || 1)),
    total: Number(req.body.total || 0),
    status: 'BOOKED',
    checkin_code: checkinCode
  };
  if (pool) {
    q("insert into bookings(id,customer_phone,hotel,room,check_in,check_out,nights,guests,total,status,checkin_code) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'BOOKED',$10)",
      [booking.id, booking.customer_phone, booking.hotel, booking.room, booking.check_in, booking.check_out, nights, booking.guests, booking.total, checkinCode])
      .then(function(){ res.status(201).json(booking); });
    return;
  }
  mem.bookings.set(booking.id, booking);
  res.status(201).json(booking);
});

app.get('/api/bookings', auth, function(req, res){
  if (pool) { q('select * from bookings where customer_phone=$1 order by created_at desc', [req.user.phone]).then(function(rows){ res.json(rows); }); return; }
  var arr = [];
  mem.bookings.forEach(function(v){ if (v.customer_phone === req.user.phone) arr.push(v); });
  res.json(arr);
});

app.get('/api/bookings/:id/qr', auth, function(req, res){
  var getBooking = pool ? q('select * from bookings where id=$1', [req.params.id]).then(function(r){ return r[0]; }) : Promise.resolve(mem.bookings.get(req.params.id));
  getBooking.then(function(b){
    if (!b) return res.status(404).json({ error: 'Not found' });
    var token = jwt.sign({ t: 'checkin', id: b.id, code: b.checkin_code }, SIGNING_SECRET);
    return QRCode.toDataURL(token, { width: 512, margin: 1 }).then(function(png){
      res.json({ png: png, code: b.checkin_code, bookingId: b.id });
    });
  }).catch(function(e){ res.status(500).json({ error: e.message }); });
});

app.post('/api/portal/checkin', auth, roles('hotel','admin','superadmin'), function(req, res){
  var raw = String(req.body.qr || '').trim();
  var code = String(req.body.code || '').trim().toUpperCase();
  var findBooking;
  if (raw) {
    var decoded;
    try { decoded = jwt.verify(raw, SIGNING_SECRET); }
    catch (e) { return res.status(400).json({ error: 'Invalid QR' }); }
    if (decoded.t !== 'checkin') return res.status(400).json({ error: 'Not a check-in code' });
    if (pool) findBooking = q('select * from bookings where id=$1 and checkin_code=$2', [decoded.id, decoded.code]).then(function(r){ return r[0]; });
    else findBooking = Promise.resolve(mem.bookings.get(decoded.id));
  } else if (code) {
    if (pool) findBooking = q('select * from bookings where checkin_code=$1', [code]).then(function(r){ return r[0]; });
    else findBooking = Promise.resolve(null);
  } else {
    return res.status(400).json({ error: 'Send qr or code' });
  }
  findBooking.then(function(b){
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    if (b.status === 'CHECKED IN') return res.json({ ok: true, alreadyCheckedIn: true, booking: b });
    if (pool) { q("update bookings set status='CHECKED IN', checked_in_at=now(), checked_in_by=$1, updated_at=now() where id=$2 returning *", [req.user.phone, b.id]).then(function(up){ res.json({ ok: true, booking: up[0] }); }); return; }
    res.json({ ok: true, booking: b });
  });
});

app.get('/api/portal/bookings', auth, roles('hotel','admin','superadmin'), function(req, res){
  var hotel = req.user.role === 'hotel' ? String(req.query.hotel || '').trim() : '';
  if (pool) {
    if (hotel) { q('select * from bookings where hotel=$1 order by created_at desc limit 200', [hotel]).then(function(rows){ res.json(rows); }); return; }
    q('select * from bookings order by created_at desc limit 200').then(function(rows){ res.json(rows); });
    return;
  }
  var arr = [];
  mem.bookings.forEach(function(b){ arr.push(b); });
  if (hotel) arr = arr.filter(function(b){ return b.hotel === hotel; });
  res.json(arr);
});

app.get('/api/portal/orders', auth, roles('vendor','admin','superadmin'), function(req, res){
  if (req.user.role === 'vendor') {
    var vendorName = String(req.query.vendor || '').trim();
    if (pool) { q('select * from orders where vendor=$1 order by created_at desc limit 100', [vendorName]).then(function(rows){ res.json(rows); }); return; }
    res.json([]);
    return;
  }
  if (pool) { q('select * from orders order by created_at desc limit 200').then(function(rows){ res.json(rows); }); return; }
  res.json([]);
});

// Static
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