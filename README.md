# ObuasiGo — Advanced Role-Based MVP

ObuasiGo is a multi-service marketplace for **food, local vendors, hotel bookings and delivery in Obuasi**.

## Interfaces included

- **Customer** — search, food ordering, floating cart, checkout, location, orders, hotel booking and QR check-in.
- **Rider** — separate rider dashboard, online/offline mode, delivery requests, earnings, customer feedback and rider registration.
- **Vendor** — vendor-only operations dashboard, own orders, menu/catalog management and business registration.
- **Hotel** — hotel-only booking dashboard, room management, hotel registration and QR check-in.
- **Admin** — protected admin dashboard for applications, documents, users, orders, bookings and verification.

## Search fix

The search bar now calls `GET /api/search` and searches the built-in catalogue plus approved vendor/hotel catalogues stored in PostgreSQL. It supports partial words and multi-word searches such as:

- `jollof`
- `jollof chicken`
- `pizza`
- `chicken`
- `drink`
- `hotel`
- `hotel room`
- a registered vendor/hotel name
- a registered menu item or room name

Search results can add food to the cart or start a hotel booking.

## Partner registration

After phone/OTP sign-in, a user can submit a partner application.

### Vendor

Collects legal name, Ghana Card number, business name, business phone, email, address, registration/licence number, description and supporting documents. An initial menu item can be added. Further menu items are added from the vendor dashboard.

### Rider

Collects legal name, Ghana Card number, rider/driver licence number, vehicle type, number plate, address and emergency contact. Supporting documents include Ghana Card, licence, vehicle registration/ownership proof and profile/selfie photo.

### Hotel

Collects legal name, Ghana Card number, hotel name, business phone, email, address, registration/licence number and description. Supporting documents include Ghana Card, business registration, hotel licence/operating document where applicable and proof of address where requested. Rooms can be added after approval.

### Admin

Admin access is **not self-granted**. A signed-in user may submit an admin access request with Ghana Card information and a reason. An existing authorized admin must approve it before the user's server-side role becomes `admin`.

## Security model

Role restrictions are enforced on the server. Hiding a button is not treated as security.

- Vendor accounts can only load their own vendor operations.
- Hotel accounts can only load their own hotel bookings.
- Rider/customer/vendor/hotel/admin APIs use server-side role checks.
- Payment and OTP secrets stay on the server.
- Identity documents are submitted to the protected document endpoint; configure Supabase Storage for persistent private storage.
- Admin approval is required for partner roles.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:10000
```

For a quick development test without Twilio, set:

```text
DEV_OTP=true
```

The server will show the development OTP in its terminal. Do not use development OTP mode in production.

## Production services

Configure PostgreSQL/Supabase, Twilio Verify, Flutterwave and Supabase Storage using `.env.example`.

Minimum production secrets:

```text
JWT_SECRET
DATABASE_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
FLW_SECRET_KEY
FLW_SECRET_HASH
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
ADMIN_PHONES
ALLOWED_ORIGINS
APP_URL
```

Never place these secrets in the frontend or commit them to GitHub.

## Important

This is an advanced application codebase/MVP. Before accepting real money or identity documents in production, connect and test the real PostgreSQL, Twilio, Flutterwave and private document-storage services and complete operational/legal verification for the businesses and documents you choose to require.


## Invite your friends
The customer app now includes a working referral/invite flow:
- Each customer receives a unique ObuasiGo invite code and shareable link.
- The link can be shared with the device share sheet, WhatsApp, SMS, or copied.
- A QR code is generated for the invite link.
- Opening an invite link stores the referral code before sign-in.
- The referral is linked when the invited customer completes OTP sign-in.
- The API tracks joined and qualified referrals. A referral becomes qualified after the invited customer completes a successfully paid order.
- Referral data is stored server-side in PostgreSQL when `DATABASE_URL` is configured, with an in-memory fallback for local testing.

Referral API endpoints: `/api/referrals/me` and `/api/referrals/claim`.
