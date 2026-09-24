# ObuasiGo — Professional Role-Based App

ObuasiGo is a connected multi-service marketplace for food, vendors, hotels, delivery and customer bookings.

## Separate websites / portals

The same server powers separate role websites:

- Customer: `/`
- Rider: `/rider`
- Vendor: `/vendor`
- Hotel: `/hotel`
- Owner/Admin: `/admin`
- Admin access request: `/admin-request.html`

Each portal uses server-side authentication and permissions. A vendor cannot use the hotel portal's protected APIs, a hotel cannot see another hotel's bookings, and a rider cannot access customer/vendor/admin operations.

## Jessica owner administration

Jessica is the configured owner name. The actual owner/admin phone is configured in `ADMIN_PHONES` in `.env`.

For local Termux testing, run:

```bash
./setup-termux.sh
```

It asks for Jessica's phone, creates a strong local JWT secret, enables development OTP, and installs dependencies.

Then:

```bash
npm start
```

Open:

```text
http://localhost:10000
```

Owner admin:

```text
http://localhost:10000/admin
```

Vendor portal:

```text
http://localhost:10000/vendor
```

Hotel portal:

```text
http://localhost:10000/hotel
```

Rider portal:

```text
http://localhost:10000/rider
```

## Termux manual setup

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts unzip -y
termux-setup-storage
cd ~/storage/downloads
unzip ObuasiGo_Professional_Real_App_Jessica_Termux.zip
cd ObuasiGo_Professional_Real_App_Jessica_Termux
./setup-termux.sh
npm start
```

The current package supports Node 20+ and works with current Termux Node LTS releases. If `setup-termux.sh` is used, do not paste any secret keys into chat.

## Connected business workflow

```text
CUSTOMER APP
    |
    +---- Food / Shopping ----> VENDOR WEBSITE ----+
    |                                                |
    +---- Hotel booking -------> HOTEL WEBSITE -----+----> JESSICA OWNER ADMIN
    |                                                |
    +---- Delivery ------------> RIDER WEBSITE -----+
    |
    +---- Invite Friend / Search / Checkout
```

### Vendor

A vendor can register from `/vendor` using phone OTP, legal name, Ghana Card information, business information and supporting documents. Jessica reviews the application. After approval the vendor gets its own protected dashboard, manages its own menu and sees only its own operational orders.

### Hotel

A hotel can register from `/hotel` using phone OTP, legal name, Ghana Card information, hotel/business information and supporting documents. After approval the hotel receives its own protected dashboard, manages rooms, views its own bookings and verifies guest check-in QR tokens.

### Rider

A rider can register from `/rider` using phone OTP, Ghana Card, rider/driver licence, vehicle type, number plate, address and supporting documents. After approval the rider gets the separate rider dashboard, delivery workflow, earnings and customer feedback.

### Owner/Admin

Jessica's `/admin` dashboard is the central control point for partner applications, partner status, documents, orders, hotel bookings, rider feedback, statistics and admin access requests.

Other staff can submit `/admin-request.html`; an existing authorized admin must approve the request before the account becomes an admin.

## Search

Customer search uses `/api/search` and searches the built-in catalogue plus approved vendor/hotel catalogues. Partial and multi-word searches are supported, including `jollof`, `jollof chicken`, `pizza`, `drink`, `hotel`, room names and registered business names.

## Invite a friend

Customers have a unique invite code, share link, QR code and share actions. The referral is linked at OTP sign-in and becomes qualified after the invited customer completes a successful paid order.

## Documents

The app accepts JPG, PNG and PDF identity/business documents through the protected `/api/documents` endpoint. For persistent private document storage, configure Supabase Storage. Do not put Supabase service-role keys in frontend code.

## Production services

For real launch, configure:

- PostgreSQL / Supabase
- Twilio Verify for OTP
- Flutterwave for payments
- Supabase private storage for documents
- Web Push/VAPID if push notifications are required

Production environment variables are listed in `.env.example`.

Never commit `.env` or server secrets to GitHub.

## Important production note

This is a real connected application codebase/MVP, but production use still requires testing the actual payment provider, OTP service, database, private document storage, identity/business verification procedures and operational policies before accepting real money or identity documents.

## Publication hardening added from the launch checklist

This release adds privacy, terms, refund and cookie pages; optional analytics consent; production HTTPS redirect; custom 404; robots.txt; dynamic sitemap; security.txt template; social preview image; compressed WebP UI assets; favicon/PWA icon; accessible focus states; reduced-motion support; a clear customer CTA; basic honeypot spam protection; and a static launch audit.

Run:

```bash
npm run launch:audit
```

See `LAUNCH_CHECKLIST.md` and `PUBLISHING.md` before accepting real customers, payments or identity documents.
