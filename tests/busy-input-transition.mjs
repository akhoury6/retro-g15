// TOO F-2a, Drawing45; Technical Applications Memo99 (30Apr1963), p1.
// A busy TYPE IN can become PHOTO READ without clearing AS or input state.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as IOCodes from '../emulator/IOCodes.js';
const p = new Processor({config: {getNode: () => false}});
p.transferDriver = async () => {};
p.warning = () => {};
let reads = 0, cancellations = 0, finishes = 0;
let completeRead;
p.devices = {
    typewriter: {
        readEnabled: false,
        read() { this.readEnabled = true; },
        cancel() {
            ++cancellations;
            this.readEnabled = false;
            p.cancelTypeIn();  // Real Typewriter.cancel has this callback.
        },
    },
    paperTapeReader: {
        read() {
            ++reads;
            return new Promise(resolve => { completeRead = resolve; });
        },
    },
};
const finishIO = p.finishIO.bind(p);
p.finishIO = () => { ++finishes; finishIO(); };
// First command in Memo99's sequence is C5 S12 (C1 is the S/D bit).
let completeInit;
let initializationCount = 0;
p.drum.ioStart = async () => {};
p.drum.ioStop = () => {};
p.drum.ioInitialize23ForAutoReload = () => {
    ++initializationCount;
    return new Promise(resolve => { completeInit = resolve; });
};
p.OC.value = IOCodes.ioCmdReady;
p.C1.value = 1;
await p.initiateIO(IOCodes.ioCmdTypeIn);
assert.equal(p.AS.value, 1);
assert.equal(initializationCount, 1);
const initialization = p.ioAutoReloadInit;
p.C1.value = 0;
p.OS.value = 1;
p.drum.line[23].set([0x123, 0x456, 0x789, 0xabc]);
const initial23 = Array.from(p.drum.line[23]);
await p.initiateIO(IOCodes.ioCmdTypeIn);
assert.equal(p.OC.value, IOCodes.ioCmdTypeIn);
assert.equal(p.devices.typewriter.readEnabled, true);
assert.equal(cancellations, 0);
assert.equal(reads, 0);
assert.equal(p.duplicateIO, false, 'reasserting TYPE IN does not queue an output reload');
await p.initiateIO(IOCodes.ioCmdPTRead);
assert.equal(p.OC.value, IOCodes.ioCmdPTRead);
assert.equal(p.AS.value, 1);
assert.equal(p.OS.value, 1);
assert.equal(p.ioAutoReloadInit, initialization, 'keep in-flight marker initialization');
assert.equal(initializationCount, 1, 'C0 transition must not reinitialize line23');
assert.deepEqual(Array.from(p.drum.line[23]), initial23);
assert.equal(p.devices.typewriter.readEnabled, false);
assert.equal(cancellations, 1);
assert.equal(reads, 1);
assert.equal(finishes, 0, 'switch device without any Ready interval');
assert.equal(p.activeIODevice, p.devices.paperTapeReader);
for (const s of [IOCodes.ioCmdPTRead, IOCodes.ioCmdTypeIn, IOCodes.ioCmdPTRead]) {
    await p.initiateIO(s);
    assert.equal(p.OC.value, IOCodes.ioCmdPTRead, 'OR cannot clear OC low bits');
    assert.equal(reads, 1, 'do not start another asynchronous reader');
    assert.equal(p.AS.value, 1);
    assert.equal(p.OS.value, 1);
    assert.equal(finishes, 0);
}
completeInit();
completeRead(false);
await Promise.resolve();
assert.equal(finishes, 1);
assert.equal(p.OC.value, IOCodes.ioCmdReady);
assert.equal(p.AS.value, 0);
console.log('PASS: busy input OR transition, state retention, duplicate reader, completion');
