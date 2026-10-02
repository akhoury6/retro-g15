// TOO F8y, drawings52/55: F resets OD, RELOAD·F or a later DS·S2 sets it.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
for (const kind of ['reload','duplicate']) {
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
    p.transferDriver=async()=>{};p.warning=()=>{};
    const output=[];const device={cancel(){},write(c){output.push(c)},makeBusy(){}};
    p.devices={typewriter:device,paperTapePunch:device};
    d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
    d.line[3][3]=(kind==='reload'?5:3)<<26;
    d.line[19].set(Array.from({length:108},(_,i)=>i+1));
    d.MZ.set([2,4,6,8]);
    let original;const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{
        await step();
        if(kind==='duplicate' && d.drumTime===440) await p.initiateIO(8);
        if(d.drumTime===450) {
            original={line:Array.from(d.line[19]),mz:Array.from(d.MZ)};
            await p.initiateIO(0);
        }
    };
    await p.typeAR();
    while(d.ioActive)await new Promise(r=>setImmediate(r));
    assert.deepEqual(Array.from(d.line[19]),[0,0,0,0,...original.line.slice(0,104)],kind);
    assert.equal(d.drumTime,648,kind+' Ready second followingT0');
    assert.deepEqual(output,[],kind+' no character before cancellation');
}
// Drawings52/55: OG format beginsT0, OE data beginsnextT0, F occursnextT0.
// All eight formats use that full second cycle even when AR data takes1WT.
for(let fmt=0;fmt<8;++fmt){
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
    d.startTiming=()=>{d.timingActive=true};d.L.value=4;d.drumTime=4;
    await d.ioStart('data cycle');
    await p.formatOutputCharacter(fmt,p.boundIOPrecessARToCode);
    assert.equal(d.drumTime,216,`fmt${fmt} ends at F`);
    d.ioStop('data cycle');
}
console.log('2 OD reload/duplicate cases and 8 format phase cases passed');
