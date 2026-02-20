import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => setLocation("/")}
          className="text-sm text-orange-400 hover:text-orange-300 transition-colors mb-8 inline-block"
        >
          &larr; Back to RC Football
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: February 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Overview</h2>
            <p>
              RC Football is a free web app for amateur flag football coaches. We take your
              privacy seriously. This policy explains what data we collect, how we use it,
              and your rights as a user.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data We Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>
                <span className="text-white font-medium">Email address</span> — collected
                when you sign up or log in via Google OAuth. Used only for account
                identification and essential communications.
              </li>
              <li>
                <span className="text-white font-medium">Name / profile info</span> —
                optionally provided by you or pulled from your Google account during OAuth
                sign-in.
              </li>
              <li>
                <span className="text-white font-medium">Play and team data</span> — the
                plays, playbooks, rosters, and team configurations you create inside the
                app. Stored securely so you can access them across sessions.
              </li>
              <li>
                <span className="text-white font-medium">Usage data</span> — basic
                analytics such as pages visited and features used, to help us improve the
                app. No personally identifiable information is attached to usage events.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Google OAuth</h2>
            <p>
              RC Football offers sign-in via Google OAuth. When you choose this option,
              Google shares your name and email address with us. We do not receive your
              Google password, and we do not access any Google data beyond what is
              necessary to create your account (email, name, profile photo).
            </p>
            <p className="mt-3">
              If you connect Google Drive for play exports, we request only the specific
              Drive permission needed to create files in your Drive. We do not read,
              modify, or delete any existing files in your Google Drive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>To authenticate you and maintain your session</li>
              <li>To save and sync your plays, teams, and playbooks</li>
              <li>To export your plays to Google Drive when you request it</li>
              <li>To send transactional emails (e.g., password reset)</li>
              <li>To improve the app based on aggregate usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">We Do Not Sell Your Data</h2>
            <p>
              We do not sell, rent, or share your personal information with third parties
              for marketing or advertising purposes. Your data is yours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data Retention</h2>
            <p>
              Your account data is retained as long as your account is active. If you
              would like your data deleted, contact us at the email below and we will
              remove your account and associated data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Security</h2>
            <p>
              We use industry-standard practices to protect your data, including encrypted
              connections (HTTPS) and secure session management. No system is perfectly
              secure, but we take reasonable measures to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. If we make material changes,
              we will update the date at the top of this page. Continued use of RC Football
              after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about this privacy policy? Reach out to us at{" "}
              <a
                href="mailto:privacy@rc-football.com"
                className="text-orange-400 hover:text-orange-300 underline transition-colors"
              >
                privacy@rc-football.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
