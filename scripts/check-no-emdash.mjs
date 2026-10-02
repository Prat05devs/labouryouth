// Project rule (AGENTS.md): no em dashes (U+2014) anywhere in code, copy, docs or comments.
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const EM=String.fromCharCode(0x2014);
const SKIP=/(^|\/)(package-lock\.json|uv\.lock|node_modules\/)|\.(jpg|jpeg|png|gif|ico|woff2?|ttf|pdf)$|^apps\/web\/(AGENTS|CLAUDE)\.md$/;
const files=execSync('git ls-files --cached --others --exclude-standard',{encoding:'utf8'}).split('\n').filter(f=>f&&!SKIP.test(f));
let bad=0;
for(const f of files){let t;try{t=readFileSync(f,'utf8');}catch{continue;}
  t.split('\n').forEach((l,i)=>{if(l.includes(EM)){bad++;console.error(`${f}:${i+1}: em dash found`);}});}
if(bad){console.error(`\n${bad} em dash(es). Rewrite with a comma, colon, period or parentheses.`);process.exit(1);}
console.log('No em dashes found.');
