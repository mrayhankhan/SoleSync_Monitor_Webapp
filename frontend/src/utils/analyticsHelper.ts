export type Sample = {
    time: string; // ISO string from DB
    timestamp: number; // epoch ms (added for convenience)
    sessionid: string;
    deviceid: string;
    foot: 'left' | 'right';
    accel: { x: number, y: number, z: number };
    gyro: { x: number, y: number, z: number };
    fsr: number[]; // [fsr1, fsr2, fsr3, fsr4, fsr5]
    heelraw: number;
};

export type StepEvent = {
    foot: 'left' | 'right';
    startTime: number;    // ms
    endTime: number;      // ms
    peakTime: number;     // ms (heel strike)
    contactTime: number;  // ms
};

export type BasicMetrics = {
    stepCount: number;
    cadence: number; // steps/min
    avgContactTime: number; // ms
    stancePercent: number;  // %
};

export type LoadMetrics = {
    heelPct: number;
    forefootPct: number;
    medialPct: number;
    lateralPct: number;
    dominantRegion: string; // e.g. 'heel', 'forefoot', 'medial'
};

export type AsymmetryMetrics = {
    stepCountDiff: number;
    contactTimeSI: number; // symmetry index
    loadSI: number;
};

export type OrientationMetrics = {
    pitchRangeDeg: number;
    rollRangeDeg: number;
    pitchStdDeg: number;
    rollStdDeg: number;
};

export type Insight = {
    label: string;
    severity: 'info' | 'warn';
};

export type AnalyticsMetrics = {
    basic: BasicMetrics;
    load: LoadMetrics;
    steps: StepEvent[];
    asymmetry?: AsymmetryMetrics;
    orientation: OrientationMetrics;
    insights: Insight[];
};

const CONTACT_THRESH = 50; // tune this

export function detectSteps(samples: Sample[]): StepEvent[] {
    const steps: StepEvent[] = [];
    let inContact = false;
    let contactStart = 0;
    let peakValue = 0;
    let peakTime = 0;

    samples.forEach((s) => {
        const t = new Date(s.time).getTime();
        // Sum all FSRs + heel (though heel is 0 in 5-sensor setup, keeping for robustness)
        const fsrSum = s.fsr.reduce((a, b) => a + b, 0) + (s.heelraw || 0);

        if (!inContact && fsrSum >= CONTACT_THRESH) {
            // contact begins
            inContact = true;
            contactStart = t;
            peakValue = fsrSum;
            peakTime = t;
        } else if (inContact && fsrSum >= CONTACT_THRESH) {
            // still in contact, update peak
            if (fsrSum > peakValue) {
                peakValue = fsrSum;
                peakTime = t;
            }
        } else if (inContact && fsrSum < CONTACT_THRESH) {
            // contact ends = step done
            const contactEnd = t;
            const contactTime = contactEnd - contactStart;
            if (contactTime > 100) { // Filter very short blips
                steps.push({
                    foot: s.foot as 'left' | 'right',
                    startTime: contactStart,
                    endTime: contactEnd,
                    peakTime,
                    contactTime
                });
            }
            inContact = false;
        }
    });

    return steps;
}

export function computeBasicMetrics(steps: StepEvent[]): BasicMetrics {
    if (steps.length < 2) {
        return { stepCount: steps.length, cadence: 0, avgContactTime: 0, stancePercent: 0 };
    }

    const stepCount = steps.length;
    const totalTimeMs = steps[steps.length - 1].peakTime - steps[0].peakTime;
    // Cadence = steps / minutes. If totalTimeMs is for N steps, we can extrapolate.
    // Or just use the duration of the recording if we had it. Here we use time between first and last step.
    const cadence = totalTimeMs > 0 ? (stepCount / (totalTimeMs / 1000 / 60)) : 0;

    const avgContactTime =
        steps.reduce((sum, s) => sum + s.contactTime, 0) / steps.length;

    // approximate stance%: use mean time between consecutive peaks as "step time"
    const meanStepTimeMs =
        totalTimeMs / (steps.length - 1);

    const stancePercent = meanStepTimeMs > 0 ? (avgContactTime / meanStepTimeMs) * 100 : 0;

    return { stepCount, cadence, avgContactTime, stancePercent };
}

export function computeLoadMetrics(samples: Sample[]): LoadMetrics {
    let heelForce = 0;
    let forefootForce = 0;
    let medialForce = 0;
    let lateralForce = 0;

    for (const s of samples) {
        const h = s.heelraw ?? 0;
        // Mapping: fsr[0]=Meta1, fsr[1]=Meta2, fsr[2]=Mid, fsr[3]=LatMid, fsr[4]=Heel(Toe?)
        // User provided mapping: 
        // fsr1, fsr2 = forefoot medial (fsr[0], fsr[1]?) -> Wait, user said "fsr1, fsr2 = forefoot medial"
        // Let's assume standard mapping: 0=Meta1, 1=Meta2, 2=Mid, 3=LatMid, 4=Heel
        // User logic:
        // heelRaw = heel
        // fsr1, fsr2 = forefoot medial
        // fsr3, fsr4 = forefoot lateral
        // fsr5 = toe

        // My fsr array is 0-indexed. 
        // s.fsr[0] -> fsr1
        // s.fsr[1] -> fsr2
        // s.fsr[2] -> fsr3
        // s.fsr[3] -> fsr4
        // s.fsr[4] -> fsr5

        const f1 = s.fsr[0] ?? 0;
        const f2 = s.fsr[1] ?? 0;
        const f3 = s.fsr[2] ?? 0;
        const f4 = s.fsr[3] ?? 0;
        const f5 = s.fsr[4] ?? 0;

        const totalSampleForce = h + f1 + f2 + f3 + f4 + f5;
        if (totalSampleForce < CONTACT_THRESH) continue; // only during contact

        heelForce += h;
        forefootForce += f1 + f2 + f3 + f4 + f5;

        medialForce += f1 + f2 + f5; // example mapping
        lateralForce += f3 + f4;
    }

    const total = heelForce + forefootForce || 1;
    const totalML = medialForce + lateralForce || 1;

    const heelPct = (heelForce / total) * 100;
    const forefootPct = (forefootForce / total) * 100;
    const medialPct = (medialForce / totalML) * 100;
    const lateralPct = (lateralForce / totalML) * 100;

    let dominantRegion = 'balanced';
    if (heelPct > 60) dominantRegion = 'heel';
    else if (forefootPct > 60) dominantRegion = 'forefoot';
    else if (medialPct > 60) dominantRegion = 'medial';
    else if (lateralPct > 60) dominantRegion = 'lateral';

    return { heelPct, forefootPct, medialPct, lateralPct, dominantRegion };
}

function std(arr: number[]): number {
    if (!arr.length) return 0;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance =
        arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

export function computeOrientationMetrics(samples: Sample[]): OrientationMetrics {
    // Assuming accel/gyro can be converted to pitch/roll or are already processed.
    // Since we don't have explicit pitch/roll in Sample, we'll estimate or mock for now.
    // Ideally, the backend should provide AHRS data (pitch/roll).
    // For this implementation, let's assume we can derive rough pitch from accel (static tilt).
    // Pitch = atan2(accelX, sqrt(accelY^2 + accelZ^2))
    // Roll = atan2(accelY, accelZ)

    const pitchVals: number[] = [];
    const rollVals: number[] = [];

    for (const s of samples) {
        // Simple tilt calculation (radians to degrees)
        const pitch = Math.atan2(s.accel.x, Math.sqrt(s.accel.y * s.accel.y + s.accel.z * s.accel.z)) * (180 / Math.PI);
        const roll = Math.atan2(s.accel.y, s.accel.z) * (180 / Math.PI);

        pitchVals.push(pitch);
        rollVals.push(roll);
    }

    const pitchMin = Math.min(...pitchVals);
    const pitchMax = Math.max(...pitchVals);
    const rollMin = Math.min(...rollVals);
    const rollMax = Math.max(...rollVals);

    const pitchRangeDeg = pitchMax - pitchMin;
    const rollRangeDeg = rollMax - rollMin;

    const pitchStdDeg = std(pitchVals);
    const rollStdDeg = std(rollVals);

    return { pitchRangeDeg, rollRangeDeg, pitchStdDeg, rollStdDeg };
}

export function deriveInsights(load: LoadMetrics): Insight[] {
    const insights: Insight[] = [];

    if (load.heelPct > 65) {
        insights.push({ label: 'Primary heel striker', severity: 'info' });
    } else if (load.forefootPct > 65) {
        insights.push({ label: 'Primary forefoot striker', severity: 'info' });
    }

    if (load.medialPct > 60) {
        insights.push({ label: 'Medial loading tendency (pronation)', severity: 'warn' });
    } else if (load.lateralPct > 60) {
        insights.push({ label: 'Lateral loading tendency (supination)', severity: 'warn' });
    }

    return insights;
}

function symmetryIndex(a: number, b: number): number {
    return 100 * (b - a) / ((a + b) / 2 || 1);
}

export function computeAsymmetry(
    left: { basic: BasicMetrics; load: LoadMetrics },
    right: { basic: BasicMetrics; load: LoadMetrics }
): AsymmetryMetrics {
    const stepCountDiff = right.basic.stepCount - left.basic.stepCount;

    const contactTimeSI = symmetryIndex(
        left.basic.avgContactTime,
        right.basic.avgContactTime
    );

    // use total load proxy = heel+forefoot, but we only have %
    // This part of user logic is slightly flawed because % always sums to 100.
    // But let's follow user instruction: "const leftLoad = left.load.heelPct + left.load.forefootPct;"
    // Since heelPct + forefootPct is always 100 (or close to it), this SI will likely be 0.
    // Unless "total load proxy" meant raw force? 
    // The user code says: "const leftLoad = left.load.heelPct + left.load.forefootPct;"
    // I will implement exactly as requested.
    const leftLoad = left.load.heelPct + left.load.forefootPct;
    const rightLoad = right.load.heelPct + right.load.forefootPct;
    const loadSI = symmetryIndex(leftLoad, rightLoad);

    return { stepCountDiff, contactTimeSI, loadSI };
}

export function computeAnalytics(samples: Sample[]): AnalyticsMetrics {
    const steps = detectSteps(samples);
    const basic = computeBasicMetrics(steps);
    const load = computeLoadMetrics(samples);
    const orientation = computeOrientationMetrics(samples);
    const insights = deriveInsights(load);

    return {
        basic,
        load,
        steps,
        orientation,
        insights
    };
}

export function generateDemoData(): Sample[] {
    const samples: Sample[] = [];
    const duration = 60000; // 60s
    const sampleRate = 50; // ms
    const startTime = Date.now() - duration;

    for (let t = 0; t < duration; t += sampleRate) {
        const time = startTime + t;
        const isoTime = new Date(time).toISOString();

        // Generate for BOTH feet
        (['left', 'right'] as const).forEach(foot => {
            // Simulate steps: 1 step every 1000ms, stance duration 600ms
            // Offset right foot by 500ms for alternating gait
            const timeOffset = foot === 'right' ? 500 : 0;
            const stepCycle = (t + timeOffset) % 1000;
            const isStance = stepCycle < 600;

            // Asymmetry: Right foot has slightly higher force (+10%)
            const forceMultiplier = foot === 'right' ? 1.1 : 1.0;

            // FSR Pattern (Sine wave during stance)
            let fsr = [0, 0, 0, 0, 0];
            if (isStance) {
                const phase = Math.sin((stepCycle / 600) * Math.PI);
                const force = phase * 500 * forceMultiplier; // Max 500 * mult
                // Heel strike first, then toe off
                const heelFactor = stepCycle < 300 ? 1 : 0.2;
                const toeFactor = stepCycle > 300 ? 1 : 0.2;

                fsr = [
                    force * toeFactor * 0.8, // Meta1
                    force * toeFactor * 0.9, // Meta2
                    force * 0.5,             // Mid
                    force * 0.5,             // LatMid
                    force * heelFactor       // Heel
                ];
            }

            // Simulate Accel for Orientation (Pitching forward/back during step)
            // Pitch: -10 to +10 deg
            const pitchRad = (Math.sin((t + timeOffset) / 1000 * 2 * Math.PI) * 10) * (Math.PI / 180);
            // Roll: -5 to +5 deg
            const rollRad = (Math.cos((t + timeOffset) / 1000 * 2 * Math.PI) * 5) * (Math.PI / 180);

            // Convert pitch/roll back to accel vector (approx)
            // z = cos(pitch)cos(roll), x = sin(pitch), y = -sin(roll)
            const az = Math.cos(pitchRad) * Math.cos(rollRad) * 9.8;
            const ax = Math.sin(pitchRad) * 9.8;
            const ay = -Math.sin(rollRad) * 9.8;

            samples.push({
                time: isoTime,
                timestamp: time,
                sessionid: 'demo',
                deviceid: foot === 'left' ? 'sim-L' : 'sim-R',
                foot: foot,
                accel: { x: ax, y: ay, z: az },
                gyro: { x: 0, y: 0, z: 0 },
                fsr: fsr,
                heelraw: 0
            });
        });
    }
    return samples;
}
