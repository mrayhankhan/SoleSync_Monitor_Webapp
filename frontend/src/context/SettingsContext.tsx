import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Point {
    x: number;
    y: number;
}

interface SettingsContextType {
    insoleImage: string | null;
    setInsoleImage: (image: string | null) => void;
    leftSensorPositions: Point[];
    rightSensorPositions: Point[];
    updateSensorPosition: (side: 'left' | 'right', index: number, x: number, y: number) => void;
    resetPositions: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_POSITIONS: Point[] = [
    { x: 0.35, y: 0.25 }, // Metatarsal 1
    { x: 0.65, y: 0.25 }, // Metatarsal 2
    { x: 0.35, y: 0.45 }, // Midfoot
    { x: 0.65, y: 0.45 }, // Lateral Mid
    { x: 0.5, y: 0.6 },   // Arch
    { x: 0.5, y: 0.85 }   // Heel
];

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [insoleImage, setInsoleImage] = useState<string | null>(() => {
        return localStorage.getItem('insoleImage');
    });

    const [leftSensorPositions, setLeftSensorPositions] = useState<Point[]>(() => {
        const saved = localStorage.getItem('leftSensorPositions');
        return saved ? JSON.parse(saved) : DEFAULT_POSITIONS;
    });

    const [rightSensorPositions, setRightSensorPositions] = useState<Point[]>(() => {
        const saved = localStorage.getItem('rightSensorPositions');
        return saved ? JSON.parse(saved) : DEFAULT_POSITIONS;
    });

    useEffect(() => {
        if (insoleImage) {
            localStorage.setItem('insoleImage', insoleImage);
        } else {
            localStorage.removeItem('insoleImage');
        }
    }, [insoleImage]);

    useEffect(() => {
        localStorage.setItem('leftSensorPositions', JSON.stringify(leftSensorPositions));
    }, [leftSensorPositions]);

    useEffect(() => {
        localStorage.setItem('rightSensorPositions', JSON.stringify(rightSensorPositions));
    }, [rightSensorPositions]);

    const updateSensorPosition = (side: 'left' | 'right', index: number, x: number, y: number) => {
        if (side === 'left') {
            const newPositions = [...leftSensorPositions];
            newPositions[index] = { x, y };
            setLeftSensorPositions(newPositions);
        } else {
            const newPositions = [...rightSensorPositions];
            newPositions[index] = { x, y };
            setRightSensorPositions(newPositions);
        }
    };

    const resetPositions = () => {
        setLeftSensorPositions(DEFAULT_POSITIONS);
        setRightSensorPositions(DEFAULT_POSITIONS);
    };

    return (
        <SettingsContext.Provider value={{
            insoleImage,
            setInsoleImage,
            leftSensorPositions,
            rightSensorPositions,
            updateSensorPosition,
            resetPositions
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
