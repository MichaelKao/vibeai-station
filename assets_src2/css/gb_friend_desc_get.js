/*********************************************
* Cool DHTML tooltip script- © Dynamic Drive DHTML code library (www.dynamicdrive.com)
* This notice MUST stay intact for legal use
* Visit Dynamic Drive at http://www.dynamicdrive.com/ for full source code
***********************************************/
var offsetxpoint=-60 //Customize x offset of tooltip
var offsetypoint=5 //Customize y offset of tooltip
var ie=document.all
var ns6=document.getElementById && !document.all
var enabletip=false
var PIC_STATIC='http://l.yimg.com/e';
if (ie||ns6)
  var tipobj = document.all? document.all["mini"] : document.getElementById? document.getElementById("mini") : ""
function ietruebody(){
return (document.compatMode && document.compatMode!="BackCompat")? document.documentElement : document.body
}
var myInfo = new Object();
var currenttheid = '';

/* show the tip of image*/
function ddtip(theid, thedesc, thecate, thesource, index, notFriend, donot_know, showVisitLink, event) {
 
  var target = event.target||event.srcElement;
  if(target.tagName!=='IMG') return;
  
//	thedesc = unescape(thedesc);
//	thecate = unescape(thecate);
  thecate = thecate.substring(0, 12);
  
  var notFriendTags = (notFriend) ? '<a class="add" href="'+jslang.hostname+'album/addfriend.php?uid='+theid+'">好友</a>' : '';
  var fidParam = (donot_know) ? '&fid='+userid : ''; 
  var leaveMsg = (friend_param == 3) ? '<a class="add" href="'+jslang.hostname+'guestbook/addpost.php?id='+theid+'&amp;lang=0&hi'+fidParam+'" target="_blank">戳戳</a>' : '';
  var visitFriend = (showVisitLink) ? '<a class="emp" href="'+jslang.hostname+'friend/'+theid+'&amp;c=3" target="_blank">看關係</a>' : '';
  var findfriend = '<a class="friend" href="'+jslang.hostname+'svcs/friend_graph/index.php?from='+jslang.viewer+'&to='+theid+'">連連看</a>';

  var regText = 
       '<div id="mini_content">' +
         '<a href="' + redirect_prefix + 'friend/*'+jslang.hostname+'friend/'+theid+'" target="_blank"><img src="'+ thesource + '" onerror="this.src=\'http://pic.wretch.cc/serv/common/user_cover.gif\'" /></a>'+
           '<h3><a href="' + redirect_prefix + 'friend/*'+jslang.hostname+'friend/'+theid+'" target="_blank">'+ theid +'</a><span class="cate">'+thecate+'</span><span class="desc">' + thedesc + '</span></h3>'+
            '<ul id="mini_service">' +
              '<li><a href="' + redirect_prefix + 'join/*'+jslang.hostname+'join/'+theid+'" target="_blank">'+jslang.join+'</a></li>' +
              '<li><a href="' + redirect_prefix + 'album/*'+jslang.hostname+'album/'+theid+'" target="_blank">'+jslang.album+'</a></li>' +
              '<li><a href="' + redirect_prefix + 'blog/*'+jslang.hostname+'blog/'+theid+'" target="_blank">'+jslang.blog+'</a></li>' +
              '<li><a href="' + redirect_prefix + 'video/*'+jslang.hostname+'video/'+theid+'" target="_blank">'+jslang.video+'</a></li>' +
              '<li><a href="' + redirect_prefix + 'friend/*'+jslang.hostname+'friend/'+theid+'" target="_blank">'+jslang.friend+'</a></li>' +
              '<li><a href="' + redirect_prefix + 'guestbook/*'+jslang.hostname+'guestbook/'+theid+'" target="_blank">'+jslang.guestbook+'</a></li>' +
            '</ul>' +
            '<ol id="mini_update">' +                           
              insertLoadingInfo()+
            '</ol>' +
        '</div>'+
        '<div id="mini_footer"><h4><a href="' + jslang.hostname + '"></a></h4>'+notFriendTags+leaveMsg+visitFriend+findfriend+'</div>' ;
	ddrivetip(regText);

  // Check Cache
  currenttheid = theid;
  if (!YAHOO.lang.isUndefined(myInfo[theid])) {
    renderMini(myInfo[theid]);
  } else {
    timer = setTimeout( function(){makeRequest(theid)}, 500);
  }
}

var renderMini = function(obj) {
  var oB = obj.blog;
  var oV = obj.video;
  var oG = obj.gbook;
  var line = '';
  var rd_b = redirect_prefix + 'nblog/*' + jslang.hostname;
  var rd_v = redirect_prefix + 'nvideo/*' + jslang.hostname;
  var rd_g = redirect_prefix + 'ngb/*' + jslang.hostname;

  // Current user or not
  if(currenttheid != obj.user) return;

  if(oB.status != 'ok')
  {
    if(oB.status == jslang.isClosed) {
      line += '<li><strong>' + jslang.blog + '</strong><span class="nonew">' + jslang.blog_closed + '</span></li>';
    }
    else{
      line += '<li>' + '<strong>'+jslang.blog + '</strong><span class="nonew">' + jslang.noLastInfo + '</span></li>'
    }
  }
  else{
    line += '<li><span class="date">' + oB.ctime  + '</span><strong>'+ jslang.blog + '</strong><a href="'+ rd_b + oB.link +'" target="_blank">'+ oB.title + '</a></li>';
  }

  if(oV.status != 'ok')
  {
    if(oV.status == jslang.isClosed) {
      line += '<li><strong>' + jslang.video + '</strong><span class="nonew">' + jslang.video_closed + '</span></li>';
    }
    else{
      line += '<li>' + '<strong>'+jslang.video + '</strong><span class="nonew">' + jslang.noLastInfo + '</span></li>'
    }
  }
  else{
    line += '<li><span class="date">' + oV.ctime  + '</span><strong>'+ jslang.video + '</strong><a href="'+ rd_v + oV.link +'" target="_blank">'+ oV.title + '</a></li>';
  }

  if(oG.status != 'ok')
  {
    if(oG.status == jslang.isClosed) {
      line += '<li><strong>' + jslang.gbook + '</strong><span class="nonew">' + jslang.gbook_closed + '</span></li>';
    }
    else{
      line += '<li>' + '<strong>'+jslang.gbook + '</strong><span class="nonew">' + jslang.noLastInfo + '</span></li>'
    }
  }
  else{
    line += '<li><span class="date">' + oG.ctime  + '</span><strong>'+ jslang.guestbook + '</strong><a href="'+ rd_g + oG.link +'" target="_blank">'+ oG.title + '</a></li>';
  }

  document.getElementById('mini_update').innerHTML = line;
};

function makeRequest(who)
{
  var objTrans = YAHOO.util.Get.script(fetch_data_url + '?u=' + who);
};

function insertLoadingInfo(){
  return '<span style="padding:1px 5px; background-color:#3366cc; color:#f0f0f0; float:right">Loading ...</span>';
};

function ddrivetip(thetext, thecolor, thewidth){
	if (ns6||ie){
		if (typeof thewidth!="undefined") tipobj.style.width=thewidth+"px"
		if (typeof thecolor!="undefined" && thecolor!="") tipobj.style.backgroundColor=thecolor
		tipobj.innerHTML=thetext
		enabletip=true
		return false
	}
}

function positiontip(p, event){
  var target = event.target||event.srcElement;

  if(target.tagName!=='IMG') return;

  var e = event;
  var curX=(ns6)?e.pageX : event.clientX+ietruebody().scrollLeft;
  var curY=(ns6)?e.pageY : event.clientY+ietruebody().scrollTop;
  var viewportY = ie&&!window.opera?ietruebody().clientHeight : window.innerHeight; 
  //Find out how close the mouse is to the corner of the window
  // if ff or safari , use pageY (absolute Y)
  var rightedge=ie&&!window.opera? ietruebody().clientWidth-event.clientX-offsetxpoint : window.innerWidth+window.pageXOffset-e.pageX-offsetxpoint-20
    var bottomedge=ie&&!window.opera? ietruebody().clientHeight-event.clientY-offsetypoint : window.innerHeight+window.pageYOffset-e.pageY-offsetypoint

    var leftedge=(offsetxpoint<0)? offsetxpoint*(-1) : -1000
    //if the horizontal distance isn't enough to accomodate the width of the context menu
    if (rightedge<tipobj.offsetWidth) {
      //move the horizontal position of the menu to the left by it's width
      tipobj.style.left=ie? ietruebody().scrollLeft+event.clientX-tipobj.offsetWidth+"px" : window.pageXOffset+e.clientX-tipobj.offsetWidth+"px"
        var e = event;
    }else if (curX<leftedge)
      tipobj.style.left="5px"
    else
      //position the horizontal position of the menu where the mouse is positioned
      tipobj.style.left=curX+offsetxpoint+"px"
        //same concept with the vertical position
        var objHeight = (tipobj.offsetHeight<150)?185:tipobj.offsetHeight; // handel miscalculate objheight 


  if (event.clientY>(viewportY*3)/4) {//3/4
    tipobj.style.top=ie? ietruebody().scrollTop+event.clientY-objHeight-offsetypoint+"px" : e.pageY-objHeight-offsetypoint+"px"
  }else {
    tipobj.style.top=curY+offsetypoint+"px"
  }
  tipobj.style.visibility="visible";
  return false;
}

function hideddrivetip(event, userid){

  var target = event.target||event.srcElement;
  var reltg = event.relatedTarget||event.toElement;

  if (reltg&&((reltg.parentNode.id.toLowerCase()=='mini')||(reltg.parentNode.parentNode.id=='mini_content'))) return;

  if (ns6||ie){
    if(typeof timer != 'undefined'){
        clearTimeout(timer);
    }
    enabletip=false
    tipobj.style.visibility="hidden"
    tipobj.style.backgroundColor=''
    tipobj.style.width=''
  }
}
