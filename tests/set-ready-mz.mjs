// SET READY uses the M19 <-> MZ exchange, not a zero-filled shift.
// TOO F-17 (PDF 98), F-10d (PDF 95), Drawing 60 (PDF 164).
import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';

Util.setTiming(Util.defaultRPM * 100);
for (const start of [0, 1, 53, 107]) {
    for (const initialMZ of [[0, 0, 0, 0], [1, 0x1fffffff, 0x1234567, 0x10000000]]) {
        const drum = new Drum();
        const initial19 = Array.from({length: 108}, (_, i) => (i + 1) * 2);
        drum.line[19].set(initial19);
        drum.MZ.set(initialMZ);
        await drum.ioStart('SET READY regression');
        drum.L.value = start;
        const before = drum.drumTime;
        await drum.ioPrecess19ToMZ();
        drum.ioStop('SET READY regression');
        assert.deepEqual(Array.from(drum.line[19]), [...initialMZ, ...initial19.slice(0, 104)],
            `MZ must enter low words, start=${start}`);
        assert.deepEqual(Array.from(drum.MZ), initial19.slice(104), 'old high words must enter MZ');
        assert.equal(drum.drumTime - before, (108 - start) % 108 + 108,
            'wait for T0, then exchange for 108 word times');
    }
}
console.log('8 SET READY MZ exchange/data/timing cases passed');
