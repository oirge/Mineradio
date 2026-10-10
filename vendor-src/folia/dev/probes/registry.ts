import type { ProbeDefinition } from './definition';
// dev/probes/registry.ts

// 沿用 visualizer background registry 的做法：新增探针只需加一个 *.probe.tsx 文件，
// 默认导出 ProbeDefinition，不用改这里。
const probeModules = import.meta.glob<{ default: ProbeDefinition }>('./*.probe.tsx', { eager: true });

const buildRegistry = () => {
    const byId: Record<string, ProbeDefinition> = {};
    for (const [path, module] of Object.entries(probeModules)) {
        if (!module.default) {
            throw new Error(`[ProbeRegistry] Missing default export in ${path}`);
        }
        if (byId[module.default.id]) {
            throw new Error(`[ProbeRegistry] Duplicate probe id "${module.default.id}"`);
        }
        byId[module.default.id] = module.default;
    }
    return byId;
};

export const PROBES = buildRegistry();
export const PROBE_LIST = Object.values(PROBES).sort((a, b) => a.id.localeCompare(b.id));
