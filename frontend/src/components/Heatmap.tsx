import React, { useEffect, useRef } from 'react';
import type { ProcessedSample } from '../../../backend/src/analytics';
import { useSettings } from '../context/SettingsContext';

interface HeatmapProps {
    samples: ProcessedSample[];
    side: 'left' | 'right';
}

export const Heatmap: React.FC<HeatmapProps> = ({ samples, side }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { insoleImage, leftSensorPositions, rightSensorPositions } = useSettings();

    // Refs for smooth animation
    const currentSensors = useRef<number[]>([0, 0, 0, 0, 0, 0]);
    const targetSensors = useRef<number[]>([0, 0, 0, 0, 0, 0]);
    const animationFrameId = useRef<number>(0);

    // Update target values when new sample arrives
    useEffect(() => {
        const latestSample = samples.filter(s => s.foot === side).slice(-1)[0];
        if (latestSample) {
            targetSensors.current = [
                latestSample.fsr[0],
                latestSample.fsr[1],
                latestSample.fsr[2],
                latestSample.fsr[3],
                latestSample.fsr[4],
                latestSample.heelRaw
            ];
        }
    }, [samples, side]);

    const sensorPositions = side === 'left' ? leftSensorPositions : rightSensorPositions;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        const render = () => {
            // LERP (Linear Interpolation) for smoothness
            // Factor 0.1 gives a smooth ease-out effect
            for (let i = 0; i < 6; i++) {
                currentSensors.current[i] += (targetSensors.current[i] - currentSensors.current[i]) * 0.05;
            }

            // Clear canvas
            ctx.clearRect(0, 0, w, h);

            // 1. Draw Background
            if (insoleImage) {
                const img = new Image();
                img.src = insoleImage;
                ctx.globalAlpha = 0.5;
                ctx.save();
                if (side === 'left') {
                    ctx.translate(w, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(img, 0, 0, w, h);
                ctx.restore();
                ctx.globalAlpha = 1.0;
            } else {
                // Default Shape
                ctx.save();
                const scale = 1.2;
                ctx.scale(side === 'left' ? -scale : scale, scale);
                ctx.translate(side === 'left' ? -w / 2 / scale : w / 2 / scale, 0);
                ctx.translate(0, -130);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-40, 280);
                ctx.bezierCurveTo(-40, 320, 40, 320, 40, 280);
                ctx.bezierCurveTo(50, 200, 70, 100, 60, 0);
                ctx.bezierCurveTo(60, -60, -20, -60, -40, -40);
                ctx.bezierCurveTo(-80, 50, -30, 150, -40, 280);
                ctx.stroke();
                ctx.restore();
            }

            // 2. Draw Heatmap
            // Low-res internal rendering for pixelated effect
            const SCALE_FACTOR = 0.25; // 1/4th resolution
            const lowW = Math.floor(w * SCALE_FACTOR);
            const lowH = Math.floor(h * SCALE_FACTOR);

            const buffer = new Float32Array(lowW * lowH);

            const sensors = [
                { ...sensorPositions[0], val: currentSensors.current[0] },
                { ...sensorPositions[1], val: currentSensors.current[1] },
                { ...sensorPositions[2], val: currentSensors.current[2] },
                { ...sensorPositions[3], val: currentSensors.current[3] },
                { ...sensorPositions[4], val: currentSensors.current[4] },
                { ...sensorPositions[5], val: currentSensors.current[5] }
            ];

            const sigma = Math.max(lowW, lowH) * 0.12;
            const sigmaSquared = sigma * sigma;
            const kernelSize = Math.ceil(sigma * 3);

            sensors.forEach(pos => {
                let x = pos.x * w;
                if (side === 'left') x = w - x;
                const y = pos.y * h;

                const lx = x * SCALE_FACTOR;
                const ly = y * SCALE_FACTOR;

                const amplitude = pos.val / 1024;

                if (amplitude > 0.01) {
                    const minX = Math.max(0, Math.floor(lx - kernelSize));
                    const maxX = Math.min(lowW - 1, Math.ceil(lx + kernelSize));
                    const minY = Math.max(0, Math.floor(ly - kernelSize));
                    const maxY = Math.min(lowH - 1, Math.ceil(ly + kernelSize));

                    for (let py = minY; py <= maxY; py++) {
                        for (let px = minX; px <= maxX; px++) {
                            const dx = px - lx;
                            const dy = py - ly;
                            const distSq = dx * dx + dy * dy;
                            const val = amplitude * Math.exp(-distSq / (2 * sigmaSquared));
                            buffer[py * lowW + px] += val;
                        }
                    }
                }
            });

            let maxValue = 0;
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] > maxValue) maxValue = buffer[i];
            }
            maxValue = Math.max(maxValue, 0.1);

            const imageData = new ImageData(lowW, lowH);
            const data = imageData.data;

            const colorStops = [
                { position: 0.0, color: [5, 43, 114] },
                { position: 0.25, color: [46, 158, 207] },
                { position: 0.5, color: [126, 217, 87] },
                { position: 0.75, color: [255, 210, 77] },
                { position: 1.0, color: [216, 58, 47] }
            ];

            const interpolateColor = (value: number): [number, number, number] => {
                value = Math.max(0, Math.min(1, value));
                if (value <= 0) return colorStops[0].color as [number, number, number];
                if (value >= 1) return colorStops[colorStops.length - 1].color as [number, number, number];

                let lowerStop = colorStops[0];
                let upperStop = colorStops[1];

                for (let i = 1; i < colorStops.length; i++) {
                    if (value <= colorStops[i].position) {
                        lowerStop = colorStops[i - 1];
                        upperStop = colorStops[i];
                        break;
                    }
                }
                const factor = (value - lowerStop.position) / (upperStop.position - lowerStop.position);
                return [
                    Math.round(lowerStop.color[0] + (upperStop.color[0] - lowerStop.color[0]) * factor),
                    Math.round(lowerStop.color[1] + (upperStop.color[1] - lowerStop.color[1]) * factor),
                    Math.round(lowerStop.color[2] + (upperStop.color[2] - lowerStop.color[2]) * factor)
                ];
            };

            for (let i = 0; i < buffer.length; i++) {
                const norm = Math.min(buffer[i] / maxValue, 1);
                const t = Math.pow(norm, 0.9);
                const [r, g, b] = interpolateColor(t);
                const idx = i * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = Math.floor(t * 255);
            }

            const offScreen = document.createElement('canvas');
            offScreen.width = lowW;
            offScreen.height = lowH;
            const offCtx = offScreen.getContext('2d');
            if (offCtx) {
                offCtx.putImageData(imageData, 0, 0);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(offScreen, 0, 0, lowW, lowH, 0, 0, w, h);
            }

            animationFrameId.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [side, insoleImage, sensorPositions]); // Removed 'samples' dependency to avoid loop reset

    return (
        <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2 uppercase">{side} Foot</div>
            <canvas
                ref={canvasRef}
                width={300}
                height={500}
                className="rounded-lg border border-gray-800"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};
