import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { FootViewer } from './FootViewer';
import { Heatmap } from './Heatmap';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import AHRS from 'ahrs';
import { CalibrationWizard, AxisMapping } from './CalibrationWizard';

export const Dashboard: React.FC = () => {
    // ... (existing state)

    // Axis Mapping State
    const [axisMappings, setAxisMappings] = useState<{ left: AxisMapping | null, right: AxisMapping | null }>({
        left: null,
        right: null
    });
    const axisMappingsRef = useRef<{ left: AxisMapping | null, right: AxisMapping | null }>({
        left: null,
        right: null
    });

    // Wizard State
    const [wizardOpen, setWizardOpen] = useState<{ side: 'left' | 'right', isOpen: boolean }>({ side: 'left', isOpen: false });

    // ... (existing refs)

    // ... (existing useEffects)

    const handleWizardComplete = (mapping: AxisMapping) => {
        const side = wizardOpen.side;
        setAxisMappings(prev => ({ ...prev, [side]: mapping }));
        axisMappingsRef.current = { ...axisMappingsRef.current, [side]: mapping };
        console.log(`[${side}] Axis Mapping Updated:`, mapping);

        // Reset AHRS filter to clear history
        if (side === 'left') leftMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
        else rightMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
    };

    const applyAxisMapping = (raw: { x: number, y: number, z: number }, mapping: AxisMapping | null) => {
        if (!mapping) return raw;
        const values = [raw.x, raw.y, raw.z];
        return {
            x: values[mapping.x.index] * mapping.x.sign,
            y: values[mapping.y.index] * mapping.y.sign,
            z: values[mapping.z.index] * mapping.z.sign
        };
    };

    // ... (existing calibrate function)

    const handleBleData = (dataView: DataView, side: 'left' | 'right', deviceId: string) => {
        // ... (parsing code)
        const ax = dataView.getFloat32(0, true);
        const ay = dataView.getFloat32(4, true);
        const az = dataView.getFloat32(8, true);
        const gx = dataView.getFloat32(12, true);
        const gy = dataView.getFloat32(16, true);
        const gz = dataView.getFloat32(20, true);

        // ... (fsr/heel parsing)

        // Apply Axis Mapping
        const mapping = axisMappingsRef.current[side];
        const acc = applyAxisMapping({ x: ax, y: ay, z: az }, mapping);
        const gyro = applyAxisMapping({ x: gx, y: gy, z: gz }, mapping);

        // Update AHRS
        const filter = side === 'left' ? leftMadgwickRef.current : rightMadgwickRef.current;

        if (filter) {
            const degToRad = Math.PI / 180;
            // Use mapped values
            filter.update(gyro.x * degToRad, gyro.y * degToRad, gyro.z * degToRad, acc.x, acc.y, acc.z);
        }

        // ... (rest of function using filter output)
        // Note: Update sample object to use MAPPED values for display? 
        // Or raw? Usually raw is better for debugging, but mapped is better for user.
        // Let's store raw in sample, but maybe add mapped?
        // Actually, let's update the sample to show what the AHRS is seeing (Mapped).

        const sample = {
            // ...
            accel: acc, // Use mapped
            gyro: gyro, // Use mapped
            // ...
        };

        // ...
    };

    // ... (renderSensorData update)
    const renderSensorData = (data: any, title: string, side: 'left' | 'right') => {
        if (!data) return <div className="text-gray-500 text-xs">Waiting for data...</div>;
        return (
            <div className="text-xs font-mono text-gray-300 space-y-1">
                <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-gray-400">{title}</div>
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setWizardOpen({ side, isOpen: true })}
                            className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white text-[10px] rounded transition-colors"
                        >
                            Wizard
                        </button>
                        <button
                            onClick={() => calibrate(side)}
                            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white text-[10px] rounded transition-colors"
                        >
                            Zero
                        </button>
                    </div>
                </div>
                {/* ... (rest of display) */}
            </div>
        );
    };

    return (
        <div className="p-6 min-h-screen w-full bg-gray-900 text-white box-border">
            {/* ... (existing JSX) */}

            <CalibrationWizard
                isOpen={wizardOpen.isOpen}
                side={wizardOpen.side}
                onClose={() => setWizardOpen(prev => ({ ...prev, isOpen: false }))}
                onComplete={handleWizardComplete}
                latestSample={wizardOpen.side === 'left' ? latestLeft : latestRight}
            />
        </div>
    );
};
