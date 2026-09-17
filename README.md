# ObuasiGo — Secure Hosting/Test Build

This version uses the supplied ObuasiGo interface while moving sensitive administration and credentials off the public app.

## Public app
- `/` — Customer/Vendor/Rider/Hotel interface
- Admin is intentionally NOT exposed as a public role switch.

## Secure admin
- `/admin.html` — separate admin portal
- Server-side role enforcement protects `/api/admin/*`.
- Set `ADMIN_PHONES` to the administrator phone numbers. Never let users choose `admin` from the frontend.

## Security rules
- Secrets belong only in hosting environment variables.
- Do not commit `.env` or provider secrets to GitHub.
- `JWT_SECRET` is required in production.
- `ALLOWED_ORIGINS` should contain only your real frontend origin(s).
- Twilio/Flutterwave/Supabase secret credentials stay server-side.
- Order, booking, tracking and admin mutations are authorization-checked on the server.
- Rate limits, Helmet, payload limits and strict input checks are enabled.

## Render
Build: `npm install`
Start: `npm start`

## Database
Use a persistent PostgreSQL database such as Supabase for testing. Run `schema.sql` if your provider does not allow the application role to create tables.

## Production note
This is a hardened test/launch foundation, not a substitute for a professional security audit. Before handling real money or identity documents at scale, perform penetration testing, dependency scanning, secrets rotation, backup/restore testing, incident response planning, and legal/privacy review.
