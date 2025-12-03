import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface FootViewerProps {
    orientation: { yaw: number, pitch: number, roll: number, quaternion?: { w: number, x: number, y: number, z: number } };
    side: 'left' | 'right';
}

// Preload the model
const MODEL_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb';
useGLTF.preload(MODEL_URL);

const ShoeModel: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
    const { scene } = useGLTF(MODEL_URL);
    // Clone the scene so we can have two independent instances
    const clone = React.useMemo(() => scene.clone(), [scene]);

    return (
        <primitive
            object={clone}
            scale={[side === 'left' ? 1 : -1, 1, 1]} // Mirror for right foot
            rotation={[0, side === 'left' ? -Math.PI / 2 : Math.PI / 2, 0]} // Rotate to face forward
        />
    );
};

const FootModel: React.FC<FootViewerProps> = ({ orientation, side }) => {
    const meshRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (meshRef.current) {
            if (orientation.quaternion) {
                // Apply quaternion if available (preferred)
                meshRef.current.quaternion.set(
                    orientation.quaternion.x,
                    orientation.quaternion.y,
                    orientation.quaternion.z,
                    orientation.quaternion.w
                );
            } else {
                // Fallback to Euler
                meshRef.current.rotation.set(orientation.pitch, orientation.yaw, orientation.roll);
            }
        }
    });

    return (
        <group ref={meshRef}>
            {/* The shoe model needs to be rotated to match the IMU frame of reference. 
                Usually IMUs are flat. The model might be upright. 
                Adjust inner rotation here. */}
            <group rotation={[0, Math.PI, 0]} scale={5}>
                <ShoeModel side={side} />
            </group>

            {/* Axes Helper for debugging - make it smaller */}
            <axesHelper args={[0.5]} />
        </group>
    );
};

export const FootViewer: React.FC<{ samples: any[], isPaused?: boolean }> = ({ samples, isPaused = false }) => {
    // Get latest sample for left and right
    let latestLeft = samples.filter(s => s.foot === 'left').pop() || { orientation: { yaw: 0, pitch: 0, roll: 0, quaternion: { w: 1, x: 0, y: 0, z: 0 } } };
    let latestRight = samples.filter(s => s.foot === 'right').pop() || { orientation: { yaw: 0, pitch: 0, roll: 0, quaternion: { w: 1, x: 0, y: 0, z: 0 } } };

    // Reset to flat if paused
    if (isPaused) {
        const flatOrientation = { yaw: 0, pitch: 0, roll: 0, quaternion: { w: 1, x: 0, y: 0, z: 0 } };
        latestLeft = { ...latestLeft, orientation: flatOrientation };
        latestRight = { ...latestRight, orientation: flatOrientation };
    }

    return (
        <div className="w-full h-full">
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 2, 4]} />
                <OrbitControls />
                <ambientLight intensity={0.8} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <Environment preset="city" />

                <Suspense fallback={<mesh><boxGeometry /><meshStandardMaterial color="red" /></mesh>}>
                    {/* Right Foot (Placed on Left Side) */}
                    <group position={[-0.6, 0, 0]}>
                        <FootModel orientation={latestRight.orientation || { yaw: 0, pitch: 0, roll: 0 }} side="right" />
                        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[1.5, 3]} />
                            <meshBasicMaterial color="#1F2937" wireframe opacity={0.3} transparent />
                        </mesh>
                    </group>

                    {/* Left Foot (Placed on Right Side) */}
                    <group position={[0.6, 0, 0]}>
                        <FootModel orientation={latestLeft.orientation || { yaw: 0, pitch: 0, roll: 0 }} side="left" />
                        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[1.5, 3]} />
                            <meshBasicMaterial color="#1F2937" wireframe opacity={0.3} transparent />
                        </mesh>
                    </group>
                </Suspense>

                <gridHelper args={[10, 10, 0x444444, 0x222222]} />
            </Canvas>
        </div>
    );
};

