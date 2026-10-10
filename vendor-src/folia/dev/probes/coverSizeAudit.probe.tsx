import { useMemo, useState } from 'react';
import CoverSizeAuditPanel from '../../src/components/shared/CoverSizeAuditPanel';
import { COVER_SIZE_STEPS, getSizedCoverUrl } from '../../src/utils/coverUrl';
import type { ProbeDefinition } from './definition';

// dev/probes/coverSizeAudit.probe.tsx
// The cover audit panel against the real Netease CDN, so its verdicts can be checked without a
// signed-in session. These are public album-art URLs already present in the repository's fixtures;
// the probe requests each one at every ladder step and lets the panel report what came back.
//
// Loading is deliberate rather than incidental: the panel reads whatever the page has fetched, and
// with nothing fetched it has nothing to say. In the app the same rows appear from ordinary
// browsing - this only removes the need to sign in to see them.

const ASSETS = [
    'https://p1.music.126.net/QrD8drwrRcegfKLPoiiG2Q==/109951166288436155.jpg',
    'https://p1.music.126.net/pSbvYkrzZ1RFKqoh-fA9AQ==/109951166352922615.jpg',
];

function CoverSizeAuditProbe() {
    const [loading, setLoading] = useState(false);
    // Every step plus the untouched original, which is the row that says how big the source is.
    const requests = useMemo(() => ASSETS.flatMap(asset => [
        asset,
        ...COVER_SIZE_STEPS.map(step => getSizedCoverUrl(asset, step)),
    ]), []);

    return (
        <div className="min-h-screen bg-zinc-900 p-6 text-zinc-100">
            <div className="mb-4 flex items-center gap-3">
                <button
                    type="button"
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs"
                    onClick={() => setLoading(true)}
                    disabled={loading}
                    data-probe-load
                >
                    {loading ? 'requested' : `Request ${requests.length} covers`}
                </button>
                <span className="text-xs opacity-60">
                    Real CDN requests. The panel fills in as each one lands.
                </span>
            </div>

            <div className="max-w-3xl">
                <CoverSizeAuditPanel isDaylight={false} panelClass="rounded-xl border border-white/10 bg-black/15" />
            </div>

            {/* Off screen rather than hidden: a display:none image is still fetched, but keeping them
                laid out makes a broken URL visible while poking at the probe by hand. */}
            <div className="pointer-events-none absolute -left-[9999px] top-0" aria-hidden>
                {loading && requests.map(url => <img key={url} src={url} alt="" width={32} height={32} />)}
            </div>
        </div>
    );
}

export default {
    id: 'coverSizeAudit', title: 'Cover size audit',
    description: 'What the cover CDNs return versus what the sizing ladder asked them for.',
    Component: CoverSizeAuditProbe,
} satisfies ProbeDefinition;
