import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, LogOut, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public props: Props;
  public setState!: (update: Partial<State> | ((prev: State) => Partial<State>)) => void;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('CRITICAL: React ErrorBoundary caught an unhandled component error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleResetSession = (): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pali_auth_user');
        localStorage.removeItem('pali_staff_token');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch {
      window.location.reload();
    }
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F4EC] text-[#1D241F] flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#DDD8C9] text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#163024] mb-2">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-[#687067] mb-6 leading-relaxed">
              An unexpected render issue occurred while loading this view. Your session and operational data are safe.
            </p>

            {this.state.error && (
              <div className="p-3 mb-6 bg-rose-50/70 border border-rose-100 rounded-xl text-left">
                <p className="text-xs font-mono font-bold text-rose-800 break-words">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {process.env.NODE_ENV !== 'production' && this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] font-mono text-rose-700/80 mt-2 max-h-36 overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#C5A86A]" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleResetSession}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F7F4EC] hover:bg-[#eee8da] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#687067]" />
                <span>Reset Session</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-[#DDD8C9]/60 flex items-center justify-between text-[11px] text-[#687067]">
              <span>Pali Resort & Club Operations</span>
              <span className="font-mono">PALI-SYSTEM-ERR</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
