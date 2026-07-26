#!/usr/bin/env bash
# Create GA4 custom dimensions / metrics for the komyo property.
#
# GA4 params are INVISIBLE in reports until registered, and registration is NOT retroactive —
# only events that arrive AFTER it carry the value. So: register FIRST, then seed, then report.
#
#   scripts/ga4-define.sh --dim choice_kind,place --met wave,choice_count
#   scripts/ga4-define.sh --list                      # what's registered right now
#
# Auth: the ga4-mcp service account key + EDITOR on the property (the read-only MCP server can
# report but not create). Uses a throwaway gcloud config dir, so your gcloud account is untouched.
set -uo pipefail

PROPERTY=543479165
KEY="${GA4_KEY:-$HOME/.config/gcp/ga4-mcp.json}"
DIMS="" METS="" LIST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dim) DIMS="$2"; shift 2 ;;
    --met) METS="$2"; shift 2 ;;
    --list) LIST=1; shift ;;
    *) echo "usage: $0 [--dim a,b] [--met c,d] [--list]"; exit 2 ;;
  esac
done

[ -f "$KEY" ] || { echo "no service-account key at $KEY (set GA4_KEY to override)"; exit 1; }

export CLOUDSDK_CONFIG="$(mktemp -d)"
trap 'rm -rf "$CLOUDSDK_CONFIG"' EXIT
gcloud auth activate-service-account --key-file="$KEY" >/dev/null 2>&1
TOKEN=$(gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/analytics.edit 2>/dev/null)
[ -n "$TOKEN" ] || { echo "could not mint a token from $KEY"; exit 1; }
API="https://analyticsadmin.googleapis.com/v1beta/properties/$PROPERTY"

if [ "$LIST" = 1 ]; then
  echo "dimensions:"; curl -s "$API/customDimensions" -H "Authorization: Bearer $TOKEN" | grep -oE '"parameterName": *"[^"]+"' | sed 's/.*: *"/  /;s/"$//' | sort
  echo "metrics:";    curl -s "$API/customMetrics"    -H "Authorization: Bearer $TOKEN" | grep -oE '"parameterName": *"[^"]+"' | sed 's/.*: *"/  /;s/"$//' | sort
  exit 0
fi

post() { # post <endpoint> <json> <label>
  out=$(curl -s -w '\n%{http_code}' -X POST "$API/$1" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$2")
  code=$(echo "$out" | tail -1)
  if [ "$code" = "200" ]; then printf '  %-28s ok\n' "$3"
  else printf '  %-28s HTTP %s  %s\n' "$3" "$code" "$(echo "$out" | head -n -1 | tr -d '\n' | cut -c1-160)"; fi
}

IFS=','
for d in $DIMS; do
  [ -n "$d" ] || continue
  post customDimensions "{\"parameterName\":\"$d\",\"displayName\":\"$d\",\"scope\":\"EVENT\"}" "dimension $d"
done
for m in $METS; do
  [ -n "$m" ] || continue
  post customMetrics "{\"parameterName\":\"$m\",\"displayName\":\"$m\",\"scope\":\"EVENT\",\"measurementUnit\":\"STANDARD\"}" "metric $m"
done
unset IFS

echo "registered. Values only attach to events sent from NOW on — seed the new param before"
echo "building a report on it (GA4's report builder hides fields that have never had a value)."
