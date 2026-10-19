import fs from 'node:fs';
import {interfaceAudit} from '../server/interface-translation-audit';
const file='client/src/lib/translation-audit-baseline.json',audit=interfaceAudit();
if(process.argv.includes('--write-baseline')){fs.writeFileSync(file,JSON.stringify({createdAt:new Date().toISOString(),knownMissing:Object.fromEntries(audit.rows.map(r=>[r.language,r.missing]))},null,2)+'\n');console.log('Existing interface gaps recorded; future new gaps will block builds.');}
else{if(!fs.existsSync(file))throw Error('Translation audit baseline missing');const baseline=JSON.parse(fs.readFileSync(file,'utf8'));const regressions=audit.rows.flatMap(r=>r.missing.filter(key=>!(baseline.knownMissing[r.language]||[]).includes(key)).map(key=>r.language+': '+key));if(regressions.length){console.error('New untranslated interface keys:',regressions.slice(0,100).join('\n'));process.exitCode=1;}else console.log('Translation gate passed: no new missing language keys.');}
