// TOO F8z PDF93 / drawing52 PDF156: OG starts at T2 of word00.
import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM * 100);
let cases = 0;
for (const start of [0, 1, 107]) {
    for (const bit of [0, 1]) {
        for (const load of [false, true]) {
            const drum = new Drum();
            const originalMZ = [0x01234560 | bit, 0x12345678, 0x1abcdef0, 0x1fedcba9];
            const originalLine = [0x1fffffff, 0x1234567, 0x0abcdef0, 0x10000000];
            drum.MZ.set(originalMZ);
            drum.line[2].set(originalLine);
            await drum.ioStart('format T1 regression');
            drum.L.value = start;
            const time = drum.drumTime;
            const src = load ? originalLine : originalMZ;
            const code = load ? await drum.ioPrecessLongLineToMZ(2, 3) : await drum.ioPrecessMZToCode(3);
            assert.equal(drum.MZ[0] & 1, bit, 'MZ00 T1 must retain its own original value');
            assert.equal(code, src[3] >>> 26, 'high format code remains unchanged');
            for (let i = 0; i < 4; i++) {
                const expected = (((src[i] & (i ? Util.wordMask : Util.wordMask & ~1)) << 3) & Util.wordMask) | (i ? src[i-1] >>> 26 : bit);
                assert.equal(drum.MZ[i], expected, `format shift word ${i}`);
            }
            assert.deepEqual(Array.from(drum.line[2].slice(0, 4)), originalLine, 'format source is nondestructive');
            assert.equal(drum.drumTime-time, (108-start)%108+4, 'format transfer remains four word times');
            drum.ioStop('format T1 regression');
            ++cases;
        }
    }
}
console.log(`${cases} slow-output MZ T1/data/timing cases passed`);
