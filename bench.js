const ITERATIONS = 50000;
const SIZE = 24000;

function benchTypedArray() {
    let q = new Int32Array(SIZE);
    let start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        let qHead = 0, qLen = 0;
        // Simulate pushing
        for (let j = 0; j < 1000; j++) {
            q[qLen++] = (j << 16) | (j + 1);
        }
        // Simulate popping
        while (qLen > qHead) {
            let v = q[qHead++];
            let cx = v >>> 16 & 65535;
            let cy = 65535 & v;
        }
    }
    return performance.now() - start;
}

function benchNormalArray() {
    let q = []; // Reused array
    let start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        q.length = 0; // Clear without GC
        // Simulate pushing
        for (let j = 0; j < 1000; j++) {
            q.push(j, j + 1);
        }
        // Simulate popping
        let qHead = 0;
        let qLen = q.length;
        while (qLen > qHead) {
            let cx = q[qHead++];
            let cy = q[qHead++];
        }
    }
    return performance.now() - start;
}

console.log("Warming up V8...");
benchTypedArray();
benchNormalArray();

console.log("Running benchmarks...");
const taTime = benchTypedArray();
console.log(`TypedArray (Bitwise) time: ${taTime.toFixed(2)} ms`);

const naTime = benchNormalArray();
console.log(`Normal Array (Push/Flat) time: ${naTime.toFixed(2)} ms`);
