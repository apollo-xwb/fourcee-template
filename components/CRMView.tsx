import React, { useEffect, useMemo, useState } from 'react';
import type { RingBuilderConfig } from '../types/audit';
import { LazyRingBuilderSection } from './LazyRingBuilderSection';
import { withBase } from '../lib/base-url';
import {
  HANDOVER_ITEMS,
  ONBOARD_STEPS,
  SOP_CHECKS,
  STATUS_LABEL,
  buildHistoryTranscript,
  seedCalls,
  type ActionState,
  type CallStatus,
  type OpsCall,
  type TranscriptLine,
} from '../lib/voice-ops';

interface CRMViewProps {
  isDarkMode?: boolean;
  businessName?: string;
  reportId?: string;
  location?: string;
  ringBuilder?: Required<RingBuilderConfig>;
}

type PortalTab = 'calls' | 'onboard' | 'handover' | 'studio';

interface LeadLog {
  id: string;
  time: string;
  customerName: string;
  intent: string;
  status: string;
  transcript: TranscriptLine[];
}

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function statusTone(status: string, isDarkMode: boolean) {
  if (status === 'live') return isDarkMode ? 'text-neutral-300' : 'text-neutral-700';
  if (status === 'booked' || status.includes('Booked')) return isDarkMode ? 'text-[#d6d6d6]' : 'text-neutral-800';
  if (status === 'follow_up' || status === 'escalated') return isDarkMode ? 'text-neutral-300' : 'text-neutral-800';
  return isDarkMode ? 'text-white/60' : 'text-navy-600';
}

function actionTone(state: ActionState, isDarkMode: boolean) {
  if (state === 'done') return isDarkMode ? 'text-neutral-300' : 'text-neutral-700';
  if (state === 'pending') return isDarkMode ? 'text-[#d6d6d6]' : 'text-neutral-800';
  return isDarkMode ? 'text-white/40' : 'text-navy-400';
}

export const CRMView: React.FC<CRMViewProps> = ({
  isDarkMode = true,
  businessName = 'PLACEHOLDER Business',
  reportId,
  location,
  ringBuilder,
}) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('calls');
  const [revenueSaved, setRevenueSaved] = useState(125500);
  const [appointmentsBooked, setAppointmentsBooked] = useState(48);
  const [logEntries, setLogEntries] = useState<LeadLog[]>([]);
  const [liveSeconds, setLiveSeconds] = useState(98);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 20, 15, 25, 14, 22, 10, 24, 16, 19, 12, 21]);
  const [selectedKey, setSelectedKey] = useState<string>('call-1');
  const [opsClock, setOpsClock] = useState(() => new Date());
  const [channelLoad, setChannelLoad] = useState({ voice: 2, sms: 1, web: 0 });
  const [onboardStep, setOnboardStep] = useState(1);
  const [plainEnglish, setPlainEnglish] = useState(
    'We answer on the front-desk iPhone. Bridal sits on Jane’s Google Calendar. Stones are looked up in Nivoda. After 6, text the client — only call the owner if it looks over 10k. WhatsApp is on for the Miami store only.'
  );
  const [signed, setSigned] = useState(true);

  const calls = useMemo(() => seedCalls(businessName), [businessName]);
  const liveCalls = useMemo(() => calls.filter((call) => call.status === 'live'), [calls]);
  const closedCalls = useMemo(() => calls.filter((call) => call.status !== 'live'), [calls]);

  const simulatedNames = useMemo(
    () => ['Amelia Stone', 'Noah Patel', 'Harper Wellington', 'Mason Brooks', 'Sophia Vale', 'Ethan Rhodes'],
    []
  );
  const simulatedIntents = useMemo(
    () => [
      'Oval Diamond Query',
      'Halo Ring Consultation',
      'Emerald Cut Upgrade',
      'Lab-Grown Bridal Request',
      'Custom Setting Appointment',
    ],
    []
  );

  const selectedCall: OpsCall | null = useMemo(() => {
    if (selectedKey.startsWith('log:')) return null;
    return calls.find((call) => call.id === selectedKey) ?? calls[0];
  }, [selectedKey, calls]);

  const selectedLog = useMemo(() => {
    if (!selectedKey.startsWith('log:')) return null;
    return logEntries.find((entry) => entry.id === selectedKey.slice(4)) ?? null;
  }, [selectedKey, logEntries]);

  const displayConversation = useMemo(() => {
    if (selectedLog) {
      return {
        id: selectedLog.id,
        customerName: selectedLog.customerName,
        intent: selectedLog.intent,
        status: selectedLog.status,
        isLive: false,
        transcript: selectedLog.transcript,
        actions: [] as OpsCall['actions'],
      };
    }
    const call = selectedCall ?? calls[0];
    return {
      id: call.id,
      customerName: call.customerName,
      intent: call.intent,
      status: STATUS_LABEL[call.status as CallStatus] ?? call.status,
      isLive: call.status === 'live',
      transcript: call.transcript,
      actions: call.actions,
    };
  }, [selectedLog, selectedCall, calls]);

  useEffect(() => {
    const pushLead = () => {
      const now = new Date();
      const customerName = simulatedNames[Math.floor(Math.random() * simulatedNames.length)];
      const intent = simulatedIntents[Math.floor(Math.random() * simulatedIntents.length)];
      const id = `${now.getTime()}-${Math.random()}`;
      setLogEntries((prev) =>
        [
          {
            id,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            customerName,
            intent,
            status: 'booked',
            transcript: buildHistoryTranscript(customerName, intent, businessName),
          },
          ...prev,
        ].slice(0, 12)
      );
    };
    pushLead();
    const startDelayMs = 10000 + Math.floor(Math.random() * 5001);
    let nextTimeout: ReturnType<typeof setTimeout>;
    let timeoutCancelled = false;
    const schedule = (delayMs: number) => {
      nextTimeout = setTimeout(() => {
        if (timeoutCancelled) return;
        pushLead();
        schedule(10000 + Math.floor(Math.random() * 5001));
      }, delayMs);
    };
    schedule(startDelayMs);
    return () => {
      timeoutCancelled = true;
      clearTimeout(nextTimeout);
    };
  }, [simulatedIntents, simulatedNames, businessName]);

  useEffect(() => {
    const metricInterval = setInterval(() => {
      setRevenueSaved((prev) => prev + Math.floor(Math.random() * 1900) + 300);
      setAppointmentsBooked((prev) => prev + (Math.random() > 0.45 ? 1 : 0));
    }, 5000);
    return () => clearInterval(metricInterval);
  }, []);

  useEffect(() => {
    const liveTicker = setInterval(() => setLiveSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(liveTicker);
  }, []);

  useEffect(() => {
    const waveInterval = setInterval(() => {
      setWaveHeights((prev) => prev.map(() => 10 + Math.round(Math.random() * 24)));
    }, 320);
    return () => clearInterval(waveInterval);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setOpsClock(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const channels = setInterval(() => {
      setChannelLoad({
        voice: 1 + Math.floor(Math.random() * 3),
        sms: Math.floor(Math.random() * 3),
        web: Math.floor(Math.random() * 2),
      });
    }, 4200);
    return () => clearInterval(channels);
  }, []);

  const liveDuration = `${String(Math.floor(liveSeconds / 60)).padStart(2, '0')}:${String(liveSeconds % 60).padStart(2, '0')}`;
  const heard = useMemo(() => parsePlainEnglish(plainEnglish), [plainEnglish]);

  const pageClass = isDarkMode ? 'text-[#e8eef4]' : 'text-navy-900';
  const tabShellClass = isDarkMode
    ? 'rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-xl'
    : 'rounded-full border border-neutral-200 bg-neutral-100/95 p-1 shadow-sm';
  const tabActiveClass = isDarkMode
    ? 'bg-gradient-to-r from-[#d6d6d6] to-[#b6b6b6] text-[#080808]'
    : 'bg-navy-900 text-white';
  const tabInactiveClass = isDarkMode ? 'text-white/70 hover:text-white' : 'text-navy-600 hover:text-navy-900';
  const panelClass = isDarkMode
    ? 'relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl'
    : 'relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white p-4 shadow-sm';
  const muted = isDarkMode ? 'text-white/55' : 'text-navy-500';
  const ink = isDarkMode ? 'text-white' : 'text-navy-900';

  return (
    <div className={`relative min-h-screen px-4 py-6 md:px-8 md:py-8 ${pageClass}`}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          filter: 'grayscale(1)',
          background: isDarkMode
            ? `linear-gradient(180deg, rgba(4,4,4,0.55), rgba(4,4,4,0.78)), url("${withBase('/assets/plates/plate_hud_atmosphere.png')}") center / cover no-repeat`
            : undefined,
        }}
        aria-hidden
      />
      {isDarkMode && <div className="fx-grid z-0" aria-hidden />}

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fx-kicker">
              Voice agent
              {location ? ` · ${location}` : ''}
            </p>
            <h1 className={`fx-hud mt-2 text-[13px] md:text-sm ${isDarkMode ? 'text-[#efefef]' : 'text-navy-800'}`}>
              Fourcee ops
            </h1>
            <p className={`mt-1 text-[11px] ${muted}`}>
              {businessName} · answer, qualify, act, log. Ring studio is a demo tab only.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className={`font-mono text-[10px] tabular-nums tracking-[0.16em] ${muted}`}>
              {opsClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {reportId ? ` · ${reportId}` : ''}
            </p>
            <div className={tabShellClass}>
              {(['calls', 'onboard', 'handover', 'studio'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                    activeTab === tab ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'calls' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'VOICE', load: channelLoad.voice },
                { id: 'SMS', load: channelLoad.sms },
                { id: 'WEB', load: channelLoad.web },
              ].map((ch) => (
                <span key={ch.id} className="fx-chip">
                  <span className={ch.load > 0 ? 'fx-dot' : 'h-1.5 w-1.5 rounded-full bg-neutral-500'} />
                  {ch.id} {ch.load.toString().padStart(2, '0')}
                </span>
              ))}
              <span className="fx-chip">SOP · answer → qualify → act → log</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Recovered" value={formatMoney(revenueSaved)} isDarkMode={isDarkMode} />
              <Kpi label="Booked today" value={appointmentsBooked.toString()} isDarkMode={isDarkMode} />
              <Kpi label="Avg handle" value="1.2m" isDarkMode={isDarkMode} />
              <Kpi label="Follow-ups owed" value="3" isDarkMode={isDarkMode} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr_0.9fr]">
              <section className={panelClass}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Call log</h3>
                  <p className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>{liveCalls.length} live</p>
                </div>
                <div className="space-y-2">
                  {liveCalls.map((call) => (
                    <LogRow
                      key={call.id}
                      title={call.customerName}
                      meta={`${call.intent} · ${call.startedAgo}`}
                      status={call.status}
                      selected={selectedKey === call.id}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(call.id)}
                    />
                  ))}
                  {logEntries.map((entry) => (
                    <LogRow
                      key={entry.id}
                      title={entry.customerName}
                      meta={`${entry.intent} · ${entry.time}`}
                      status={entry.status}
                      selected={selectedKey === `log:${entry.id}`}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(`log:${entry.id}`)}
                    />
                  ))}
                  {closedCalls.map((call) => (
                    <LogRow
                      key={call.id}
                      title={call.customerName}
                      meta={call.intent}
                      status={call.status}
                      selected={selectedKey === call.id}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(call.id)}
                    />
                  ))}
                </div>
              </section>

              <aside className={panelClass}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Transcript</h3>
                    <p className={`mt-1 text-[11px] ${muted}`}>
                      {displayConversation.customerName} · {displayConversation.intent}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(displayConversation.status, isDarkMode)}`}>
                    {displayConversation.isLive ? `LIVE ${liveDuration}` : displayConversation.status}
                  </span>
                </div>
                <div className={`mt-3 rounded-xl border px-3 py-2 ${isDarkMode ? 'border-white/10 bg-black/50' : 'border-neutral-200 bg-white'}`}>
                  <p className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>Voice activity</p>
                  <div className="mt-2 flex h-8 items-end gap-1">
                    {waveHeights.map((h, i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full ${isDarkMode ? 'bg-neutral-300/80' : 'bg-navy-500/70'}`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div tabIndex={0} role="region" aria-label="Live call transcript" className={`mt-3 max-h-[340px] space-y-2 overflow-auto rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-black/40' : 'border-neutral-200 bg-white'}`}>
                  {displayConversation.transcript.map((row, idx) => (
                    <div key={`${displayConversation.id}-${idx}`} className={`rounded-lg border p-2.5 ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-neutral-100 bg-neutral-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-semibold ${row.speaker === 'Agent' ? ink : isDarkMode ? 'text-neutral-300' : 'text-neutral-800'}`}>
                          {row.speaker}
                        </span>
                        <span className={`text-[10px] ${muted}`}>{row.at}</span>
                      </div>
                      <p className={`mt-1 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/85' : 'text-navy-800'}`}>{row.line}</p>
                    </div>
                  ))}
                </div>
              </aside>

              <section className={panelClass}>
                <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Actions · status</h3>
                <p className={`mt-2 text-[11px] uppercase tracking-[0.16em] ${statusTone(displayConversation.status, isDarkMode)}`}>
                  {displayConversation.status}
                </p>
                <div className="mt-3 space-y-2">
                  {displayConversation.actions.length === 0 ? (
                    <p className={`text-[12px] ${muted}`}>Closed log — actions already written to CRM.</p>
                  ) : (
                    displayConversation.actions.map((action) => (
                      <div key={action.id} className="flex items-start justify-between gap-2 border-b border-white/5 py-2 last:border-0">
                        <div>
                          <p className={`text-[12px] ${ink}`}>{action.label}</p>
                          {action.detail ? <p className={`text-[11px] ${muted}`}>{action.detail}</p> : null}
                        </div>
                        <span className={`text-[10px] uppercase tracking-[0.14em] ${actionTone(action.state, isDarkMode)}`}>
                          {action.state}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <p className={`mt-4 text-[10px] uppercase tracking-[0.18em] ${muted}`}>SOP check</p>
                <ul className="mt-2 space-y-1">
                  {SOP_CHECKS.map((item) => (
                    <li key={item} className={`text-[11px] ${isDarkMode ? 'text-white/75' : 'text-navy-700'}`}>
                      · {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'onboard' && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className={panelClass}>
              <p className="fx-kicker">
                Client onboarding · {onboardStep + 1} of {ONBOARD_STEPS.length}
              </p>
              <h2 className="fx-display mt-2 text-2xl md:text-3xl">
                {onboardStep === 0
                  ? 'When does the line pick up?'
                  : onboardStep === 1
                    ? 'Which tools does the store already live in?'
                    : onboardStep === 2
                      ? 'What should the voice never do?'
                      : 'Read it back. Correct anything.'}
              </h2>
              <p className={`mt-2 max-w-xl text-[13px] leading-relaxed ${muted}`}>
                {onboardStep === 0
                  ? 'Hours, after-hours, and who owns the phone when the floor is busy. Write it like a text to the manager.'
                  : onboardStep === 1
                    ? 'Calendar, CRM, inventory, WhatsApp, SMS — name the tools in plain English. No API keys on day one.'
                    : onboardStep === 2
                      ? 'Escalate rules, dollar thresholds, languages, and the greeting that must stay in the store’s voice.'
                      : 'We turn the paragraph into integration cards. Wrong card? Edit the paragraph. The original stays in the developer packet.'}
              </p>
              <textarea
                value={plainEnglish}
                onChange={(event) => setPlainEnglish(event.target.value)}
                rows={8}
                className={`mt-4 w-full rounded-2xl border px-4 py-3 text-[14px] leading-relaxed outline-none ${
                  isDarkMode ? 'border-white/10 bg-black/40 text-[#efefef]' : 'border-neutral-200 bg-white text-navy-900'
                }`}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {ONBOARD_STEPS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setOnboardStep(index)}
                    className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
                      onboardStep === index ? tabActiveClass : `border ${isDarkMode ? 'border-white/15 text-white/70' : 'border-neutral-200 text-navy-600'}`
                    }`}
                  >
                    {index + 1} {label}
                  </button>
                ))}
              </div>
            </section>
            <section className={panelClass}>
              <p className="fx-kicker">We heard</p>
              <div className="mt-3 space-y-2">
                {heard.map((card) => (
                  <div key={card.title} className={`rounded-2xl border px-3 py-2.5 ${isDarkMode ? 'border-white/10 bg-black/30' : 'border-neutral-200 bg-neutral-50'}`}>
                    <p className={`text-[13px] ${ink}`}>{card.title}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.12em] ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>{card.state}</p>
                  </div>
                ))}
              </div>
              <p className={`mt-4 text-[12px] leading-relaxed ${muted}`}>
                Wrong card? Edit the paragraph. The original stays in the developer packet.
              </p>
            </section>
          </div>
        )}

        {activeTab === 'handover' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="fx-kicker">{signed ? 'Signed client · handover gate' : 'Unsigned · preview only'}</p>
                <h2 className="fx-display mt-2 text-2xl md:text-3xl">{signed ? `Ready for build — ${businessName}` : 'Handover locked until sign'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSigned((value) => !value)}
                className="fx-btn fx-btn-ghost text-[10px]"
              >
                {signed ? 'Mark unsigned' : 'Mark signed'}
              </button>
            </div>
            {!signed ? (
              <p className={`max-w-xl text-[13px] ${muted}`}>
                Engineering does not provision from a Slack thread. Sign the client, then this packet becomes a work order.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Fact label="Answer" body={`Front desk line · display CID ${businessName}`} isDarkMode={isDarkMode} />
                  <Fact label="Write targets" body="Google Calendar · CRM contacts · inventory holds" isDarkMode={isDarkMode} />
                  <Fact label="Escalate" body="Owner after hours if > $10k · design for custom · never legal on the line" isDarkMode={isDarkMode} />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className={panelClass}>
                    <p className="fx-kicker">Engineering checklist</p>
                    <ul className="mt-3 space-y-2">
                      {HANDOVER_ITEMS.map((item) => (
                        <li key={item.id} className={`text-[13px] ${ink}`}>
                          <span className={item.ready ? 'text-neutral-400' : isDarkMode ? 'text-[#d6d6d6]' : 'text-neutral-700'}>
                            {item.ready ? '☑' : '☐'}
                          </span>{' '}
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className={panelClass}>
                    <p className="fx-kicker">Do-not-do (client words)</p>
                    <p className={`mt-3 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-navy-800'}`}>
                      {plainEnglish}
                    </p>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="mt-6 space-y-3">
            <p className={`text-[12px] ${muted}`}>
              Showroom merchandising only. The voice agent remains the SOP — this never replaces a live inventory lookup.
            </p>
            {ringBuilder ? (
              <LazyRingBuilderSection config={ringBuilder} isDarkMode={isDarkMode} compact businessName={businessName} />
            ) : (
              <p className={muted}>Ring studio is off for this payload (`ringBuilder.enabled: false`).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function parsePlainEnglish(text: string) {
  const cards = [
    { title: 'Phone · front desk', state: 'Mapped · number still needed', hit: /iphone|phone|desk|line/i },
    { title: 'Calendar · bridal', state: 'Mapped · invite owner', hit: /calendar|jane|book/i },
    { title: 'Inventory · Nivoda', state: 'Mapped · token at handover', hit: /nivoda|stone|inventory/i },
    { title: 'After-hours · SMS + escalate', state: 'Rule drafted', hit: /after|6|sms|text|10k|owner/i },
    { title: 'WhatsApp', state: 'Scoped if mentioned', hit: /whatsapp|miami/i },
    { title: 'Website · storefront', state: 'Noted', hit: /shopify|website|storefront/i },
  ];
  const matched = cards.filter((card) => card.hit.test(text));
  return matched.length ? matched : [{ title: 'Needs a first paragraph', state: 'Waiting', hit: /./ }];
}

const Kpi: React.FC<{ label: string; value: string; isDarkMode: boolean }> = ({ label, value, isDarkMode }) => (
  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-neutral-200 bg-white'}`}>
    <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-white/55' : 'text-navy-500'}`}>{label}</p>
    <p className={`mt-1 text-xl font-medium tracking-tight ${isDarkMode ? 'text-[#b6b6b6]' : 'text-navy-900'}`}>{value}</p>
  </div>
);

const Fact: React.FC<{ label: string; body: string; isDarkMode: boolean }> = ({ label, body, isDarkMode }) => (
  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-neutral-200 bg-white'}`}>
    <p className="fx-kicker">{label}</p>
    <p className={`mt-2 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-navy-800'}`}>{body}</p>
  </div>
);

const LogRow: React.FC<{
  title: string;
  meta: string;
  status: string;
  selected: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}> = ({ title, meta, status, selected, isDarkMode, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border px-3 py-2.5 text-left ${
      selected
        ? isDarkMode
          ? 'border-neutral-300/35 bg-neutral-100/5'
          : 'border-navy-400 bg-navy-50'
        : isDarkMode
          ? 'border-white/10 bg-black/40'
          : 'border-neutral-200 bg-neutral-50'
    }`}
  >
    <p className={`text-[13px] font-medium ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>{title}</p>
    <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-white/55' : 'text-navy-500'}`}>
      {meta} · <span className={statusTone(status, isDarkMode)}>{status}</span>
    </p>
  </button>
);
