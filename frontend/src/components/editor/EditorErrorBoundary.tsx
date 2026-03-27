import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { useI18nStore } from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[EditorErrorBoundary]', error.message, error.stack);
    console.error('[EditorErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState((s) => ({ hasError: false, error: null, retryKey: s.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      const t = useI18nStore.getState().t;
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
            {t('error.editorTitle')}
          </h3>
          <p className="text-sm text-text-muted max-w-sm mb-2">
            {t('error.editorDescription')}
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-400 bg-bg-secondary rounded-lg p-2 max-w-md overflow-auto mb-4 text-left">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={this.handleRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t('error.retry')}
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('error.reload')}
            </Button>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
