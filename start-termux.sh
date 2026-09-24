#!/data/data/com.termux/files/usr/bin/bash
set -e
if [ ! -f .env ]; then echo '.env not found. Run ./setup-termux.sh first.'; exit 1; fi
npm start
