let simulationInterval: NodeJS.Timeout | null = null;

export function startSimulation(onData: (csvChunk: string, gatewayId: string, sessionId: string) => void) {
    if (simulationInterval) {
        console.log('Simulation already running');
        return;
    }

    const sessionId = 'sim_' + Date.now();
    const gatewayId = 'sim_gateway_01';
    let t = 0;

    console.log('Starting internal simulation...');

    simulationInterval = setInterval(() => {
        const now = Date.now();
        // Simulate Left Foot
        const leftRow = generateRow(now, 'left', t);
        // Simulate Right Foot
        const rightRow = generateRow(now, 'right', t);

        const csvChunk = `${leftRow}\n${rightRow}`;

        onData(csvChunk, gatewayId, sessionId);
        t += 0.05; // Time step
    }, 50); // 20Hz
}

export function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        console.log('Simulation stopped');
    }
}

function generateRow(timestamp: number, foot: 'left' | 'right', t: number): string {
    // Realistic Walking Cycle (1.2s period)
    const cycleDuration = 1.2;
    // Offset right foot by 50% of cycle
    const timeOffset = foot === 'right' ? cycleDuration / 2 : 0;
    const localT = (t + timeOffset) % cycleDuration;
    const phase = localT / cycleDuration; // 0.0 to 1.0

    let accelX = 0, accelY = 0, accelZ = 9.81;
    let gyroX = 0, gyroY = 0, gyroZ = 0;
    const fsr = [0, 0, 0, 0, 0];
    let heel = 0;

    // Gait Phases
    if (phase < 0.2) {
        // 1. Heel Strike (0-20%)
        accelX = 2.0;
        accelZ = 12.0;
        accelX = 9.81 * Math.sin(20 * Math.PI / 180);
        accelZ = 9.81 * Math.cos(20 * Math.PI / 180);
        heel = 900;
    } else if (phase < 0.5) {
        // 2. Mid-Stance (20-50%)
        accelX = 0;
        accelZ = 9.81;
        heel = 200;
        fsr[3] = 600;
        fsr[4] = 600;
        fsr[2] = 300;
    } else if (phase < 0.7) {
        // 3. Toe-Off (50-70%)
        accelX = 9.81 * Math.sin(-30 * Math.PI / 180);
        accelZ = 9.81 * Math.cos(-30 * Math.PI / 180);
        heel = 0;
        fsr[0] = 900;
        fsr[1] = 800;
        fsr[2] = 800;
        fsr[3] = 100;
        fsr[4] = 100;
    } else {
        // 4. Swing (70-100%)
        accelX = 5.0;
        accelZ = 9.81;
        heel = 0;
    }

    return `${new Date(timestamp).toISOString()},sole001,${foot},${accelX.toFixed(3)},${accelY.toFixed(3)},${accelZ.toFixed(3)},${gyroX.toFixed(3)},${gyroY.toFixed(3)},${gyroZ.toFixed(3)},${fsr[0].toFixed(0)},${fsr[1].toFixed(0)},${fsr[2].toFixed(0)},${fsr[3].toFixed(0)},${fsr[4].toFixed(0)},${heel.toFixed(0)},3.7`;
}
