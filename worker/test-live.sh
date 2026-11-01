#!/usr/bin/env bash
# Tests the deployed Worker. Run: bash worker/test-live.sh https://handstand-metrics.<you>.workers.dev
# The first check really stores one row, with app_version 0.0.0: delete it afterwards in Supabase with
#   delete from public.session_summaries where app_version = '0.0.0';
url="$1"
[ -z "$url" ] && { echo "Usage: bash worker/test-live.sh <worker url>"; exit 1; }
origin="https://tombeemster.github.io"
day=$(date -u +%F)
good='"day":"'$day'","attempts_total":2,"timed_auto":2,"timed_manual":0,"near_misses":1,"miss_other_person":0,"miss_unsteady":1,"miss_not_vertical":0,"miss_no_standing":0,"fails":0,"avg_ms":2000,"best_ms":2500,"record_ms":9000,"manual_counted":false,"app_version":"0.0.0"'

check() {  # what, expected status, then the curl arguments
  what="$1"; want="$2"; shift 2
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$url")
  [ "$got" = "$want" ] && echo "ok    $what ($got)" || echo "FAIL  $what: wanted $want, got $got"
}

check 'valid summary stored'  204 -X POST -H "Origin: $origin" -d "{$good}"
check 'extra field refused'   400 -X POST -H "Origin: $origin" -d "{$good,\"name\":\"x\"}"
check 'out of range refused'  400 -X POST -H "Origin: $origin" -d "{${good/\"near_misses\":1/\"near_misses\":9999}}"
check 'other origin refused'  403 -X POST -H "Origin: https://example.com" -d "{$good}"
check 'GET refused'           405
