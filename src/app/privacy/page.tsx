export const metadata = { title: 'Privacy Policy — UmaCore' }

const LAST_UPDATED = 'April 28, 2026'
const CONTACT_EMAIL = 'intranetzosu@gmail.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <span className="text-xs text-violet-400 font-medium uppercase tracking-wider">Legal</span>
          <h1 className="mt-2 text-2xl font-semibold text-white">Privacy Policy</h1>
          <p className="mt-1 text-xs text-zinc-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          UmaCore (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a free, community-run tool for managing
          Uma Musume club quotas. This page explains what data we collect, why, and
          what rights you have under the EU General Data Protection Regulation (GDPR).
        </p>

        <Section title="1. Who is responsible for your data?">
          <p>
            UmaCore is operated by Haruki. You can contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">
              {CONTACT_EMAIL}
            </a>
            {' '}or via our{' '}
            <a href="https://discord.gg/f4QZNag9Hv" target="_blank" rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors">
              Discord server
            </a>.
          </p>
        </Section>

        <Section title="2. What data we collect and why">
          <SubSection title="Discord account data (when you sign in)">
            <p>
              We use Discord OAuth 2.0 for authentication. When you sign in, Discord
              shares the following with us:
            </p>
            <ul className="mt-3 space-y-2">
              {[
                ['Discord user ID', 'To uniquely identify your account across sessions'],
                ['Username & avatar', 'To display your name in the dashboard header'],
                ['Email address', 'Provided by Discord as part of the OAuth flow; we do not store or use it independently'],
                ['Guild list & permissions', 'To determine which Discord servers you are an administrator of, so we can show you only your clubs'],
              ].map(([item, reason]) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                  <span><span className="text-zinc-200 font-medium">{item}</span> — {reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Your Discord access token is used only during sign-in to fetch guild
              membership and is never stored on our servers.
            </p>
          </SubSection>

          <SubSection title="Club and quota data">
            <p>
              When you or your club members submit quota data, we store the following
              in our database:
            </p>
            <ul className="mt-3 space-y-2">
              {[
                'In-game trainer names',
                'Daily fan counts and quota deficit / surplus',
                'Club configuration (name, daily quota target, schedule)',
                'Bomb records (active status and days remaining)',
              ].map(item => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              This data is operational — it is required to provide the quota tracking
              service. The legal basis is <strong className="text-zinc-200">legitimate interest</strong>{' '}
              (GDPR Art. 6(1)(f)) in operating the dashboard for club administrators.
            </p>
          </SubSection>

          <SubSection title="Session cookie">
            <p>
              After signing in, we set a single HTTP-only, encrypted session cookie
              (<code className="text-xs bg-white/5 px-1 py-0.5 rounded">next-auth.session-token</code> /
              {' '}<code className="text-xs bg-white/5 px-1 py-0.5 rounded">__Secure-next-auth.session-token</code>).
              This cookie is <strong className="text-zinc-200">strictly necessary</strong> to keep
              you signed in and contains no personal data beyond your Discord user ID and
              the list of guild IDs where you hold administrator permissions. It expires
              when your session ends or after 30 days.
            </p>
          </SubSection>
        </Section>

        <Section title="3. What we do NOT collect">
          <ul className="space-y-2">
            {[
              'No analytics or tracking cookies (no Google Analytics, Plausible, or similar)',
              'No advertising identifiers',
              'No Discord messages or server content',
              'No payment data (Ko-fi donations are handled entirely by Ko-fi)',
            ].map(item => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="4. Data sharing">
          <p>
            We do not sell, rent, or share your data with third parties except where
            strictly required to operate the service:
          </p>
          <ul className="mt-3 space-y-2">
            {[
              ['Discord', 'OAuth provider — subject to Discord\'s own Privacy Policy'],
              ['Hosting / database provider', 'Our server and database infrastructure; data is processed in accordance with GDPR data-processing agreements'],
            ].map(([party, note]) => (
              <li key={party} className="flex gap-3">
                <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span><span className="text-zinc-200 font-medium">{party}</span> — {note}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            Session tokens expire after 30 days of inactivity. Quota and club data
            is retained for as long as your club remains active on UmaCore. You may
            request deletion at any time (see Section 6).
          </p>
        </Section>

        <Section title="6. Your rights (GDPR)">
          <p>If you are in the EU / EEA, you have the right to:</p>
          <ul className="mt-3 space-y-2">
            {[
              ['Access', 'Request a copy of the data we hold about you'],
              ['Rectification', 'Ask us to correct inaccurate data'],
              ['Erasure', 'Ask us to delete your data ("right to be forgotten")'],
              ['Restriction', 'Ask us to stop processing your data in certain circumstances'],
              ['Objection', 'Object to processing based on legitimate interest'],
              ['Portability', 'Receive your data in a machine-readable format'],
            ].map(([right, desc]) => (
              <li key={right} className="flex gap-3">
                <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span><span className="text-zinc-200 font-medium">{right}</span> — {desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">
              {CONTACT_EMAIL}
            </a>. We will respond within 30 days.
          </p>
        </Section>

        <Section title="7. Changes to this policy">
          <p>
            We may update this policy when we change how we process data. The &ldquo;last
            updated&rdquo; date at the top will reflect any changes. Continued use of
            UmaCore after an update constitutes acceptance of the revised policy.
          </p>
        </Section>

        <div className="pt-4 border-t border-white/5 flex items-center gap-4">
          <a href="/login" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Back to login</a>
          <span className="text-zinc-800">·</span>
          <a href="https://discord.gg/f4QZNag9Hv" target="_blank" rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Discord support</a>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pl-4 border-l border-white/8 space-y-2">
      <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">{title}</p>
      <div className="text-sm text-zinc-400 leading-relaxed">{children}</div>
    </div>
  )
}
