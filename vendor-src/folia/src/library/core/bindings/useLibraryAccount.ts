import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { OnlineProviderId, ProviderAccountSummary } from '../../../types/onlineMusic';
import type {
    LibraryAccountController,
    LibraryAccountLayerSource,
    LibraryAccountSnapshot,
    LibraryLoginSessionSnapshot,
    LibraryProviderSwitchRequest,
    LoginSelfCheckItem,
} from '../contracts/account';
import {
    canRetryLogin,
    canShowLoginDiagnostics,
    isLoginDialogVisible,
    LOGIN_FAILURE_TIPS,
    LOGIN_METHOD_STEP_COPY,
    resolveLoginDiagnosticsPrompt,
    resolveProviderSwitchCopy,
} from '../model/accountRules';
import { translateHomeMessage } from '../model/homeSources';
import {
    LOGIN_SELF_CHECK_COPY,
    resolveLoginSelfCheckItemLabel,
    resolveLoginSelfCheckProxyMessage,
    resolveLoginSelfCheckVerdictMessage,
    summarizeLoginSelfCheck,
} from '../model/loginSelfCheckRules';

// src/library/core/bindings/useLibraryAccount.ts
// 在线账户 controller 的 React 绑定：useSyncExternalStore 订阅 controller 快照，把登录与切换确认的 i18n key
// 翻译好交给 suite。细粒度 selector 只订阅快照里的一块（controller 保证各块在未变时保持身份），
// 登录弹窗不会因为账户列表刷新而重渲染。controller 由宿主创建（A4），这里不创建、不 dispose。

/** 订阅快照里的一块；selector 必须返回快照里已有的引用（或原始值），不能每次新建对象。 */
export const useLibraryAccountSelector = <T,>(
    controller: LibraryAccountController,
    selector: (snapshot: LibraryAccountSnapshot) => T,
): T => useSyncExternalStore(
    controller.subscribe,
    () => selector(controller.getSnapshot()),
    () => selector(controller.getSnapshot()),
);

const selectLogin = (snapshot: LibraryAccountSnapshot) => snapshot.login;
const selectPendingSwitch = (snapshot: LibraryAccountSnapshot) => snapshot.pendingSwitch;
const selectProviders = (snapshot: LibraryAccountSnapshot) => snapshot.providers;
const selectActiveProviderId = (snapshot: LibraryAccountSnapshot) => snapshot.activeProviderId;
const selectSnapshot = (snapshot: LibraryAccountSnapshot) => snapshot;

/** 登录方式的一项（文案已翻译；图标由 suite 按 iconKey 映射到自己的资源）。 */
export type LibraryLoginMethodView = {
    id: string;
    label: string;
    iconKey: string;
};

/** 已翻译的失败后自检。 */
export type LibraryLoginSelfCheckView = {
    title: string;
    /** 还在检查：界面显示 runningText。 */
    running: boolean;
    runningText: string;
    /** 结论；还在跑或自检本身出错时为 null。 */
    verdict: string | null;
    /** 代理提示；没有会影响登录请求的代理时为 null。 */
    proxyNote: string | null;
    /** 自检本身出错时的说明。 */
    error: string | null;
    /** 逐项结果（标签已翻译，detail 是错误码、域名等原文）。 */
    items: Array<LoginSelfCheckItem & { label: string }>;
};

/** 已翻译的登录界面。 */
export type LibraryLoginView = {
    session: LibraryLoginSessionSnapshot;
    /** 此刻是否该显示（方式还在解析、扫码已确认时不显示；刷新失败时重新显示）。 */
    visible: boolean;
    canRetry: boolean;
    canShowDiagnostics: boolean;
    title: string;
    note: string;
    /** 状态行；选方式的第一步与后端故障时为 null。 */
    status: string | null;
    /** provider 声明了多种方式时的两步式文案；单步流程为 null。 */
    methodStep: {
        title: string;
        hint: string;
        pending: string;
        /** 已选方式的说明；还没选时为空串。 */
        current: string;
        options: LibraryLoginMethodView[];
    } | null;
    /** 诊断入口的提示语；不该给诊断时为 null。 */
    diagnosticsPrompt: string | null;
    /**
     * 失败后先给的简单办法（与诊断入口同时出现）：标题、几条办法、以及收起诊断与反馈的那一项的文案。
     * suite 先显示办法，诊断与反馈放在后面。
     */
    failureTips: { title: string; items: string[]; escalation: string } | null;
    /** 后端故障界面的文案（只有 backend.failed 时非空）。 */
    backendFailure: { title: string; restartLabel: string; restartingLabel: string } | null;
    /** 失败后的自检；没有时为 null。 */
    selfCheck: LibraryLoginSelfCheckView | null;
    retryLabel: string;
    closeLabel: string;
};

/** 翻译失败后的自检（纯函数）。 */
export const translateLoginSelfCheck = (
    t: TFunction,
    selfCheck: LibraryLoginSessionSnapshot['selfCheck'],
    providerLabel: string,
): LibraryLoginSelfCheckView | null => {
    if (!selfCheck) return null;
    const base = {
        title: translateHomeMessage(t, LOGIN_SELF_CHECK_COPY.title),
        runningText: translateHomeMessage(t, LOGIN_SELF_CHECK_COPY.running),
    };
    if (selfCheck.status === 'running') {
        return { ...base, running: true, verdict: null, proxyNote: null, error: null, items: [] };
    }
    if (selfCheck.status === 'failed') {
        return {
            ...base,
            running: false,
            verdict: null,
            proxyNote: null,
            error: t(LOGIN_SELF_CHECK_COPY.failedKey, { message: selfCheck.message }),
            items: [],
        };
    }
    const proxyMessage = resolveLoginSelfCheckProxyMessage(selfCheck.verdict, providerLabel);
    return {
        ...base,
        running: false,
        verdict: translateHomeMessage(t, resolveLoginSelfCheckVerdictMessage(selfCheck.verdict, providerLabel)),
        proxyNote: proxyMessage ? translateHomeMessage(t, proxyMessage) : null,
        error: null,
        items: summarizeLoginSelfCheck(selfCheck.result)
            .filter(item => item.state !== 'skip')
            .map(item => ({ ...item, label: translateHomeMessage(t, resolveLoginSelfCheckItemLabel(item.id, selfCheck.result.runtime)) })),
    };
};

/** 已翻译的切换确认。 */
export type LibraryProviderSwitchView = {
    request: LibraryProviderSwitchRequest;
    title: string;
    description: string;
};

/** 翻译一份登录快照（纯函数，供绑定与测试共用）。providerLabel 是平台的显示名（自检结论里用）。 */
export const translateLoginSession = (
    t: TFunction,
    session: LibraryLoginSessionSnapshot,
    providerLabel: string = session.providerId,
): LibraryLoginView => {
    const { copy, methods, selectedMethodId } = session;
    const selected = methods.find(method => method.id === selectedMethodId);
    return {
        session,
        visible: isLoginDialogVisible(session),
        canRetry: canRetryLogin(session),
        canShowDiagnostics: canShowLoginDiagnostics(session),
        title: translateHomeMessage(t, copy.title),
        note: translateHomeMessage(t, copy.note),
        status: copy.status ? translateHomeMessage(t, copy.status) : null,
        methodStep: methods.length > 0
            ? {
                title: translateHomeMessage(t, LOGIN_METHOD_STEP_COPY.title),
                hint: translateHomeMessage(t, LOGIN_METHOD_STEP_COPY.hint),
                pending: translateHomeMessage(t, LOGIN_METHOD_STEP_COPY.pending),
                current: selected ? t('home.qqLoginMethodCurrent', { method: t(selected.labelKey) }) : '',
                options: methods.map(method => ({ id: method.id, label: t(method.labelKey), iconKey: method.iconKey })),
            }
            : null,
        diagnosticsPrompt: session.failure && canShowLoginDiagnostics(session)
            ? translateHomeMessage(t, resolveLoginDiagnosticsPrompt(session.failure))
            : null,
        failureTips: session.failure && canShowLoginDiagnostics(session)
            ? {
                title: translateHomeMessage(t, LOGIN_FAILURE_TIPS.title),
                items: LOGIN_FAILURE_TIPS.items.map(item => translateHomeMessage(t, item)),
                escalation: translateHomeMessage(t, LOGIN_FAILURE_TIPS.escalation),
            }
            : null,
        backendFailure: session.backend.failed
            ? {
                title: t('home.loginBackendDown'),
                restartLabel: t('home.restartBackend'),
                restartingLabel: t('home.restartingBackend'),
            }
            : null,
        selfCheck: translateLoginSelfCheck(t, session.selfCheck, providerLabel),
        retryLabel: t('home.retryQr'),
        closeLabel: t('home.closeLogin'),
    };
};

// 确认框里的平台名：与 omni.getProviderLabel 相同的取法（shortName → displayName → id）。
const providerLabelOf = (providers: readonly ProviderAccountSummary[], providerId: OnlineProviderId): string => {
    const provider = providers.find(candidate => candidate.providerId === providerId);
    return provider?.shortName || provider?.displayName || providerId;
};

/** 翻译一个待确认切换（纯函数）。 */
export const translateProviderSwitch = (
    t: TFunction,
    request: LibraryProviderSwitchRequest,
    providers: readonly ProviderAccountSummary[],
): LibraryProviderSwitchView => {
    const copy = resolveProviderSwitchCopy(providerLabelOf(providers, request.to));
    return {
        request,
        title: translateHomeMessage(t, copy.title),
        description: translateHomeMessage(t, copy.description),
    };
};

// 登录平台的显示名（自检结论里用）：选出来的是字符串，provider 列表刷新而名字没变时不会让登录界面重渲染。
const selectLoginProviderLabel = (snapshot: LibraryAccountSnapshot): string | null => (
    snapshot.login ? providerLabelOf(snapshot.providers, snapshot.login.providerId) : null
);

/** 只订阅登录会话（和它的平台名）：没有登录时为 null。 */
export const useLibraryAccountLogin = (controller: LibraryAccountController): LibraryLoginView | null => {
    const { t } = useTranslation();
    const session = useLibraryAccountSelector(controller, selectLogin);
    const providerLabel = useLibraryAccountSelector(controller, selectLoginProviderLabel);
    return useMemo(
        () => (session ? translateLoginSession(t, session, providerLabel ?? session.providerId) : null),
        [providerLabel, session, t],
    );
};

/** 只订阅待确认切换（平台名要读 provider 列表，所以也订阅它）：没有待确认请求时为 null。 */
export const useLibraryAccountPendingSwitch = (controller: LibraryAccountController): LibraryProviderSwitchView | null => {
    const { t } = useTranslation();
    const request = useLibraryAccountSelector(controller, selectPendingSwitch);
    const providers = useLibraryAccountSelector(controller, selectProviders);
    return useMemo(() => (request ? translateProviderSwitch(t, request, providers) : null), [providers, request, t]);
};

/** 只订阅 provider 列表与当前平台（账户列表 / 切换器用）。 */
export const useLibraryAccountProviders = (controller: LibraryAccountController): {
    providers: ProviderAccountSummary[];
    activeProviderId: OnlineProviderId;
} => {
    const providers = useLibraryAccountSelector(controller, selectProviders);
    const activeProviderId = useLibraryAccountSelector(controller, selectActiveProviderId);
    return useMemo(() => ({ providers, activeProviderId }), [activeProviderId, providers]);
};

export type LibraryAccountView = {
    snapshot: LibraryAccountSnapshot;
    login: LibraryLoginView | null;
    pendingSwitch: LibraryProviderSwitchView | null;
};

/** 整份快照 + 已翻译的登录与切换确认（account surface 一次拿全用）。 */
export const useLibraryAccount = (controller: LibraryAccountController): LibraryAccountView => {
    const snapshot = useLibraryAccountSelector(controller, selectSnapshot);
    const login = useLibraryAccountLogin(controller);
    const pendingSwitch = useLibraryAccountPendingSwitch(controller);
    return useMemo(() => ({ snapshot, login, pendingSwitch }), [login, pendingSwitch, snapshot]);
};

/**
 * account surface 订阅首页 surface 交上来的账户层（A5）：返回此刻接上的元素（没接时 null）。suite 拿它决定
 * portal 位置；元素换了只让订阅它的 account surface 重渲染。
 */
export const useLibraryAccountLayerElement = (layer: LibraryAccountLayerSource): HTMLElement | null => (
    useSyncExternalStore(layer.subscribe, layer.getElement, layer.getElement)
);
