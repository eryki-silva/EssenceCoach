import {createHash,timingSafeEqual} from 'node:crypto';
export function securityHeaders(production=false){return {
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://cdn.cloudflare.steamstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  ...(production?{'Strict-Transport-Security':'max-age=31536000'}:{})
};}
export function sendJson(res,value,status=200,headers={}){res.writeHead(status,{...headers,...(status>=400?{Connection:'close'}:{}),'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
export function passwordAccepted(header,password){
  if(!header?.startsWith('Basic ')||header.length>4096)return false;
  let decoded;try{decoded=Buffer.from(header.slice(6),'base64').toString('utf8');}catch{return false;}
  const colon=decoded.indexOf(':');if(colon<0||decoded.slice(0,colon)!=='coach')return false;
  const digest=value=>createHash('sha256').update(value).digest();return timingSafeEqual(digest(decoded.slice(colon+1)),digest(password));
}
