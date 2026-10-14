import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Five-step setup wizard (plus a results screen).
 * Submits to the existing n8n lead intake (app.fourcee.online/webhook/lead-intake).
 * That workflow reads body.email, body.company_name, body.city, body.current_url;
 * the new answers ride along under body.wizard so the pipeline's shape is unchanged.
 */
export const LEAD_INTAKE_URL = 'https://app.fourcee.online/webhook/lead-intake';
export const BOOKING_URL = 'https://calendar.app.google/Ra2fzveKj33ZqbAG9';
const STORAGE_KEY = 'fourcee-setup-wizard-v1';

export type WizardAnswers = {
  businessName: string;
  city: string;
  website: string;
  pains: string[];
  goal: string;
  phoneSystem: string;
  calendarTool: string;
  callsPerWeek: string;
  missedShare: string;
  budget: string;
  timeline: string;
  name: string;
  email: string;
  phone: string;
};

const EMPTY: WizardAnswers = {
  businessName: '', city: '', website: '', pains: [], goal: '', phoneSystem: '', calendarTool: '',
  callsPerWeek: '', missedShare: '', budget: '', timeline: '', name: '', email: '', phone: '',
};

export const STEPS = [
  { id: 'business', title: 'Your business', blurb: 'Who are we setting this up for?' },
  { id: 'goals', title: 'What is going wrong', blurb: 'Pick everything that sounds familiar.' },
  { id: 'tools', title: 'Your phones today', blurb: 'Rough numbers are fine.' },
  { id: 'fit', title: 'Budget and timing', blurb: 'So we suggest the right plan, not the biggest one.' },
  { id: 'contact', title: 'Where to send it', blurb: 'We email your setup plan. No spam, no list.' },
] as const;

const PAINS = [
  'Calls go to voicemail after hours',
  'Staff get pulled off the floor to answer',
  'Quote and repair follow-ups slip',
  'Appointment no-shows',
  'Callers ask the same questions all day',
];
const PHONE_SYSTEMS = ['Landline / desk phones', 'Mobile phone', 'VoIP (RingCentral, Zoom, etc.)', 'Not sure'];
const CALENDARS = ['Google Calendar', 'Microsoft Outlook', 'Calendly / Cal.com', 'Paper diary', 'None'];
const MISSED = ['Under 10%', '10–25%', '25–50%', 'Over 50%', 'No idea'];
const BUDGETS = ['Under $500 a month', '$500–$1,000 a month', '$1,000–$2,000 a month', 'Over $2,000 a month', 'Not sure yet'];
const TIMELINES = ['This month', 'In 1–3 months', 'Just looking'];

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function validateStep(step: number, a: WizardAnswers): string | null {
  if (step === 0) {
    if (a.businessName.trim().length < 2) return 'Add your business name.';
    if (a.city.trim().length < 2) return 'Add the city you trade in.';
    if (a.website.trim() && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(a.website.trim())) return 'That website doesn’t look right. Leave it blank if you don’t have one.';
  }
  if (step === 1 && a.pains.length === 0) return 'Pick at least one.';
  if (step === 2) {
    if (!a.phoneSystem) return 'Choose what you answer calls on.';
    const n = Number(a.callsPerWeek);
    if (!a.callsPerWeek || !Number.isFinite(n) || n < 0 || n > 100000) return 'Roughly how many calls a week? A guess is fine.';
    if (!a.missedShare) return 'Choose how many calls you think you miss.';
  }
  if (step === 3) {
    if (!a.budget) return 'Choose a budget range.';
    if (!a.timeline) return 'Choose when you’d like to start.';
  }
  if (step === 4) {
    if (a.name.trim().length < 2) return 'Add your name.';
    if (!emailOk(a.email)) return 'Add a valid email address.';
  }
  return null;
}

export function buildPayload(a: WizardAnswers) {
  return {
    email: a.email.trim().toLowerCase(),
    company_name: a.businessName.trim(),
    city: a.city.trim(),
    current_url: a.website.trim(),
    source: 'fourcee-setup-wizard',
    wizard: {
      version: 1,
      contact_name: a.name.trim(),
      phone: a.phone.trim(),
      pains: a.pains,
      goal: a.goal.trim(),
      phone_system: a.phoneSystem,
      calendar_tool: a.calendarTool,
      calls_per_week: Number(a.callsPerWeek),
      missed_share: a.missedShare,
      budget: a.budget,
      timeline: a.timeline,
      page: typeof window !== 'undefined' ? window.location.href : '',
      submitted_at: new Date().toISOString(),
    },
  };
}

const field = 'w-full rounded-xl border border-[#d9c39a]/80 bg-white px-4 py-3 text-base text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-[#b79a61]/50';
const label = 'block text-[11px] uppercase tracking-[0.2em] text-[#7a6648] mb-1.5';

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`text-left rounded-xl border px-4 py-3 text-base transition-colors ${on ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#d9c39a]/80 bg-white text-navy-800 hover:bg-[#faf5ea]'}`}
    >
      {children}
    </button>
  );
}

export const SetupWizard: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<WizardAnswers>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');
  const loaded = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.answers) setA({ ...EMPTY, ...saved.answers });
      if (typeof saved?.step === 'number') setStep(Math.min(Math.max(saved.step, 0), STEPS.length));
      if (saved?.done) setStatus('done');
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (!loaded.current) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers: a, done: status === 'done' })); } catch { /* ignore */ }
  }, [step, a, status]);

  useEffect(() => { if (open) headingRef.current?.focus(); }, [step, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => { setA((p) => ({ ...p, [k]: v })); setError(null); };
  const togglePain = (p: string) => set('pains', a.pains.includes(p) ? a.pains.filter((x) => x !== p) : [...a.pains, p]);

  const submit = async () => {
    setStatus('sending');
    try {
      const res = await fetch(LEAD_INTAKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(a)) });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('done');
      setStep(STEPS.length);
    } catch {
      setStatus('failed');
    }
  };

  const next = () => {
    const e = validateStep(step, a);
    if (e) { setError(e); return; }
    if (step === STEPS.length - 1) { void submit(); return; }
    setStep((s) => s + 1);
  };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };
  const restart = () => { setA(EMPTY); setStep(0); setStatus('idle'); setError(null); };

  const isResult = step >= STEPS.length;
  const pct = useMemo(() => Math.round(((isResult ? STEPS.length : step) / STEPS.length) * 100), [step, isResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center sm:p-4" data-testid="setup-wizard">
      <button type="button" aria-label="Close setup" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="wizard-title" className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#d9c39a]/70 bg-[#fffdf8] shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#fffdf8]/95 backdrop-blur px-5 pt-5 pb-3 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#7a6648]" data-testid="wizard-progress-label">
              {isResult ? 'All done' : `Step ${step + 1} of ${STEPS.length}`}
            </p>
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-navy-600 hover:bg-navy-900/5" aria-label="Close setup">✕</button>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#efe5d0]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-navy-900 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="px-5 pb-6 sm:px-7">
          <h3 id="wizard-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl serif text-navy-900 outline-none">
            {isResult ? 'Thanks. Here is what happens next.' : STEPS[step].title}
          </h3>
          {!isResult && <p className="mt-1 text-sm text-navy-600">{STEPS[step].blurb}</p>}

          <div className="mt-5 space-y-4">
            {step === 0 && (
              <>
                <div><label className={label} htmlFor="wz-biz">Business name</label><input id="wz-biz" className={field} value={a.businessName} onChange={(e) => set('businessName', e.target.value)} autoComplete="organization" /></div>
                <div><label className={label} htmlFor="wz-city">City</label><input id="wz-city" className={field} value={a.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" /></div>
                <div><label className={label} htmlFor="wz-web">Website (optional)</label><input id="wz-web" className={field} value={a.website} onChange={(e) => set('website', e.target.value)} inputMode="url" placeholder="yourstore.com" /></div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="grid gap-2">{PAINS.map((p) => <Chip key={p} on={a.pains.includes(p)} onClick={() => togglePain(p)}>{p}</Chip>)}</div>
                <div><label className={label} htmlFor="wz-goal">Anything else? (optional)</label><textarea id="wz-goal" rows={3} className={field} value={a.goal} onChange={(e) => set('goal', e.target.value)} placeholder="e.g. we lose bridal enquiries on Saturdays" /></div>
              </>
            )}
            {step === 2 && (
              <>
                <div><label className={label} htmlFor="wz-phone-sys">You answer calls on</label><select id="wz-phone-sys" className={field} value={a.phoneSystem} onChange={(e) => set('phoneSystem', e.target.value)}><option value="">Choose one</option>{PHONE_SYSTEMS.map((o) => <option key={o}>{o}</option>)}</select></div>
                <div><label className={label} htmlFor="wz-cal">Bookings live in (optional)</label><select id="wz-cal" className={field} value={a.calendarTool} onChange={(e) => set('calendarTool', e.target.value)}><option value="">Choose one</option>{CALENDARS.map((o) => <option key={o}>{o}</option>)}</select></div>
                <div><label className={label} htmlFor="wz-calls">Calls a week, roughly</label><input id="wz-calls" className={field} value={a.callsPerWeek} onChange={(e) => set('callsPerWeek', e.target.value.replace(/[^\d]/g, '').slice(0, 6))} inputMode="numeric" placeholder="e.g. 60" /></div>
                <div><span className={label}>Calls you think you miss</span><div className="grid grid-cols-2 gap-2">{MISSED.map((o) => <Chip key={o} on={a.missedShare === o} onClick={() => set('missedShare', o)}>{o}</Chip>)}</div></div>
              </>
            )}
            {step === 3 && (
              <>
                <div><span className={label}>Monthly budget</span><div className="grid gap-2">{BUDGETS.map((o) => <Chip key={o} on={a.budget === o} onClick={() => set('budget', o)}>{o}</Chip>)}</div></div>
                <div><span className={label}>When would you start?</span><div className="grid grid-cols-3 gap-2">{TIMELINES.map((o) => <Chip key={o} on={a.timeline === o} onClick={() => set('timeline', o)}>{o}</Chip>)}</div></div>
              </>
            )}
            {step === 4 && (
              <>
                <div><label className={label} htmlFor="wz-name">Your name</label><input id="wz-name" className={field} value={a.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></div>
                <div><label className={label} htmlFor="wz-email">Email</label><input id="wz-email" type="email" className={field} value={a.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" inputMode="email" /></div>
                <div><label className={label} htmlFor="wz-tel">Phone (optional)</label><input id="wz-tel" type="tel" className={field} value={a.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" /></div>
                <p className="text-sm text-navy-600">Prefer to talk it through? <a className="underline" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Book a 30-minute call</a>.</p>
              </>
            )}
            {isResult && (
              <div className="space-y-4 text-base text-navy-800" data-testid="wizard-result">
                <p>We have your answers for <strong>{a.businessName || 'your business'}</strong>{a.city ? ` in ${a.city}` : ''}. Here is the plan:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>We look at how your calls are handled today{a.callsPerWeek ? ` (about ${a.callsPerWeek} a week, ${a.missedShare.toLowerCase()} missed)` : ''}.</li>
                  <li>You get a written setup plan by email at {a.email || 'your inbox'}, usually within one working day.</li>
                  <li>On a 30-minute call we agree the script, hours and handover rules before anything goes live.</li>
                </ol>
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="block w-full rounded-full bg-navy-900 px-6 py-3.5 text-center text-sm font-bold uppercase tracking-[0.18em] text-white" data-testid="wizard-book">Book the 30-minute call</a>
                <button type="button" onClick={restart} className="w-full text-sm text-navy-600 underline">Start over</button>
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="wizard-error">{error}</p>}
          {status === 'failed' && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">That didn’t send. Check your connection and try again, or book a call instead.</p>}

          {!isResult && (
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={back} disabled={step === 0} className="flex-1 rounded-full border border-navy-200 px-5 py-3 text-sm font-semibold text-navy-800 disabled:opacity-40" data-testid="wizard-back">Back</button>
              <button type="button" onClick={next} disabled={status === 'sending'} className="flex-[2] rounded-full bg-navy-900 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60" data-testid="wizard-next">
                {step === STEPS.length - 1 ? (status === 'sending' ? 'Sending…' : 'Send my answers') : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
