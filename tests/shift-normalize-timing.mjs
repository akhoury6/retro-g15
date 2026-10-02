// Hardware timing: Theory of Operation pp.46, 60-61 and drawing 30.
// Run: node tests/shift-normalize-timing.mjs
import assert from "node:assert/strict";
import {Processor} from "../emulator/Processor.js";
const p = new Processor({config: {getNode: () => false}});
const cases = [
    ["shift AR termination", 26, 54, 0, 0x1fffffff, 2, 5],
    ["shift AR overflow", 26, 54, 0, 0x1ffffffe, 2, 5],
    ["shift AR/T-count tie", 26, 2, 0, 0x1fffffff, 2, 4],
    ["shift count only", 26, 2, 1, 0, 2, 4],
    ["normalize already normalized", 27, 54, 0, 0, 0x10000000, 3],
    ["normalize after one shift", 27, 54, 0, 0, 0x08000000, 5],
    ["normalize PM/T-count tie", 27, 2, 0, 0, 0x08000000, 4],
    ["normalize zero, count only", 27, 4, 0, 0, 0, 6],
];
for (const [name, source, count, characteristic, ar, mq, earliest] of cases) {
    // Model an immediate command read at L=1: transfer starts at WT 2.
    // Test N before, at, and after the earliest legal RC word.
    for (const n of [earliest-2, earliest-1, earliest, earliest+1]) {
        p.drum.procActive = true;
        p.drum.L.value = 2;
        p.drum.drumTime = 2;
        p.drum.eTime = 0;
        p.drum.eTimeSliceEnd = 1e9;
        p.T.value = count;
        p.C.value = characteristic;
        p.DI.value = 0;
        p.drum.AR.value = ar;
        p.drum.MQ[0].value = 0;
        p.drum.MQ[1].value = mq;
        p.drum.ID[0].value = p.drum.ID[1].value = 0;
        if (source == 26) await p.shiftMQLeftIDRight();
        else await p.normalizeMQ();
        assert.equal(p.drum.drumTime, earliest, name);
        p.N.value = n;
        p.CQ.value = p.CG.value = 0;
        p.setCommandLine(0);
        await p.readCommand();
        assert.equal(p.lastRCWordTime, n < earliest ? n+108 : n, `${name}, N=${n}`);
        if (name.startsWith("shift AR")) assert.equal(p.drum.AR.value, 0, name);
    }
}
console.log(`PASS: ${cases.length*4} shift/normalize RC timing cases`);
