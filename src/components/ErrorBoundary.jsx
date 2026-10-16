import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 text-left">
              <p className="text-xs font-mono text-red-700 break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.history.back();
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
