// Drawings60/61: OD/!OE clears passing MZ; OD/OE exchanges until F.
import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
let cases=0;
for(const oe of [0,1])for(const start of [0,1,53,103,104,105,106,107]){
    const d=new Drum();d.startTiming=()=>{d.timingActive=true};
    d.L.value=start;d.drumTime=start;
    const line=Array.from({length:108},(_,i)=>(i+1)*2),mz=[101,202,303,404];
    d.line[19].set(line);d.MZ.set(mz);
    const expected=line.slice(),buffer=mz.slice();
    let position=start,elapsed=0;
    if(!oe)while(position!==0){buffer[position%4]=0;position=(position+1)%108;++elapsed;}
    do{
        const old=expected[position];expected[position]=buffer[position%4];buffer[position%4]=old;
        position=(position+1)%108;++elapsed;
    }while(position!==0);
    await d.ioStart('phase cancellation');await d.ioCompleteSetReady(oe);d.ioStop('phase cancellation');
    assert.deepEqual(Array.from(d.line[19]),expected,`OE${oe} WT${start}`);
    assert.deepEqual(Array.from(d.MZ),buffer);
    assert.equal(d.drumTime,start+elapsed);
    ++cases;
}
console.log(`${cases} OD/OE preclear and partial-exchange cases passed`);
