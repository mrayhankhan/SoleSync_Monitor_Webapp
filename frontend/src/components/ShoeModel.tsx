import React, { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ShoeModelProps {
    quaternion: { w: number, x: number, y: number, z: number };
    accel: { x: number, y: number, z: number };
}

export const ShoeModel: React.FC<ShoeModelProps> = ({ quaternion, accel }) => {
    const group = useRef<THREE.Group>(null);
    // Use a simple box if model not found, or try to load a default model
    // For now, let's just render a box to ensure it works without external assets
    // If you have a model, replace the mesh below with:
    // const { nodes, materials } = useGLTF('/shoe.gltf');

    useFrame(() => {
        if (group.current) {
            // Apply quaternion
            group.current.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        }
    });

    return (
        <group ref={group} dispose={null}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 0.5, 2]} />
                <meshStandardMaterial color="orange" />
            </mesh>
            {/* Visual indicator for "front" */}
            <mesh position={[0, 0.25, -0.8]}>
                <boxGeometry args={[0.8, 0.1, 0.2]} />
                <meshStandardMaterial color="white" />
            </mesh>
        </group>
    );
};

// Preload if we had a model
// useGLTF.preload('/shoe.gltf');
