import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Heatmap } from './Heatmap';
import { Settings, Activity, Bluetooth, Wifi, Square, History, Footprints } from 'lucide-react';
import AHRS from 'ahrs';
import { type AxisMapping } from './CalibrationWizard';
import { SessionsModal } from './SessionsModal';
import { ThemeToggle } from './ThemeToggle';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { ShoeModel } from './ShoeModel';

export const Dashboard: React.FC = () => {
    const { isConnected: isSocketConnected, socket } = useSocket();
    const [samples, setSamples] = useState<any[]>([]);
    const [lastLeftTime, setLastLeftTime] = useState<number>(0);
    const [lastRightTime, setLastRightTime] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());

    const [isSimulating, setIsSimulating] = useState(false);
    const [dbConnected, setDbConnected] = useState<boolean>(true); // Assume true initially

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

    // Recording State
    const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
    const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
    const isBleConnected = !!leftDevice || !!rightDevice;

    useEffect(() => {
        let interval: any;
        if (recordingSessionId && recordingStartTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - recordingStartTime) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [recordingSessionId, recordingStartTime]);

    const toggleRecording = async () => {
        if (recordingSessionId) {
            setRecordingSessionId(null);
            setRecordingStartTime(null);
        } else {
            const newSessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;
            setRecordingSessionId(newSessionId);
            setRecordingStartTime(Date.now());
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                await fetch(`${API_URL}/api/session/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: newSessionId })
                });
            } catch (e) {
                console.error("Failed to start session on backend", e);
            }
        }
    };

    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

    useEffect(() => {
        // Initialize Madgwick filters
        // Sample period 20ms (50Hz), Beta 0.1
        leftMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
        rightMadgwickRef.current = new AHRS({ sampleInterval: 20, algorithm: 'Madgwick', beta: 0.1 });
    }, []);

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

            // RECORDING LOGIC
            if (recordingSessionId && socket) {
                // Format: timestamp,deviceId,foot,ax,ay,az,gx,gy,gz,fsr1,fsr2,fsr3,fsr4,fsr5,heelRaw,voltage,temperature
                const csvLine = `${new Date().toISOString()},${deviceId},${side},${acc.x},${acc.y},${acc.z},${gyro.x},${gyro.y},${gyro.z},${fsr[0]},${fsr[1]},${fsr[2]},${fsr[3]},${fsr[4]},${heel},0,0`;
                socket.emit('rawCSV', { csv: csvLine, gatewayId: 'web-dashboard', sessionId: recordingSessionId });
            }

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

        // Check DB Status
        const checkStatus = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                await fetch(`${API_URL}/api/status`);
                // If backend is up, we are "connected" for storage purposes (either DB or Local)
                setDbConnected(true);
            } catch (e) {
                console.error("Failed to check backend status", e);
                setDbConnected(false);
            }
        };
        checkStatus();
        const statusInterval = setInterval(checkStatus, 10000); // Check every 10s

        return () => {
            clearInterval(interval);
            clearInterval(statusInterval);
        };
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

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Derived data for visualization
    // Default to left foot for now, or use whichever is active/selected
    // For the 3D view and Heatmap, we might want to show both or toggle.
    // The UI shows a "Left" / "Right" toggle in the heatmap section but it's hardcoded.
    // Let's use the latest data from either foot for the main view if available.

    // Check connection status (timeout after 2 seconds)
    // Only consider active if we have recent data AND (BLE is connected OR Simulation is running)
    const hasRecentLeftData = now - lastLeftTime < 2000 && lastLeftTime > 0;
    const hasRecentRightData = now - lastRightTime < 2000 && lastRightTime > 0;

    const isLeftActive = hasRecentLeftData && (!!leftDevice || isSimulating);
    const isRightActive = hasRecentRightData && (!!rightDevice || isSimulating);

    // Get latest samples for display
    const latestLeft = samples.filter(s => s.foot === 'left').pop();
    const latestRight = samples.filter(s => s.foot === 'right').pop();

    const activeSide = 'left'; // Default to left for main view for now
    const activeSample = activeSide === 'left' ? latestLeft : latestRight;

    const quaternion = activeSample?.orientation?.quaternion || { w: 1, x: 0, y: 0, z: 0 };
    const accel = activeSample?.accel || { x: 0, y: 0, z: 0 };
    const fsrData = activeSample?.fsr || [0, 0, 0, 0, 0];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-6 pb-24 transition-colors duration-200">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                            SoleSync Monitor
                        </h1>
                        <p className="text-gray-500 dark:text-zinc-400 text-sm">Real-time Gait Analysis System</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${dbConnected
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                            {dbConnected ? (localStorage.getItem('useLocalStore') === 'true' ? 'Local Store' : 'DB Connected') : 'DB Disconnected'}
                        </div>
                        <ThemeToggle />
                        <button
                            onClick={() => setSessionsModalOpen(true)}
                            className="p-2 bg-white dark:bg-zinc-900 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-zinc-800 shadow-sm"
                        >
                            <History size={20} className="text-gray-600 dark:text-zinc-400" />
                        </button>
                        <button className="p-2 bg-white dark:bg-zinc-900 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <Settings size={20} className="text-gray-600 dark:text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Live Status & Controls */}
                    <div className="space-y-6">
                        {/* Connection Card */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Activity className="text-purple-500" />
                                Live Status
                            </h2>

                            {/* Device Status Items */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-black/40 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isBleConnected ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                                            <Bluetooth size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">ESP32 Device</div>
                                            <div className="text-xs text-gray-500 dark:text-zinc-500">{isBleConnected ? 'Connected' : 'Disconnected'}</div>
                                        </div>
                                    </div>
                                    {isBleConnected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-black/40 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isSocketConnected ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'}`}>
                                            <Wifi size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Backend Stream</div>
                                            <div className="text-xs text-gray-500 dark:text-zinc-500">{isSocketConnected ? 'Active' : 'Connecting...'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recording Controls */}
                            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800">
                                <div className="mb-4">
                                    <label className="text-xs uppercase text-gray-400 dark:text-zinc-500 font-semibold mb-2 block">Session ID</label>
                                    <input
                                        type="text"
                                        value={recordingSessionId || ''}
                                        readOnly
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors text-gray-500"
                                        placeholder="Auto-generated..."
                                    />
                                </div>
                                <button
                                    onClick={toggleRecording}
                                    disabled={!isBleConnected && !isSocketConnected}
                                    className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${recordingSessionId
                                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-white dark:bg-white text-gray-900 dark:text-black hover:bg-gray-50 dark:hover:bg-gray-200 border border-gray-200 dark:border-transparent'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {recordingSessionId ? (
                                        <>
                                            <Square size={18} fill="currentColor" />
                                            Stop Recording ({formatTime(elapsedTime)})
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                                            Start Recording
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                                <div className="text-gray-500 dark:text-zinc-500 text-xs mb-1">Step Count</div>
                                <div className="text-2xl font-bold">{activeSample?.stepCount || 0}</div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                                <div className="text-gray-500 dark:text-zinc-500 text-xs mb-1">Cadence</div>
                                <div className="text-2xl font-bold">0 <span className="text-xs font-normal text-gray-400 dark:text-zinc-600">spm</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Middle & Right: Visualizations */}
                    <div className="md:col-span-2 space-y-6">
                        {/* 3D View */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-1 border border-gray-200 dark:border-zinc-800 shadow-sm h-[300px] relative overflow-hidden group">
                            <div className="absolute top-4 left-4 z-10">
                                <h3 className="text-sm font-semibold bg-white/90 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-gray-200 dark:border-white/10">3D Motion</h3>
                            </div>
                            <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
                                <ambientLight intensity={0.5} />
                                <pointLight position={[10, 10, 10]} />
                                <Suspense fallback={null}>
                                    <ShoeModel
                                        quaternion={quaternion}
                                        accel={accel}
                                    />
                                    <Environment preset="city" />
                                </Suspense>
                                <OrbitControls enableZoom={false} />
                            </Canvas>
                        </div>

                        {/* Heatmap */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Footprints className="text-blue-500" size={20} />
                                    Pressure Distribution
                                </h3>
                                <div className="flex gap-2">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs text-gray-500 dark:text-zinc-400">Left</span>
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs text-gray-500 dark:text-zinc-400">Right</span>
                                </div>
                            </div>
                            <div className="flex justify-center gap-12">
                                <Heatmap data={fsrData} />
                                {/* Placeholder for Right Foot */}
                                <div className="opacity-30 grayscale">
                                    <Heatmap data={[0, 0, 0, 0, 0]} />
                                </div>
                            </div>
                        </div>

                        {/* Sensor Diagnostics (Restored) */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Sensor Diagnostics</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Foot Data */}
                                <div className={`p-4 rounded-xl border ${isLeftActive ? 'border-purple-500/30 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-200 dark:border-zinc-800'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="font-medium text-sm">Left Foot</div>
                                        <div className="flex gap-2">
                                            {!leftDevice && !isSimulating && (
                                                <button
                                                    onClick={() => connectBle('left')}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                            <button
                                                onClick={() => calibrate('left')}
                                                className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-xs rounded transition-colors"
                                            >
                                                Zero
                                            </button>
                                            <button
                                                onClick={() => setWizardOpen({ side: 'left', isOpen: true })}
                                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded transition-colors"
                                            >
                                                Wizard
                                            </button>
                                        </div>
                                    </div>
                                    {latestLeft ? (
                                        <div className="space-y-2 text-xs font-mono text-gray-600 dark:text-zinc-400">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>AX: {latestLeft.accel.x.toFixed(2)}</div>
                                                <div>GX: {latestLeft.gyro.x.toFixed(2)}</div>
                                                <div>AY: {latestLeft.accel.y.toFixed(2)}</div>
                                                <div>GY: {latestLeft.gyro.y.toFixed(2)}</div>
                                                <div>AZ: {latestLeft.accel.z.toFixed(2)}</div>
                                                <div>GZ: {latestLeft.gyro.z.toFixed(2)}</div>
                                            </div>
                                            <div className="pt-2 border-t border-gray-200 dark:border-zinc-800">
                                                <div>FSR: {latestLeft.fsr.join(', ')}</div>
                                            </div>
                                            {/* Debug Info */}
                                            <div className="text-[10px] opacity-50 mt-1">
                                                Offset: {JSON.stringify(calibrationOffsets.left)}
                                                <br />
                                                Map: {axisMappings.left ? 'Set' : 'None'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 italic">No data received</div>
                                    )}
                                </div>

                                {/* Right Foot Data */}
                                <div className={`p-4 rounded-xl border ${isRightActive ? 'border-purple-500/30 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-200 dark:border-zinc-800'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="font-medium text-sm">Right Foot</div>
                                        <div className="flex gap-2">
                                            {!rightDevice && !isSimulating && (
                                                <button
                                                    onClick={() => connectBle('right')}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                            <button
                                                onClick={() => calibrate('right')}
                                                className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-xs rounded transition-colors"
                                            >
                                                Zero
                                            </button>
                                            <button
                                                onClick={() => setWizardOpen({ side: 'right', isOpen: true })}
                                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded transition-colors"
                                            >
                                                Wizard
                                            </button>
                                        </div>
                                    </div>
                                    {latestRight ? (
                                        <div className="space-y-2 text-xs font-mono text-gray-600 dark:text-zinc-400">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>AX: {latestRight.accel.x.toFixed(2)}</div>
                                                <div>GX: {latestRight.gyro.x.toFixed(2)}</div>
                                                <div>AY: {latestRight.accel.y.toFixed(2)}</div>
                                                <div>GY: {latestRight.gyro.y.toFixed(2)}</div>
                                                <div>AZ: {latestRight.accel.z.toFixed(2)}</div>
                                                <div>GZ: {latestRight.gyro.z.toFixed(2)}</div>
                                            </div>
                                            <div className="pt-2 border-t border-gray-200 dark:border-zinc-800">
                                                <div>FSR: {latestRight.fsr.join(', ')}</div>
                                            </div>
                                            {/* Debug Info */}
                                            <div className="text-[10px] opacity-50 mt-1">
                                                Offset: {JSON.stringify(calibrationOffsets.right)}
                                                <br />
                                                Map: {axisMappings.right ? 'Set' : 'None'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 italic">No data received</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessions Modal */}
            {
                sessionsModalOpen && (
                    <SessionsModal
                        isOpen={sessionsModalOpen}
                        onClose={() => setSessionsModalOpen(false)}
                    />
                )
            }
        </div >
    );
};

