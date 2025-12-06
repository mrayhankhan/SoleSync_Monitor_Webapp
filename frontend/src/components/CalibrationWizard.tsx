import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CalibrationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    side: 'left' | 'right';
    onComplete: (mapping: AxisMapping) => void;
    latestSample: any;
}

export interface AxisMapping {
    x: { index: 0 | 1 | 2, sign: 1 | -1 };
    y: { index: 0 | 1 | 2, sign: 1 | -1 };
    z: { index: 0 | 1 | 2, sign: 1 | -1 };
}

export const CalibrationWizard: React.FC<CalibrationWizardProps> = ({ isOpen, onClose, side, onComplete, latestSample }) => {
    const [step, setStep] = useState<number>(0); // 0: Intro, 1: Yaw, 2: Pitch, 3: Roll, 4: Complete
    const [isRecording, setIsRecording] = useState(false);
    const [recordedSamples, setRecordedSamples] = useState<any[]>([]);
    const [results, setResults] = useState<{
        yaw: { axis: 'x' | 'y' | 'z', sign: 1 | -1 } | null,
        pitch: { axis: 'x' | 'y' | 'z', sign: 1 | -1 } | null,
        roll: { axis: 'x' | 'y' | 'z', sign: 1 | -1 } | null
    }>({ yaw: null, pitch: null, roll: null });
    const [error, setError] = useState<string | null>(null);

    // Accumulate samples when recording
    useEffect(() => {
        if (isRecording && latestSample) {
            setRecordedSamples(prev => [...prev, latestSample]);
        }
    }, [latestSample, isRecording]);

    if (!isOpen) return null;

    const startRecording = () => {
        setRecordedSamples([]);
        setIsRecording(true);
        setError(null);
    };

    const stopRecording = () => {
        setIsRecording(false);
        processStepData();
    };

    const processStepData = () => {
        if (recordedSamples.length < 10) {
            setError("Not enough data. Please move the sensor as instructed.");
            return;
        }

        // Integrate Gyro Data
        let sumX = 0, sumY = 0, sumZ = 0;
        recordedSamples.forEach(s => {
            sumX += s.gyro.x;
            sumY += s.gyro.y;
            sumZ += s.gyro.z;
        });

        // Find dominant axis
        const absX = Math.abs(sumX);
        const absY = Math.abs(sumY);
        const absZ = Math.abs(sumZ);
        const max = Math.max(absX, absY, absZ);

        let axis: 'x' | 'y' | 'z';
        let sign: 1 | -1;

        if (max === absX) { axis = 'x'; sign = sumX > 0 ? 1 : -1; }
        else if (max === absY) { axis = 'y'; sign = sumY > 0 ? 1 : -1; }
        else { axis = 'z'; sign = sumZ > 0 ? 1 : -1; }

        console.log(`Step ${step} Result: Axis ${axis}, Sign ${sign}, Sums: ${sumX.toFixed(0)}, ${sumY.toFixed(0)}, ${sumZ.toFixed(0)}`);

        if (step === 1) { // Yaw (Rotate Right/CW) -> Expected +Z (Up) rotation? 
            // Wait, standard frame: Z is Up. Rotating CW (looking from top) is NEGATIVE Z?
            // Right Hand Rule: Thumb Up (Z). Fingers curl CCW.
            // So CW rotation is NEGATIVE Z.
            // Let's assume we want to map to Standard Body Frame:
            // X: Forward
            // Y: Right
            // Z: Up
            // Yaw Right (CW) = Rotation around Z? No, Yaw Left is +Z. Yaw Right is -Z.
            // Let's ask user to rotate "90 deg Left (CCW)" to match +Z?
            // Or just "Rotate 90 deg Clockwise" and expect -Z.
            // Let's stick to "Rotate 90 deg Clockwise" -> Expect -Z.
            // So if we detect +Axis, then Axis = -Z. If we detect -Axis, then Axis = +Z.
            // Wait, let's just map the DETECTED axis to the TARGET axis.
            // Target for Yaw (CW) is -Z (or just Z axis with -1 sign).

            // Actually, let's simplify.
            // Step 1: Yaw Left (CCW) -> +Z
            // Step 2: Pitch Up (Toe Up) -> +Y (if Y is Right) -> Pitch Up is rotation around Y?
            // X is Forward. Y is Right. Z is Up.
            // Pitch Up (Toe goes up) = Rotation around Y axis (Right).
            // Right Hand Rule on Y (Thumb Right): Fingers curl Up-Back-Down-Front.
            // So Pitch Up is +Y rotation.
            // Step 3: Roll Right -> +X rotation?
            // X is Forward. Thumb Forward. Fingers curl Right-Down-Left-Up.
            // So Roll Right is +X rotation.

            // So:
            // 1. Rotate Left 90° -> +Z
            // 2. Lift Toe 90° -> +Y
            // 3. Roll Right 90° -> +X

            setResults(prev => ({ ...prev, yaw: { axis, sign } }));
            setStep(2);
        } else if (step === 2) { // Pitch Up -> +Y
            setResults(prev => ({ ...prev, pitch: { axis, sign } }));
            setStep(3);
        } else if (step === 3) { // Roll Right -> +X
            setResults(prev => ({ ...prev, roll: { axis, sign } }));
            setStep(4);
        }
    };

    const finishCalibration = () => {
        // We have mappings for X, Y, Z rotations.
        // Yaw Result maps to Z axis.
        // Pitch Result maps to Y axis.
        // Roll Result maps to X axis.

        // results.yaw = { axis: 'y', sign: -1 } means raw -Y is acting as Z.
        // So Z_out = -Y_raw.

        // results.pitch = { axis: 'x', sign: 1 } means raw +X is acting as Y.
        // So Y_out = +X_raw.

        // results.roll = { axis: 'z', sign: 1 } means raw +Z is acting as X.
        // So X_out = +Z_raw.

        if (!results.yaw || !results.pitch || !results.roll) {
            setError("Incomplete calibration.");
            return;
        }

        const mapping: AxisMapping = {
            x: { index: results.roll.axis === 'x' ? 0 : results.roll.axis === 'y' ? 1 : 2, sign: results.roll.sign },
            y: { index: results.pitch.axis === 'x' ? 0 : results.pitch.axis === 'y' ? 1 : 2, sign: results.pitch.sign },
            z: { index: results.yaw.axis === 'x' ? 0 : results.yaw.axis === 'y' ? 1 : 2, sign: results.yaw.sign }
        };

        // TODO: Check orthogonality / duplicates?
        // If user messed up, we might map X and Y to the same raw axis.
        // Simple check: indices should be unique.
        const indices = new Set([mapping.x.index, mapping.y.index, mapping.z.index]);
        if (indices.size !== 3) {
            setError("Invalid movements detected. Axes must be unique. Try again.");
            setStep(1);
            setResults({ yaw: null, pitch: null, roll: null });
            return;
        }

        onComplete(mapping);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Calibrate {side === 'left' ? 'Left' : 'Right'} Sensor</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="mb-8">
                    {step === 0 && (
                        <div className="text-center">
                            <p className="text-gray-300 mb-4">
                                <b>Movement-Based Calibration</b>
                            </p>
                            <p className="text-gray-400 text-sm">
                                You will perform 3 rotations to identify the axes.
                                <br />
                                1. Rotate Left (Yaw)
                                <br />
                                2. Lift Toe (Pitch)
                                <br />
                                3. Roll Right (Roll)
                            </p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">🔄 ⬅️</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Step 1: Yaw</h4>
                            <p className="text-gray-300 mb-4">
                                Place shoe flat.
                                <br />
                                Rotate it <b>90° to the LEFT</b> (Counter-Clockwise).
                                <br />
                                <span className="text-sm text-gray-500">(Rotation around Vertical / Z axis)</span>
                            </p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">👟 ⬆️</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Step 2: Pitch</h4>
                            <p className="text-gray-300 mb-4">
                                Keep heel on ground.
                                <br />
                                Lift the <b>Toe UP 90°</b> (Vertical).
                                <br />
                                <span className="text-sm text-gray-500">(Rotation around Lateral / Y axis)</span>
                            </p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">👟 ➡️</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Step 3: Roll</h4>
                            <p className="text-gray-300 mb-4">
                                Keep flat.
                                <br />
                                Roll the shoe <b>90° to the RIGHT</b>.
                                <br />
                                <span className="text-sm text-gray-500">(Rotation around Forward / X axis)</span>
                            </p>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">✅</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Calibration Complete!</h4>
                            <p className="text-gray-300">
                                Your sensor axes have been mapped.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Live Data Debug */}
                    {latestSample && isRecording && (
                        <div className="mt-4 text-xs font-mono text-gray-500 text-center">
                            Recording... Gyro: {latestSample.gyro.x.toFixed(0)}, {latestSample.gyro.y.toFixed(0)}, {latestSample.gyro.z.toFixed(0)}
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>

                    {step === 0 && (
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Start
                        </button>
                    )}

                    {(step >= 1 && step <= 3) && (
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        >
                            {isRecording ? "Stop Recording" : "Start Recording"}
                        </button>
                    )}

                    {step === 4 && (
                        <button
                            onClick={finishCalibration}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Apply
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
