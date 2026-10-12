import React, { useState } from 'react';
import { submitAuditRequest, type AuditRequestErrors } from '../lib/audit-request-client';
import { newIdempotencyKey } from '../lib/lead-client';

/** Free-audit lead magnet (#/free-audit): email + store URL -> stored lead -> honest "we'll send your audit" state. */
export function AuditRequestForm({ isDarkMode }: { isDarkMode: boolean }) {
  const [email, setEmail] = useState('');
  const [site, setSite] = useState('');
  const [hp, setHp] = useState('');
  const [key] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<AuditRequestErrors>({});
  const [error, setError] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const card = isDarkMode ? 'bg-zinc-900/80 border-white/10 text-white' : 'bg-white/90 border-black/10 text-zinc-900';
  const input = `w-full rounded-xl border px-4 py-3 text-base ${isDarkMode ? 'bg-black/40 border-white/15' : 'bg-white border-black/15'}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setErrors({});
    const r = await submitAuditRequest({ email, site_url: site, website: hp }, { idempotencyKey: key });
    setBusy(false);
    if (r.status === 'sent') setSent(email.trim());
    else if (r.status === 'invalid') setErrors(r.fields);
    else setError(r.error);
  };

  return (
    <section className="mx-auto max-w-xl px-5 pt-28 pb-20" data-testid="audit-request">
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-xl backdrop-blur ${card}`}>
        {sent ? (
          <div role="status" data-testid="audit-request-sent">
            <h1 className="text-2xl font-semibold">Request received</h1>
            <p className="mt-3 opacity-80">
              Thanks. We&rsquo;ll review your store and email your free audit to <strong>{sent}</strong>. Audits are prepared by
              our team, so this is not instant; expect it within a few working days. Nothing has been sent yet.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <h1 className="text-2xl font-semibold">Get a free audit of your store</h1>
            <p className="mt-2 opacity-80">Tell us where to look and where to send it. We&rsquo;ll check how your store handles calls and enquiries, then email you the findings.</p>
            <label className="mt-6 block text-sm font-medium" htmlFor="ar-email">Email</label>
            <input id="ar-email" name="email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            {errors.email && <p className="mt-1 text-sm text-red-500" data-testid="err-email">{errors.email}</p>}
            <label className="mt-4 block text-sm font-medium" htmlFor="ar-site">Store website</label>
            <input id="ar-site" name="site_url" type="url" inputMode="url" placeholder="yourstore.com" className={input} value={site} onChange={(e) => setSite(e.target.value)} aria-invalid={!!errors.site_url} />
            {errors.site_url && <p className="mt-1 text-sm text-red-500" data-testid="err-site">{errors.site_url}</p>}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
              <label>Website (leave empty)<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" /></label>
            </div>
            {error && <p className="mt-4 text-sm text-red-500" role="alert" data-testid="audit-request-error">{error}</p>}
            <button type="submit" disabled={busy} className="mt-6 w-full rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black disabled:opacity-60">
              {busy ? 'Sending…' : 'Request my free audit'}
            </button>
            <p className="mt-3 text-xs opacity-60">We only use your email to send the audit and follow up about it.</p>
          </form>
        )}
      </div>
    </section>
  );
}
