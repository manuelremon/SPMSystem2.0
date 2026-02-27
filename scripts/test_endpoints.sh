#!/bin/bash
# Test endpoints - check they don't return 500
# 401/403 is OK (means auth is needed but server didn't crash)
# 200/404 is OK (means endpoint works)
# 500 = BAD (means server error, likely missing table or bad SQL)

# First try to get a token
RESP=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "1", "password": "password123"}')

TOKEN=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",""))' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Could not get token, testing without auth (checking for 500s)..."
  AUTH_HEADER=""
else
  echo "Token obtained!"
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

ENDPOINTS=(
  "/api/contracts/"
  "/api/invoices/"
  "/api/returns/"
  "/api/slob/aging"
  "/api/kitting/boms"
  "/api/kitting/orders"
  "/api/production/orders"
  "/api/warranty/"
  "/api/eco/"
  "/api/demand-planning/plans"
  "/api/quality/inspections"
  "/api/quality/ncr"
  "/api/prices/lists"
  "/api/prices/negotiations"
  "/api/cycle-count/"
  "/api/lots/"
  "/api/recalls/"
  "/api/consignment/"
  "/api/customs/"
  "/api/kanban/"
  "/api/packaging/"
  "/api/supplier-portal/config"
  "/api/supplier-onboarding/"
  "/api/supplier-finance/"
  "/api/spend-analytics/"
  "/api/contracts/compliance"
  "/api/quality/capa"
)

PASS=0
FAIL=0

for ep in "${ENDPOINTS[@]}"; do
  if [ -n "$AUTH_HEADER" ]; then
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH_HEADER" http://localhost:5000$ep)
  else
    CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5000$ep)
  fi

  if [ "$CODE" -lt 500 ]; then
    echo "OK   $CODE $ep"
    PASS=$((PASS+1))
  else
    # Get body for debugging
    if [ -n "$AUTH_HEADER" ]; then
      BODY=$(curl -s -H "$AUTH_HEADER" http://localhost:5000$ep | head -c 300)
    else
      BODY=$(curl -s http://localhost:5000$ep | head -c 300)
    fi
    echo "FAIL $CODE $ep"
    echo "     $BODY"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== Results: $PASS OK, $FAIL FAIL out of $((PASS+FAIL)) ==="
