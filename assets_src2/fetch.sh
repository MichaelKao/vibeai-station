#!/bin/bash
# usage: fetch.sh <outpath> <wayback-url>
out="$1"; url="$2"
for i in 1 2 3 4 5; do
  curl -sL --max-time 60 "$url" -o "$out" 2>/dev/null
  if [ -s "$out" ]; then
    sz=$(wc -c < "$out")
    if [ "$sz" -gt 400 ]; then echo "OK $out $sz"; exit 0; fi
    if [ "$sz" -gt 0 ]; then echo "OK(small) $out $sz"; exit 0; fi
  fi
  sleep 1
done
echo "FAIL $out"
