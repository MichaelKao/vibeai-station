import crypto from 'node:crypto';
export const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
export const salt=()=>crypto.randomBytes(8).toString('hex');
export const check=(u,p)=>u && u.pass===hash(p,u.salt);
export const requireLogin=(req,res,next)=>req.session.uid?next():res.redirect('/login?next='+encodeURIComponent(req.originalUrl));
export const requireOwner=(req,res,next)=>res.locals.u && req.session.uid===res.locals.u.id?next():res.status(403).render('msg',{title:'沒有權限',msg:'這不是你的小站喔！'});
