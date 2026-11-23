import * as THREE from 'three';
import { fitView, SEAT_HALF_TAN } from '../../../components/scenes/cinema/cinemaCamera';
import { isSeatTaken } from '../../../components/scenes/cinema/cinemaGeometry';
import { ROWS, SCREEN, rowFloor, rowZ, seatXs } from '../../../components/scenes/cinema/cinemaLayout';
import { loadCinemaReel } from '../../../components/scenes/cinema/cinemaReel';
import { createCinemaScene, type CinemaScene } from '../../../components/scenes/cinema/cinemaScene';
import { quadToMatrix3d, type ScreenQuad } from '../../../components/scenes/engine/surfaceQuad';
import { mixColors } from '../../../components/visualizer/colorMix';

// Host the upstream hall and project Mineradio's live lyric surface onto its screen.
interface CinemaInput {
    playing: boolean;
    reducedMotion: boolean;
    accent: string;
    cover: string;
    lightsUp: boolean;
    curtainsOnPause: boolean;
    power: number;
    bass: number;
}

const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = Math.round(SCREEN_WIDTH * SCREEN.height / SCREEN.width);
const PREFERRED_ROW = Math.round((ROWS.count - 1) * (2 / 3));
const TRAVEL_LIMIT = THREE.MathUtils.degToRad(80);
const CLIP_CORNERS = [
    [-SCREEN.width / 2, SCREEN.centerY + SCREEN.height / 2, 0.02],
    [SCREEN.width / 2, SCREEN.centerY + SCREEN.height / 2, 0.02],
    [SCREEN.width / 2, SCREEN.centerY - SCREEN.height / 2, 0.02],
    [-SCREEN.width / 2, SCREEN.centerY - SCREEN.height / 2, 0.02],
] as const;

export function createLocalCinema(box: HTMLElement, screen: HTMLElement, read: () => CinemaInput,
    onStatus: (status: 'ready' | 'failed') => void) {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0, 0);
    const canvas = renderer.domElement;
    box.appendChild(canvas);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90);
    const seat = seatXs().filter(x => !isSeatTaken(PREFERRED_ROW, x)).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? 0;
    camera.position.set(seat, rowFloor(PREFERRED_ROW) + 1.15, rowZ(PREFERRED_ROW, seat) - 0.3);
    const direction = new THREE.Vector3(0, SCREEN.centerY - 0.2, 0).sub(camera.position);
    const baseYaw = Math.atan2(-direction.x, -direction.z);
    const basePitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    const bufferSize = new THREE.Vector2();
    const clip = new THREE.Vector4();
    const cove = new THREE.Color();
    let hall: CinemaScene | null = null;
    let disposed = false, prepared = false, ready = false, frame = 0, lastTime = 0;
    let width = 0, height = 0, yaw = 0, pitch = 0, project = true;
    let warmUntil = 0, cover: string | undefined, coverRevision = 0, accent: string | undefined;

    const wake = () => {
        if (!disposed && prepared && !frame && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const sync = () => {
        warmUntil = performance.now() + 6500;
        wake();
    };
    const resize = () => {
        const nextWidth = box.clientWidth, nextHeight = box.clientHeight;
        if (nextWidth <= 0 || nextHeight <= 0 || (nextWidth === width && nextHeight === height)) return;
        width = nextWidth;
        height = nextHeight;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        fitView(camera, SEAT_HALF_TAN);
        project = true;
        wake();
    };
    const setCover = (url: string, playing: boolean) => {
        cover = url;
        const revision = ++coverRevision;
        if (!url) { hall?.setReel(null, playing); return; }
        void loadCinemaReel(url).then(reel => {
            if (disposed || revision !== coverRevision || !hall) reel?.texture.dispose();
            else { hall.setReel(reel, playing); sync(); }
        });
    };
    const setProjection = () => {
        const corners = CLIP_CORNERS.map(([x, y, z]) => {
            clip.set(x, y, z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
            return { x: (clip.x + clip.w) * width / 2, y: (clip.w - clip.y) * height / 2, w: clip.w };
        }) as unknown as ScreenQuad;
        screen.style.width = `${SCREEN_WIDTH}px`;
        screen.style.height = `${SCREEN_HEIGHT}px`;
        screen.style.transform = quadToMatrix3d(SCREEN_WIDTH, SCREEN_HEIGHT, corners);
    };
    function draw(now: number) {
        frame = 0;
        if (disposed || !hall || document.hidden || !width || !height) { lastTime = 0; return; }
        try {
            const input = read();
            if (input.cover !== cover) setCover(input.cover, input.playing);
            if (input.accent !== accent) {
                accent = input.accent;
                cove.setStyle(mixColors('#ffd6a8', accent, 0.4));
            }
            if (project) {
                camera.rotation.set(basePitch + pitch, baseYaw + yaw, 0, 'YXZ');
                camera.updateMatrixWorld();
                setProjection();
                project = false;
            }
            const dt = lastTime ? Math.min(0.1, Math.max(0, (now - lastTime) / 1000)) : 0;
            lastTime = now;
            const shutter = hall.update({ dt, running: input.playing, power: input.reducedMotion ? 0 : input.power,
                bass: input.reducedMotion ? 0 : input.bass, lightsUp: input.lightsUp, curtainsOnPause: input.curtainsOnPause,
                still: input.reducedMotion, cove, camera, bufferSize: renderer.getDrawingBufferSize(bufferSize) });
            hall.render(renderer, camera);
            screen.style.visibility = shutter > 0 ? '' : 'hidden';
            if (!ready) { ready = true; onStatus('ready'); }
            if (!input.reducedMotion && (input.playing || now < warmUntil)) wake();
            else lastTime = 0;
        } catch {
            fail();
        }
    }
    const observer = new ResizeObserver(resize);
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = lastTime = 0; } else sync(); };
    function dispose() {
        if (disposed) return;
        disposed = true;
        coverRevision++;
        cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener('webglcontextlost', contextLost);
        document.removeEventListener('visibilitychange', visibility);
        hall?.dispose();
        hall = null;
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
        for (const key of ['width', 'height', 'transform', 'visibility']) screen.style.removeProperty(key);
    }
    function fail() { if (!disposed) { dispose(); onStatus('failed'); } }

    observer.observe(box);
    canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibility);
    resize();
    void (async () => {
        try {
            const built = await createCinemaScene();
            if (disposed) { built.dispose(); return; }
            hall = built;
            await built.compile(renderer, camera);
            if (!disposed) { prepared = true; sync(); }
        } catch { fail(); }
    })();
    return {
        sync, dispose,
        turn: (dx: number, dy: number) => {
            yaw = THREE.MathUtils.clamp(yaw + dx, -TRAVEL_LIMIT, TRAVEL_LIMIT);
            pitch = THREE.MathUtils.clamp(pitch + dy, -TRAVEL_LIMIT - basePitch, TRAVEL_LIMIT - basePitch);
            project = true;
            wake();
        },
        reset: () => { yaw = pitch = 0; project = true; wake(); },
    };
}
