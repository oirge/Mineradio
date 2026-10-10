import React, { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

// src/components/shared/FastColorPicker.tsx
// Wraps react-colorful so its 60fps drag re-renders stay inside this component instead of
// re-rendering the whole editor; the parent receives values it can throttle on its own.

type FastColorPickerProps = {
    color: string;
    height?: number;
    onChange: (color: string) => void;
    onPointerDown?: () => void;
};

const FastColorPicker: React.FC<FastColorPickerProps> = ({ color, height = 236, onChange, onPointerDown }) => {
    const [localColor, setLocalColor] = useState(color);

    // Sync back when the parent switches mode or color field.
    useEffect(() => {
        setLocalColor(color);
    }, [color]);

    const handleChange = (nextColor: string) => {
        setLocalColor(nextColor);
        onChange(nextColor);
    };

    return (
        <div onPointerDown={onPointerDown} className="w-full h-full">
            <HexColorPicker color={localColor} onChange={handleChange} style={{ width: '100%', height }} />
        </div>
    );
};

export default FastColorPicker;
