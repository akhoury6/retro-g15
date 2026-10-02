import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
const make=()=>{const d=new Drum();d.startTiming=()=>{d.timingActive=true};d.L.value=104;d.drumTime=104;return d};
const settle=async d=>{while(d.idleWordTimePump)await d.idleWordTimePump};
for(const owner of ['idle','cpu','io-takeover','io-start-stop']){
    const d=make(),seen=[];let ready=false,taken=false;
    await d.ioStart('old controller');
    d.wordTimeHook=()=>{assert.equal(ready,true,'Ready is not held by residual clock');seen.push(d.L.value);return d.L.value!==107};
    if(owner==='cpu')await d.procStart();
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{
        await step();
        if(!taken&&owner.startsWith('io-')){
            taken=true;await d.ioStart('new owner');
            if(owner==='io-start-stop')d.ioStop('new owner');
        }
    };
    d.ioStop('old controller');ready=true;
    if(owner==='cpu'){await d.waitFor(4);d.procStop();}
    else if(owner==='io-takeover'){
        await settle(d);
        assert.equal(d.ioActive,true);
        await d.ioWaitFor(108-d.L.value);d.ioStop('new owner');
    }
    await settle(d);
    assert.deepEqual(seen,[104,105,106,107],owner);
    assert.equal(d.drumTime,108,owner+' no duplicate word clocks');
    assert.equal(d.timingActive,false,owner+' stops after tail without owners');
}
console.log('4 residual-clock ownership/handoff cases passed');
