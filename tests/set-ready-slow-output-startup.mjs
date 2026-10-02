// Memo 39; TOO F-8w/x, F-17, drawings 52 and 60.
// Exercise real output coroutines with cancellation at deterministic word times.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM * 100);
let cases=0;
for (const manual of [false,true]) {
for (const operation of ['typeAR','typeLine19','punchLine19']) {
    // Typewriter's initial delay puts format at time216; punch format at108.
    const formatTime=operation==='punchLine19'?108:216;
    for (const cancelAt of [103,formatTime+1,formatTime+107,formatTime+109,formatTime+215,formatTime+217]) {
        for (const mz of [[0,0,0,0],[2,4,6,8]]) {
            const p=new Processor({config:{getNode:()=>false}});
            const d=p.drum;
            const output=[];
            const device={cancel(){},write(code){output.push(code)},makeBusy(){}};
            p.devices={typewriter:device,paperTapePunch:device};
            p.transferDriver=async()=>{};
            d.startTiming=()=>{d.timingActive=true};
            d.L.value=99; d.drumTime=99;
            d.line[19].set(Array.from({length:108},(_,i)=>2*(i+1)));
            d.MZ.set(mz);
            // PERIOD then END: no data shifting before cancellation.
            d.line[2][3]=d.line[3][3]=(3<<26)|(1<<23);
            let captured,readyTime;
            const step=d.stepDrum.bind(d);
            d.stepDrum=async()=>{
                await step();
                if(d.drumTime===cancelAt) {
                    captured={line:Array.from(d.line[19]),mz:Array.from(d.MZ)};
                    if(manual)await p.executeKeyboardCommand(4);
                    else await p.initiateIO(0);
                }
            };
            const finish=p.finishIO.bind(p);
            p.finishIO=()=>{finish();if(p.OC.value===16)readyTime=d.drumTime;};
            await p[operation]();
            while(d.ioActive) await new Promise(resolve=>setImmediate(resolve));
            const precess=(!manual && operation!=='typeAR')||cancelAt<formatTime+216;
            assert.ok(captured);
            const label=`manual=${manual} ${operation} cancel=${cancelAt}, MZ=${mz}`;
            const expected=captured.line.slice(),buffer=captured.mz.slice();
            let position=cancelAt%108,elapsed=0;
            const oe=cancelAt>=formatTime+108 && cancelAt<formatTime+216;
            if(precess){
                if(!oe)while(position!==0){buffer[position%4]=0;position=(position+1)%108;++elapsed;}
                do{
                    const old=expected[position];expected[position]=buffer[position%4];buffer[position%4]=old;
                    position=(position+1)%108;++elapsed;
                }while(position!==0);
            }
            assert.deepEqual(Array.from(d.line[19]),expected,label);
            assert.deepEqual(Array.from(d.MZ),buffer,label);
            if(precess)assert.equal(readyTime,cancelAt+elapsed,label);
            assert.equal(p.OC.value,16,label);
            // Punch emits its documented initial SPACE; cancellation emits no data.
            assert.equal(output.length,operation==='punchLine19'?(cancelAt<formatTime?0:cancelAt>formatTime+216?2:1):0,label);
            ++cases;
        }
    }
}
}
console.log(`${cases} SET READY slow-output startup/data/timing cases passed`);
