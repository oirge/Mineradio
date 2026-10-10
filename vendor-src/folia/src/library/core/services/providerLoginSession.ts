import type { OnlineProviderId, QrLoginFailureKind, QrLoginState } from '../../../types/onlineMusic';
import type {
    LibraryAccountAuthPort,
    LibraryAccountClock,
    LibraryAccountLogger,
    LibraryLoginDiagnosticsEnvironment,
    LibraryLoginSelfCheck,
    LibraryTimerHandle,
} from '../contracts/account';
import {
    describeLoginError,
    knownQrLoginErrorReason,
    qrLoginErrorReasonOf,
    retryAfterMsOf,
} from '../model/accountRules';
import { resolveLoginSelfCheckVerdict } from '../model/loginSelfCheckRules';
import {
    formatQrLoginDiagnosticReport,
    QR_LOGIN_TIMELINE_LIMIT,
    type QrLoginTimelineEvent,
} from '../../../utils/qrLoginDiagnosticReport';

// src/library/core/services/providerLoginSession.ts
// 扫码登录会话（Library v2 · A2）：一轮扫码按固定的几步走，每一步都进时间线（同一条记录经日志端口打出）：
//   1. 能力判定：provider 没有 auth 能力就直接报错；
//   2. 要码：等上一轮的要码请求结算后才发（后端同一时间只允许一个要码在建会话，并发的会被拒 409），
//      等待期间又被取代就不发；拿到 key 时已被取代，就把这把 key keyed 归还；
//   3. 就绪：显示二维码，声明了寿命的 provider 由前端计时（到期先停轮询并 keyed 取消，再报「已过期」）；
//   4. 轮询：上一次结算后 2 秒才发下一次，不会重叠。网络层的瞬时失败（transient，二维码在服务端仍有效）
//      连续 PROVIDER_LOGIN_TRANSIENT_POLL_LIMIT 次以内照常接着轮询，超过才算失败；
//   5. 确认：会话已换成登录凭据，不再取消（后端要让在途轮询继续读到 803）；确认回调（账户刷新）返回 false
//      记为 account-refresh-failed；
//   6. 失败：停掉计时器，记下失败形态与后端要求的冷却，然后自动跑一次主动自检（在手机上取消除外），
//      结论放进快照，界面据此说明卡在哪一层。
// 代次：每次 start / stop / TTL 到期都前进，每个 await 之后先验代次，晚到的结果作废。
// 时间线记录完整的错误信息（名字、原文、错误码、HTTP 状态、后端原始响应），不分 provider。
// 无 React、无 window、不直接碰 omni：auth 端口、时钟、诊断环境与日志出口都由调用方注入。
// 快照只放原始状态；文案、后端故障、可见性、能否重试由 A3 用 core/model/accountRules 派生。

/** 两次轮询之间的间隔（上一个请求结算之后才开始计）。 */
export const PROVIDER_LOGIN_POLL_INTERVAL_MS = 2000;

/** 轮询连续遇到网络层瞬时失败时容忍的次数；超过才算登录失败。 */
export const PROVIDER_LOGIN_TRANSIENT_POLL_LIMIT = 2;

/** 生成诊断报告时最多等还在跑的自检多久（自检的每一项都有自己的超时，正常十秒内结束）。 */
const SELF_CHECK_REPORT_WAIT_MS = 15_000;

/** idle：还没开始过；loading：正在要码；其余是后端报的状态（与旧 hook 的 QrUiState 相同）。 */
export type ProviderLoginSessionPhase = 'idle' | 'loading' | QrLoginState['state'];

/** 会话的原始状态。没有变化时保持对象身份（useSyncExternalStore 友好）。 */
export type ProviderLoginSessionSnapshot = Readonly<{
    /** 最近一次 start 领到的会话 id（每次要码都换新，对应旧 hook 的 sessionIdRef）；从没 start 过为 0。 */
    sessionId: number;
    /** 最近一次 start 的 provider；从没 start 过为 null。 */
    providerId: OnlineProviderId | null;
    methodId: string | null;
    phase: ProviderLoginSessionPhase;
    /** 二维码图片地址；还没拿到时为空串。 */
    qrImageUrl: string;
    /** 失败形态；没扫就过期、auth 能力缺失都不算失败，为 null。 */
    failure: QrLoginFailureKind | null;
    /** 后端要求的冷却（秒，向上取整）；冷却结束自动回到 null。 */
    retryCooldownSeconds: number | null;
    /** 失败后的主动自检；没有失败或不需要自检时为 null。 */
    selfCheck: LibraryLoginSelfCheck | null;
}>;

/** 扫码确认时交给确认回调的事件。 */
export type ProviderLoginConfirmedEvent = {
    sessionId: number;
    providerId: OnlineProviderId;
    methodId: string | null;
};

/**
 * 确认回调：扫码确认后调用（旧 hook 的 onConfirmed），用来刷新账户。resolve `false` 表示扫码确认了却没拿到登录态，
 * 会话回到 error + account-refresh-failed；其余返回值都算完成。回调结算时会话代次已经变了（再次 start / stop），
 * 结果被丢弃。回调抛错按旧行为记为 check-error。
 */
export type ProviderLoginConfirmedHandler = (
    event: ProviderLoginConfirmedEvent,
) => Promise<boolean | void> | boolean | void;

export type ProviderLoginSessionDeps = {
    auth: LibraryAccountAuthPort;
    clock: LibraryAccountClock;
    diagnostics: LibraryLoginDiagnosticsEnvironment;
    /** 省略时打到 console（前缀 [ProviderQrLogin]，与旧 hook 相同）。 */
    log?: LibraryAccountLogger;
    /** 省略时确认即完成（phase 停在 confirmed）。 */
    onConfirmed?: ProviderLoginConfirmedHandler;
};

/**
 * start 的回执：sessionId 同步可得（会话已经进入 loading）；settled 在要码请求结算后 resolve
 * （拿到二维码、失败或被取代），之后的轮询进度只在快照里。
 */
export type ProviderLoginStartTicket = {
    sessionId: number;
    settled: Promise<void>;
};

export interface ProviderLoginSession {
    getSnapshot(): ProviderLoginSessionSnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * 停掉上一轮（keyed 取消它的会话），换新的会话 id 并开始要码。methodId 是 provider 声明的扫码登录方式；
     * 不传由 provider 取默认值。
     */
    start(providerId: OnlineProviderId, methodId?: string): ProviderLoginStartTicket;
    /** 停轮询、清 TTL、keyed 取消当前会话（确认后的会话不取消）。不改快照（与旧 hook 的 stop 相同）。 */
    stop(): void;
    /** 本轮时间线 + 自检 + provider 诊断；从没 start 过时为 null。自检还在跑时先等它（有上限）。 */
    buildDiagnosticReport(): Promise<string | null>;
    /** stop 并放掉全部订阅；之后的 start 不再生效。 */
    dispose(): void;
}

/** 默认日志出口：与旧 hook 打到 console 的记录相同。 */
export const consoleProviderLoginLogger: LibraryAccountLogger = (level, event, detail) => {
    console[level](`[ProviderQrLogin] ${event}`, detail);
};

// 记住活跃会话归谁：keyed 取消必须向开始会话的 provider 发，只存 key 就不知道该向谁取消。
type ActiveQrSession = { providerId: OnlineProviderId; key: string };
type ScheduledTimer = { handle: LibraryTimerHandle };
/** 一轮扫码自己的进度（不进快照）：扫过没有、轮询了几次、连续瞬时失败几次。 */
type RoundState = { sessionId: number; providerId: OnlineProviderId; methodId: string | undefined; scanned: boolean; polls: number; transientFailures: number };

const INITIAL_SNAPSHOT: ProviderLoginSessionSnapshot = Object.freeze({
    sessionId: 0,
    providerId: null,
    methodId: null,
    phase: 'idle',
    qrImageUrl: '',
    failure: null,
    retryCooldownSeconds: null,
    selfCheck: null,
});

const sameSnapshot = (a: ProviderLoginSessionSnapshot, b: ProviderLoginSessionSnapshot): boolean => (
    a.sessionId === b.sessionId
    && a.providerId === b.providerId
    && a.methodId === b.methodId
    && a.phase === b.phase
    && a.qrImageUrl === b.qrImageUrl
    && a.failure === b.failure
    && a.retryCooldownSeconds === b.retryCooldownSeconds
    && a.selfCheck === b.selfCheck
);

// 轮询报 error 时进时间线的字段：后端原文、结构化原因、冷却、是否瞬时、原始返回字段（顺序固定，报告按它排）。
const describeErrorState = (result: Extract<QrLoginState, { state: 'error' }>): Record<string, unknown> => ({
    message: result.message,
    reason: result.reason,
    retryAfterMs: result.retryAfterMs,
    transient: result.transient,
    detail: result.detail,
});

/** 建一个扫码登录会话；同一时间只有一轮在跑，再次 start 会先停掉上一轮。 */
export const createProviderLoginSession = (deps: ProviderLoginSessionDeps): ProviderLoginSession => {
    const { auth, clock, diagnostics, onConfirmed } = deps;
    const log = deps.log ?? consoleProviderLoginLogger;
    const listeners = new Set<() => void>();
    let snapshot = INITIAL_SNAPSHOT;
    // 代次：start / stop / TTL 到期都前进；每个 await 之后先验代次。
    let generation = 0;
    // 最近一轮扫码的时间线：失败时连同自检与 provider 的诊断一起生成报告。只保留一轮，重新开始即清空。
    let timeline: QrLoginTimelineEvent[] = [];
    let meta: { providerId: OnlineProviderId | null; methodId: string | null; startedAt: number } = {
        providerId: null,
        methodId: null,
        startedAt: 0,
    };
    let checkTimer: ScheduledTimer | null = null;
    let ttlTimer: ScheduledTimer | null = null;
    let cooldownTimer: ScheduledTimer | null = null;
    let activeSession: ActiveQrSession | null = null;
    // 还在路上的要码请求（不论结果都会结算）。新一轮要码前先等它，同一时间只让一个要码请求到后端。
    let pendingCreate: Promise<void> | null = null;
    // 这一轮还在跑的自检：生成报告时先等它。
    let pendingSelfCheck: { sessionId: number; done: Promise<void> } | null = null;
    let lastLoggedPhase: ProviderLoginSessionPhase = 'idle';
    let disposed = false;

    const update = (patch: Partial<ProviderLoginSessionSnapshot>): void => {
        const next = { ...snapshot, ...patch };
        if (sameSnapshot(snapshot, next)) return;
        snapshot = next;
        for (const listener of [...listeners]) listener();
    };

    const schedule = (callback: () => void, ms: number): ScheduledTimer => ({ handle: clock.setTimeout(callback, ms) });

    const clearTimer = (timer: ScheduledTimer | null): null => {
        if (timer) clock.clearTimeout(timer.handle);
        return null;
    };

    const isCurrent = (round: RoundState): boolean => round.sessionId === generation;

    // 同一条记录既进时间线，也经日志端口打出（打包版可在开发者设置的日志面板里看到）。
    const note = (event: string, detail: Record<string, unknown> = {}, level: 'info' | 'warn' = 'info'): void => {
        const at = clock.now();
        const entry = { at, event, detail: { ...detail, elapsedMs: at - meta.startedAt } };
        timeline = [...timeline, entry].slice(-QR_LOGIN_TIMELINE_LIMIT);
        log(level, event, { providerId: meta.providerId, ...entry.detail });
    };

    // 取消是 keyed 的，只放掉自己这一把 key；全局清空会在多客户端场景下杀掉别人正在手机上确认的会话。
    // Fire-and-forget：关窗时不该等后端回话，取消失败最多留下一个会自己过期的会话。
    const releaseSession = (session: ActiveQrSession | null): void => {
        if (!session) return;
        const logCancelError = (error: unknown) => {
            log('warn', 'cancel:error', { providerId: session.providerId, ...describeLoginError(error) });
        };
        try {
            void Promise.resolve(auth.cancelQrLogin(session.providerId, session.key)).catch(logCancelError);
        } catch (error) {
            logCancelError(error);
        }
    };

    // 记下后端要求的冷却；冷却结束只清这个字段，不动其余状态。新一轮开始（start）时重置。
    const beginCooldown = (retryAfterMs: number | null): void => {
        cooldownTimer = clearTimer(cooldownTimer);
        if (retryAfterMs === null || retryAfterMs <= 0) return;
        update({ retryCooldownSeconds: Math.ceil(retryAfterMs / 1000) });
        cooldownTimer = schedule(() => {
            cooldownTimer = null;
            update({ retryCooldownSeconds: null });
        }, retryAfterMs);
    };

    const stop = (): void => {
        generation += 1;
        checkTimer = clearTimer(checkTimer);
        ttlTimer = clearTimer(ttlTimer);
        releaseSession(activeSession);
        activeSession = null;
    };

    // ─── 第 6 步：失败后的主动自检 ─────────────────────────────────────

    // 结果按会话 id 认领（而不是代次）：失败后关窗、TTL 到期都会推进代次，但这一轮的结论仍属于这一轮；
    // 只有新的 start 换了会话 id 才作废。
    const runSelfCheck = (sessionId: number, providerId: OnlineProviderId): void => {
        let supported = false;
        try {
            supported = auth.canRunQrLoginSelfCheck(providerId);
        } catch {
            // provider 刚被移除（例如关掉了 mod 源）：没有可检查的对象。
        }
        if (!supported) return;
        update({ selfCheck: { status: 'running' } });
        note('self-check:start');
        const done = (async () => {
            let selfCheck: LibraryLoginSelfCheck | null;
            try {
                const result = await auth.runQrLoginSelfCheck(providerId);
                if (snapshot.sessionId !== sessionId) return;
                if (!result) {
                    selfCheck = null;
                    note('self-check', { result: 'nothing to check' });
                } else {
                    const verdict = resolveLoginSelfCheckVerdict(result);
                    selfCheck = { status: 'done', result, verdict };
                    note('self-check', {
                        verdict: verdict.kind,
                        detail: verdict.detail ?? undefined,
                        proxy: verdict.proxy ?? undefined,
                        durationMs: result.durationMs,
                    }, verdict.kind === 'network-ok' ? 'info' : 'warn');
                }
            } catch (error) {
                if (snapshot.sessionId !== sessionId) return;
                selfCheck = { status: 'failed', message: error instanceof Error ? error.message : String(error) };
                note('self-check:error', describeLoginError(error), 'warn');
            }
            update({ selfCheck });
        })();
        pendingSelfCheck = { sessionId, done };
    };

    /** 进入失败：记下失败形态与冷却；不是用户自己在手机上取消的，自动跑一次自检。 */
    const fail = (
        round: RoundState,
        phase: 'error' | 'expired',
        failure: QrLoginFailureKind | null,
        retryAfterMs: number | null = null,
    ): void => {
        checkTimer = clearTimer(checkTimer);
        // 终态不再轮询，留着 TTL 计时器只会在界面关掉后才触发。
        ttlTimer = clearTimer(ttlTimer);
        update({ phase, failure });
        beginCooldown(retryAfterMs);
        if (failure !== null && failure !== 'canceled-on-device') runSelfCheck(round.sessionId, round.providerId);
    };

    // ─── 第 5 步：确认 ─────────────────────────────────────────────────

    const confirm = async (round: RoundState): Promise<void> => {
        checkTimer = clearTimer(checkTimer);
        ttlTimer = clearTimer(ttlTimer);
        // 会话已经换成登录凭据，不该再取消：后端要让在途的轮询继续读到 803。
        activeSession = null;
        const completed = onConfirmed
            ? await onConfirmed({ sessionId: round.sessionId, providerId: round.providerId, methodId: round.methodId ?? null })
            : undefined;
        if (!isCurrent(round)) return;
        note('complete', { completed: completed !== false }, completed === false ? 'warn' : 'info');
        if (completed === false) fail(round, 'error', 'account-refresh-failed');
    };

    // ─── 第 4 步：轮询 ─────────────────────────────────────────────────

    const scheduleNextPoll = (round: RoundState, key: string): void => {
        checkTimer = schedule(() => { void poll(round, key); }, PROVIDER_LOGIN_POLL_INTERVAL_MS);
    };

    const handlePollResult = async (round: RoundState, key: string, result: QrLoginState): Promise<void> => {
        if (result.state === 'error' && result.transient && round.transientFailures < PROVIDER_LOGIN_TRANSIENT_POLL_LIMIT) {
            // 没拿到上游的回应，二维码在服务端仍然有效：界面保持原样，接着轮询。
            round.transientFailures += 1;
            note('poll:retry', { polls: round.polls, attempt: round.transientFailures, ...describeErrorState(result) }, 'warn');
            scheduleNextPoll(round, key);
            return;
        }
        round.transientFailures = 0;
        if (result.state === 'scanned') round.scanned = true;
        if (lastLoggedPhase !== result.state) {
            lastLoggedPhase = result.state;
            note('state', {
                state: result.state,
                polls: round.polls,
                ...(result.state === 'error' ? describeErrorState(result) : {}),
            }, result.state === 'error' ? 'warn' : 'info');
        }

        switch (result.state) {
            case 'waiting':
            case 'scanned':
                update({ phase: result.state });
                scheduleNextPoll(round, key);
                return;
            case 'confirmed':
                update({ phase: 'confirmed' });
                await confirm(round);
                return;
            case 'expired':
                // 扫过码之后才过期，多半是手机端的确认被拒了，要当失败处理。
                fail(round, 'expired', round.scanned ? 'expired-after-scan' : null);
                return;
            case 'error':
                // 已知的结构化原因本身就是失败形态；没有或不认识时按普通的轮询失败。
                fail(round, 'error', knownQrLoginErrorReason(result.reason) ?? 'check-error', result.retryAfterMs ?? null);
                return;
        }
    };

    // 串行轮询：上一个 check 结算之后才排下一次，不会重叠。确认回调在这里面 await，它抛错同样记为 check-error。
    const poll = async (round: RoundState, key: string): Promise<void> => {
        if (!isCurrent(round)) return;
        try {
            round.polls += 1;
            const result = await auth.checkQrLogin(round.providerId, key);
            if (!isCurrent(round)) return;
            await handlePollResult(round, key, result);
        } catch (error) {
            if (!isCurrent(round)) return;
            note('check:error', { polls: round.polls, scanned: round.scanned, ...describeLoginError(error) }, 'warn');
            fail(round, 'error', qrLoginErrorReasonOf(error) ?? 'check-error', retryAfterMsOf(error));
        }
    };

    // ─── 第 3 步：就绪 ─────────────────────────────────────────────────

    // 只有声明了二维码寿命的 provider 才由前端计时；其余仍旧等后端把过期报上来。
    const armTtl = (round: RoundState): void => {
        const ttlMs = auth.getQrTtlMs(round.providerId);
        if (ttlMs === null) return;
        ttlTimer = schedule(() => {
            note('state', { state: 'expired', source: 'ttl', scanned: round.scanned, polls: round.polls });
            // 先停轮询并取消会话，再报「已过期」——此时界面的重试已经可用。
            stop();
            fail(round, 'expired', round.scanned ? 'expired-after-scan' : null);
        }, ttlMs);
    };

    // ─── 第 2 步：要码 ─────────────────────────────────────────────────

    /** 发出要码请求并登记为在途；同步抛错由调用方按 start-error 处理，此时没有在途请求，不必登记。 */
    const requestQr = (round: RoundState): Promise<{ key: string; imageUrl: string }> => {
        const request = Promise.resolve(auth.createQrLogin(round.providerId, round.methodId));
        const settledRequest = request.then(() => undefined, () => undefined);
        pendingCreate = settledRequest;
        void settledRequest.then(() => {
            if (pendingCreate === settledRequest) pendingCreate = null;
        });
        return request;
    };

    // ─── 一轮扫码 ─────────────────────────────────────────────────────

    const run = async (round: RoundState): Promise<void> => {
        note('start', { methodId: round.methodId });
        // 第 1 步：能力判定。
        if (!auth.getProviderCapabilities(round.providerId).auth) {
            update({ phase: 'error' });
            return;
        }

        let qr: { key: string; imageUrl: string };
        try {
            if (pendingCreate) {
                await pendingCreate;
                // 等的时候又被更新的 start（或 stop）取代：这一轮不再要码，交给更新的那一轮。
                if (!isCurrent(round)) return;
            }
            qr = await requestQr(round);
        } catch (error) {
            if (!isCurrent(round)) return;
            note('start:error', describeLoginError(error), 'warn');
            fail(round, 'error', qrLoginErrorReasonOf(error) ?? 'start-error', retryAfterMsOf(error));
            return;
        }
        if (!isCurrent(round)) {
            // 这一轮已被更新的 start（或 stop）取代（例如连点刷新）：把刚拿到的会话还回去，
            // 否则它会一直占着后端直到 TTL 到期。
            releaseSession({ providerId: round.providerId, key: qr.key });
            return;
        }

        activeSession = { providerId: round.providerId, key: qr.key };
        update({ qrImageUrl: qr.imageUrl, phase: 'waiting' });
        lastLoggedPhase = 'waiting';
        note('ready');
        armTtl(round);
        scheduleNextPoll(round, qr.key);
    };

    const start = (providerId: OnlineProviderId, methodId?: string): ProviderLoginStartTicket => {
        if (disposed) return { sessionId: snapshot.sessionId, settled: Promise.resolve() };
        stop();
        cooldownTimer = clearTimer(cooldownTimer);
        const sessionId = generation;
        timeline = [];
        meta = { providerId, methodId: methodId ?? null, startedAt: clock.now() };
        lastLoggedPhase = 'loading';
        pendingSelfCheck = null;
        update({
            sessionId,
            providerId,
            methodId: methodId ?? null,
            phase: 'loading',
            qrImageUrl: '',
            failure: null,
            retryCooldownSeconds: null,
            selfCheck: null,
        });
        const round: RoundState = { sessionId, providerId, methodId, scanned: false, polls: 0, transientFailures: 0 };
        return { sessionId, settled: run(round) };
    };

    // 等还在跑的自检（属于当前会话的那个），最多等 SELF_CHECK_REPORT_WAIT_MS。
    const waitForSelfCheck = async (): Promise<void> => {
        const pending = pendingSelfCheck;
        if (!pending || pending.sessionId !== snapshot.sessionId) return;
        let timer: ScheduledTimer | null = null;
        await Promise.race([
            pending.done,
            new Promise<void>(resolve => { timer = schedule(resolve, SELF_CHECK_REPORT_WAIT_MS); }),
        ]);
        clearTimer(timer);
    };

    // 生成可以直接贴进 issue 的诊断报告：本轮时间线 + 自检 + provider 自己的诊断（后端状态、拉起步骤、请求与连接记录）。
    const buildDiagnosticReport = async (): Promise<string | null> => {
        const { providerId, methodId } = meta;
        if (providerId === null) return null;
        await waitForSelfCheck();
        return formatQrLoginDiagnosticReport({
            generatedAt: clock.now(),
            appVersion: diagnostics.appVersion,
            userAgent: diagnostics.userAgent,
            providerId,
            methodId,
            failure: snapshot.failure,
            timeline,
            selfCheck: snapshot.selfCheck,
            providerLines: await auth.getQrLoginDiagnostics(providerId),
        });
    };

    return {
        getSnapshot: () => snapshot,
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        start,
        stop,
        buildDiagnosticReport,
        dispose: () => {
            stop();
            cooldownTimer = clearTimer(cooldownTimer);
            disposed = true;
            listeners.clear();
        },
    };
};
