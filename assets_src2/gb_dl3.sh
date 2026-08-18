#!/bin/bash
BASE=/d/repos/vibeai-station/assets_src2
T=$BASE/img/gb/style_1417; mkdir -p $T
LOG=$BASE/gb_dl3.log; : > $LOG
get(){ local out="$1" url="$2" i sz
 for i in 1 2 3 4; do curl -sL --max-time 60 "$url" -o "$out" 2>/dev/null
  sz=$(wc -c < "$out" 2>/dev/null||echo 0); [ "${sz:-0}" -gt 0 ] && { echo "OK $sz $out">>$LOG; return 0; }; sleep 6; done
 echo "FAIL $out <- $url">>$LOG; }
for f in body.jpg footer.gif hr.gif main.gif main_tab1.gif main_tab2.gif main_tab3.gif mine.gif msg_added.jpg msg_content.jpg msg_control.gif myService.gif stats.gif; do
  get "$T/$f" "https://web.archive.org/web/20131218131235id_/http://l.yimg.com/e/style/14/1417/$f"; sleep 2
done
echo DONE >> $LOG
