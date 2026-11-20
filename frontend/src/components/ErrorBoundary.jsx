import { Component } from "react";

/**
 * If a screen crashes, show a friendly message instead of a blank screen.
 * It sits outside the language provider, so it says everything in both languages.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Screen crashed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-bold">Something went wrong · काहीतरी चुकले</h1>
          <p className="text-lg text-slate-800">
            Please reload the page. If this keeps happening, tell the owner.
            <br />
            कृपया पान पुन्हा उघडा. असे वारंवार झाल्यास मालकांना सांगा.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-16 w-full rounded-2xl bg-sky-700 text-xl font-bold text-white"
          >
            Reload · पुन्हा उघडा
          </button>
        </div>
      </div>
    );
  }
}
