create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer','rider','vendor','hotel','admin','superadmin')),
  status text not null default 'active',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_applications (
  id uuid primary key default gen_random_uuid(),
  phone text not null references users(phone) on delete cascade,
  requested_role text not null check (requested_role in ('rider','vendor','hotel')),
  business_name text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists orders (
  id text primary key,
  customer_phone text not null references users(phone),
  vendor text not null,
  items jsonb not null default '[]',
  total numeric(12,2) not null default 0,
  currency text not null default 'GHS',
  status text not null default 'PAYMENT PENDING',
  rider_phone text references users(phone),
  pickup_code text not null default '4821',
  delivery_pin text not null default '7392',
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  customer_phone text not null references users(phone),
  hotel text not null,
  room text not null,
  total numeric(12,2) not null default 0,
  currency text not null default 'GHS',
  status text not null default 'BOOKED',
  check_in date,
  check_out date,
  guests integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  tx_ref text primary key,
  user_phone text references users(phone),
  entity_type text not null,
  entity_id text not null,
  amount numeric(12,2) not null,
  currency text not null default 'GHS',
  status text not null default 'pending',
  provider text not null default 'flutterwave',
  transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracking_points (
  id bigserial primary key,
  order_id text not null references orders(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now()
);


create table if not exists order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null references orders(id) on delete cascade,
  customer_phone text not null references users(phone),
  rider_phone text references users(phone),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references users(phone) on delete cascade,
  doc_type text not null,
  file_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references users(phone) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_idx on orders(customer_phone, created_at desc);
create index if not exists orders_rider_idx on orders(rider_phone, updated_at desc);
create index if not exists tracking_order_idx on tracking_points(order_id, created_at desc);
create index if not exists documents_status_idx on documents(status, created_at asc);

create index if not exists feedback_rider_idx on order_feedback(rider_phone, created_at desc);

-- ObuasiGo partner/business registration and searchable catalog
create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(), owner_phone text not null references users(phone) on delete cascade,
  kind text not null check (kind in ('vendor','hotel')), business_name text not null,
  business_phone text, email text, address text, description text, ghana_card_name text, ghana_card_number text,
  registration_number text, status text not null default 'pending' check (status in ('pending','approved','rejected')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists business_owner_kind_idx on business_profiles(owner_phone,kind);
create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references business_profiles(id) on delete cascade,
  name text not null, category text, price numeric(12,2) not null default 0, description text not null default '',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists catalog_search_idx on catalog_items(lower(name),lower(category));
create table if not exists rider_profiles (
  phone text primary key references users(phone) on delete cascade, full_name text, ghana_card_name text,
  ghana_card_number text, license_number text, vehicle_type text, plate_number text, address text, emergency_phone text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists admin_access_requests (
  id uuid primary key default gen_random_uuid(), phone text not null references users(phone) on delete cascade,
  full_name text, ghana_card_number text, reason text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
