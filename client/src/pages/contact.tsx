import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

export default function Contact() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <TopNav />
      <div className="max-w-xl mx-auto px-6 py-12">
        <button
          onClick={() => setLocation("/")}
          className="text-sm text-orange-400 hover:text-orange-300 transition-colors mb-8 inline-block"
        >
          &larr; Back to RC Football
        </button>

        <h1 className="text-3xl font-bold text-white mb-4">Contact</h1>
        <p className="text-slate-300 leading-relaxed mb-8">
          Have a question, feature request, or bug to report? We're a small team and we
          read every email. Drop us a line and we'll get back to you.
        </p>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">General &amp; Support</p>
            <a
              href="mailto:rcfootball@rc-football.com"
              className="text-orange-400 hover:text-orange-300 underline transition-colors text-lg font-medium"
            >
              rcfootball@rc-football.com
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Privacy Inquiries</p>
            <a
              href="mailto:privacy@rc-football.com"
              className="text-orange-400 hover:text-orange-300 underline transition-colors"
            >
              privacy@rc-football.com
            </a>
          </div>
        </div>

        <p className="text-slate-500 text-sm mt-6">
          We typically respond within 1–2 business days.
        </p>
      </div>
    </div>
  );
}
