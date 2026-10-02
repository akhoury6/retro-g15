// Theory of Operation C-7b, C-8, C-12d, drawings 26 and 34.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
const p = new Processor({config: {getNode: () => false}});
let cases = 0;
function configure(d, sd=0) {
    p.S.value=0; p.D.value=d; p.C.value=3; p.C1.value=sd; p.CS.value=1;
    p.drum.PN[0].value=0x1234; p.drum.PN[1].value=0x5678;
    p.dpCarry=0; p.dpEvenSign=0; p.suppressMinus0=false;
}
function transfer(d) { if (d===25) p.transferToID(); else p.transferToMQPN(d); }
for (const d of [24,25,26]) for (const wt of [2,3])
for (const negative of [false,true]) for (const oldAR of [0x2468,0x2469]) for (const ip of [0,1]) {
    configure(d);
    p.drum.L.value=wt; p.drum.AR.value=oldAR; p.IP.value=ip;
    p.drum.line[0][wt]=negative?11:10;
    transfer(d);
    const label=`D=${d}, WT=${wt}, negative=${negative}, oldAR=${oldAR}, IP=${ip}`;
    assert.equal(p.drum.read(d), wt%2 ? oldAR : 0, label);
    assert.equal(p.drum.AR.value, negative?0x1ffffff7:10, label);
    assert.equal(p.IP.value, ip, label);
    if(d!==26) assert.deepEqual(p.drum.PN.map(r=>r.value),[0x1234,0x5678],label);
    ++cases;
}
// DP complementation must carry from an all-zero low half into the high
// half, while the previous AR value is discarded at the even destination.
for (const d of [24,25,26]) for (const low of [1,11]) {
    configure(d,1); p.IP.value=1; p.drum.AR.value=0x2469;
    p.drum.L.value=2; p.drum.line[0][2]=low; transfer(d);
    assert.equal(p.drum.read(d),0);
    const convertedLow=p.drum.AR.value;
    p.drum.L.value=3; p.drum.line[0][3]=8; transfer(d);
    assert.equal(p.drum.read(d),convertedLow);
    assert.equal(p.drum.AR.value, low===1 ? 0x1ffffff8 : 0x1ffffff7);
    assert.equal(p.IP.value,1);
    ++cases;
}
// S=28 makes CH=3 genuine SU, not AVA; retain that path for PN.
configure(26);p.S.value=28;p.CS.value=0;p.drum.L.value=2;p.drum.AR.value=10;
transfer(26);assert.equal(p.drum.PN[0].value,0x1ffffff7);assert.equal(p.drum.AR.value,10);++cases;
console.log(`PASS: ${cases} AVA/SU two-word-register cases`);
