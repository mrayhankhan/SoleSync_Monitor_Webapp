import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { FootViewer } from './FootViewer';
import { Heatmap } from './Heatmap';

export const Dashboard: React.FC = () => {
    const { isConnected, socket } = useSocket();
    const [samples, setSamples] = useState<any[]>([]);
    const [lastLeftTime, setLastLeftTime] = useState<number>(0);
    const [lastRightTime, setLastRightTime] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());
    const [isPaused, setIsPaused] = useState(false);

    // BLE State
    const [leftDevice, setLeftDevice] = useState<any | null>(null);
    const [rightDevice, setRightDevice] = useState<any | null>(null);

    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

    useEffect(() => {
        // Update 'now' every second to trigger re-render of status
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('sampleBatch', (data: { samples: any[] }) => {
            if (isPaused) return; // Ignore data if paused

            const newSamples = data.samples;
            // Update timestamps
            newSamples.forEach(s => {
                if (s.foot === 'left') setLastLeftTime(Date.now());
                if (s.foot === 'right') setLastRightTime(Date.now());
            });

            // Keep last 100 samples for visualization
            setSamples(prev => [...prev, ...newSamples].slice(-100));
        });

        return () => {
            socket.off('sampleBatch');
        };
    }, [socket, isPaused]);

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
                if (isPaused) return;
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

            const sample = {
                timestamp: Date.now(),
                deviceId: deviceId,
                foot: side,
                accel: { x: ax, y: ay, z: az },
                gyro: { x: gx, y: gy, z: gz },
                fsr: fsr,
                heelRaw: heel,
                // Mock processed data for now
                orientation: { yaw: 0, pitch: 0, roll: 0, quaternion: { w: 1, x: 0, y: 0, z: 0 } },
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

    // Check connection status (timeout after 2 seconds)
    const isLeftActive = now - lastLeftTime < 2000 && lastLeftTime > 0;
    const isRightActive = now - lastRightTime < 2000 && lastRightTime > 0;

    // Get latest samples for display
    const latestLeft = samples.filter(s => s.foot === 'left').pop();
    const latestRight = samples.filter(s => s.foot === 'right').pop();

    const renderSensorData = (data: any, title: string) => {
        if (!data) return <div className="text-gray-500 text-xs">Waiting for data...</div>;
        return (
            <div className="text-xs font-mono text-gray-300 space-y-1">
                <div className="font-bold text-gray-400 mb-1">{title}</div>
                <div className="grid grid-cols-2 gap-x-4">
                    <div>Accel X: {data.accel.x.toFixed(2)}</div>
                    <div>Gyro X: {data.gyro.x.toFixed(2)}</div>
                    <div>Accel Y: {data.accel.y.toFixed(2)}</div>
                    <div>Gyro Y: {data.gyro.y.toFixed(2)}</div>
                    <div>Accel Z: {data.accel.z.toFixed(2)}</div>
                    <div>Gyro Z: {data.gyro.z.toFixed(2)}</div>
                </div>
            </div>
        );
    };

    const renderPressureData = (data: any, title: string) => {
        if (!data) return <div className="text-gray-500 text-xs">Waiting for data...</div>;
        return (
            <div className="text-xs font-mono text-gray-300 space-y-1">
                <div className="font-bold text-gray-400 mb-1">{title}</div>
                <div className="flex space-x-2">
                    {data.fsr.map((val: number, i: number) => (
                        <div key={i} className="bg-gray-700 px-1 rounded">S{i}: {val.toFixed(0)}</div>
                    ))}
                    <div className="bg-gray-700 px-1 rounded">Heel: {data.heelRaw.toFixed(0)}</div>
                </div>
            </div>
        );
    };

    const StatusBadge = ({ label, connected, onConnect, isBleConnected }: { label: string, connected: boolean, onConnect: () => void, isBleConnected: boolean }) => (
        <div className="flex items-center space-x-2">
            <div className={`flex items-center px-3 py-1 rounded-full text-sm border ${connected ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                {label}: {connected ? 'Active' : 'Inactive'}
            </div>
            {!isBleConnected && (
                <button
                    onClick={onConnect}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                    Connect BLE
                </button>
            )}
            {isBleConnected && (
                <span className="text-xs text-blue-400 border border-blue-900 bg-blue-900/20 px-2 py-1 rounded">BLE Linked</span>
            )}
        </div>
    );

    return (
        <div className="p-6 min-h-screen w-full bg-gray-900 text-white box-border">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Live Monitor</h2>
                <div className="flex items-center space-x-4 mr-16">
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

                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`px-4 py-1 rounded-lg font-medium text-sm transition-colors ${isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
                    >
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Panel: IMU / 3D View */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col">
                    <h3 className="text-gray-400 text-sm font-medium mb-4">Motion Tracking (IMU)</h3>

                    {/* 3D Viewer */}
                    <div className="bg-gray-900 rounded-lg relative overflow-hidden mb-4 h-[500px]">
                        <FootViewer samples={samples} isPaused={isPaused} />
                    </div>

                    {/* Live Data Feed */}
                    <div className="bg-gray-900 rounded p-3">
                        <div className="grid grid-cols-2 gap-4">
                            {renderSensorData(latestLeft, "Left Foot IMU")}
                            {renderSensorData(latestRight, "Right Foot IMU")}
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
        </div>
    );
};

