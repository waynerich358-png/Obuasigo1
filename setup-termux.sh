#!/data/data/com.termux/files/usr/bin/bash
set -e
printf '\n=== ObuasiGo Termux Setup ===\n'
printf 'Enter Jessica\'s owner/admin phone in international format (example +233241234567): '
read -r ADMIN_PHONE
if [[ ! "$ADMIN_PHONE" =~ ^\+[1-9][0-9]{7,14}$ ]]; then
  echo 'Invalid phone format. Use +233...'
  exit 1
fi
JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
cat > .env <<ENV
NODE_ENV=development
PORT=10000
OWNER_NAME=Jessica
ADMIN_PHONES=$ADMIN_PHONE
JWT_SECRET=$JWT
DEV_OTP=true
DATABASE_URL=
DATABASE_SSL=true
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
FLW_SECRET_KEY=
FLW_SECRET_HASH=
APP_URL=http://localhost:10000
ALLOWED_ORIGINS=http://localhost:10000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=obuasigo-documents
VAPID_SUBJECT=mailto:admin@obuasigo.local
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
ENV
echo 'Created .env for Jessica owner access.'
echo 'Installing dependencies...'
npm install --no-audit --no-fund
echo
echo 'Setup complete. Start ObuasiGo with:'
echo '  npm start'
echo 'Then open: http://localhost:10000'
