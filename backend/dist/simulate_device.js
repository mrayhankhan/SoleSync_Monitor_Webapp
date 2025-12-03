"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const socket = (0, socket_io_client_1.io)('http://localhost:3000');
const sessionId = 'sim_' + Date.now();
const gatewayId = 'sim_gateway_01';
console.log('Starting simulation...');
socket.on('connect', () => {
    console.log('Connected to backend');
    startStreaming();
});
function startStreaming() {
    let t = 0;
    setInterval(() => {
        const now = Date.now();
        // Simulate Left Foot
        const leftRow = generateRow(now, 'left', t);
        // Simulate Right Foot
        const rightRow = generateRow(now, 'right', t); // Sync movements for easier comparison
        const csvChunk = `${leftRow}\n${rightRow}`;
        socket.emit('rawCSV', { csv: csvChunk, gatewayId, sessionId });
        t += 0.05; // Time step
    }, 50); // 20Hz
}
function generateRow(timestamp, foot, t) {
    // Radical Simulation Cycle (12s period)
    const cycle = t % 12;
    let accelX = 0, accelY = 0, accelZ = 0;
    let gyroX = 0, gyroY = 0, gyroZ = 0;
    // 1. Flat (0-3s) - STABLE
    if (cycle < 3) {
        accelZ = 9.81;
    }
    // 2. Pitch 90 (Toes Down) (3-6s) - STABLE
    else if (cycle < 6) {
        accelX = 9.81; // Gravity on X
        accelZ = 0;
    }
    // 3. Roll 90 (Outwards) (6-9s) - STABLE
    else if (cycle < 9) {
        accelY = 9.81; // Gravity on Y
        accelZ = 0;
    }
    // 4. Yaw Spin (9-12s) - ROTATING
    else {
        accelZ = 9.81;
        gyroZ = 3.0; // Fast spin around Z
    }
    // FSR (Pressure) - Pulse during Flat phase
    const pressure = cycle < 3 ? 500 + Math.sin(t * 5) * 500 : 0;
    const fsr = [pressure, pressure, pressure, pressure, pressure];
    const heel = pressure;
    return `${new Date(timestamp).toISOString()},sole001,${foot},${accelX.toFixed(3)},${accelY.toFixed(3)},${accelZ.toFixed(3)},${gyroX.toFixed(3)},${gyroY.toFixed(3)},${gyroZ.toFixed(3)},${fsr[0]},${fsr[1]},${fsr[2]},${fsr[3]},${fsr[4]},${heel},3.7`;
}
