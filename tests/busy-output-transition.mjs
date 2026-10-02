// TOO F1/dwg45 OC set-only gates; F8/dwg52 live source/device selection.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
let cases=0;
for (const target of [9,10]) for (const changeAt of [103,218,300,330,450]) {
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
    p.transferDriver=async()=>{};p.warning=()=>{};
    const events=[];
    p.devices={typewriter:{cancel(){},write(code){events.push(['type',d.drumTime,code])}},
        paperTapePunch:{cancel(){},makeBusy(){},write(code){events.push(['punch',d.drumTime,code])}}};
    d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
    // DIGIT, END, SIGN. Keep line19 nonempty so cancellation can inspect it.
    d.line[2][3]=d.line[3][3]=(1<<23)|(4<<20);
    const original=Array.from({length:108},(_,i)=>(i+1)*2);
    d.line[19].set(original);d.AR.value=0x12345678;
    const originalAR=d.AR.value;
    let observed, activeF;
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{
        await step();
        if(d.drumTime===changeAt) await p.initiateIO(target);
        // First data F is324 if punched before initialG, otherwise432.
        const firstF=changeAt===103&&target===10?324:432;
        if(d.drumTime===firstF) {
            observed={line:Array.from(d.line[19]),ar:d.AR.value};activeF=firstF;
        }
        if(d.drumTime===550) await p.initiateIO(0);
    };
    await p.typeAR();while(d.ioActive)await new Promise(r=>setImmediate(r));
    // Independent one-word gate oracle, including a mid-data source change.
    const expected=original.slice();let carry=0,ar=originalAR;
    for(let x=0;x<108;++x){
        const time=activeF-108+x;
        if(time<changeAt){
            if(x===0){carry=ar>>>25;ar=(ar&0x1ffffff)<<4;}
        }else{
            const word=expected[x];expected[x]=((word&0x1ffffff)<<4)|carry;carry=word>>>25;
        }
    }
    assert.deepEqual(observed.line,expected,`OC${target} at${changeAt} live M19 gate`);
    assert.equal(observed.ar,ar,`OC${target} at${changeAt} AR gate`);
    if(target===10&&changeAt===450){
        assert.deepEqual(events,[['punch',540,originalAR>>>25|16]],'handoff emits prepared OB, not a new initial blank');
    }
    assert.equal(p.OC.value,16,'cancel completes Ready');++cases;
}
console.log(`${cases} busy slow-output source/device transitions passed`);
