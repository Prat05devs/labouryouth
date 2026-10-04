import type {NextConfig} from 'next';
// Next.js inlines small bootstrap scripts, so script-src needs 'unsafe-inline'; everything else is same-origin only.
const prod=process.env.NODE_ENV==='production';
const csp=["default-src 'self'","script-src 'self' 'unsafe-inline'"+(prod?'':" 'unsafe-eval'"),"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'","connect-src 'self'","frame-ancestors 'none'","base-uri 'self'","form-action 'self'","object-src 'none'"].join('; ');
const config:NextConfig={poweredByHeader:false,async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Content-Security-Policy',value:csp},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},...(prod?[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]:[])]}];}};
export default config;
