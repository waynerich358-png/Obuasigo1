const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const twilio = require('twilio');
const { Pool } = require('pg');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const SIGNING_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!JWT_SECRET) console.warn('WARNING: JWT_SECRET not set. Using ephemeral secret.');

app.set('trust proxy', 1);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: function(origin, cb) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

const apiLimiter = rateLimit({ windowMs: 60*1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny', index: false }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6*1024*1024 } });

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    })
  : null;

async function q(text, params) {
  if (!pool) throw new Error('DATABASE_NOT_CONFIGURED');
  const result = await pool.query(text, params || []);
  return result.rows;
}

async function initDb() {
  if (!pool) {
    console.warn('No DATABASE_URL - running in memory mode.');
    return;
  }
  await pool.query(
    'create extension if not exists pgcrypto;' +
    'create table if not exists users(id uuid primary key default gen_random_uuid(),phone text unique not null,email text,full_name text,role text default \'customer\',verified boolean default false,status text default \'active\',created_at timestamptz default now(),updated_at timestamptz default now());' +
    'create table if not exists orders(id text primary key,customer_phone text not null,customer_name text,vendor text not null,items jsonb default \'[]\',subtotal numeric default 0,delivery_fee numeric default 8,total numeric default 0,currency text default \'GHS\',status text default \'Order created\',rider_phone text,pickup_code text default \'4821\',delivery_pin text default \'7392\',delivery_address jsonb,note text,created_at timestamptz default now(),updated_at timestamptz default now());' +
    'create table if not exists bookings(id text primary key,customer_phone text not null,customer_name text,hotel text not null,room text not null,check_in date,check_out date,nights int default 1,guests int default 1,total numeric default 0,currency text default \'GHS\',status text default \'BOOKED\',checkin_code text not null,checked_in_at timestamptz,checked_in_by text,created_at timestamptz default now(),updated_at timestamptz default now());' +
    'create table if not exists rider_earnings(id bigserial primary key,rider_phone text not null,order_id text not null,amount numeric default 0,day date default current_date,created_at timestamptz default now());' +
    'create table if not exists audit_logs(id bigserial primary key,actor text,action text,entity_type text,entity_id text,meta jsonb,created_at timestamptz default now());' +
    'create index if not exists orders_customer_idx on orders(customer_phone,created_at desc);' +
    'create index if not exists orders_rider_idx on orders(rider_phone,updated_at desc);' +
    'create index if not exists bookings_hotel_idx on bookings(hotel,created_at desc);' +
    'create index if not exists bookings_code_idx on bookings(checkin_code);' +
    'create index if not exists earnings_rider_day_idx on rider_earnings(rider_phone,day);'
  );
}

const mem = {
  users: new Map(),
  orders: new Map(),
  bookings: new Map(),
  earnings: [],
  audit: []
};

function normalizePhone(p) {
  return String(p || '').replace(/[\s()\-]/g, '');
}
function validE164(p) {
  return /^\+[1-9]\d{7,14}$/.test(p);
}

const twilioOk = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
const twilioClient = twilioOk ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

async function sendOtp(phone) {
  if (twilioOk) {
    const v = await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phone, channel: 'sms' });
    return { provider: 'twilio', status: v.status };
  }
  if (process.env.DEV_OTP === 'true') {
    global.devOtps = global.devOtps || new Map();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    global.devOtps.set(phone, { code: code, expires: Date.now() + 300000 });
    console.log('[DEV OTP]', phone, code);
    return { provider: 'development', status: 'pending', devOtp: code };
  }
  const err = new Error('OTP service not configured');
  err.statusCode = 503;
  throw err;
}

async function verifyOtp(phone, code) {
  if (twilioOk) {
    return twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code: code });
  }
  const r = global.devOtps ? global.devOtps.get(phone) : null;
  if (!r || Date.now() > r.expires) return { status: 'canceled' };
  global.devOtps.delete(phone);
  return { status: r.code === code ? 'approved' : 'pending' };
}

function configuredRole(phone) {
  const admins = (process.env.ADMIN_PHONES || '').split(',').map(normalizePhone).filter(Boolean);
  return admins.includes(phone) ? 'admin' : 'customer';
}

async function getUser(phone) {
  if (pool) {
    const r = await q('select * from users where phone=$1', [phone]);
    return r[0];
  }
  return mem.users.get(phone);
}

async function upsertUser(phone) {
  const role = configuredRole(phone);
  if (pool) {
    const r = await q(
      'insert into users(phone,role,verified) values($1,$2,true) ' +
      'on conflict(phone) do update set verified=true, ' +
      'role=case when $2=\'admin\' then \'admin\' else users.role end ' +
      'returning *',
      [phone, role]
    );
    return r[0];
  }
  let u = mem.users.get(phone) || { phone: phone, role: role, verified: true };
  u.verified = true;
  if (role === 'admin') u.role = 'admin';
  mem.users.set(phone, u);
  return u;
}

function auth(req, res, next) {
  try {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    req.user = jwt.verify(tok, SIGNING_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

function roles() {
  const allowed = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (allowed.indexOf(req.user.role) !== -1) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

const adminOnly = roles('admin', 'superadmin');

async function audit(actor, action, type, id, meta) {
  if (pool) {
    await q('insert into audit_logs(actor,action,entity_type,entity_id,meta) values($1,$2,$3,$4,$5)',
      [actor, action, type, id, JSON.stringify(meta || {})]).catch(function(){});
  } else {
    mem.audit.push({ actor: actor, action: action, type: type, id: id, meta: meta || {}, at: new Date().toISOString() });
  }
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

app.post('/api/auth/request-otp', authLimiter, async function(req, res) {
  const phone = normalizePhone(req.body.phone);
  if (!validE164(phone)) return res.status(400).json({ error: 'Use international format e.g. +233241234567' });
  try {
    const r = await sendOtp(phone);
    const out = { ok: true, provider: r.provider };
    if (r.devOtp) out.devOtp = r.devOtp;
    res.json(out);
  } catch (e) {
    res.status(e.statusCode || 502).json({ error: 'Could not send OTP' });
  }
});

app.post('/api/auth/verify-otp', authLimiter, async function(req, res) {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!validE164(phone) || !/^[0-9]{4,10}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid phone or OTP' });
  }
  try {
    const c = await verifyOtp(phone, code);
    if (c.status !== 'approved') return res.status(400).json({ error: 'Incorrect or expired OTP' });
    const user = await upsertUser(phone);
    const token = jwt.sign(
      { phone: user.phone, role: user.role || 'customer', verified: true },
      SIGNING_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ ok: true, token: token, user: user });
  } catch (e) {
    res.status(502).json({ error: 'Could not verify OTP' });
  }
});

app.get('/api/me', auth, async function(req, res) {
  const u = await getUser(req.user.phone);
  res.json({ user: u || req.user });
});

app.patch('/api/me', auth, async function(req, res) {
  const fullName = String(req.body.fullName || '').slice(0, 120);
  const email = String(req.body.email || '').slice(0, 200);
  if (pool) {
    const r = await q('update users set full_name=$1,email=$2,updated_at=now() where phone=$3 returning *',
      [fullName, email, req.user.phone]);
    return res.json({ user: r[0] });
  }
  const u = mem.users.get(req.user.phone) || { phone: req.user.phone, role: 'customer' };
  u.full_name = fullName;
  u.email = email;
  mem.users.set(u.phone, u);
  res.json({ user: u });
});

const CATALOG = {
  restaurants: [
    { id: 'r1', name: 'Obuasi Kitchen', emoji: '\uD83C\uDF57', tags: 'Jollof \u00B7 Chicken', eta: '25-35 min',
      items: [
        { id: 'i1', name: 'Jollof + Chicken', price: 38, emoji: '\uD83C\uDF57' },
        { id: 'i2', name: 'Fried Rice + Beef', price: 42, emoji: '\uD83C\uDF5B' },
        { id: 'i3', name: 'Chicken Wings (6pc)', price: 30, emoji: '\uD83C\uDF57' },
        { id: 'i4', name: 'Soft Drink', price: 8, emoji: '\uD83E\uDD64' }
      ]},
    { id: 'r2', name: 'Pizza Hub Obuasi', emoji: '\uD83C\uDF55', tags: 'Pizza \u00B7 Fast food', eta: '30-40 min',
      items: [
        { id: 'i5', name: 'Pepperoni Pizza', price: 65, emoji: '\uD83C\uDF55' },
        { id: 'i6', name: 'Margherita', price: 55, emoji: '\uD83C\uDF55' },
        { id: 'i7', name: 'Garlic Bread', price: 20, emoji: '\uD83E\uDD56' }
      ]},
    { id: 'r3', name: 'Ashanti Chop Bar', emoji: '\uD83E\uDD58', tags: 'Local food \u00B7 Home style', eta: '20-30 min',
      items: [
        { id: 'i8', name: 'Fufu + Light Soup', price: 34, emoji: '\uD83E\uDD58' },
        { id: 'i9', name: 'Banku + Tilapia', price: 48, emoji: '\uD83D\uDC1F' },
        { id: 'i10', name: 'Waakye Special', price: 32, emoji: '\uD83C\uDF5A' }
      ]}
  ],
  hotels: [
    { id: 'h1', name: 'Obuasi Royal Hotel', room: 'Executive Room', perks: 'Wi-Fi \u00B7 Breakfast', price: 450 },
    { id: 'h2', name: 'Golden View Lodge', room: 'Comfort Room', perks: 'Parking \u00B7 Pool', price: 320 }
  ]
};

app.get('/api/catalog', function(req, res) {
  res.json(CATALOG);
});

const ORDER_FLOW = [
  'Order created','Payment confirmed','Restaurant accepted','Preparing','Food ready',
  'Rider assigned','Rider accepted','Rider arrived','Food picked up','Going to customer',
  'Arrived at customer','Customer PIN verified','Completed'
];

function makeId(prefix, n) {
  const digits = n || 5;
  const min = Math.pow(10, digits - 1);
  const range = Math.pow(10, digits) - min;
  return prefix + Math.floor(min + Math.random() * range);
}

app.post('/api/orders', auth, async function(req, res) {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    subtotal += Number(items[i].price || 0) * Number(items[i].qty || 0);
  }
  const deliveryFee = Number(req.body.deliveryFee != null ? req.body.deliveryFee : 8);
  const total = Number(req.body.total != null ? req.body.total : (subtotal + deliveryFee));
  const order = {
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
    await q(
      'insert into orders(id,customer_phone,customer_name,vendor,items,subtotal,delivery_fee,total,status,pickup_code,delivery_pin,delivery_address,note) ' +
      'values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [order.id, order.customer_phone, order.customer_name, order.vendor, JSON.stringify(items),
       subtotal, deliveryFee, total, order.status, order.pickup_code, order.delivery_pin,
       JSON.stringify(order.delivery_address), order.note]
    );
  } else {
    mem.orders.set(order.id, order);
  }
  await audit(req.user.phone, 'order.created', 'order', order.id, { total: total });
  res.status(201).json(order);
});

app.get('/api/orders', auth, async function(req, res) {
  if (pool) {
    const rows = await q('select * from orders where customer_phone=$1 order by created_at desc', [req.user.phone]);
    return res.json(rows);
  }
  const arr = [];
  mem.orders.forEach(function(v) {
    if (v.customer_phone === req.user.phone) arr.push(v);
  });
  res.json(arr);
});

app.patch('/api/orders/:id/status', auth, async function(req, res) {
  const s = String(req.body.status || '').slice(0, 40);
  if (ORDER_FLOW.indexOf(s) === -1) return res.status(400).json({ error: 'Invalid status' });

  if (pool) {
    const existing = (await q('select * from orders where id=$1', [req.params.id]))[0];
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    const canCustomer = existing.customer_phone === req.user.phone;
    const canRider = existing.rider_phone === req.user.phone && req.user.role === 'rider';
    const canOps = ['vendor', 'admin', 'superadmin'].indexOf(req.user.role) !== -1;
    if (!canCustomer && !canRider && !canOps) {
      return res.status(403).json({ error: 'Not allowed to update this order' });
    }
    const r = await q(
      'update orders set status=$1, updated_at=now(), ' +
      'rider_phone=coalesce($2, rider_phone) where id=$3 returning *',
      [s, canRider ? req.user.phone : (req.body.riderPhone || null), req.params.id]
    );
    if (s === 'Completed' && r[0].rider_phone) {
      await q('insert into rider_earnings(rider_phone,order_id,amount) values($1,$2,$3)',
        [r[0].rider_phone, r[0].id, 15]);
    }
    await audit(req.user.phone, 'order.status', 'order', req.params.id, { status: s });
    return res.json(r[0]);
  }

  const o = mem.orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.customer_phone !== req.user.phone && ['vendor', 'rider', 'admin', 'superadmin'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  o.status = s;
  if (req.user.role === 'rider') o.rider_phone = req.user.phone;
  if (s === 'Completed' && o.rider_phone) {
    mem.earnings.push({
      rider_phone: o.rider_phone,
      order_id: o.id,
      amount: 15,
      day: new Date().toISOString().slice(0, 10)
    });
  }
  res.json(o);
});

app.post('/api/bookings', auth, async function(req, res) {
  const hotel = String(req.body.hotel || '').slice(0, 80);
  const room = String(req.body.room || '').slice(0, 80);
  const checkIn = req.body.checkIn || null;
  const checkOut = req.body.checkOut || null;
  const guests = Math.max(1, Number(req.body.guests || 1));
  const total = Number(req.body.total || 0);
  let nights = 1;
  if (checkIn && checkOut) {
    const diff = new Date(checkOut) - new Date(checkIn);
    if (diff > 0) nights = Math.max(1, Math.round(diff / 86400000));
  }
  const checkinCode = 'OBG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const booking = {
    id: makeId('OBU-HL-'),
    customer_phone: req.user.phone,
    customer_name: req.body.customerName || null,
    hotel: hotel,
    room: room,
    check_in: checkIn,
    check_out: checkOut,
    nights: nights,
    guests: guests,
    total: total,
    currency: 'GHS',
    status: 'BOOKED',
    checkin_code: checkinCode
  };
  if (pool) {
    await q(
      'insert into bookings(id,customer_phone,customer_name,hotel,room,check_in,check_out,nights,guests,total,status,checkin_code) ' +
      'values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [booking.id, booking.customer_phone, booking.customer_name, hotel, room,
       checkIn, checkOut, nights, guests, total, 'BOOKED', checkinCode]
    );
  } else {
    mem.bookings.set(booking.id, booking);
  }
  await audit(req.user.phone, 'booking.created', 'booking', booking.id);
  res.status(201).json(booking);
});

app.get('/api/bookings', auth, async function(req, res) {
  if (pool) {
    const rows = await q('select * from bookings where customer_phone=$1 order by created_at desc', [req.user.phone]);
    return res.json(rows);
  }
  const arr = [];
  mem.bookings.forEach(function(v) {
    if (v.customer_phone === req.user.phone) arr.push(v);
  });
  res.json(arr);
});

app.get('/api/bookings/:id/qr', auth, async function(req, res) {
  let booking;
  if (pool) {
    const r = await q('select * from bookings where id=$1', [req.params.id]);
    booking = r[0];
  } else {
    booking = mem.bookings.get(req.params.id);
  }
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customer_phone !== req.user.phone && ['hotel','admin','superadmin'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const payload = {
    t: 'checkin',
    id: booking.id,
    code: booking.checkin_code,
    hotel: booking.hotel,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  const token = jwt.sign(payload, SIGNING_SECRET);
  const png = await QRCode.toDataURL(token, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
  res.json({ png: png, code: booking.checkin_code, bookingId: booking.id });
});

app.post('/api/portal/checkin', auth, roles('hotel','admin','superadmin'), async function(req, res) {
  const raw = String(req.body.qr || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase();

  let booking = null;
  if (raw) {
    try {
      const decoded = jwt.verify(raw, SIGNING_SECRET);
      if (decoded.t !== 'checkin') return res.status(400).json({ error: 'Not a check-in code' });
      if (decoded.exp && decoded.exp < Date.now()) return res.status(400).json({ error: 'Code expired' });
      if (pool) {
        const r = await q('select * from bookings where id=$1 and checkin_code=$2', [decoded.id, decoded.code]);
        booking = r[0];
      } else {
        booking = mem.bookings.get(decoded.id);
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid QR' });
    }
  } else if (code) {
    if (pool) {
      const r = await q('select * from bookings where checkin_code=$1', [code]);
      booking = r[0];
    } else {
      const arr = [];
      mem.bookings.forEach(function(v) { arr.push(v); });
      booking = arr.filter(function(b) { return b.checkin_code === code; })[0];
    }
  } else {
    return res.status(400).json({ error: 'Send qr or code' });
  }

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'CHECKED IN') {
    return res.json({ ok: true, alreadyCheckedIn: true, booking: booking });
  }

  if (pool) {
    const r = await q(
      'update bookings set status=\'CHECKED IN\', checked_in_at=now(), checked_in_by=$1, updated_at=now() ' +
      'where id=$2 returning *',
      [req.user.phone, booking.id]
    );
    booking = r[0];
  } else {
    booking.status = 'CHECKED IN';
    booking.checked_in_at = new Date().toISOString();
    booking.checked_in_by = req.user.phone;
  }
  await audit(req.user.phone, 'booking.checkin', 'booking', booking.id);
  res.json({ ok: true, booking: booking });
});

app.get('/api/rider/earnings', auth, roles('rider','admin','superadmin'), async function(req, res) {
  const phone = req.user.role === 'rider' ? req.user.phone : (req.query.rider || req.user.phone);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  let rows = [];
  if (pool) {
    rows = await q(
      'select day::text as day, sum(amount)::float as amount, count(*)::int as deliveries ' +
      'from rider_earnings ' +
      'where rider_phone=$1 and day >= current_date - interval \'6 days\' ' +
      'group by day',
      [phone]
    );
  } else {
    const filtered = mem.earnings.filter(function(e) {
      return e.rider_phone === phone && days.indexOf(e.day) !== -1;
    });
    rows = [];
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      let row = null;
      for (let j = 0; j < rows.length; j++) if (rows[j].day === e.day) row = rows[j];
      if (!row) { row = { day: e.day, amount: 0, deliveries: 0 }; rows.push(row); }
      row.amount += Number(e.amount);
      row.deliveries += 1;
    }
  }

  const series = days.map(function(d) {
    const r = rows.filter(function(x) { return x.day === d; })[0];
    return { day: d, amount: r ? Number(r.amount) : 0, deliveries: r ? r.deliveries : 0 };
  });
  let total = 0;
  for (let i = 0; i < series.length; i++) total += series[i].amount;
  const today = series[series.length - 1].amount;
  res.json({ series: series, total: total, today: today, currency: 'GHS' });
});

app.get('/api/rider/requests', auth, roles('rider','admin','superadmin'), async function(req, res) {
  if (pool) {
    const rows = await q(
      'select * from orders ' +
      'where (status in (\'Food ready\',\'Rider assigned\',\'Restaurant accepted\',\'Preparing\') or rider_phone=$1) ' +
      'and status <> \'Completed\' ' +
      'order by created_at desc limit 20',
      [req.user.phone]
    );
    return res.json(rows);
  }
  const arr = [];
  mem.orders.forEach(function(o) { if (o.status !== 'Completed') arr.push(o); });
  res.json(arr);
});

app.get('/api/portal/overview', auth, adminOnly, async function(req, res) {
  if (pool) {
    const customers = await q('select count(*) n from users where role=\'customer\'');
    const riders = await q('select count(*) n from users where role=\'rider\'');
    const vendors = await q('select count(*) n from users where role=\'vendor\'');
    const hotels = await q('select count(*) n from users where role=\'hotel\'');
    const orders = await q('select count(*) n from orders');
    const bookings = await q('select count(*) n from bookings');
    const checkins = await q('select count(*) n from bookings where status=\'CHECKED IN\'');
    const revenue = await q('select coalesce(sum(total),0) n from orders where status=\'Completed\'');
    return res.json({
      customers: Number(customers[0].n),
      riders: Number(riders[0].n),
      vendors: Number(vendors[0].n),
      hotels: Number(hotels[0].n),
      orders: Number(orders[0].n),
      bookings: Number(bookings[0].n),
      checkedIn: Number(checkins[0].n),
      revenue: Number(revenue[0].n)
    });
  }
  let checkinCount = 0;
  mem.bookings.forEach(function(b) { if (b.status === 'CHECKED IN') checkinCount++; });
  let revenue = 0;
  mem.orders.forEach(function(o) { if (o.status === 'Completed') revenue += o.total; });
  res.json({
    customers: 1,
    riders: 1,
    vendors: 1,
    hotels: 2,
    orders: mem.orders.size,
    bookings: mem.bookings.size,
    checkedIn: checkinCount,
    revenue: revenue
  });
});

app.get('/api/portal/orders', auth, roles('vendor','admin','superadmin'), async function(req, res) {
  if (req.user.role === 'vendor') {
    const vendorName = String(req.query.vendor || '').trim();
    if (!vendorName) return res.status(400).json({ error: 'vendor query required for vendors' });
    if (pool) {
      const rows = await q('select * from orders where vendor=$1 order by created_at desc limit 100', [vendorName]);
      return res.json(rows);
    }
    const arr = [];
    mem.orders.forEach(function(o) { if (o.vendor === vendorName) arr.push(o); });
    return res.json(arr);
  }
  if (pool) {
    const rows = await q('select * from orders order by created_at desc limit 200');
    return res.json(rows);
  }
  const arr = [];
  mem.orders.forEach(function(o) { arr.push(o); });
  res.json(arr);
});

app.get('/api/portal/bookings', auth, roles('hotel','admin','superadmin'), async function(req, res) {
  const hotel = req.user.role === 'hotel' ? String(req.query.hotel || '').trim() : '';
  if (pool) {
    if (hotel) {
      const rows = await q('select * from bookings where hotel=$1 order by created_at desc limit 200', [hotel]);
      return res.json(rows);
    }
    const rows = await q('select * from bookings order by created_at desc limit 200');
    return res.json(rows);
  }
  const arr = [];
  mem.bookings.forEach(function(b) { arr.push(b); });
  if (hotel) return res.json(arr.filter(function(b) { return b.hotel === hotel; }));
  res.json(arr);
});

async function flw(pathname, body) {
  const r = await fetch('https://api.flutterwave.com/v3' + pathname, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.FLW_SECRET_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || 'Flutterwave error');
  return d;
}

app.post('/api/payments/checkout', auth, async function(req, res) {
  if (!process.env.FLW_SECRET_KEY) return res.status(503).json({ error: 'Flutterwave not configured' });
  const amount = Number(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Invalid amount' });
  const tx_ref = 'OBG-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const base = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
  try {
    const d = await flw('/payments', {
      tx_ref: tx_ref,
      amount: amount,
      currency: 'GHS',
      redirect_url: base + '/payment-return',
      customer: {
        email: req.body.email || (req.user.phone.replace('+', '') + '@obuasigo.app'),
        name: req.body.name || 'ObuasiGo Customer',
        phonenumber: req.user.phone
      },
      payment_options: 'card,ghanamobilemoney',
      customizations: { title: 'ObuasiGo', description: req.body.description || 'ObuasiGo order' },
      meta: { entity_type: req.body.entityType || 'order', entity_id: req.body.entityId || '' }
    });
    res.json({ ok: true, tx_ref: tx_ref, link: d.data ? d.data.link : null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/webhooks/flutterwave', express.raw({ type: 'application/json' }), async function(req, res) {
  const hash = req.headers['verif-hash'];
  if (!process.env.FLW_SECRET_HASH || hash !== process.env.FLW_SECRET_HASH) return res.status(401).end();
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).end();
  }
  const tx = body.data || body;
  if (tx.tx_ref) {
    await audit('flutterwave', 'webhook', 'payment', tx.tx_ref, { status: tx.status }).catch(function(){});
  }
  res.json({ ok: true });
});

const sockets = new Map();
let WebSocket;
try { WebSocket = require('ws'); } catch (e) {}

function broadcast(orderId, msg) {
  const set = sockets.get(orderId);
  if (!set) return;
  set.forEach(function(ws) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  });
}

app.post('/api/tracking/:orderId', auth, roles('rider','admin','superadmin'), async function(req, res) {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: 'Invalid coordinates' });
  const p = {
    orderId: req.params.orderId,
    lat: lat,
    lng: lng,
    accuracy: Number(req.body.accuracy || 0),
    at: new Date().toISOString()
  };
  broadcast(p.orderId, Object.assign({ type: 'location' }, p));
  res.json({ ok: true, p: p });
});

const vapidReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
if (vapidReady) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

app.get('/api/push/public-key', function(req, res) {
  res.json({ configured: vapidReady, publicKey: vapidReady ? process.env.VAPID_PUBLIC_KEY : null });
});

app.post('/api/push/subscribe', auth, async function(req, res) {
  if (!vapidReady) return res.status(503).json({ error: 'Push not configured' });
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  res.json({ ok: true });
});

app.post('/api/documents', auth, upload.single('document'), async function(req, res) {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.indexOf(req.file.mimetype) === -1) return res.status(400).json({ error: 'JPG, PNG or PDF only' });
  let url = null;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET) {
    const sb = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const p = 'documents/' + req.user.phone.replace(/\W/g, '_') + '/' + Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const up = await sb.storage.from(process.env.SUPABASE_STORAGE_BUCKET)
      .upload(p, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (up.error) return res.status(502).json({ error: 'Storage failed' });
    url = up.data.path;
  }
  res.status(201).json({ ok: true, url: url });
});

app.get('/payment-return', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'payment-return.html'));
});

app.get('/portal', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/portal.html', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/scan', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'scan.html'));
});

app.get('/scan.html', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'scan.html'));
});

app.get('/rider', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'rider.html'));
});

app.get('/rider.html', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'rider.html'));
});

app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const httpServer = require('http').createServer(app);

if (WebSocket) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });
  wss.on('connection', function(ws, req) {
    const u = new URL(req.url, 'http://localhost');
    const orderId = u.searchParams.get('orderId');
    const token = u.searchParams.get('token');
    try {
      jwt.verify(token || '', SIGNING_SECRET);
    } catch (e) {
      return ws.close(1008, 'Unauthorized');
    }
    if (!orderId) return ws.close(1008, 'Order required');
    if (!sockets.has(orderId)) sockets.set(orderId, new Set());
    sockets.get(orderId).add(ws);
    ws.on('close', function() {
      const set = sockets.get(orderId);
      if (set) set.delete(ws);
    });
    ws.send(JSON.stringify({ type: 'connected', orderId: orderId }));
  });
}

initDb()
  .then(function() {
    httpServer.listen(PORT, function() {
      console.log('ObuasiGo listening on ' + PORT);
    });
  })
  .catch(function(e) {
    console.error('DB init failed', e);
    process.exit(1);
  });