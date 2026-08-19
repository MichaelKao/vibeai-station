import crypto from 'node:crypto';
export const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
export const salt=()=>crypto.randomBytes(8).toString('hex');
export const check=(u,p)=>u && u.pass===hash(p,u.salt);
export const requireLogin=(req,res,next)=>req.session.uid?next():res.redirect('/login?next='+encodeURIComponent(req.originalUrl));
// back 要給：不給的話 msg.ejs 那顆「回上一頁」只能退回站台首頁，
// 但使用者是在別人的小站上被擋下來的，退回那個人的小站才合理。
export const requireOwner=(req,res,next)=>res.locals.u && req.session.uid===res.locals.u.id
  ? next()
  : res.status(403).render('msg',{title:'沒有權限',msg:'這不是你的小站喔！',
      back: res.locals.u ? '/'+res.locals.u.name : '/'});
