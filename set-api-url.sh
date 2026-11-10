#!/bin/sh
# usage: ./set-api-url.sh https://your-backend.onrender.com
[ -z "$1" ] && { echo "usage: $0 <https-url>"; exit 1; }
sed -i '' "s#https://YOUR-BACKEND-URL#${1%/}#" app/eas.json && grep EXPO_PUBLIC_API_URL app/eas.json
