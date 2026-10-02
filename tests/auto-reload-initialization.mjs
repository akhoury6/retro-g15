// TOO F-4p; drawings66 (C1 sets OY) and68 (IN.OY writes old23 to MZ).
import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM * 100);
for (const start of [0, 1, 2, 3, 53, 107]) {
    const d = new Drum();
    const old23 = [0x1234567, 0x1fffffff, 0, 0x10000001];
    const old19 = Array.from({length:108}, (_, i) => i * 37 + 2);
    d.line[23].set(old23);
    d.line[19].set(old19);
    d.MZ.set([9, 8, 7, 6]);
    await d.ioStart('auto init regression');
    d.L.value = start;
    const before = d.drumTime;
    await d.ioInitialize23ForAutoReload();
    d.ioStop('auto init regression');
    assert.deepEqual(Array.from(d.MZ), old23, `old23 enters MZ, start=${start}`);
    assert.deepEqual(Array.from(d.line[23]), [1, 0, 0, 0], 'new marker only');
    assert.deepEqual(Array.from(d.line[19]), old19, 'C1 alone does not set OD');
    assert.equal(d.drumTime-before, (4-start%4)%4+4, 'align to next quartet and copy four words');
}
console.log('PASS: 6 automatic initialization data/timing cases');
