import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { translateLoginSession } from '../../../src/library/core/bindings/useLibraryAccount';
import { resolveLoginSessionCopy } from '../../../src/library/core/model/accountRules';
import type { LibraryLoginSessionSnapshot } from '../../../src/library/core/contracts/account';
import { buildQrLoginFailureHelpProps } from '../../../src/library/suites/grid/account/buildQrLoginFailureHelpProps';
import OnlineProviderLoginModal from '../../../src/library/suites/grid/account/OnlineProviderLoginModal';
import type { QrLoginFailureKind } from '../../../src/types/onlineMusic';

// test/unit/navigation/qrLoginFailureHelpPresentation.test.ts
// 登录失败后的帮助：是否显示由 core 规则（canShowLoginDiagnostics → 视图的 diagnosticsPrompt / failureTips）决定，
// grid 的登录弹窗与 TUI 的 F4 都只认它。这里走「快照 → translateLoginSession → 网格弹窗」这一条，与 GridAccountSurface
// 的装配同形：帮助显示在二维码旁边，先是简单办法，诊断与反馈收在「还是不行？」下面，一开始不展开。

const failures: QrLoginFailureKind[] = [
    'start-error', 'check-error', 'expired-after-scan', 'account-refresh-failed',
];

const t = ((key: string) => key) as unknown as TFunction;

const session = (providerId: string, failure: QrLoginFailureKind | null): LibraryLoginSessionSnapshot => {
    const base = {
        id: 1,
        providerId,
        phase: failure ? 'error' as const : 'waiting' as const,
        methods: [],
        selectedMethodId: null,
        qrImageUrl: '',
        failure,
        retryCooldownSeconds: null,
        selfCheck: null,
        backend: { failed: false, detail: null, restarting: false, canRestart: false },
    };
    return { ...base, copy: resolveLoginSessionCopy(base) };
};

const render = (providerId: string, failure: QrLoginFailureKind | null) => {
    const buildReport = vi.fn(async () => 'report');
    const view = translateLoginSession(t, session(providerId, failure));
    const failureHelp = view.failureTips && view.session.failure
        ? buildQrLoginFailureHelpProps({ t, providerId, failure: view.session.failure, tips: view.failureTips, buildReport })
        : undefined;
    const html = renderToStaticMarkup(createElement(OnlineProviderLoginModal, {
        title: view.title, note: view.note, qrCodeImg: '', statusText: view.status ?? '',
        state: failure ? 'error' : 'waiting', retryLabel: view.retryLabel, closeLabel: view.closeLabel, failureHelp,
        onRetry: () => {}, onClose: () => {},
    }));
    return { view, failureHelp, html, buildReport };
};

describe('QR login failure help presentation', () => {
    it.each(['netease', 'kugou', 'qq'])('puts the simple fixes first and keeps %s diagnostics collapsed', providerId => {
        for (const failure of failures) {
            const { view, failureHelp, html, buildReport } = render(providerId, failure);
            const prompt = failure === 'expired-after-scan' ? 'home.qrDiagnosticsPromptScanned' : 'home.qrDiagnosticsPrompt';
            expect(view.diagnosticsPrompt).toBe(prompt);
            expect(view.failureTips).toEqual({
                title: 'home.qrTipsTitle',
                items: ['home.qrTipRestart', 'home.qrTipSwitchNetwork'],
                escalation: 'home.qrDiagnosticsToggle',
            });
            expect(failureHelp?.prompt).toBe(prompt);
            // 简单办法排在「还是不行？」之前；诊断与反馈一开始收着，不出现在页面上。
            expect(html.indexOf('home.qrTipRestart')).toBeLessThan(html.indexOf('home.qrTipSwitchNetwork'));
            expect(html.indexOf('home.qrTipSwitchNetwork')).toBeLessThan(html.indexOf('home.qrDiagnosticsToggle'));
            expect(html).toContain('aria-expanded="false"');
            expect(html).not.toContain('home.qrDiagnosticsCopy');
            expect(html).not.toContain('home.qrDiagnosticsReport');
            // 帮助在二维码旁边：弹窗加宽成两栏。
            expect(html).toContain('max-w-3xl');
            expect(html).toContain('sm:flex-row');
            expect(failureHelp?.buildReport).toBe(buildReport);
            expect(buildReport).not.toHaveBeenCalled();
        }
    });

    it('stays a narrow single column while nothing has failed', () => {
        const { view, failureHelp, html } = render('netease', null);
        expect(view.failureTips).toBeNull();
        expect(failureHelp).toBeUndefined();
        expect(html).toContain('max-w-sm');
        expect(html).not.toContain('max-w-3xl');
        expect(html).not.toContain('home.qrTipsTitle');
    });
});
