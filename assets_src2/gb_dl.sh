#!/bin/bash
BASE=/d/repos/vibeai-station/assets_src2
IMG=$BASE/img/gb
S=$BASE/scratch
H=$BASE/html
mkdir -p "$IMG/Smileys" "$S" "$H"
LOG=$BASE/gb_dl.log
: > $LOG

get () {
  local out="$1" url="$2" i sz
  for i in 1 2 3 4 5; do
    curl -sL --max-time 60 "$url" -o "$out" 2>/dev/null
    sz=$(wc -c < "$out" 2>/dev/null || echo 0)
    if [ "${sz:-0}" -gt 0 ]; then echo "OK $sz $out" >> $LOG; return 0; fi
    sleep 8
  done
  echo "FAIL $out  <- $url" >> $LOG
  return 1
}

for n in angry biggrin bighug blushing broken_heart confused crying happy laughing lovestruck notalking phbbbbt sad shameonyou straightface surprise tongue waiting winking worried; do
  get "$IMG/Smileys/$n.gif" "https://web.archive.org/web/20131211113501id_/http://l.yimg.com/e/serv/guestbook/img/Smileys/$n.gif"
  sleep 3
done
echo "smileys done" >> $LOG

get "$IMG/lock.gif" "https://web.archive.org/web/2013id_/http://l.yimg.com/e/icon/blog/lock.gif"; sleep 3
get "$IMG/isAuth.gif" "https://web.archive.org/web/2013id_/http://l.yimg.com/e/serv/common/img/isAuth.gif"; sleep 3
get "$IMG/rss.gif" "https://web.archive.org/web/2013id_/http://l.yimg.com/e/serv/common/img/rss.gif"; sleep 3
get "$IMG/button_admin.gif" "https://web.archive.org/web/2013id_/http://l.yimg.com/e/serv/common/img/button_admin.gif"; sleep 3
get "$IMG/webpage.gif" "https://web.archive.org/web/2013id_/http://l.yimg.com/e/serv/guestbook/img/webpage.gif"; sleep 3
echo "icons done" >> $LOG

get "$H/gb_user_a000000010_20120531.html" "https://web.archive.org/web/20120531223342id_/http://www.wretch.cc/user/a000000010"; sleep 3
get "$H/gb_friend_a00000415263_20110518.html" "https://web.archive.org/web/20110518114015id_/http://www.wretch.cc/friend/a00000415263"; sleep 3
get "$H/gb_gbook_announce_a0190728_20110702.html" "https://web.archive.org/web/20110702224451id_/http://www.wretch.cc/guestbook/a0190728&tab=announce"; sleep 3
get "$H/gb_gbook_advise_a0052018_20111004.html" "https://web.archive.org/web/20111004181742id_/http://www.wretch.cc/guestbook/a0052018&tab=advise"; sleep 3
get "$H/gb_gbook_track_a0003033_20110716.html" "https://web.archive.org/web/20110716015827id_/http://www.wretch.cc/guestbook/a0003033&tab=track"; sleep 3
get "$H/gb_gbook_addpost_a0913375433_20110625.html" "https://web.archive.org/web/20110625015749id_/http://www.wretch.cc/guestbook/a0913375433&tab=addpost"; sleep 3
get "$S/gb2009.html" "https://web.archive.org/web/20091223163035id_/http://www.wretch.cc/guestbook/a000000SS501"; sleep 3
echo "pages done" >> $LOG

curl -s --max-time 90 "https://web.archive.org/cdx/search/cdx?url=www.wretch.cc/friend&matchType=prefix&filter=statuscode:200&collapse=urlkey&limit=120&from=2011&to=2013&fl=timestamp,original,length" > "$S/cdx_friend.txt"; sleep 5
curl -s --max-time 90 "https://web.archive.org/cdx/search/cdx?url=l.yimg.com/e/serv/guestbook/img&matchType=prefix&filter=statuscode:200&collapse=urlkey&limit=300&fl=timestamp,original,mimetype,length" > "$S/cdx_gbimg.txt"; sleep 5
curl -s --max-time 90 "https://web.archive.org/cdx/search/cdx?url=l.yimg.com/e/serv/user&matchType=prefix&filter=statuscode:200&collapse=urlkey&limit=200&fl=timestamp,original,mimetype,length" > "$S/cdx_userassets.txt"; sleep 5
curl -s --max-time 90 "https://web.archive.org/cdx/search/cdx?url=l.yimg.com/e/serv/friend&matchType=prefix&filter=statuscode:200&collapse=urlkey&limit=200&fl=timestamp,original,mimetype,length" > "$S/cdx_friendassets.txt"; sleep 5
curl -s --max-time 90 "https://web.archive.org/cdx/search/cdx?url=www.wretch.cc/guestbook/a0&matchType=prefix&filter=statuscode:200&collapse=urlkey&limit=80&from=20120101&to=20121231&fl=timestamp,original,length" > "$S/cdx_gb2012.txt"
echo "ALLDONE" >> $LOG
