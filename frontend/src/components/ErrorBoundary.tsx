import { Component, type ReactNode } from 'react';
import { AlertTriangle, Copy, Home, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { useI18nStore } from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleCopyError = () => {
    const t = useI18nStore.getState().t;
    const text = this.state.error
      ? `${this.state.error.message}\n\n${this.state.error.stack || ''}`
      : t('error.unknown');
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      const t = useI18nStore.getState().t;
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-red-500/10 mb-5">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">
            {t('error.title')}
          </h2>
          <p className="text-sm text-text-muted max-w-md mb-4">
            {t('error.description')}
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-400 bg-bg-secondary rounded-lg p-3 max-w-lg overflow-auto mb-4 text-left border border-red-500/20">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('error.reload')}
            </Button>
            <Button variant="secondary" onClick={() => { window.location.href = '/wiki/'; }} className="gap-2">
              <Home className="h-4 w-4" />
              {t('error.goHome')}
            </Button>
            {this.state.error && (
              <Button variant="ghost" onClick={this.handleCopyError} className="gap-2">
                <Copy className="h-4 w-4" />
                {this.state.copied ? t('common.copied') : t('error.copyError')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
