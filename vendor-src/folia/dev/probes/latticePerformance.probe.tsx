import { useEffect, useMemo, useRef, useState } from 'react';
import { TitleFitCacheContext, TitleFitterContext } from '../../src/hooks/useSettledTitle';
import { createTitleFitCache } from '../../src/utils/settledTitleCache';
import { emptyCounters, makeFitter, type Strategy } from './lattice-performance/strategies';
import { runWorkload, type Job, type Result, type Scenario } from './lattice-performance/run';
import { Wall } from './lattice-performance/Wall';
import type { ProbeDefinition } from './definition';
import '../../src/components/app/lattice/Lattice.css';
import './lattice-performance/probe.css';

// dev/probes/latticePerformance.probe.tsx — sequential, repeatable comparisons on the production Lattice wall.
const STRATEGIES: Strategy[] = ['original', 'current', 'dom'];
const SCENARIOS: Scenario[] = ['scale', 'reflow', 'pan'];
const labels = { original: '原版 CSS', current: '目标宽度预测', dom: '旧的 DOM 测量',
    scale: '局部连续缩放', reflow: '宽度 reflow', pan: '大范围移动' };

function Trial({ job, done, phase }: { job: Job; done: (result?: Result, error?: string) => void; phase: (value: string) => void }) {
    const host = useRef<HTMLDivElement>(null);
    const counters = useMemo(emptyCounters, []);
    const fitter = useMemo(() => makeFitter(job.strategy, counters), [job.strategy, counters]);
    // Per-trial, so a warm shared cache cannot make a later trial look free.
    const cache = useMemo(() => createTitleFitCache(), []);
    useEffect(() => {
        const controller = new AbortController();
        void document.fonts.ready.then(() => {
            if (!controller.signal.aborted && host.current) {
                return runWorkload(host.current, job, counters, controller.signal, phase);
            }
        }).then(result => { if (result) done(result); }).catch(error => {
            if (error.name !== 'AbortError') done(undefined, String(error));
        });
        return () => controller.abort();
    }, [job, counters, done, phase]);
    return <TitleFitterContext.Provider value={fitter}><TitleFitCacheContext.Provider value={cache}>
        <div className="lattice-perf-host" ref={host}><Wall count={job.count} /></div>
    </TitleFitCacheContext.Provider></TitleFitterContext.Provider>;
}

function LatticePerformanceProbe() {
    const [strategy, setStrategy] = useState<Strategy>('current');
    const [scenario, setScenario] = useState<Scenario>('reflow');
    const [count, setCount] = useState(300);
    const [seconds, setSeconds] = useState(6);
    const [repeats, setRepeats] = useState(1);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [phase, setPhase] = useState('idle');
    const [error, setError] = useState('');
    const done = useMemo(() => (result?: Result, failure?: string) => {
        if (result) setResults(previous => [...previous, result]);
        if (failure) { setError(failure); setJobs([]); }
        else setJobs(previous => previous.slice(1));
        setPhase('idle');
    }, []);
    const start = (all: boolean) => {
        setError('');
        const next: Job[] = [];
        for (let repeat = 0; repeat < repeats; repeat++) {
            for (const movement of all ? SCENARIOS : [scenario]) {
                // Rotate strategy order across repeats to reduce systematic warm-cache/thermal ordering bias.
                const variants = all ? STRATEGIES.map((_, index) => STRATEGIES[(index + repeat) % STRATEGIES.length]) : [strategy];
                for (const variant of variants) next.push({ strategy: variant, scenario: movement, count, seconds, repeat: repeat + 1 });
            }
        }
        setJobs(next);
    };
    const download = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'lattice-performance.json';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const job = jobs[0];
    useEffect(() => {
        if (!job) return;
        const hidden = () => {
            if (document.hidden) {
                setJobs([]); setPhase('idle'); setError('页面进入后台，当前轮已取消；已完成结果保留。');
            }
        };
        document.addEventListener('visibilitychange', hidden);
        return () => document.removeEventListener('visibilitychange', hidden);
    }, [job]);
    return <div className="lattice-perf">
        <header><h1>Lattice 标题性能对比</h1>
            <p>真实 Lattice 墙；每轮重新挂载，预热 2.2 秒 → 运动 → 停稳 1.4 秒。原版为当前 0.95 行高的 CSS-only 对照。</p>
            <fieldset disabled={Boolean(job)}>
                <label>方案 <select value={strategy} onChange={event => setStrategy(event.target.value as Strategy)}>{STRATEGIES.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label>运动 <select value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{SCENARIOS.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label>队列 <select value={count} onChange={event => setCount(Number(event.target.value))}>{[100, 300, 1000].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>运动秒数 <select value={seconds} onChange={event => setSeconds(Number(event.target.value))}>{[3, 6, 12].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>重复 <select value={repeats} onChange={event => setRepeats(Number(event.target.value))}>{[1, 3, 5].map(value => <option key={value}>{value}</option>)}</select></label>
                <button onClick={() => start(false)}>运行所选</button><button onClick={() => start(true)}>运行全部 9 组</button>
            </fieldset>
            <button disabled={!job} onClick={() => { setJobs([]); setPhase('idle'); }}>停止</button>
            <button disabled={!results.length} onClick={download}>导出 JSON</button>
            <button disabled={Boolean(job)} onClick={() => setResults([])}>清空结果</button>
            <output data-testid="perf-status">{job ? `${labels[job.strategy]} / ${labels[job.scenario]} / ${phase} / 剩余 ${jobs.length} 轮` : 'idle'}</output>
            {error && <p role="alert">{error}</p>}
            <p>RAF 间隔不是 GPU 耗时。DOM 读取仅统计裁切高度校验；测量总时不含 React 提交。相同设备、视口下比较，保持页面前台。</p>
        </header>
        <div className="lattice-perf-stage">{job ? <Trial key={`${results.length}-${job.strategy}-${job.scenario}-${job.repeat}`} job={job} done={done} phase={setPhase} /> : <p>选择方案后开始。运行时请勿手动拖动墙或调整窗口。</p>}</div>
        <div className="lattice-perf-results"><table><thead><tr><th>方案 / 场景 / 轮 / 队列 / 时长</th><th>阶段</th><th>平均 / P95 / 最大 ms</th><th>&gt;33.3ms / 帧数</th><th>测量次数 / DOM 读取</th><th>测量总时 ms</th><th>挂载峰值</th></tr></thead>
            <tbody>{results.flatMap((result, index) => (['motion', 'settle'] as const).map(part => {
                const stats = result[part];
                return <tr key={`${index}-${part}`}><td>{labels[result.strategy]} / {labels[result.scenario]} / {result.repeat} / {result.count} 首 / {result.seconds}s</td><td>{part}</td>
                    <td>{stats.mean.toFixed(1)} / {stats.p95.toFixed(1)} / {stats.max.toFixed(1)}</td><td>{stats.over33} / {stats.frames}</td>
                    <td>{stats.fits.calls} / {stats.fits.reads}</td><td>{stats.fits.ms.toFixed(2)}</td><td>{result.mountedPeak}</td></tr>;
            }))}</tbody></table></div>
    </div>;
}
export default { id: 'latticePerformance', title: 'Lattice performance comparison',
    description: 'Real wall: CSS baseline vs settled DOM fitting, continuous scale, reflow and pan.', Component: LatticePerformanceProbe } satisfies ProbeDefinition;
