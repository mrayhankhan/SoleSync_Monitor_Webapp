"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSamples = processSamples;
const ahrs_1 = __importDefault(require("ahrs"));
const deviceStates = {};
function getDeviceState(deviceId) {
    if (!deviceStates[deviceId]) {
        deviceStates[deviceId] = {
            madgwick: new ahrs_1.default({ sampleInterval: 10, algorithm: 'Madgwick', beta: 0.1 }), // Assume ~100Hz for now, can be dynamic
            lastStepTime: 0,
            stepCount: 0
        };
    }
    return deviceStates[deviceId];
}
function processSamples(samples) {
    return samples.map(sample => {
        const state = getDeviceState(sample.deviceId);
        // 1. Orientation (AHRS)
        // Madgwick expects rad/s for gyro and g for accel (or raw, but units matter for beta)
        // Assuming input: Accel in g, Gyro in rad/s
        state.madgwick.update(sample.gyro.x, sample.gyro.y, sample.gyro.z, sample.accel.x, sample.accel.y, sample.accel.z);
        const q = state.madgwick.getQuaternion();
        const euler = state.madgwick.getEulerAngles(); // returns { heading, pitch, roll } in radians
        // 2. Step Counting (Simple Peak Detection on Accel Z or Total Accel)
        // Very basic implementation: Peak > 1.2g and debounce
        const accelMag = Math.sqrt(sample.accel.x ** 2 + sample.accel.y ** 2 + sample.accel.z ** 2);
        let isStep = false;
        if (accelMag > 1.2 && (sample.timestamp - state.lastStepTime > 300)) {
            state.stepCount++;
            state.lastStepTime = sample.timestamp;
            isStep = true;
        }
        // 3. Gait Phase (Simple FSR threshold)
        const totalPressure = sample.fsr.reduce((a, b) => a + b, 0) + sample.heelRaw;
        const gaitPhase = totalPressure > 100 ? 'stance' : 'swing'; // Threshold needs calibration
        return {
            ...sample,
            orientation: {
                yaw: euler.heading,
                pitch: euler.pitch,
                roll: euler.roll,
                quaternion: q
            },
            isStep,
            stepCount: state.stepCount,
            gaitPhase
        };
    });
}
