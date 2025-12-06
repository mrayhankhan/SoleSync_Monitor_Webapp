import React, { useState } from 'react';
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
    const [step, setStep] = useState<number>(0); // 0: Intro, 1: Flat, 2: Toe Down, 3: Complete
    const [flatAccel, setFlatAccel] = useState<{ x: number, y: number, z: number } | null>(null);
    const [downAccel, setDownAccel] = useState<{ x: number, y: number, z: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleNext = () => {
        setError(null);
        if (step === 0) {
            setStep(1);
        } else if (step === 1) {
            // Capture Flat Data (Identifies Z axis)
            if (!latestSample) {
                setError("No sensor data received.");
                return;
            }
            setFlatAccel(latestSample.accel);
            setStep(2);
        } else if (step === 2) {
            // Capture Toe Down Data (Identifies X axis)
            if (!latestSample) {
                setError("No sensor data received.");
                return;
            }
            setDownAccel(latestSample.accel);
            setStep(3);
        } else if (step === 3) {
            // Calculate and Finish
            if (flatAccel && downAccel) {
                const mapping = calculateMapping(flatAccel, downAccel);
                if (mapping) {
                    onComplete(mapping);
                    onClose();
                } else {
                    setError("Could not determine orientation. Please try again.");
                    setStep(1);
                }
            }
        }
    };

    const calculateMapping = (flat: { x: number, y: number, z: number }, down: { x: number, y: number, z: number }): AxisMapping | null => {
        // Goal: Map IMU axes to Body Frame: X=Forward, Y=Right, Z=Up

        // 1. Identify Z (Up) Axis from Flat Data
        // In Flat position, Gravity points DOWN (-Z).
        // So the axis reading approx -1g is Z. Or +1g is -Z.
        // Let's find the axis with max absolute value.

        const flatValues = [flat.x, flat.y, flat.z];

        let zIndex = 0;
        let maxVal = 0;
        flatValues.forEach((v, i) => {
            if (Math.abs(v) > Math.abs(maxVal)) {
                maxVal = v;
                zIndex = i;
            }
        });

        // If maxVal is positive (e.g. +1g), it means that axis is pointing UP (opposing gravity).
        // Wait, accelerometer measures "proper acceleration".
        // Sitting on table: Gravity pulls down. Table pushes up. Accel measures the Upward force (1g).
        // So the axis pointing UP reads +1g.
        // So if flatValues[zIndex] > 0, that IMU axis is +Z.
        // If flatValues[zIndex] < 0, that IMU axis is -Z.

        const zSign = flatValues[zIndex] > 0 ? 1 : -1;

        // 2. Identify X (Forward) Axis from Toe Down Data
        // In Toe Down position, the "Forward" axis is pointing DOWN.
        // So the "Forward" axis should read -1g (because Up is +1g).
        // We look for the axis with max abs value, EXCLUDING the Z axis we just found.

        const downValues = [down.x, down.y, down.z];
        let xIndex = 0;
        maxVal = 0;

        downValues.forEach((v, i) => {
            if (i === zIndex) return; // Ignore Z axis
            if (Math.abs(v) > Math.abs(maxVal)) {
                maxVal = v;
                xIndex = i;
            }
        });

        // If maxVal is negative (e.g. -1g), it means that axis is pointing DOWN.
        // Since we pointed the shoe's Forward axis DOWN, this axis corresponds to Forward.
        // So if downValues[xIndex] < 0, that IMU axis is +X (Forward).
        // If downValues[xIndex] > 0, that IMU axis is -X (Backward).

        const xSign = downValues[xIndex] < 0 ? 1 : -1;

        // 3. Identify Y (Right) Axis
        // Remaining axis index
        const yIndex = [0, 1, 2].find(i => i !== zIndex && i !== xIndex) as 0 | 1 | 2;

        // Determine sign using Cross Product rule: X cross Y = Z  =>  Y = Z cross X ? No.
        // Right Hand Rule: X (Thumb) x Y (Index) = Z (Middle).
        // We know X and Z. We need Y.
        // We can just arbitrarily assign Y to the remaining axis, but we need the sign.
        // This is tricky without a third measurement (e.g. on side).
        // BUT, we can assume a right-handed coordinate system for the IMU.
        // If we map raw indices to a standard basis, the determinant should be +1.

        // Let's just default Y sign to 1 and let the user flip if needed? 
        // Or better: Use the cross product of our mapped X and Z to find expected Y.

        // Actually, simpler:
        // We have mapped X and Z.
        // Let's say IMU axes are i, j, k.
        // We found X = s1 * axis(idx1)
        // We found Z = s2 * axis(idx2)
        // Y must be s3 * axis(idx3).
        // To preserve right-handedness: (X x Y) . Z = 1.

        // Let's tentatively set Y sign to 1.
        let ySign: 1 | -1 = 1;

        // Check chirality
        // Construct a 3x3 matrix where rows are X, Y, Z vectors in terms of raw IMU axes.
        // M = [ [x_x, x_y, x_z], [y_x, y_y, y_z], [z_x, z_y, z_z] ]
        // The determinant should be 1.

        // Vector X in raw frame: has 'xSign' at 'xIndex', 0 elsewhere.
        // Vector Z in raw frame: has 'zSign' at 'zIndex', 0 elsewhere.
        // Vector Y in raw frame: has 'ySign' at 'yIndex', 0 elsewhere.

        // Example: X is raw[1] (+), Z is raw[2] (-). Y is raw[0] (?).
        // X = (0, 1, 0)
        // Z = (0, 0, -1)
        // Y = (s, 0, 0)
        // X x Y = (0, 0, -s).
        // We want X x Y = Z => (0, 0, -s) = (0, 0, -1) => s = 1.

        // General logic:
        // Permutation parity:
        // (0,1,2) -> Even
        // (0,2,1) -> Odd
        // ...

        // Let's implement a simple cross product check.
        // We want Y = Z cross X (Wait, X x Y = Z => - (Y x X) = Z => Y x X = -Z => Y = Z x X ? No.)
        // X x Y = Z.
        // Cross product of X and Z?
        // Z x X = Y.
        // Let's test: X=(1,0,0), Y=(0,1,0), Z=(0,0,1). Z x X = (0,1,0) = Y. Correct.

        // So Y_vector = Z_vector x X_vector.
        // Our vectors are in the "Raw IMU Basis".
        // Z_vector has 0s and one +/-1.
        // X_vector has 0s and one +/-1.

        const vecZ = [0, 0, 0]; vecZ[zIndex] = zSign;
        const vecX = [0, 0, 0]; vecX[xIndex] = xSign;

        // Cross product
        const cross = [
            vecZ[1] * vecX[2] - vecZ[2] * vecX[1],
            vecZ[2] * vecX[0] - vecZ[0] * vecX[2],
            vecZ[0] * vecX[1] - vecZ[1] * vecX[0]
        ];

        // The non-zero component of 'cross' should be at yIndex.
        // Its value (+/-1) is the ySign.

        if (cross[yIndex] !== 0) {
            ySign = cross[yIndex] > 0 ? 1 : -1;
        } else {
            console.error("Error in axis calculation");
            return null;
        }

        return {
            x: { index: xIndex as any, sign: xSign },
            y: { index: yIndex, sign: ySign },
            z: { index: zIndex as any, sign: zSign }
        };
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
                                This wizard will help you map your sensor's orientation to the shoe.
                            </p>
                            <p className="text-gray-400 text-sm">
                                You will need to place the shoe in two positions.
                            </p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">👟 ➡️ 🪑</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Step 1: Place Flat</h4>
                            <p className="text-gray-300">
                                Place the shoe <b>flat on a table</b> or the floor.
                                <br />
                                Ensure it is steady.
                            </p>
                            {latestSample && (
                                <div className="mt-4 text-xs font-mono text-gray-500">
                                    Current: {latestSample.accel.x.toFixed(2)}, {latestSample.accel.y.toFixed(2)}, {latestSample.accel.z.toFixed(2)}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="text-center">
                            <div className="text-4xl mb-4">👟 ⬇️</div>
                            <h4 className="text-lg font-semibold text-white mb-2">Step 2: Toe Down</h4>
                            <p className="text-gray-300">
                                Hold the shoe vertically with the <b>toe pointing down</b>.
                                <br />
                                (Heel up, Toe down)
                            </p>
                            {latestSample && (
                                <div className="mt-4 text-xs font-mono text-gray-500">
                                    Current: {latestSample.accel.x.toFixed(2)}, {latestSample.accel.y.toFixed(2)}, {latestSample.accel.z.toFixed(2)}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm text-center">
                            {error}
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
                    <button
                        onClick={handleNext}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        {step === 0 ? "Start" : step === 2 ? "Finish" : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
};
