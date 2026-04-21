import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | AgencyViz',
  description: 'How AgencyViz collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="h-screen bg-surface overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-edge">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/login">
            <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted">
            <span className="font-medium text-ink">Privacy</span>
            <Link href="/terms-and-conditions" className="hover:text-teal transition-colors">Terms</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-2xl font-semibold text-ink mb-1">Privacy Policy</h1>
          <p className="text-sm text-muted mb-8">Effective date: 17 April 2026 &middot; Last updated: 17 April 2026</p>

          <Section title="1. Introduction">
            <p>
              AgencyViz (&quot;the Service&quot;) is operated by Xcelerate Digital Systems (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
              AgencyViz is a business-to-business software platform that helps agencies manage proposals, documents,
              feedbacks, and reporting integrations.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and protect information when you use AgencyViz
              at agencyviz.io and all associated subdomains. By using the Service, you agree to the practices described
              in this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <h3 className="text-base font-medium text-ink mt-4 mb-2">Account information</h3>
            <p>
              When your team owner invites you to AgencyViz, we collect your name, email address, and company
              affiliation. Passwords are hashed by our authentication provider and are never stored in plain text.
            </p>

            <h3 className="text-base font-medium text-ink mt-4 mb-2">Content data</h3>
            <p>We store content you create or upload through the Service, including:</p>
            <ul>
              <li>Proposals, documents, and templates</li>
              <li>Feedback projects and feedback comments</li>
              <li>Uploaded files (PDFs, images)</li>
              <li>Screenshots and annotations created during feedbacks</li>
            </ul>

            <h3 className="text-base font-medium text-ink mt-4 mb-2">Third-party integration data</h3>
            <ul>
              <li>
                <strong>Meta (Facebook) Ads:</strong> When you connect a Meta account, we store your OAuth
                access token (encrypted at rest) and associated ad account identifiers. We do <strong>not</strong> store
                ad performance data — impressions, spend, clicks and other metrics are queried live from the
                Meta Marketing API and passed through to Google Looker Studio on each request.
              </li>
              <li>
                <strong>Google Looker Studio:</strong> We store connector configuration only. No Google user
                data is stored by AgencyViz.
              </li>
            </ul>

            <h3 className="text-base font-medium text-ink mt-4 mb-2">Usage data</h3>
            <p>We collect standard server logs including IP addresses, browser type, and pages visited to operate and maintain the Service.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide and operate the Service — proposal creation, document management, review workflows, and reporting</li>
              <li>Authenticate users and manage team access</li>
              <li>Facilitate third-party data connections (e.g. Meta Ads to Looker Studio)</li>
              <li>Send transactional emails such as team invitations, password resets, and review notifications</li>
              <li>Improve, maintain, and secure the Service</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing and Third Parties">
            <p>We share data with the following third-party service providers as necessary to operate the Service:</p>
            <ul>
              <li><strong>Supabase</strong> — authentication, database hosting, and file storage (hosted on AWS infrastructure)</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Meta Platforms</strong> — OAuth integration for advertising data access, governed by Meta Platform Terms</li>
              <li><strong>Google</strong> — Looker Studio community connector; no user data is stored by the Google connector</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal data to third parties. We may disclose information
              if required to do so by law or in response to a valid legal request.
            </p>
          </Section>

          <Section title="5. Data Storage and Security">
            <ul>
              <li>All data is hosted on Supabase infrastructure (AWS)</li>
              <li>Meta access tokens are encrypted at rest using AES-256-GCM</li>
              <li>Row-level security (RLS) is enforced at the database level to isolate tenant data</li>
              <li>All data is transmitted over HTTPS</li>
              <li>File uploads are stored with access controls in Supabase Storage</li>
            </ul>
            <p>
              While we implement industry-standard security measures, no method of electronic storage or
              transmission is 100% secure. We cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="6. Public Sharing">
            <p>
              Proposals, documents, and reviews can be shared via unique token-based URLs. Shared content is
              accessible to anyone with the link without requiring authentication. Share links can be revoked
              by the content owner at any time.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <ul>
              <li>Account and content data is retained while your account is active</li>
              <li>Upon account closure or deletion, your data will be removed within a reasonable timeframe</li>
              <li>Meta OAuth tokens are retained while the connection is active and deleted when disconnected</li>
            </ul>
          </Section>

          <Section title="8. Your Rights">
            <p>You may request to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate personal data</li>
              <li>Delete your personal data and account</li>
              <li>Export your data in a portable format</li>
              <li>Revoke third-party integration connections at any time</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at the email address listed below.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              AgencyViz uses session cookies provided by Supabase Auth to maintain your authenticated session.
              These are functional cookies required for the Service to operate. We do <strong>not</strong> use
              advertising, analytics, or third-party tracking cookies.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              AgencyViz is a business-to-business service and is not directed at individuals under the age of 18.
              We do not knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. The effective date at the top of this page
              reflects the latest version. We encourage you to review this policy periodically. Continued use
              of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:
            </p>
            <p>
              Xcelerate Digital Systems<br />
              Email: <a href="mailto:jack@xceleratedigitalsystems.com" className="text-teal hover:text-teal-hover underline">jack@xceleratedigitalsystems.com</a>
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted">
        <p>&copy; {new Date().getFullYear()} Xcelerate Digital Systems. All rights reserved.</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="font-medium text-ink/70">Privacy Policy</span>
          <span>&middot;</span>
          <Link href="/terms-and-conditions" className="hover:text-teal transition-colors">Terms &amp; Conditions</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 [&>p]:text-sm [&>p]:text-muted [&>p]:leading-relaxed [&>p]:mb-3 [&>ul]:text-sm [&>ul]:text-muted [&>ul]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ul>li]:mb-1">
      <h2 className="text-lg font-semibold text-ink mt-8 mb-3">{title}</h2>
      {children}
    </section>
  );
}
