import type { TFunction } from 'i18next';
import type { OnlineProviderId, QrLoginFailureKind } from '../../../../types/onlineMusic';
import type { LibraryLoginSelfCheckView, LibraryLoginView } from '../../../core/bindings/useLibraryAccount';
import { buildQrLoginIssueUrl } from '../../../../utils/qrLoginDiagnosticReport';
import { resolveLoginDiagnosticsPrompt } from '../../../core/model/accountRules';
import { translateHomeMessage } from '../../../core/model/homeSources';
import type { QrLoginFailureHelpProps } from './QrLoginFailureHelp';

// src/library/suites/grid/account/buildQrLoginFailureHelpProps.ts
// 把扫码登录失败后的帮助（简单办法、自检、收起的诊断与反馈）翻译成登录弹窗要的 props，网格的 account surface 只在失败时传进来。

export const buildQrLoginFailureHelpProps = ({
    t,
    providerId,
    failure,
    tips,
    selfCheck = null,
    buildReport,
}: {
    t: TFunction;
    providerId: OnlineProviderId;
    failure: QrLoginFailureKind;
    /** 视图里已翻译的简单办法（useLibraryAccountLogin 的 failureTips）。 */
    tips: NonNullable<LibraryLoginView['failureTips']>;
    selfCheck?: LibraryLoginSelfCheckView | null;
    buildReport: () => Promise<string>;
}): QrLoginFailureHelpProps => ({
    tips: { title: tips.title, items: tips.items },
    selfCheck,
    escalationLabel: tips.escalation,
    prompt: translateHomeMessage(t, resolveLoginDiagnosticsPrompt(failure)),
    disclosure: t('home.qrDiagnosticsDisclosure'),
    copyLabel: t('home.qrDiagnosticsCopy'),
    copiedLabel: t('home.qrDiagnosticsCopied'),
    copyFailedLabel: t('home.qrDiagnosticsCopyFailed'),
    reportLabel: t('home.qrDiagnosticsReport'),
    buildReport,
    buildIssueUrl: report => buildQrLoginIssueUrl({
        providerId,
        report,
        pasteHint: t('home.qrDiagnosticsPasteHint'),
    }),
});
