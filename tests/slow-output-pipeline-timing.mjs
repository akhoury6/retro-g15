// Independent fixture from TOO F8u-ae and drawings54/55.
// Commands start WT99; FIRST eligible post-init T0 is absolute108.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM*100);
let cases=0;
for(const operation of ['punchLine19','typeAR','typeLine19']) {
    for(const initialOF of [0,1]) {
        for(const copy of operation==='punchLine19'?[false]:[false,true]) {
            const p=new Processor({config:{getNode:()=>false}}),d=p.drum;
            const type=[],punch=[];
            p.devices={typewriter:{write:c=>type.push([d.drumTime,c])},
                paperTapePunch:{write:c=>punch.push([d.drumTime,c]),makeBusy(){}}};
            p.punchSwitch=copy?1:0;
            d.startTiming=()=>{d.timingActive=true};
            d.L.value=99;d.drumTime=99;d.OF.value=initialOF;
            // DIGIT, PERIOD, WAIT, END, SIGN (recommended post-END format).
            d.line[2][3]=d.line[3][3]=(3<<23)|(7<<20)|(1<<17)|(4<<14);
            d.AR.value=1<<28;d.line[19][107]=1<<28;
            d.MZ.set([1,0x1234567,0x1abcdef0,0x1fedcba9]);
            d.line[2][0]=d.line[3][0]=1;
            let fetches=0;
            const fetch=p.fetchSlowOutputFormat.bind(p);
            p.fetchSlowOutputFormat=async()=>{
                const old=Array.from(d.MZ), result=old.slice();
                const source=d.drumTime<p.slowOutputODUntil ?
                    Array.from(d.line[operation==='typeAR'?3:2].slice(0,4)) : old;
                let of=d.OF.value;
                for(let pulse=1;pulse<116;++pulse) {
                    const w=Math.floor(pulse/29),b=pulse%29;
                    result[w]=(result[w]&~(1<<b))|((of&1)<<b);
                    of=(of>>>1)|(((source[w]>>>b)&1)<<2);
                }
                const code=await fetch();
                assert.deepEqual(Array.from(d.MZ),result,'pipeline MZ matches serial gate oracle');
                assert.equal(code,of);
                ++fetches;
                return code;
            };
            await p[operation]();
            assert.equal(fetches,5,'includes post-STOP format fetch');
            const codes=[0x18,6,7,4];
            if(operation==='punchLine19') {
                assert.deepEqual(punch,[[108,0],...codes.map((c,i)=>[324+i*216,c])]);
                assert.equal(d.drumTime,1188,'Ready is next F after STOP execution');
            } else {
                const first=initialOF?540:648;
                const expected=codes.map((c,i)=>[first+i*324,c]);
                assert.deepEqual(type,expected,`${operation} OF=${initialOF} copy=${copy}`);
                assert.deepEqual(punch,copy?[[initialOF?108:216,0],...expected]:[]);
                assert.equal(d.drumTime,first+3*324+216,'final data phase precedes Ready');
            }
            assert.equal(d.OF.value,4,'post-STOP SIGN actually reaches OF');
            ++cases;
        }
    }
}
console.log(`${cases} independent slow-output pipeline timing cases passed`);

// Hold ENABLE across the first pending digit. OF timing continues, but G waits.
{
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum,events=[];
    p.devices={typewriter:{write:c=>events.push([d.drumTime,c])},paperTapePunch:{write(){},makeBusy(){}}};
    d.startTiming=()=>{d.timingActive=true}; d.L.value=99;d.drumTime=99;
    d.AR.value=1<<28;d.line[3][3]=(1<<23)|(4<<20); // DIGIT END SIGN
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{
        await step();
        if(d.drumTime===432)p.enableSwitch=1; // first F, digit already prepared
        if(d.drumTime===864)p.enableSwitch=0; // release at eligible T0
    };
    await p.typeAR();
    assert.deepEqual(events,[[864,0x18],[1188,4]],'ENABLE delays execute without discarding buffered digit');
    assert.equal(d.drumTime,1404);
}
console.log('ENABLE hold preserves buffered output and resumes at T0');
// SIGN samples at the DATA word00, after the format cycle's remaining104 words.
{
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum,events=[];
    p.devices={typewriter:{write:c=>events.push([d.drumTime,c])},paperTapePunch:{write(){},makeBusy(){}}};
    d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
    d.line[3][3]=(4<<26)|(1<<23)|(4<<20);
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{await step();if(d.drumTime===250)d.AR.value=1;};
    await p.typeAR();
    assert.equal(events[0][1],1,'negative AR sign changed after format fetch is sampled at data T1');
}
// END latches a encountered1; a CPU clear later in the scan cannot undo it.
{
    const p=new Processor({config:{getNode:()=>false}}),d=p.drum,events=[];
    p.devices={paperTapePunch:{write:c=>events.push([d.drumTime,c]),makeBusy(){}}};
    d.startTiming=()=>{d.timingActive=true};d.L.value=99;d.drumTime=99;
    d.line[2][3]=(1<<26)|(4<<23);d.line[19][0]=1;
    const step=d.stepDrum.bind(d);
    d.stepDrum=async()=>{await step();if(d.drumTime===217)d.line[19][0]=0;};
    await p.punchLine19();
    assert.deepEqual(events,[[108,0],[324,5],[540,4]],'nonzero seen before later CPU clear converts END to RELOAD');
    assert.equal(d.drumTime,756);
}
console.log('SIGN and END sample/latch at their documented data-cycle times');
