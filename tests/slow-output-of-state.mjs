import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM * 100);
const make = () => new Processor({config:{getNode:()=>false}});
// Input E boundaries: OF1/2 clear; only digit/WAIT or CR/TAB change OF3.
for (const [code, expected] of [[0x11,0],[7,0],[2,1],[3,1],[1,1],[5,1],[6,1]]) {
    const p=make(); p.OC.value=12; p.drum.OF.value=7;
    await p.receiveInputCode(code);
    if (p.ioPrecession) await p.ioPrecession;
    assert.equal(p.drum.OF.value,expected,`input code ${code}`);
}
for (let initial=0; initial<8; ++initial) {
    const p=make();p.drum.OF.value=initial;p.finishIO();
    assert.equal(p.drum.OF.value,initial&5,'Ready clears only OF2');
}
// TYPE's startup and inter-character delay set OF3 before the next extraction.
for (const operation of ['typeAR','typeLine19']) {
    const p=make(),d=p.drum,states=[];
    const device={write(){},makeBusy(){}};
    p.devices={typewriter:device,paperTapePunch:device};
    d.line[2][3]=d.line[3][3]=(0<<26)|(1<<23); // DIGIT, END
    d.AR.value=1<<28; d.line[19][107]=1<<28;
    const fetch=p.fetchSlowOutputFormat.bind(p);
    p.fetchSlowOutputFormat=async()=>{states.push(d.OF.value);return fetch()};
    await p[operation]();
    assert.deepEqual(states,[1,1,1],`${operation} TYPE delay OF3 before both extractions`);
}
// END with nonempty19 sets OF1, retaining RELOAD in the old register at reload.
{
    const p=make(),d=p.drum,states=[];
    d.line[19][107]=1<<28;d.line[2][3]=1<<26; // initial END
    const actual=p.fetchSlowOutputFormat.bind(p);
    p.fetchSlowOutputFormat=async()=>{states.push(d.OF.value);return actual()};
    p.devices={paperTapePunch:{makeBusy(){},write(code){
        if(code===5)d.line[2][3]=1<<23; // next format DIGIT, END
    }}};
    await p.punchLine19();
    assert.deepEqual(states,[0,5,0,1],'converted END feeds RELOAD back through MZ');
}
console.log('15 OF input/Ready boundaries and 3 slow-output state sequences passed');
