import { Link } from "@remix-run/react";
import { useTypewriter } from "~/hooks/useTypewriter";

export default function Index() {
  const typewriterText = useTypewriter({
    phrases: [
      "Monitor uptime around the clock",
      "Get instant alerts when issues arise",
      "Track performance metrics in real-time",
      "Keep your services running smoothly",
    ],
    typingSpeed: 40,
    deletingSpeed: 40,
    pauseAfterTyping: 2000,
    pauseAfterDeleting: 500,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:pt-32 sm:pb-32">
        <div className="text-center animate-fade-in">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6">
            Ding.ing
          </h1>
          <div className="h-16 sm:h-20 flex items-center justify-center mb-8">
            <p
              className="text-2xl sm:text-3xl md:text-4xl font-medium text-slate-600 min-h-[1.2em]"
              aria-live="polite"
            >
              {typewriterText}
              <span className="animate-pulse">|</span>
            </p>
          </div>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 animate-slide-up">
            Uptime monitoring powered by Prometheus Blackbox Exporter.
            Track your services, get alerted when they go down.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up-delayed">
            <Link
              to="/signup"
              className="rounded-lg bg-slate-900 px-8 py-3.5 text-white font-medium hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="rounded-lg border-2 border-slate-300 px-8 py-3.5 font-medium hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-4">
            Everything you need to stay online
          </h2>
          <p className="text-center text-slate-600 mb-16 max-w-2xl mx-auto">
            Comprehensive monitoring tools designed for developers who care about reliability
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Real-time Monitoring
              </h3>
              <p className="text-slate-600">
                Continuous uptime checks with customizable intervals. Monitor HTTP/HTTPS endpoints with precision.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Smart Alerts
              </h3>
              <p className="text-slate-600">
                Multi-channel notifications via Email, Slack, PagerDuty, and Discord. Get alerted the moment issues arise.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Incident Management
              </h3>
              <p className="text-slate-600">
                Track and resolve issues with detailed metrics. View incident history and performance trends.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Flexible Probes
              </h3>
              <p className="text-slate-600">
                Powerful HTTP/HTTPS monitoring with custom configurations. Support for complex authentication scenarios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-16">
            Why Choose Ding.ing?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                24/7
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Always Reliable
              </h3>
              <p className="text-slate-600">
                Round-the-clock monitoring powered by battle-tested Prometheus Blackbox Exporter. Your uptime is our mission.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                ⚡
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Lightning Fast Setup
              </h3>
              <p className="text-slate-600">
                Start monitoring in minutes, not hours. Simple interface designed for developers who value their time.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                🛡️
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Peace of Mind
              </h3>
              <p className="text-slate-600">
                Sleep better knowing you'll be the first to know when something goes wrong. Instant alerts, actionable insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            Start monitoring in minutes
          </h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join developers who trust Ding.ing to keep their services online
          </p>
          <Link
            to="/signup"
            className="inline-block rounded-lg bg-white px-10 py-4 text-slate-900 font-semibold hover:bg-slate-100 transition-colors shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 transition-all text-lg"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Ding.ing. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
                Terms
              </Link>
              <a
                href="https://github.com"
                className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
