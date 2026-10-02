// Serial oracle: TOO F8w-z PDF93, drawing52 PDF156. OG gates T2..T116.
import assert from 'node:assert/strict';
import {Drum} from '../emulator/Drum.js';
import * as Util from '../emulator/Util.js';
Util.setTiming(Util.defaultRPM * 100);
function serial(source, initialMZ, initialOF) {
    const result = initialMZ.slice();
    let of = initialOF;
    for (let pulse = 1; pulse < 116; ++pulse) {
        const w = Math.floor(pulse / 29), b = pulse % 29;
        const incoming = (source[w] >>> b) & 1;
        result[w] = (result[w] & ~(1 << b)) | ((of & 1) << b);
        of = (of >>> 1) | (incoming << 2);
    }
    return {words: result, of};
}
// Seed every OF state explicitly; Ready does not clear every OF stage.
for (const initialOF of [0, 1, 2, 3, 4, 5, 6, 7]) {
for (const load of [false, true]) {
    const drum = new Drum();
    const mz = [1, 0x1234567, 0x1abcdef0, 0x1fedcba9];
    const line = [0x1fffffff, 0x1234567, 0x0abcdef0, 0x10000000];
    drum.MZ.set(mz);
    drum.OF.value = initialOF;
    drum.line[2].set(line);
    const source = load ? line : mz;
    const expected = serial(source, mz, initialOF);
    await drum.ioStart('OF serial oracle');
    const code = load ? await drum.ioPrecessLongLineToMZ(2, 3) : await drum.ioPrecessMZToCode(3);
    assert.equal(code, expected.of, 'OF receives final three source bits');
    assert.deepEqual(Array.from(drum.MZ), expected.words, 'MZ receives old OF through three stages; source T1 is not sampled');
    drum.ioStop('OF serial oracle');
}
}
console.log('16 slow-output serial OF-tail cases passed');
