#!/bin/bash
BASE=/d/repos/vibeai-station/assets_src2
T=$BASE/img/gb; H=$BASE/html; S=$BASE/scratch
LOG=$BASE/gb_dl4.log; : > $LOG
get(){ local out="$1" url="$2" i sz
 for i in 1 2 3 4; do curl -sL --max-time 60 "$url" -o "$out" 2>/dev/null
  sz=$(wc -c < "$out" 2>/dev/null||echo 0); [ "${sz:-0}" -gt 0 ] && { echo "OK $sz $out">>$LOG; return 0; }; sleep 6; done
 echo "FAIL $out <- $url">>$LOG; }
get "$H/gb_friend_a000000000aa_20131225.html" "https://web.archive.org/web/20131225030237id_/http://www.wretch.cc/friend/a000000000aa"; sleep 3
get "$H/gb_friend_a000001_20131226.html" "https://web.archive.org/web/20131226230443id_/http://www.wretch.cc/friend/a000001"; sleep 3
get "$H/gb_user_a014042_20120326.html" "https://web.archive.org/web/20120326145053id_/http://www.wretch.cc/user/a014042"; sleep 3
for f in mini-t.gif mini-b.gif arrow.png logo.png addwhite.gif emptywhite.gif; do
  get "$T/friend_$f" "https://web.archive.org/web/2011id_/http://l.yimg.com/e/serv/friend/img/$f"; sleep 2
done
get "$T/user_cover.gif" "https://web.archive.org/web/2012id_/http://l.yimg.com/e/serv/common/img/user_cover.gif"; sleep 2
echo DONE >> $LOG
