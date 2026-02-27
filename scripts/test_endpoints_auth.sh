#!/bin/bash
# Test endpoints with properly formed auth token

TOKEN=$(python3 -c "
import jwt, datetime, os, uuid
secret = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key')
payload = {
    'user_id': '1',
    'type': 'access',
    'jti': str(uuid.uuid4()),
    'iat': datetime.datetime.now(datetime.UTC),
    'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1)
}
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
")

echo "Testing with proper auth token (user_id=1, type=access)..."
echo ""

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
  RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:5000$ep)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')

  if [ "$CODE" -lt 500 ]; then
    echo "OK   $CODE $ep"
    PASS=$((PASS+1))
  else
    echo "FAIL $CODE $ep"
    echo "     $(echo $BODY | head -c 300)"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== Results: $PASS OK, $FAIL FAIL out of $((PASS+FAIL)) ==="
