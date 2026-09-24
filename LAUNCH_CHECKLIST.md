# ObuasiGo publication checklist

This build incorporates the launch checklist from the supplied references. A passing static audit does **not** mean the platform is legally or operationally ready to accept real money or identity documents.

## Website hardening included

- [x] Privacy policy page
- [x] Terms & conditions page
- [x] Refund/cancellation policy page
- [x] Cookie/tracking policy page
- [x] Optional analytics consent banner
- [x] Server-side secrets architecture
- [x] Production HTTPS redirect
- [x] Security headers via Helmet
- [x] API rate limiting
- [x] Basic honeypot spam protection
- [x] Meta title/description
- [x] Open Graph/Twitter social image asset
- [x] Favicon/app icon
- [x] robots.txt
- [x] dynamic sitemap.xml
- [x] Alt text on key images
- [x] Custom 404 page
- [x] Accessible focus states
- [x] Mobile responsive layouts
- [x] Reduced-motion support
- [x] Form required-field validation already present in partner/admin forms
- [x] Clear customer CTA: Start ordering
- [x] Legal/footer navigation

## Still required before a real public launch

1. Replace all legal/business placeholders with the actual registered business details.
2. Have the final privacy, terms, refund and cookie documents reviewed for the jurisdictions in which ObuasiGo operates.
3. Configure a real production domain in `APP_URL` and update app-store/web metadata.
4. Configure production PostgreSQL/Supabase.
5. Configure Twilio Verify and test Ghana OTP delivery.
6. Configure Flutterwave and test successful, failed, cancelled and webhook payment flows.
7. Configure private document storage and access rules.
8. Configure real maps/location credentials if the selected maps provider requires them.
9. Configure notification credentials if push/SMS/email notifications are enabled.
10. Configure analytics only if desired and after the required consent/privacy review.
11. Complete real refund/cancellation rules with vendors/hotels.
12. Verify business/rider/hotel identity and licensing procedures before accepting real documents.
13. Run end-to-end tests on real Android devices and common Ghana mobile networks.
14. Test backups, monitoring, error alerts and database recovery.
15. Create real support contacts and an escalation process.
16. Configure a production JWT secret and never reuse development secrets.
17. Verify that all admin accounts use strong authentication and least-privilege roles.
18. Perform a security review/penetration test before handling significant real customer traffic.

## Static audit

```bash
npm run launch:audit
```

The audit checks required launch files and basic integration. It cannot verify external provider credentials, legal compliance, real payment settlement, OTP delivery, production DNS/HTTPS, or operational readiness.
