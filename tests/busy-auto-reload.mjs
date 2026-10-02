// TOO drawing66 items11/32a: AS and OY command gates have no Ready qualifier.
// At word resolution, serialize four-word line23 operations at TF boundaries.
import assert from 'node:assert/strict';
import {Processor} from '../emulator/Processor.js';
import * as IO from '../emulator/IOCodes.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
const p = new Processor({config:{getNode:()=>false}});
p.warning = () => {};
p.OC.value = IO.ioCmdTypeIn;
p.C1.value = 1;
p.OS.value = 1;
let transfers = 0, initCount = 0, frameCount = 0, reloadCount = 0, active = false;
p.transferDriver = async () => { ++transfers; };
p.drum.ioStart = async () => { assert.equal(active, false, 'line23 operations cannot overlap'); active = true; };
p.drum.ioStop = () => { assert.equal(active, true); active = false; };
const frame1Started = deferred(), releaseFrame1 = deferred();
const initStarted = deferred(), releaseInit = deferred();
const line19 = deferred();
p.drum.ioPrecessCodeTo23 = async () => {
    ++frameCount;
    if (frameCount === 1) { frame1Started.resolve(); await releaseFrame1.promise; return 0; }
    return 1;  // second character makes an automatically reloaded quartet
};
p.drum.ioInitialize23ForAutoReload = async () => {
    ++initCount;
    if (initCount === 1) { initStarted.resolve(); await releaseInit.promise; }
};
p.drum.ioCopy23ToMZ = async auto => { assert.equal(auto, true); ++reloadCount; };
p.drum.ioPrecessMZTo19 = () => line19.promise;
const first = p.receiveInputCode(IO.ioDataMask | 1);
await frame1Started.promise;
await p.initiateIO(IO.ioCmdTypeIn);
assert.equal(transfers, 1, 'CPU transfer finishes while prior frame remains active');
assert.equal(p.AS.value, 1, 'busy C1 sets AS immediately');
assert.equal(initCount, 0, 'initialization waits for active quartet boundary');
assert.equal(p.OS.value, 1);
const second = p.receiveInputCode(IO.ioDataMask | 2);
releaseFrame1.resolve();
await first;
await initStarted.promise;
assert.equal(frameCount, 1, 'later frame waits for initialization');
releaseInit.resolve();
await second;
assert.equal(frameCount, 2);
assert.equal(reloadCount, 1, 'later frame observes newly enabled AS');
assert.equal(p.ioPrecession, line19.promise);
await p.initiateIO(IO.ioCmdTypeIn);
await p.ioAutoReloadInit;
assert.equal(initCount, 2, 'line19 precession is independent of line23 initialization');
assert.equal(transfers, 2);
assert.equal(p.OC.value, IO.ioCmdTypeIn);
line19.resolve();
console.log('PASS: busy C1 quartet ordering, deferred AS, CPU progress and independent line19');
