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

export type AnalyticsMetrics = {
    basic: BasicMetrics;
    load: LoadMetrics;
    steps: StepEvent[];
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

export function computeBasicMetrics(samples: Sample[], steps: StepEvent[]): BasicMetrics {
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
    // Simple integration of pressure over time per region
    // FSR mapping (approx): 0=Meta1, 1=Meta2, 2=Mid, 3=LatMid, 4=Heel

    let heelSum = 0;
    let forefootSum = 0; // Meta1 + Meta2
    let midSum = 0;      // Mid + LatMid

    let totalSum = 0;

    samples.forEach(s => {
        const f = s.fsr;
        // Forefoot: 0, 1
        const ff = (f[0] || 0) + (f[1] || 0);
        // Midfoot: 2, 3
        const mid = (f[2] || 0) + (f[3] || 0);
        // Heel: 4 (and heelraw if present)
        const heel = (f[4] || 0) + (s.heelraw || 0);

        forefootSum += ff;
        midSum += mid;
        heelSum += heel;
        totalSum += ff + mid + heel;
    });

    if (totalSum === 0) {
        return { heelPct: 0, forefootPct: 0, medialPct: 0, lateralPct: 0, dominantRegion: 'none' };
    }

    const heelPct = (heelSum / totalSum) * 100;
    const forefootPct = (forefootSum / totalSum) * 100;

    // Medial vs Lateral is harder with this specific sensor layout without exact coordinates
    // But we can approximate: 
    // Medial: Meta1 (0), Mid (2), Arch (removed)
    // Lateral: Meta2 (1), LatMid (3)

    let medialSum = 0;
    let lateralSum = 0;

    samples.forEach(s => {
        const f = s.fsr;
        medialSum += (f[0] || 0) + (f[2] || 0);
        lateralSum += (f[1] || 0) + (f[3] || 0);
    });

    const mlTotal = medialSum + lateralSum;
    const medialPct = mlTotal > 0 ? (medialSum / mlTotal) * 100 : 0;
    const lateralPct = mlTotal > 0 ? (lateralSum / mlTotal) * 100 : 0;

    let dominantRegion = 'balanced';
    if (heelPct > 50) dominantRegion = 'heel';
    else if (forefootPct > 50) dominantRegion = 'forefoot';

    return {
        heelPct,
        forefootPct,
        medialPct,
        lateralPct,
        dominantRegion
    };
}

export function computeAnalytics(samples: Sample[]): AnalyticsMetrics {
    const steps = detectSteps(samples);
    const basic = computeBasicMetrics(samples, steps);
    const load = computeLoadMetrics(samples);

    return {
        basic,
        load,
        steps
    };
}
