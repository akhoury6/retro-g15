// OB5 gates: TOO F8c-p and drawing52. Suppression is latched state;
// PUNCH enables DIGIT's set gate but does not disable non-DIGIT's reset gate.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
const pack = formats => formats.reduce((word,fmt,i)=>word|(fmt<<(26-3*i)),0);
function make(formats,copy=0){
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 const typed=[],punched=[];
 p.devices={typewriter:{write(c){typed.push(c)}},paperTapePunch:{makeBusy(){},write(c){punched.push(c)}}};
 p.punchSwitch=copy;d.startTiming=()=>{d.timingActive=true};
 d.line[2][3]=d.line[3][3]=pack(formats);d.AR.value=1<<25;
 d.line[19][107]=1<<25;d.line[19][0]=2;
 return {p,d,typed,punched};
}
let cases=0;
// Literal RELOAD in both sources, plus END converted to RELOAD by nonempty19.
for(const operation of ['typeAR','typeLine19'])for(const converted of [false,true])for(const copy of [0,1]){
 if(converted&&operation==='typeAR')continue;
 const {p,d,typed,punched}=make([0,converted?1:5],copy);
 const fetch=p.fetchSlowOutputFormat.bind(p);let count=0;
 p.fetchSlowOutputFormat=async()=>{
  if(++count===3){d.line[2][3]=d.line[3][3]=pack([0,1,4]);d.line[19].fill(0);}
  return fetch();
 };
 await p[operation]();
 assert.deepEqual(typed,[17,copy?16:0,4],`${operation},converted=${converted},copy=${copy}`);
 if(copy)assert.deepEqual(punched,[0,17,5,16,4],'COPY records initial blank and RELOAD, never suppresses digit');
 ++cases;
}
// DIGIT retains significance; PERIOD explicitly sets it; other non-DIGIT
// formats clear it. END's reset is exercised by its converted-RELOAD cases above.
for(const [fmt,emitted,suppresses] of [[0,16,false],[2,2,true],[3,6,false],[4,0,true],[6,3,true],[7,7,true]]){
 for(const copy of [0,1]){
  const {p,typed}=make([0,fmt,0,1,4],copy);
  await p.typeAR();
  assert.deepEqual(typed,[17,emitted,copy||!suppresses?16:0,4],`fmt=${fmt},copy=${copy}`);
  ++cases;
 }
}
// PUNCH affects DIGIT's set gate, not the independent OB5 reset latch.
for(const scenario of ['off-before-first-digit','off-after-copy-zero','off-after-copy-sign']){
 const formats=scenario==='off-after-copy-sign'?[0,4,0,1,4]:[0,0,1,4];
 const {p,d,typed}=make(formats,1);d.AR.value=0;
 const fetch=p.fetchSlowOutputFormat.bind(p);let count=0;
 p.fetchSlowOutputFormat=async()=>{
  ++count;
  if(count===(scenario==='off-before-first-digit'?1:scenario==='off-after-copy-zero'?2:3))p.punchSwitch=0;
  return fetch();
 };
 await p.typeAR();
 assert.deepEqual(typed,scenario==='off-before-first-digit'?[0,0,4]:scenario==='off-after-copy-zero'?[16,16,4]:[16,0,0,4],scenario);
 ++cases;
}
console.log(`${cases} OB5 format/COPY/switch-transition cases passed`);
