// TOO C16a, E9b-c/E10c, Drawing59: reserved107 and N display gating.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as Util from '../emulator/Util.js';
import * as IO from '../emulator/IOCodes.js';
Util.setTiming(Util.defaultRPM * 100);
let cases = 0;
for (const markPhase of [0, 37, 106, 107]) {
    const p = new Processor({config:{getNode:()=>false}});
    p.OC.value = IO.ioCmdReady;
    p.drum.L.value = markPhase;
    p.N.value = 73;
    p.T.value = 51;
    p.drum.CM.value = ((~51 & 127) << 21) | ((~12 & 127) << 13) | (29 << 1); // stale display N
    p.drum.AR.value = 0x1234567;
    p.drum.line[0].fill(0x2468);
    p.drum.line[1].fill(0x1357);
    const cm = ((~51 & 127) << 21) | ((~73 & 127) << 13) | (29 << 1);
    await p.executeKeyboardCommand(-0x6d);
    assert.equal(p.drum.line[0][107], cm ^ Util.wordMask);
    assert.equal(p.drum.line[1][107], 0x1234567);
    for (let n = 0; n < 107; ++n) {
        assert.equal(p.drum.line[0][n], 0x2468);
        assert.equal(p.drum.line[1][n], 0x1357);
    }
    p.drum.L.value = (markPhase + 17) % 108;
    p.drum.CM.value = 0;
    p.drum.AR.value = 0;
    p.N.value = 5;
    p.T.value = 7;
    await p.executeKeyboardCommand(-0x72);
    assert.equal(p.drum.CM.value, cm);
    assert.equal(p.drum.AR.value, 0x1234567);
    assert.equal(p.N.value, 73, 'restore effective next location, not only display CM');
    assert.equal(p.T.value, 51);
    // Confirm execution really resumes at the saved location, rather than
    // merely restoring a display register.
    p.drum.line[0][73] = (75 << 21) | (77 << 13) | (28 << 6) | (28 << 1);
    p.setCommandLine(0);
    await p.drum.procStart();
    await p.readCommand();
    p.drum.procStop();
    assert.equal(p.cmdLoc.value, 73);
    assert.equal(p.N.value, 77);
    assert.equal(p.S.value, 28);
    assert.equal(p.D.value, 28);
    ++cases;
}
for (const n of [0, 20, 73, 107]) for (const phase of [0, 37, 107]) {
    const p = new Processor({config:{getNode:()=>false}});
    p.OC.value = IO.ioCmdReady;
    p.N.value = n;
    p.drum.L.value = phase;
    p.drum.AR.value = 0x1f123456;
    await p.executeKeyboardCommand(-0x74);
    assert.equal(p.drum.AR.value >>> 21, n === 0 ? 0x94 : n);
    assert.equal(p.drum.AR.value & 0x1fffff, 0x123456);
    ++cases;
}
const p = new Processor({config:{getNode:()=>false}});
p.OC.value = IO.ioCmdTypeAR;
p.drum.AR.value = 0x1234567;
assert.equal(await p.executeKeyboardCommand(-0x74), 1, 'T is qualified by Ready');
assert.equal(p.drum.AR.value, 0x1234567);
console.log(`PASS: ${cases} operator mark/return/N-display cases and busy T gating`);
