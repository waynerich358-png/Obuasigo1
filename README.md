# ObuasiGo — Launch-Ready MVP

ObuasiGo is a full-stack web/PWA MVP for food delivery, riders, vendors, hotels and administration. The public interface is mobile-first and the rider experience is intentionally separate from the customer experience.

## What is included
- Customer food ordering and hotel booking UI
- Dedicated rider control interface with online/offline state, delivery requests, earnings, safety and help
- Vendor order workflow
- Hotel booking/check-in workflow
- Protected admin portal at `/admin.html`
- Phone OTP via Twilio Verify
- JWT sessions
- PostgreSQL persistence (Supabase or another PostgreSQL provider)
- Flutterwave checkout and webhook endpoint
- Browser GPS + WebSocket delivery tracking
- Web Push subscription endpoints
- Secure document upload endpoint with Supabase Storage support
- Rate limiting, Helmet, CORS controls and server-side role authorization
- Render deployment configuration
- PWA manifest/service-worker assets

## Important production rule
The browser never receives Twilio, Flutterwave, Supabase service-role or JWT secrets. Put secrets in the hosting provider's environment variables only.

## Render
Create a **Web Service** from the GitHub repository.

Build command:
`npm install`

Start command:
`npm start`

Health check:
`/api/health`

The project pins Node through `.node-version` to 24.14.1 and `package.json` also declares a bounded Node 24 range.

## Minimum environment variables
For a first hosted test:

`JWT_SECRET` = a long random secret
`NODE_ENV` = `production`

The server can start without the optional integrations, but they will report as not configured in `/api/health`.

## Real services
For real customer use configure:

- `DATABASE_URL` — PostgreSQL connection string
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `FLW_SECRET_KEY`
- `FLW_SECRET_HASH`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `ADMIN_PHONES` — comma-separated E.164 phone numbers
- `ALLOWED_ORIGINS` — comma-separated allowed browser origins
- `APP_URL` — public HTTPS URL

## Database
Run `schema.sql` against your PostgreSQL/Supabase database. The server also creates the core tables automatically when `DATABASE_URL` is present.

## Role security
Customers do not choose an admin role in the browser. Admin access is granted server-side from `ADMIN_PHONES`. Rider/vendor/hotel roles should be approved server-side; changing the visible UI does not grant API permissions.

## Free testing
Render provides free web services for testing, but free services spin down after inactivity and have an ephemeral filesystem. Use external PostgreSQL/storage for anything you need to keep. Supabase has a free plan for a small test database/storage project.

## Before accepting real money or identity documents
Configure real service credentials, verify payment webhooks, configure persistent storage, set a permanent JWT secret, restrict CORS, publish privacy/terms, and run a security review/penetration test.
