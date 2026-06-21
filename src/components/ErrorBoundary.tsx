import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { hasError: boolean; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('Application error', error, info);
  }
  render(): ReactNode {
    if (this.state.hasError) return (
      <main className="recovery-screen">
        <div className="panel narrow">
          <h1>Application recovery</h1>
          <p>The app encountered an unexpected error and stopped this view safely.</p>
          <div className="alert error">No data was changed. Reload the application or use Data Integrity and Recovery if the problem continues.</div>
          <button className="button primary" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </main>
    );
    return this.props.children;
  }
}
