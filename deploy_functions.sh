#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MEafterMe — Firebase Functions Deploy Script
# Изпълни: bash deploy_functions.sh YOUR_FIREBASE_CI_TOKEN
# ═══════════════════════════════════════════════════════════════

set -e

TOKEN=$1
PROJECT="meafterme-d0347"

if [ -z "$TOKEN" ]; then
  echo "❌ Липсва Firebase CI token!"
  echo "Употреба: bash deploy_functions.sh YOUR_TOKEN"
  exit 1
fi

echo "🔑 Добавяне на API ключове като Firebase Secrets..."

echo -n "$ELEVENLABS_API_KEY" | \
  firebase functions:secrets:set ELEVENLABS_API_KEY \
  --project $PROJECT --token "$TOKEN" --force

echo -n "$DID_API_KEY" | \
  firebase functions:secrets:set DID_API_KEY \
  --project $PROJECT --token "$TOKEN" --force

echo -n "$OPENAI_API_KEY" | \
  firebase functions:secrets:set OPENAI_API_KEY \
  --project $PROJECT --token "$TOKEN" --force

echo -n "$ANTHROPIC_API_KEY" | \
  firebase functions:secrets:set ANTHROPIC_API_KEY \
  --project $PROJECT --token "$TOKEN" --force

echo "✅ Всички secrets добавени!"
echo ""
echo "🚀 Деплойване на Cloud Functions..."

firebase deploy --only functions \
  --project $PROJECT \
  --token "$TOKEN" \
  --force

echo "✅ ГОТОВО!"
