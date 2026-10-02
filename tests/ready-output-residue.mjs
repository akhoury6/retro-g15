// OD0/OE1: READY immediate, M19<-MZ and MZ<-oldMZ OR old19 until F.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
let cases=0;
for(const operation of ['typeAR','typeLine19','punchLine19']){
 for(const manual of operation==='typeAR'?[false,true]:[true]){
  for(const offset of [2,53,107]){
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
    const device={cancel(){},write(){},makeBusy(){}};p.devices={typewriter:device,paperTapePunch:device};
    p.transferDriver=async()=>{};
    d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
    d.line[2][3]=d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
    d.line[19].set(Array.from({length:108},(_,i)=>(i+1)*2));
    const cancelAt=(operation==='punchLine19'?432:648)+offset;
    let original,readyAt;
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{
      await step();
      if(d.drumTime===cancelAt){
        assert.equal(p.slowOutputOE,1);assert.ok(d.drumTime>=p.slowOutputODUntil);
        original={line:Array.from(d.line[19]),mz:Array.from(d.MZ)};
        if(manual)await p.executeKeyboardCommand(4);else await p.initiateIO(0);
        assert.equal(p.OC.value,16,'Ready rises immediately, before tail completes');readyAt=d.drumTime;
      }
      if(readyAt)assert.equal(p.OC.value,16,'residual gates never hold Ready low');
    };
    await p[operation]();
    while(d.idleWordTimePump)await d.idleWordTimePump;
    const expected=original.line.slice(),mz=original.mz.slice();
    for(let x=offset;x<108;++x){const old=expected[x];expected[x]=mz[x%4];mz[x%4]|=old;}
    assert.deepEqual(Array.from(d.line[19]),expected);
    assert.deepEqual(Array.from(d.MZ),mz);
    assert.equal(d.drumTime,cancelAt+108-offset);
    assert.equal(readyAt,cancelAt);
    assert.equal(d.timingActive,false);
    ++cases;
  }
 }
}
console.log(`${cases} real-controller Ready-high residual data/timing cases passed`);
// CPU drives the clock and starts a new input operation as soon as Ready rises.
// This also verifies old coroutine cleanup cannot overwrite the new OC.
{
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 const device={cancel(){},write(){},makeBusy(){},read(){}};
 p.devices={typewriter:device,paperTapePunch:device};p.transferDriver=async()=>{};
 d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
 d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
 d.line[19].set(Array.from({length:108},(_,i)=>2*(i+1)));
 await d.procStart();
 const output=p.typeAR();let original;
 while(d.drumTime<650)await d.waitFor(1);
 original={line:Array.from(d.line[19]),mz:Array.from(d.MZ)};
 await p.initiateIO(0);
 assert.equal(p.OC.value,16);
 await p.initiateIO(12); // input removes FAST-OUT before any later word
 assert.equal(p.OC.value,12);
 await d.waitFor(2);
 await output;
 assert.equal(p.OC.value,12,'old output must not finish new input');
 assert.deepEqual(Array.from(d.line[19]),original.line,'new input disables residual FAST-OUT gate');
 assert.deepEqual(Array.from(d.MZ),original.mz);
 assert.equal(d.wordTimeHook,null);
 d.procStop();
}
console.log('Ready permits immediate new input without clock or OC ownership collision');
// The old ioStop can find a CPU waiting for a word; its immediate wakeup step
// must already see Ready/FAST-OUT and apply the first residual word.
{
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 const device={cancel(){},write(){},makeBusy(){}};p.devices={typewriter:device,paperTapePunch:device};
 p.transferDriver=async()=>{};d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
 d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
 d.line[19].set(Array.from({length:108},(_,i)=>2*(i+1)));
 let captured,sawWaiting=false;
 const stop=d.ioStop.bind(d);
 d.ioStop=caption=>{if(captured&&d.procSync.waiting)sawWaiting=true;return stop(caption)};
 const step=d.stepDrum.bind(d);
 d.stepDrum=async()=>{await step();if(d.drumTime===650){
   captured={line:Array.from(d.line[19]),mz:Array.from(d.MZ)};
   await p.initiateIO(0);assert.equal(p.OC.value,16);
 }};
 await d.procStart();const output=p.typeAR();await d.waitFor(700);await output;
 const expected=captured.line.slice(),mz=captured.mz.slice();
 for(let x=2;x<108;++x){const old=expected[x];expected[x]=mz[x%4];mz[x%4]|=old;}
 assert.equal(sawWaiting,true,'fixture reaches ioStop with CPU waiting');
 assert.deepEqual(Array.from(d.line[19]),expected,'first tail word was not skipped');
 assert.deepEqual(Array.from(d.MZ),mz);
 d.procStop();
}
console.log('CPU-waiting cancellation applies the first residual word');
// Direct operator requests also wait for the canceled coroutine's cleanup.
for(const [key,expected] of [[-0x71,12],[-0x70,15],[-0x62,6]]){
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 const device={cancel(){},write(){},makeBusy(){},read(){}};
 p.devices={typewriter:device,paperTapePunch:device,paperTapeReader:{read:()=>new Promise(()=>{}),reverseBlock:()=>new Promise(()=>{})}};
 d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
 d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
 await d.procStart();const output=p.typeAR();while(d.drumTime<650)await d.waitFor(1);
 await p.executeKeyboardCommand(4);assert.equal(p.OC.value,16);
 await p.executeKeyboardCommand(key);await output;
 assert.equal(p.OC.value,expected,'manual S then operator command preserves new OC');
 if(d.procActive){await d.waitFor(1);d.procStop();}
 while(d.idleWordTimePump)await d.idleWordTimePump;
}
console.log('Manual S then Q/P/B hands off without old output clearing the new OC');
// A fresh slow-output command retires the old token. Its F/OF belongs to itself.
{
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 const device={cancel(){},write(){},makeBusy(){}};p.devices={typewriter:device,paperTapePunch:device};
 p.transferDriver=async()=>{};d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
 d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
 await d.procStart();const old=p.typeAR();while(d.drumTime<650)await d.waitFor(1);
 await p.initiateIO(0);d.line[3][3]=(1<<26)|(4<<23);
 await p.initiateIO(8);
 while(p.OC.value!==16)await d.waitFor(1);
 await old;await p.slowOutputCompletion;
 assert.equal(d.OF.value,4,'new output completes its own post-STOP SIGN');
 assert.equal(d.wordTimeHook,null);assert.equal(p.slowOutputResidue,null);
 d.procStop();
}
console.log('New slow output owns its own phase after a Ready tail');
// Power-down retires residual writes even if the idle clock already has a step.
{
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
 d.startTiming=()=>{d.timingActive=true};d.L.value=104;d.drumTime=104;
 await d.ioStart('old');p.installReadyOutputResidue();d.ioStop('old');
 const before=Array.from(d.line[19]);p.powerDown();
 while(d.idleWordTimePump)await d.idleWordTimePump;
 assert.deepEqual(Array.from(d.line[19]),before);assert.equal(d.wordTimeHook,null);
 assert.equal(d.timingActive,false);assert.equal(p.poweredOn,false);
}
console.log('Power-down retires the residual clock and storage writes');
// RESET retires the tail and awaits old cleanup before assigning the boot reader.
{
 const p=new Processor({config:{getNode:()=>false}}),d=p.drum;let reads=0;
 const device={cancel(){},write(){},makeBusy(){}};
 p.devices={typewriter:device,paperTapePunch:device,paperTapeReader:{async read(){++reads;return true;}}};
 p.transferDriver=async()=>{};d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
 d.line[3][3]=(3<<26)|(3<<23)|(1<<20)|(4<<17);
 await d.procStart();const old=p.typeAR();while(d.drumTime<650)await d.waitFor(1);
 await p.initiateIO(0);p.CH.value=1;
 await p.systemReset();await old;
 assert.equal(reads,2);assert.equal(p.OC.value,15);assert.equal(p.hungIO,true);
 assert.equal(d.wordTimeHook,null);assert.equal(p.slowOutputResidue,null);
 d.procStop();
}
console.log('RESET preserves the new boot-reader owner after retiring the tail');
