# ObuasiGo publishing steps

## 1. Complete production values

Copy `.env.example` to `.env` on the server and set:

- `NODE_ENV=production`
- `APP_URL=https://your-real-domain`
- `JWT_SECRET=<strong random secret>`
- `DATABASE_URL=<production PostgreSQL URL>`
- `DATABASE_SSL=true`
- `ALLOWED_ORIGINS=https://your-real-domain`
- `ADMIN_PHONES=<Jessica's real owner phone>`
- Twilio Verify values
- Flutterwave values
- Supabase private storage values
- Maps values if used by the chosen maps integration
- Optional analytics ID
- Real business/legal contact values

Do not put secrets in frontend files or GitHub.

## 2. Database

Run the SQL schema/migrations against the production PostgreSQL database. Confirm backups and recovery before accepting real transactions.

## 3. Private documents

Create a private Supabase Storage bucket for verification documents. Production startup intentionally refuses document uploads if private storage is not configured.

## 4. HTTPS

Put the service behind HTTPS. In production the server redirects non-HTTPS requests. Confirm the reverse proxy sends the `X-Forwarded-Proto` header correctly.

## 5. Payment testing

Before launch, test:

- successful card payment
- successful Ghana mobile-money payment
- cancelled payment
- failed payment
- duplicate webhook
- webhook signature rejection
- amount mismatch
- currency mismatch
- refund flow

Never mark an order paid from a frontend callback alone.

## 6. OTP testing

Test OTP delivery to real Ghana numbers using the production verification provider. Disable development OTP before public launch.

## 7. Legal/business details

Replace all placeholders in the legal pages with the actual registered company/business details, support contacts and final policies. Obtain appropriate legal review before collecting real identity documents.

## 8. Domain / SEO

Set `APP_URL` to the real HTTPS domain. The server dynamically generates `robots.txt` and `sitemap.xml` from `APP_URL`.

## 9. Analytics

Analytics is optional. If enabled, it is loaded only after the visitor accepts optional analytics in the privacy banner.

## 10. Final checks

Run:

```bash
npm run launch:audit
npm start
```

Then manually test on a real Android phone:

- customer registration/login
- search
- cart
- checkout
- order status
- vendor registration/login
- rider registration/login
- hotel registration/login
- hotel QR check-in
- admin approval
- documents
- referral
- privacy choices
- legal pages
- 404 page
- mobile navigation

A successful local audit is not a substitute for real provider, security, legal, payment and operational testing.
