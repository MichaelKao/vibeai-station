#!/bin/bash
S=/d/repos/vibeai-station/assets_src2/scratch/zh; mkdir -p $S
LOG=/d/repos/vibeai-station/assets_src2/probe_zh.log; : > $LOG
while read -r ts url; do
  [ -z "$ts" ] && continue
  n=$(echo "$url" | md5sum | cut -c1-8)
  curl -sL --max-time 40 "https://web.archive.org/web/${ts}id_/$url" -o "$S/$n.html" 2>/dev/null
  sz=$(wc -c < "$S/$n.html" 2>/dev/null||echo 0)
  hit=$(grep -o '性別\|生日\|學歷\|自我介紹\|留言者\|悄悄話\|發表留言\|我的好友' "$S/$n.html" 2>/dev/null | sort -u | tr '\n' ' ')
  echo "$ts $url sz=$sz zh=[$hit]" >> $LOG
  sleep 2
done < /d/repos/vibeai-station/assets_src2/probe_list.txt
echo DONE >> $LOG
