import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { requestHost } from '../client';
import { exportLocalDiagnostics, recordLocalError } from './localDiagnostics';
import './localRecovery.css';

// src/mineradio/local/LocalErrorBoundary.tsx
// Replace a failed surface without touching Mineradio's audio or persisted visual settings.
interface Props { children: ReactNode; surface: string; captureRuntime?: boolean; root?: boolean }
interface State { failed: boolean; attempt: number }
function Recovery({ retry, root }: { retry: () => void; root?: boolean }) {
    const { t } = useTranslation('localPlayer');
    return <section className={`local-recovery${root ? ' local-recovery-root' : ''}`} role="alert" data-testid="local-recovery">
        <strong>{t(root ? 'playerFailed' : 'effectFailed')}</strong><p>{t('recoveryHint')}</p>
        <div><button onClick={retry}>{t('retrySurface')}</button>
            <button onClick={() => { void requestHost('switchInterface', { mode: 'mineradio' }).catch(() => {}); }}>{t('returnToMineradio')}</button>
            <button onClick={exportLocalDiagnostics}>{t('exportDiagnostics')}</button></div>
    </section>;
}
export default class LocalErrorBoundary extends Component<Props, State> {
    state: State = { failed: false, attempt: 0 };
    static getDerivedStateFromError(): Partial<State> { return { failed: true }; }
    componentDidCatch(error: Error, info: ErrorInfo) {
        recordLocalError(error, this.props.surface, info.componentStack || '');
    }
    componentDidMount() {
        if (this.props.captureRuntime) {
            window.addEventListener('error', this.onError);
            window.addEventListener('unhandledrejection', this.onRejection);
        }
    }
    componentWillUnmount() {
        window.removeEventListener('error', this.onError);
        window.removeEventListener('unhandledrejection', this.onRejection);
    }
    componentDidUpdate(previous: Props) {
        if (previous.surface !== this.props.surface && this.state.failed) this.retry();
    }
    private fail = (error: unknown) => {
        if (this.state.failed) return;
        recordLocalError(error, this.props.surface);
        this.setState({ failed: true });
    };
    private onError = (event: ErrorEvent) => { if (event.error || event.message) this.fail(event.error || event.message); };
    private onRejection = (event: PromiseRejectionEvent) => this.fail(event.reason);
    private retry = () => this.setState(previous => ({ failed: false, attempt: previous.attempt + 1 }));
    render() {
        return this.state.failed ? <Recovery retry={this.retry} root={this.props.root} />
            : <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    }
}
