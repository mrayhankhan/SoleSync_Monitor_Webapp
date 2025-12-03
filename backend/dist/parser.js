"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsvChunk = parseCsvChunk;
function parseCsvChunk(csvChunk, sessionId) {
    const lines = csvChunk.split('\n');
    const samples = [];
    for (const line of lines) {
        if (!line.trim() || line.startsWith('timestamp'))
            continue; // Skip empty or header
        const parts = line.split(',');
        if (parts.length < 15)
            continue; // Invalid row
        try {
            // 2025-11-24T14:32:10.123Z,sole001,left,0.01,-0.98,9.81,0.002,0.001,0.0005,120,150,80,90,110,512,3.7
            const timestamp = new Date(parts[0]).getTime();
            const deviceId = parts[1];
            const foot = parts[2].toLowerCase();
            const accel = {
                x: parseFloat(parts[3]),
                y: parseFloat(parts[4]),
                z: parseFloat(parts[5])
            };
            const gyro = {
                x: parseFloat(parts[6]),
                y: parseFloat(parts[7]),
                z: parseFloat(parts[8])
            };
            const fsr = [
                parseFloat(parts[9]),
                parseFloat(parts[10]),
                parseFloat(parts[11]),
                parseFloat(parts[12]),
                parseFloat(parts[13])
            ];
            const heelRaw = parseFloat(parts[14]);
            const voltage = parts[15] ? parseFloat(parts[15]) : undefined;
            const temperature = parts[16] ? parseFloat(parts[16]) : undefined;
            samples.push({
                timestamp,
                deviceId,
                foot,
                accel,
                gyro,
                fsr,
                heelRaw,
                voltage,
                temperature,
                sessionId
            });
        }
        catch (e) {
            console.warn('Failed to parse line:', line, e);
        }
    }
    return samples;
}
