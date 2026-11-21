'use strict';
// Same-value proofs only. Existing numeric literals/URLs must all remain;
// additional digits need an explicit English number word or named date month.
function allowProtectedValues(source,sourceTokens,targetTokens){
 const remaining=new Map();for(const token of targetTokens)remaining.set(token,(remaining.get(token)||0)+1);
 for(const token of sourceTokens){if(!remaining.get(token))return false;remaining.set(token,remaining.get(token)-1);}
 const extra=[...remaining].flatMap(([token,count])=>Array(count).fill(token));if(!extra.length)return true;
 if(extra.some(token=>!/^\d+(?:\.5)?$/.test(token)))return false;
 const clean=source.replace(/https?:\/\/[^\s<>"']+|\{\{[^{}]+\}\}|\{[A-Za-z_][\w.]*\}/g,' '),proof=new Map(),add=n=>proof.set(String(n),(proof.get(String(n))||0)+1);
 const units={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19},tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 const pattern=/\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi;
 for(const match of clean.matchAll(pattern)){const parts=match[0].toLowerCase().split(/[- ]/);add(parts[0]in tens?tens[parts[0]]+(units[parts[1]]||0):units[parts[0]]);}
 // "a year" and "an hour" are explicit singular quantities, not new figures.
 for(const _ of clean.matchAll(/\b(?:a|an)\s+(?:(?:academic|additional|extra|failed|foundation|full|preparatory|single)\s+)?(?:year|semester|term|month|week|day|hour|minute|second)\b/gi))add(1);
 // Ordinals and occupancy have explicit values; preserve all existing literals.
 const ordinals={first:1,second:2,third:3,fourth:4};
 for(const m of clean.matchAll(/\b(first|second|third|fourth)[- ](?:year|semester|term|phase|stage)\b/gi))add(ordinals[m[1].toLowerCase()]);
 for(const m of clean.matchAll(/\b(twin|triple)\s+(?:or\s+(?:twin|triple)\s+)?rooms?\b/gi)){for(const word of m[0].match(/twin|triple/gi)||[])add(word.toLowerCase()==='twin'?2:3);}
 for(const _ of clean.matchAll(/\bone and a half(?: times)?\b/gi))add('1.5');
 const names={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
 const monthPattern=/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/g;
 for(const match of clean.matchAll(monthPattern)){
  const before=clean.slice(Math.max(0,match.index-30),match.index),after=clean.slice(match.index+match[0].length),range=/(?:–|—|-)\s*$/.test(before)||/^\s*(?:–|—|-)\s*[A-Z]/.test(after);
  const dateContext=clean.trim()===match[0]||/\d\s*$/.test(before)||/^\s*\d/.test(after)||/\b(?:in|by|until|from|through|before|after|on|for|during)\s+(?:mid[- ]|early\s+|late\s+)?$/.test(before.toLowerCase())||/\b(?:deadline|intake|month)\s*[:=-]?\s*$/.test(before.toLowerCase())||/^\s*(?:deadline|intake|entry|start|intakes)\b/i.test(after)||/\(\s*$/.test(before)||range;
  if(dateContext)add(names[match[0].toLowerCase()]);
 }
 for(const token of extra){if(!proof.get(token))return false;proof.set(token,proof.get(token)-1);}return true;
}
module.exports={allowProtectedValues};
