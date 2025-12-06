import React, { useRef, useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Upload, RotateCcw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Settings: React.FC = () => {
    const {
        insoleImage,
        setInsoleImage,
        leftSensorPositions,
        rightSensorPositions,
        updateSensorPosition,
        resetPositions
    } = useSettings();

    const containerRef = useRef<HTMLDivElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('right');

    const currentPositions = selectedSide === 'left' ? leftSensorPositions : rightSensorPositions;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setInsoleImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMouseDown = (index: number) => {
        setDraggingIndex(index);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingIndex !== null && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            updateSensorPosition(selectedSide, draggingIndex, x, y);
        }
    };

    const handleMouseUp = () => {
        setDraggingIndex(null);
    };

    // Global mouse up to catch drops outside the container
    useEffect(() => {
        const handleGlobalMouseUp = () => setDraggingIndex(null);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    return (
        <div className="p-6 h-full overflow-auto text-white">
            <div className="flex items-center mb-6">
                <Link to="/" className="mr-4 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h2 className="text-3xl font-bold">Settings</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Panel */}
                <div className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4">Insole Image</h3>
                        <p className="text-gray-400 mb-4 text-sm">
                            Upload an image of your insole to use as the background for the heatmap.
                        </p>

                        <div className="flex items-center space-x-4">
                            <label className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors">
                                <Upload className="w-5 h-5 mr-2" />
                                <span>Upload Image</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                            </label>

                            {insoleImage && (
                                <button
                                    onClick={() => setInsoleImage(null)}
                                    className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/50 rounded-lg transition-colors"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4">Sensor Configuration</h3>

                        {/* Side Selector */}
                        <div className="flex space-x-4 mb-6">
                            <button
                                onClick={() => setSelectedSide('left')}
                                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${selectedSide === 'left'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                            >
                                Left Foot
                            </button>
                            <button
                                onClick={() => setSelectedSide('right')}
                                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${selectedSide === 'right'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                            >
                                Right Foot
                            </button>
                        </div>

                        <p className="text-gray-400 mb-4 text-sm">
                            Drag the numbered points on the preview to match the physical location of your sensors for the <strong>{selectedSide === 'left' ? 'Left' : 'Right'} Foot</strong>.
                        </p>

                        <button
                            onClick={resetPositions}
                            className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset All Positions
                        </button>
                    </div>
                </div>

                {/* Interactive Preview */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col items-center">
                    <h3 className="text-xl font-semibold mb-4 capitalize">{selectedSide} Foot Placement</h3>

                    <div
                        ref={containerRef}
                        className="relative w-[300px] h-[500px] bg-gray-900 rounded-lg border-2 border-dashed border-gray-600 overflow-hidden select-none"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {insoleImage ? (
                            <img
                                src={insoleImage}
                                alt="Insole"
                                className={`w-full h-full object-contain pointer-events-none opacity-50 ${selectedSide === 'left' ? 'scale-x-[-1]' : ''}`}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                No Image Uploaded
                            </div>
                        )}

                        {/* Sensor Points */}
                        {currentPositions.map((pos, index) => (
                            <div
                                key={index}
                                className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-xs font-bold cursor-move transition-transform hover:scale-110 ${draggingIndex === index
                                    ? 'bg-blue-500 text-white z-20 scale-110 ring-4 ring-blue-500/30'
                                    : 'bg-gray-700 text-gray-200 border border-gray-500 z-10'
                                    }`}
                                style={{
                                    left: `${pos.x * 100}%`,
                                    top: `${pos.y * 100}%`
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleMouseDown(index);
                                }}
                            >
                                {index === 5 ? 'H' : index}
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-sm text-gray-500">
                        Sensors: 0-4 (Toes/Arch), H (Heel)
                    </p>
                </div>
            </div>
        </div>
    );
};
