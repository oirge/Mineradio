import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wall } from './lattice-performance/Wall';
import type { ProbeDefinition } from './definition';
import '../../src/components/app/lattice/Lattice.css';

// dev/probes/latticeExit.probe.tsx
// The leaving wave only exists under a presence boundary, and the wall is never re-rendered once
// it starts leaving, so its per-card delay has to resolve at that moment. Mirrors App.tsx's own
// AnimatePresence shape - a keyed wrapper that fades while the posters retrace their flight.
function LatticeExitProbe() {
    const [present, setPresent] = useState(true);
    const [gone, setGone] = useState(false);
    return <div style={{ height: '100vh', position: 'relative' }} data-gone={gone}>
        <button style={{ position: 'absolute', zIndex: 50 }} onClick={() => setPresent(false)}>离开</button>
        <AnimatePresence initial={false} onExitComplete={() => setGone(true)}>
            {present && <motion.div key="lattice" style={{ position: 'absolute', inset: 0 }}
                initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.62, ease: 'easeIn' }}>
                <Wall count={120} />
            </motion.div>}
        </AnimatePresence>
    </div>;
}

export default { id: 'latticeExit', title: 'Lattice leaving wave',
    description: 'The wall under a presence boundary: posters must still retrace the entry wave in reverse.',
    Component: LatticeExitProbe } satisfies ProbeDefinition;
