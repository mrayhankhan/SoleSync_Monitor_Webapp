import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { FootViewer } from './FootViewer';
import { Heatmap } from './Heatmap';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import AHRS from 'ahrs';
import { CalibrationWizard, type AxisMapping } from './CalibrationWizard';

export const Dashboard: React.FC = () => {
    const { isConnected, socket } = useSocket();
    const [samples, setSamples] = useState<any[]>([]);
    const [lastLeftTime, setLastLeftTime] = useState<number>(0);
    const [lastRightTime, setLastRightTime] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());
    const [isSimulating, setIsSimulating] = useState(false);

    // BLE State
    const [leftDevice, setLeftDevice] = useState<any | null>(null);
    const [rightDevice, setRightDevice] = useState<any | null>(null);

    // Calibration State & Ref (to avoid stale closures in BLE callbacks)
    const [calibrationOffsets, setCalibrationOffsets] = useState<{ left: any, right: any }>({
        left: { w: 1, x: 0, y: 0, z: 0 },
        right: { w: 1, x: 0, y: 0, z: 0 }
    });
    const calibrationOffsetsRef = useRef<{ left: any, right: any }>({
        left: { w: 1, x: 0, y: 0, z: 0 },
        right: { w: 1, x: 0, y: 0, z: 0 }
    });

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

    // AHRS Filter Refs
    const leftMadgwickRef = useRef<any>(null);
    const rightMadgwickRef = useRef<any>(null);

    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

    useEffect(() => {
        // Initialize Madgwick filters
        // Sample period 20ms (50Hz), Beta 0.1
        leftMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
        rightMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
    }, []);

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

    const calibrate = (side: 'left' | 'right') => {
        const filter = side === 'left' ? leftMadgwickRef.current : rightMadgwickRef.current;
        if (filter) {
            const q = filter.getQuaternion();
            const newOffset = { w: q.w, x: -q.x, y: -q.y, z: -q.z };

            // Update State (for UI/Re-render)
            setCalibrationOffsets(prev => ({
                ...prev,
                [side]: newOffset
            }));

            // Update Ref (for BLE Callback)
            calibrationOffsetsRef.current = {
                ...calibrationOffsetsRef.current,
                [side]: newOffset
            };

            console.log(`[${side}] Calibrated! Offset:`, newOffset);
        }
    };

    const handleBleData = (dataView: DataView, side: 'left' | 'right', deviceId: string) => {
        // Parse struct (Little Endian)
        // struct SensorData { float ax, ay, az, gx, gy, gz; uint16_t fsr[5]; uint16_t heel; }

        try {
            const ax = dataView.getFloat32(0, true);
            const ay = dataView.getFloat32(4, true);
            const az = dataView.getFloat32(8, true);
            const gx = dataView.getFloat32(12, true);
            const gy = dataView.getFloat32(16, true);
            const gz = dataView.getFloat32(20, true);

            const fsr = [
                dataView.getUint16(24, true),
                dataView.getUint16(26, true),
                dataView.getUint16(28, true),
                dataView.getUint16(30, true),
                dataView.getUint16(32, true)
            ];
            const heel = dataView.getUint16(34, true);

            // Calculate dt (time since last sample)
            const now = Date.now();
            const lastTime = side === 'left' ? lastLeftTime : lastRightTime;
            let dt = 0.02; // Default 20ms

            if (lastTime > 0) {
                dt = (now - lastTime) / 1000; // Convert to seconds
            }

            // Clamp dt to avoid huge jumps on reconnect (max 0.5s)
            if (dt > 0.5) dt = 0.02;

            // Scale Gyro: The filter expects 50Hz (20ms) updates.
            // If we are slower (e.g. 100ms), we need to tell the filter to integrate 5x more.
            // Or, we can just pre-multiply the gyro rate by (dt / expected_dt).
            // Angle = Rate * dt.
            // Filter assumes: Angle += Rate * 0.02.
            // We want: Angle += Rate * dt.
            // So InputRate * 0.02 = Rate * dt  =>  InputRate = Rate * (dt / 0.02).

            const scaleFactor = dt / 0.02;

            // Apply Axis Mapping
            const mapping = axisMappingsRef.current[side];
            const acc = applyAxisMapping({ x: ax, y: ay, z: az }, mapping);
            const gyro = applyAxisMapping({ x: gx, y: gy, z: gz }, mapping);

            // Update AHRS
            const filter = side === 'left' ? leftMadgwickRef.current : rightMadgwickRef.current;

            if (filter) {
                // Madgwick expects gyro in radians/sec
                const degToRad = Math.PI / 180;

                // Apply dynamic scaling to gyro
                const gx_scaled = gyro.x * scaleFactor;
                const gy_scaled = gyro.y * scaleFactor;
                const gz_scaled = gyro.z * scaleFactor;

                filter.update(gx_scaled * degToRad, gy_scaled * degToRad, gz_scaled * degToRad, acc.x, acc.y, acc.z);
            }

            let q = filter ? filter.getQuaternion() : { w: 1, x: 0, y: 0, z: 0 };

            // Apply Calibration Offset: Q_final = Q_offset * Q_current
            // USE REF HERE to avoid stale closure
            const offset = side === 'left' ? calibrationOffsetsRef.current.left : calibrationOffsetsRef.current.right;
            if (offset) {
                // Quaternion multiplication
                const q_off = offset;
                const q_curr = q;

                q = {
                    w: q_off.w * q_curr.w - q_off.x * q_curr.x - q_off.y * q_curr.y - q_off.z * q_curr.z,
                    x: q_off.w * q_curr.x + q_off.x * q_curr.w + q_off.y * q_curr.z - q_off.z * q_curr.y,
                    y: q_off.w * q_curr.y - q_off.x * q_curr.z + q_off.y * q_curr.w + q_off.z * q_curr.x,
                    z: q_off.w * q_curr.z + q_off.x * q_curr.y - q_off.y * q_curr.x + q_off.z * q_curr.w
                };
            }

            const euler = filter ? filter.getEulerAngles() : { heading: 0, pitch: 0, roll: 0 };

            const sample = {
                timestamp: Date.now(),
                deviceId: deviceId,
                foot: side,
                accel: acc,
                gyro: gyro,
                fsr: fsr,
                heelRaw: heel,
                orientation: {
                    yaw: euler.heading,
                    pitch: euler.pitch,
                    roll: euler.roll,
                    // Remap Body Frame (X=Fwd, Y=Right, Z=Up) to Three.js Frame
                    // Accounting for Model Base Rotation (-90 deg Y for Right Shoe):
                    // Model X (Pitch) aligns with World -Z.
                    // Model Z (Roll) aligns with World X.
                    // Model Y (Yaw) aligns with World Y.
                    // Mapping:
                    // Body Pitch (Y) -> Model Pitch (X) -> World -Z (so z = -q.y)
                    // Body Roll (X) -> Model Roll (Z) -> World X (so x = q.x)
                    // Body Yaw (Z) -> Model Yaw (Y) -> World Y (so y = q.z)
                    quaternion: { w: q.w, x: q.x, y: q.z, z: -q.y }
                },
                isStep: false,
                stepCount: 0,
                gaitPhase: 'stance'
            };

            setSamples(prev => [...prev, sample].slice(-100));
            if (side === 'left') setLastLeftTime(Date.now());
            else setLastRightTime(Date.now());

        } catch (e) {
            console.error("Error parsing BLE data", e);
        }
    };

    useEffect(() => {
        // Update 'now' every second to trigger re-render of status
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('sampleBatch', (data: { samples: any[] }) => {
            const newSamples = data.samples;
            // Update timestamps
            newSamples.forEach(s => {
                if (s.foot === 'left') setLastLeftTime(Date.now());
                if (s.foot === 'right') setLastRightTime(Date.now());
            });

            // Keep last 100 samples for visualization
            setSamples(prev => [...prev, ...newSamples].slice(-100));
        });

        socket.on('simulationStatus', (data: { running: boolean }) => {
            setIsSimulating(data.running);
        });

        return () => {
            socket.off('sampleBatch');
            socket.off('simulationStatus');
        };
    }, [socket]);

    // BLE Connection Handler
    const connectBle = async (side: 'left' | 'right') => {
        try {
            // @ts-ignore - navigator.bluetooth is experimental
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SERVICE_UUID] }]
            });

            const server = await device.gatt?.connect();
            const service = await server?.getPrimaryService(SERVICE_UUID);
            const char = await service?.getCharacteristic(CHARACTERISTIC_UUID);

            await char?.startNotifications();
            char?.addEventListener('characteristicvaluechanged', (e: any) => {
                const value = e.target.value;
                handleBleData(value, side, device.id);
            });

            if (side === 'left') setLeftDevice(device);
            else setRightDevice(device);

            device.addEventListener('gattserverdisconnected', () => {
                if (side === 'left') setLeftDevice(null);
                else setRightDevice(null);
            });

        } catch (e) {
            console.error("BLE Connection failed:", e);
            alert("Failed to connect: " + e);
        }
    };

    // Check connection status (timeout after 2 seconds)
    // Only consider active if we have recent data AND (BLE is connected OR Simulation is running)
    const hasRecentLeftData = now - lastLeftTime < 2000 && lastLeftTime > 0;
    const hasRecentRightData = now - lastRightTime < 2000 && lastRightTime > 0;

    const isLeftActive = hasRecentLeftData && (!!leftDevice || isSimulating);
    const isRightActive = hasRecentRightData && (!!rightDevice || isSimulating);

    // Get latest samples for display
    const latestLeft = samples.filter(s => s.foot === 'left').pop();
    const latestRight = samples.filter(s => s.foot === 'right').pop();

    const renderPressureData = (data: any, title: string) => {
        if (!data) return <div className="text-gray-500 text-xs">Waiting for data...</div>;
        return (
            <div className="text-xs font-mono text-gray-300 space-y-1">
                <div className="font-bold text-gray-400 mb-1">{title}</div>
                <div className="flex space-x-2">
                    {data.fsr.map((val: number, i: number) => (
                        <div key={i} className="bg-gray-700 px-1 rounded">S{i}: {val.toFixed(0)}</div>
                    ))}
                </div>
            </div>
        );
    };

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
                <div className="grid grid-cols-2 gap-x-4">
                    <div>Accel X: {data.accel.x.toFixed(2)}</div>
                    <div>Gyro X: {data.gyro.x.toFixed(2)}</div>
                    <div>Accel Y: {data.accel.y.toFixed(2)}</div>
                    <div>Gyro Y: {data.gyro.y.toFixed(2)}</div>
                    <div>Accel Z: {data.accel.z.toFixed(2)}</div>
                    <div>Gyro Z: {data.gyro.z.toFixed(2)}</div>
                </div>
                {/* Debug: Show Calibration Offset */}
                <div className="text-[10px] text-gray-500 mt-1">
                    Offset: W:{calibrationOffsets[side].w.toFixed(2)} X:{calibrationOffsets[side].x.toFixed(2)} Y:{calibrationOffsets[side].y.toFixed(2)} Z:{calibrationOffsets[side].z.toFixed(2)}
                </div>
                {/* Debug: Show Axis Mapping */}
                {axisMappings[side] && (
                    <div className="text-[10px] text-gray-500">
                        Map: X:{axisMappings[side]?.x.sign > 0 ? '+' : '-'}{axisMappings[side]?.x.index} Y:{axisMappings[side]?.y.sign > 0 ? '+' : '-'}{axisMappings[side]?.y.index} Z:{axisMappings[side]?.z.sign > 0 ? '+' : '-'}{axisMappings[side]?.z.index}
                    </div>
                )}
            </div>
        );
    };

    const StatusBadge = ({ label, connected, onConnect, isBleConnected }: { label: string, connected: boolean, onConnect: () => void, isBleConnected: boolean }) => {
        let statusText = 'Disconnected';
        let statusColor = 'bg-red-900/30 text-red-400 border-red-800';
        let dotColor = 'bg-red-500';

        if (isBleConnected) {
            statusText = 'BLE Connected';
            statusColor = 'bg-green-900/30 text-green-400 border-green-800';
            dotColor = 'bg-green-500';
        } else if (connected && isSimulating) {
            statusText = 'Simulating';
            statusColor = 'bg-blue-900/30 text-blue-400 border-blue-800';
            dotColor = 'bg-blue-500';
        }

        return (
            <div className="flex items-center space-x-2">
                <div className={`flex items-center px-3 py-1 rounded-full text-sm border ${statusColor}`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${dotColor} animate-pulse`} />
                    {label}: {statusText}
                </div>
                {!isBleConnected && (
                    <button
                        onClick={onConnect}
                        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                        Connect BLE
                    </button>
                )}
            </div>
        );
    };

    const toggleSimulation = () => {
        if (isSimulating) {
            socket?.emit('stopSimulation');
        } else {
            socket?.emit('startSimulation');
        }
    };

    return (
        <div className="p-6 min-h-screen w-full bg-gray-900 text-white box-border">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Live Monitor</h2>
                <div className="flex items-center space-x-4">
                    {/* Backend Status */}
                    <div className={`flex items-center px-3 py-1 rounded-full text-sm ${isConnected ? 'bg-blue-900/30 text-blue-300 border border-blue-800' : 'bg-gray-800 text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-blue-500' : 'bg-gray-500'}`} />
                        Backend
                    </div>

                    <StatusBadge
                        label="Left Shoe"
                        connected={isLeftActive}
                        onConnect={() => connectBle('left')}
                        isBleConnected={!!leftDevice}
                    />
                    <StatusBadge
                        label="Right Shoe"
                        connected={isRightActive}
                        onConnect={() => connectBle('right')}
                        isBleConnected={!!rightDevice}
                    />

                    <div className="h-6 w-px bg-gray-700 mx-2"></div>

                    <button
                        onClick={toggleSimulation}
                        className={`px-4 py-1 rounded-lg font-medium text-sm transition-colors ${isSimulating ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                        {isSimulating ? 'Stop Sim' : 'Start Sim'}
                    </button>

                    <div className="h-6 w-px bg-gray-700 mx-2"></div>

                    <Link
                        to="/settings"
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <Settings size={20} />
                    </Link>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Panel: IMU / 3D View */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col">
                    <h3 className="text-gray-400 text-sm font-medium mb-4">Motion Tracking (IMU)</h3>

                    {/* 3D Viewer */}
                    <div className="bg-gray-900 rounded-lg relative overflow-hidden mb-4 h-[500px]">
                        <FootViewer samples={samples} />
                    </div>

                    {/* Live Data Feed */}
                    <div className="bg-gray-900 rounded p-3">
                        <div className="grid grid-cols-2 gap-4">
                            {renderSensorData(latestLeft, "Left Foot IMU", 'left')}
                            {renderSensorData(latestRight, "Right Foot IMU", 'right')}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Pressure Heatmap */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col">
                    <h3 className="text-gray-400 text-sm font-medium mb-4">Pressure Distribution</h3>

                    {/* Heatmaps */}
                    <div className="bg-gray-900 rounded-lg flex items-center justify-around p-4 mb-4 overflow-auto">
                        <Heatmap samples={samples} side="left" />
                        <Heatmap samples={samples} side="right" />
                    </div>

                    {/* Live Data Feed */}
                    <div className="bg-gray-900 rounded p-3">
                        <div className="grid grid-cols-1 gap-4">
                            {renderPressureData(latestLeft, "Left Foot Pressure")}
                            {renderPressureData(latestRight, "Right Foot Pressure")}
                        </div>
                    </div>
                </div>
            </div>

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
