import type { ReactNode } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps } from '../../utils/mobileMotion';

// src/mineradio/local/LocalMotionStatus.tsx
// Preserve the existing centered layout while presence owns a short opacity/transform transition.
const centeredTransforms = {
    x: (_: unknown, transform: string) => `translateX(-50%)${transform === 'none' ? '' : ` ${transform}`}`,
    both: (_: unknown, transform: string) => `translate(-50%, -50%)${transform === 'none' ? '' : ` ${transform}`}`,
};

export default function LocalMotionStatus({ children, className, role, center = 'x', testId }: {
    children: ReactNode; className: string; role?: 'status' | 'alert'; center?: 'x' | 'both' | 'none'; testId?: string;
}) {
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    return <motion.div {...(mobile ? mobileMotionProps('status', reducedMotion) : {})}
        transformTemplate={mobile && center !== 'none' ? centeredTransforms[center] : undefined}
        inert={!present} aria-hidden={!present || undefined}
        role={role} className={className} data-testid={testId}>
        {children}
    </motion.div>;
}
