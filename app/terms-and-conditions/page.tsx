import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions | AgencyViz',
  description: 'Terms governing use of the AgencyViz platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-edge">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/login">
            <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted">
            <Link href="/privacy-policy" className="hover:text-teal transition-colors">Privacy</Link>
            <span className="font-medium text-ink">Terms</span>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-2xl font-semibold text-ink mb-1">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted mb-8">Effective date: 17 April 2026 &middot; Last updated: 17 April 2026</p>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using AgencyViz (&quot;the Service&quot;), you agree to be bound by these Terms &amp;
              Conditions. If you are using the Service on behalf of an organisation, you represent and warrant that you
              have the authority to bind that organisation to these terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              AgencyViz is a business-to-business software platform operated by Xcelerate Digital Systems that enables
              agencies to create and manage proposals, documents, templates, creative reviews, and reporting
              integrations with third-party advertising and analytics platforms.
            </p>
          </Section>

          <Section title="3. Accounts and Access">
            <ul>
              <li>Accounts are created via invitation from a team owner. Open self-registration is not available.</li>
              <li>You are responsible for maintaining the security of your login credentials.</li>
              <li>Each account is for a single individual. Sharing login credentials is prohibited.</li>
              <li>Team owners are responsible for managing their team members&apos; access and permissions.</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to access data belonging to other users or companies</li>
              <li>Interfere with, disrupt, or place an undue burden on the Service or its infrastructure</li>
              <li>Reverse-engineer, decompile, or scrape any part of the Service</li>
              <li>Upload content that infringes on third-party intellectual property rights</li>
              <li>Use the Service to distribute malware, spam, or other harmful content</li>
            </ul>
          </Section>

          <Section title="5. Content Ownership and Licence">
            <p>
              You retain full ownership of all content you create or upload to AgencyViz, including proposals,
              documents, templates, review projects, and uploaded files.
            </p>
            <p>
              By using the Service, you grant Xcelerate Digital Systems a limited, non-exclusive licence to host,
              store, display, and transmit your content solely as necessary to provide and operate the Service.
              This licence terminates when your content is deleted or your account is closed.
            </p>
            <p>
              Xcelerate Digital Systems does not claim ownership of your content.
            </p>
          </Section>

          <Section title="6. Public Sharing">
            <p>
              The Service allows you to share proposals, documents, and reviews via unique public links. Content
              shared via a public link is accessible to anyone who has the URL, without authentication.
            </p>
            <p>
              You are responsible for managing the distribution of share links. Xcelerate Digital Systems is not
              liable for any unauthorised access to content that results from sharing links with unintended
              recipients.
            </p>
          </Section>

          <Section title="7. Third-Party Integrations">
            <p>
              AgencyViz integrates with third-party services including Meta (Facebook) Ads and Google Looker Studio.
              Your use of these integrations is subject to the respective third-party terms:
            </p>
            <ul>
              <li>Meta Platform Terms and Developer Policies</li>
              <li>Google Terms of Service and Looker Studio Terms</li>
            </ul>
            <p>
              Xcelerate Digital Systems is not responsible for the availability, accuracy, or data practices of
              third-party services. You are responsible for maintaining valid authorisations with third-party
              platforms and for complying with their terms of use.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The AgencyViz platform, including its software, design, branding, and documentation, is the
              intellectual property of Xcelerate Digital Systems. Nothing in these terms grants you any right to
              use our trademarks, logos, or branding without prior written consent.
            </p>
            <p>
              Templates provided within AgencyViz are licensed for use within the platform only.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted
              by law, Xcelerate Digital Systems makes no warranties, express or implied, regarding the Service.
            </p>
            <p>
              Xcelerate Digital Systems shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages, including but not limited to loss of data, revenue, or business opportunity,
              arising from your use of or inability to use the Service.
            </p>
            <p>
              To the extent permitted by law, our total aggregate liability for any claims arising from or related
              to the Service shall not exceed the fees you paid to us in the twelve (12) months preceding the claim.
            </p>
          </Section>

          <Section title="10. Termination">
            <ul>
              <li>Either party may terminate the use of the Service at any time.</li>
              <li>We may suspend or terminate your account if you breach these terms or engage in conduct that we
                reasonably determine is harmful to the Service or other users.</li>
              <li>Upon termination, your data may be deleted after a reasonable retention period. You may request a
                data export prior to account closure.</li>
            </ul>
          </Section>

          <Section title="11. Modifications to Terms">
            <p>
              We may update these Terms &amp; Conditions from time to time. The effective date at the top of this
              page reflects the latest version. Continued use of the Service after changes are posted constitutes
              acceptance of the updated terms. We will make reasonable efforts to notify users of material changes
              via email or in-app notice.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These terms are governed by and construed in accordance with the laws of Australia. Any disputes
              arising from these terms or your use of the Service shall be subject to the exclusive jurisdiction
              of the courts of Australia.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have questions about these Terms &amp; Conditions, contact us at:
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
          <Link href="/privacy-policy" className="hover:text-teal transition-colors">Privacy Policy</Link>
          <span>&middot;</span>
          <span className="font-medium text-ink/70">Terms &amp; Conditions</span>
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
