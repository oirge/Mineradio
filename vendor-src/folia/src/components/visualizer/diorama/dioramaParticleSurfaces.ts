import { type DioramaParticleClusterAnchor } from './dioramaGeometry';

// src/components/visualizer/diorama/dioramaParticleSurfaces.ts
// Builds each primitive's point lattice. Two rules here are the whole reason sharp-edged shapes now
// survive a large displacement, and breaking either of them is what tore the old cube open:
//
// 1. WELD - never stitch independent plates. A cube is ONE shell lattice and a tetrahedron's faces are
//    triangular lattices that INCLUDE their boundaries, so a point on an edge lands at exactly the same
//    coordinates whichever face you approach it from. (The old box sampled six independent 12x8 grids: a
//    shared edge carried 12 points from one face and 8 from the other, only 2 of which coincided - a
//    seam that existed at rest, before any audio.)
// 2. NORMALS MUST BE A CONTINUOUS FUNCTION OF POSITION. The baked normal is the direction the shader
//    displaces along. A FLAT face normal jumps 90 degrees across an edge, so ANY displacement along it
//    pulls the two faces in different directions - no amount of amplitude tuning can hide that. Every
//    lattice below bakes a smooth field instead: coincident points get an identical direction, and
//    neighbours get near-identical ones, so a ripple crosses an edge without breaking.
//
// Subdivisions also account for the shader's yStretch, so a 3.4x pillar stays evenly sampled instead of
// spacing its rows 5.3x further apart than its columns (which read as stacked slats, not a solid pillar).
export interface DioramaStructuredSurface {
    positions: Float32Array;
    normals: Float32Array;
    /**
     * The lattice's own mean distance from its centre - i.e. how big this primitive actually is, in its
     * own local units. The shader displaces by a FRACTION of it, so one amplitude number means the same
     * thing for every primitive (and for the tunnel, which passes its radius here).
     */
    radius: number;
    /** Actual point count. Welding and shell topology make this differ from the requested budget. */
    count: number;
    /**
     * Distance between neighbouring lattice points, expressed in units of `radius` (i.e. in the same unit
     * space the shader reads its ripple field in). This is a HARD CEILING on wave detail, not a taste
     * knob: a wavelength shorter than ~4 of these puts neighbouring points on opposite phases, and the
     * crest stops reading as a surface and starts reading as the random scatter we are told to avoid.
     * The shader clamps every wavenumber against it, so raising the density slider genuinely buys finer
     * ripples and lowering it degrades them gracefully instead of aliasing.
     */
    spacing: number;
}

const surfaceCache = new Map<string, DioramaStructuredSurface>();
const TWO_PI = Math.PI * 2;

const BOX_HALF = 0.55;
const CYLINDER_RADIUS = 0.58;
const CYLINDER_HALF_HEIGHT = 0.75;
const TORUS_MAJOR = 0.68;
const TORUS_TUBE = 0.12;
const TETRA_VERTICES: Array<[number, number, number]> = [
    [0, 0.86, 0],
    [-0.81, -0.5, 0.47],
    [0.81, -0.5, 0.47],
    [0, -0.5, -0.94],
];
const TETRA_FACES = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
const TETRA_CENTER: [number, number, number] = [0, -0.16, 0];

interface Lattice {
    positions: number[];
    normals: number[];
    /** Widest gap between neighbouring points, in the lattice's own local units. */
    spacing: number;
}

const push = (out: Lattice, p: [number, number, number], n: [number, number, number]) => {
    out.positions.push(p[0], p[1], p[2]);
    out.normals.push(n[0], n[1], n[2]);
};

const unit = (x: number, y: number, z: number): [number, number, number] => {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
};

/**
 * The outward direction for the flat-faced primitives (box, tetrahedron): straight out from the shape's
 * centre. It is the SMOOTHEST continuous field available, which is what matters - the direction is what
 * the shader displaces along, so how fast it turns between neighbours decides whether the lattice tears.
 * At a face centre it still equals the true face normal; toward an edge it leans over gradually, so a
 * swell inflates the shape elastically instead of sliding each face off on its own vector.
 *
 * A sharper superellipsoid normal (|p/half|^5) was tried to keep the faces flatter, and measurably tore:
 * it crams the whole turn into the last lattice step, leaving points either side of an edge 58 degrees
 * apart - at full swell that is ~2x the lattice spacing of relative motion, i.e. a visible split.
 */
const radialNormal = (
    p: [number, number, number],
    center: [number, number, number] = [0, 0, 0],
): [number, number, number] => unit(p[0] - center[0], p[1] - center[1], p[2] - center[2]);

const countBoxShell = (across: number, tall: number): number => (
    2 * (across * tall + tall * across + across * across) - 4 * (across + tall + across) + 8
);

/** The largest shell that fits the budget and stays evenly spaced once the shader applies yStretch. */
const resolveBoxShell = (budget: number, stretchY: number): [number, number] => {
    let best: [number, number] = [2, 2];
    for (let across = 2; across <= 96; across += 1) {
        const tall = Math.max(2, Math.round(1 + (across - 1) * stretchY));
        if (countBoxShell(across, tall) > budget) break;
        best = [across, tall];
    }
    return best;
};

/** One closed shell: every edge and corner point exists exactly once, shared by the faces that meet there. */
const buildBoxSurface = (budget: number, stretchY: number, out: Lattice) => {
    const [across, tall] = resolveBoxShell(budget, stretchY);
    const axis = (index: number, steps: number): number => (index / (steps - 1) - 0.5) * 2 * BOX_HALF;
    // The shell is sampled on a regular grid; the widest step is the coarsest of the three axes.
    out.spacing = (2 * BOX_HALF) / Math.max(1, Math.min(across, tall) - 1);
    for (let iy = 0; iy < tall; iy += 1) {
        for (let iz = 0; iz < across; iz += 1) {
            for (let ix = 0; ix < across; ix += 1) {
                const interior = ix > 0 && ix < across - 1
                    && iy > 0 && iy < tall - 1
                    && iz > 0 && iz < across - 1;
                if (interior) continue;
                const p: [number, number, number] = [axis(ix, across), axis(iy, tall), axis(iz, across)];
                push(out, p, radialNormal(p));
            }
        }
    }
};

/** A ring grid: already welded (the angle wraps) and its radial normal is already continuous. */
const buildCylinderSurface = (budget: number, stretchY: number, out: Lattice) => {
    // Aim for square cells on the STRETCHED wall: circumference vs the stretched height.
    const aspect = (TWO_PI * CYLINDER_RADIUS) / (2 * CYLINDER_HALF_HEIGHT * Math.max(0.2, stretchY));
    const rows = Math.max(2, Math.round(Math.sqrt(budget / Math.max(0.1, aspect))));
    const columns = Math.max(3, Math.floor(budget / rows));
    // Rows are spaced up the UNSTRETCHED wall (the field reads the unstretched position); columns by arc.
    out.spacing = Math.max(
        (2 * CYLINDER_HALF_HEIGHT) / (rows - 1),
        (TWO_PI * CYLINDER_RADIUS) / columns,
    );
    for (let row = 0; row < rows; row += 1) {
        const y = (row / (rows - 1) - 0.5) * 2 * CYLINDER_HALF_HEIGHT;
        for (let column = 0; column < columns; column += 1) {
            const angle = (column / columns) * TWO_PI;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            push(out, [cosine * CYLINDER_RADIUS, y, sine * CYLINDER_RADIUS], [cosine, 0, sine]);
        }
    }
};

/**
 * Barycentric lattices that INCLUDE each face's boundary, so the four faces land identical points along
 * their six shared edges. Those coincident points are left in place rather than deduplicated: the shader's
 * displacement is a pure function of position, so they always move as one and simply read as one point.
 */
const buildTetrahedronSurface = (budget: number, out: Lattice) => {
    let steps = 1;
    while (TETRA_FACES.length * (((steps + 2) * (steps + 3)) / 2) <= budget) steps += 1;
    // Every edge of a regular tetrahedron with these vertices is ~1.63 long, cut into `steps` spans.
    out.spacing = Math.hypot(
        TETRA_VERTICES[0][0] - TETRA_VERTICES[1][0],
        TETRA_VERTICES[0][1] - TETRA_VERTICES[1][1],
        TETRA_VERTICES[0][2] - TETRA_VERTICES[1][2],
    ) / steps;
    for (const [first, second, third] of TETRA_FACES) {
        const a = TETRA_VERTICES[first];
        const b = TETRA_VERTICES[second];
        const c = TETRA_VERTICES[third];
        for (let i = 0; i <= steps; i += 1) {
            for (let j = 0; j <= steps - i; j += 1) {
                const wa = i / steps;
                const wb = j / steps;
                const wc = 1 - wa - wb;
                const p: [number, number, number] = [0, 1, 2].map((axis) => (
                    a[axis] * wa + b[axis] * wb + c[axis] * wc
                )) as [number, number, number];
                push(out, p, radialNormal(p, TETRA_CENTER));
            }
        }
    }
};

/** Already welded (both angles wrap) and its tube normal is already a smooth field. */
const buildTorusSurface = (budget: number, out: Lattice) => {
    const minor = Math.max(4, Math.round(Math.sqrt(budget / 4)));
    const major = Math.max(6, Math.floor(budget / minor));
    out.spacing = Math.max(
        (TWO_PI * (TORUS_MAJOR + TORUS_TUBE)) / major,
        (TWO_PI * TORUS_TUBE) / minor,
    );
    for (let i = 0; i < major; i += 1) {
        const majorAngle = (i / major) * TWO_PI;
        const majorCosine = Math.cos(majorAngle);
        const majorSine = Math.sin(majorAngle);
        for (let j = 0; j < minor; j += 1) {
            const minorAngle = (j / minor) * TWO_PI;
            const minorCosine = Math.cos(minorAngle);
            const minorSine = Math.sin(minorAngle);
            const radius = TORUS_MAJOR + TORUS_TUBE * minorCosine;
            push(
                out,
                [radius * majorCosine, TORUS_TUBE * minorSine, radius * majorSine],
                [minorCosine * majorCosine, minorSine, minorCosine * majorSine],
            );
        }
    }
};

export const buildDioramaStructuredSurface = (
    kind: DioramaParticleClusterAnchor['kind'],
    budget: number,
    stretchY = 1,
): DioramaStructuredSurface => {
    // Bucket the stretch so a continuous slider still hits a small, stable set of cached lattices.
    const stretchKey = Math.round(Math.max(0.2, stretchY) * 4) / 4;
    const cacheKey = `${kind}:${budget}:${stretchKey}`;
    const cached = surfaceCache.get(cacheKey);
    if (cached) return cached;

    const out: Lattice = { positions: [], normals: [], spacing: 0 };
    if (kind === 'box') buildBoxSurface(budget, stretchKey, out);
    else if (kind === 'sphere') buildCylinderSurface(budget, stretchKey, out);
    else if (kind === 'cone') buildTetrahedronSurface(budget, out);
    else buildTorusSurface(budget, out);

    const positions = Float32Array.from(out.positions);
    const normals = Float32Array.from(out.normals);
    const count = positions.length / 3;
    let total = 0;
    for (let index = 0; index < count; index += 1) {
        total += Math.hypot(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
    }
    const radius = count > 0 ? total / count : 1;
    const surface: DioramaStructuredSurface = {
        positions,
        normals,
        radius,
        count,
        // Into the unit space the shader reads the field in (position / radius).
        spacing: out.spacing / radius,
    };
    surfaceCache.set(cacheKey, surface);
    return surface;
};
