#!/bin/bash
BASE=/d/repos/vibeai-station/assets_src2
C=$BASE/css; S=$BASE/scratch; H=$BASE/html; IMG=$BASE/img/gb
LOG=$BASE/gb_dl2.log; : > $LOG
get(){ local out="$1" url="$2" i sz
 for i in 1 2 3 4; do curl -sL --max-time 60 "$url" -o "$out" 2>/dev/null
  sz=$(wc -c < "$out" 2>/dev/null||echo 0); [ "${sz:-0}" -gt 0 ] && { echo "OK $sz $out">>$LOG; return 0; }; sleep 6; done
 echo "FAIL $out <- $url">>$LOG; }

get "$IMG/Smileys/biggrin.gif" "https://web.archive.org/web/20131217170818id_/http://l.yimg.com/e/serv/guestbook/img/Smileys/biggrin.gif"; sleep 2
get "$C/gb_friend_fix.css" "https://web.archive.org/web/20110415011140id_/http://l.yimg.com/e/serv/friend/css/fix.css%3F17303"; sleep 2
get "$C/gb_friend_select.css" "https://web.archive.org/web/20110415011140id_/http://l.yimg.com/e/serv/friend/css/select.css%3F17139"; sleep 2
get "$C/gb_user_font.css" "https://web.archive.org/web/20120920003250id_/http://l.yimg.com/e/serv/user/css/font.css%3F20120116"; sleep 2
get "$S/desc_get.js" "https://web.archive.org/web/20110605044824id_/http://l.yimg.com/e/serv/friend/js/desc_get.js%3F22300"; sleep 2
get "$IMG/tpic5.jpg" "https://web.archive.org/web/2011id_/http://l.yimg.com/e/serv/friend/img/thumbs/tpic5.jpg"; sleep 2
get "$IMG/isAuth_silver.gif" "https://web.archive.org/web/2011id_/http://l.yimg.com/e/serv/common/img/isAuth_silver.gif"; sleep 2
# per-user skin CSS (to identify the default theme)
get "$C/gb_userskin_a000000010_guestbook.css" "https://web.archive.org/web/2013id_/http://f12.wretch.yimg.com/a000000010/files/guestbook.css%3F1306549603"; sleep 2
get "$C/gb_userskin_a00379_guestbook.css" "https://web.archive.org/web/2011id_/http://f10.wretch.yimg.com/a00379/files/guestbook.css%3F1291310734"; sleep 2
get "$C/gb_userskin_a0913375433_guestbook.css" "https://web.archive.org/web/2011id_/http://f8.wretch.yimg.com/a0913375433/files/guestbook.css%3F1258136273"; sleep 2
get "$C/gb_userskin_a000000010_user.css" "https://web.archive.org/web/2012id_/http://f12.wretch.yimg.com/a000000010/files/user.css%3F1314560819"; sleep 2
get "$C/gb_userskin_a00000415263_friend.css" "https://web.archive.org/web/2011id_/http://f10.wretch.yimg.com/a00000415263/files/friend.css%3F1292757357"; sleep 2
echo DONE >> $LOG
