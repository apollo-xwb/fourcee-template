
import React, { useEffect, useState } from 'react';
import { PACKAGES, UPSELLS } from '../constants.tsx';
import { CheckoutState } from '../types';
import fcShad from '../public/assets/fcshad.webp';
import { isPlaceholderBusinessName, loadAuditContent, PLACEHOLDER_BUSINESS_NAME } from '../lib/audit-content';
interface CheckoutFlowProps {
  isDarkMode?: boolean;
  initialPackageId?: string | null;
}

const LEGACY_PACKAGE_IDS: Record<string, string> = { premium: 'pro' };

const WISE_PAYMENT_URL = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_WISE_PAYMENT_URL || '';
const CAL_BOOKING_URL =
  (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_CAL_BOOKING_URL ||
  'https://calendar.app.google/Ra2fzveKj33ZqbAG9';


export const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ isDarkMode = false, initialPackageId }) => {
  const normalizedInitial =
    initialPackageId && LEGACY_PACKAGE_IDS[initialPackageId]
      ? LEGACY_PACKAGE_IDS[initialPackageId]
      : initialPackageId;
  const resolvedInitialId =
    normalizedInitial && PACKAGES.some((p) => p.id === normalizedInitial) ? normalizedInitial : PACKAGES[1].id;
  const [state, setState] = useState<CheckoutState>({
    packageId: resolvedInitialId,
    upsells: [],
    form: {},
    step: 1,
    billingCycle: 'monthly',
  });
  const [companyName, setCompanyName] = useState(PLACEHOLDER_BUSINESS_NAME);

  useEffect(() => {
    let mounted = true;
    loadAuditContent()
      .then((data) => {
        if (!mounted) return;
        const incomingName = data?.business?.name?.trim();
        if (!incomingName) return;
        setCompanyName((current) =>
          isPlaceholderBusinessName(current) ? incomingName : current
        );
      })
      .catch(() => {
        // Keep placeholder if audit data is unavailable.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPackage = PACKAGES.find(p => p.id === state.packageId)!;
  const upsellTotal = UPSELLS.filter(u => state.upsells.includes(u.id)).reduce((acc, curr) => acc + (curr.price || 0), 0);
  const upsellMonthlyTotal = UPSELLS.filter(u => state.upsells.includes(u.id))
    .reduce((acc, u) => acc + (('monthlyPrice' in u && (u as { monthlyPrice?: number }).monthlyPrice) || 0), 0);
  /** Due today: annual = yearly + one-time upsells (setup waived). Monthly = setup + first month + monthly upsells + one-time upsells */
  const total =
    state.billingCycle === 'annual'
      ? selectedPackage.yearlyPrice + upsellTotal
      : selectedPackage.price + selectedPackage.monthly + upsellMonthlyTotal + upsellTotal;
  const monthlyTotal = selectedPackage.monthly + upsellMonthlyTotal;

  const nextStep = () => setState(s => ({ ...s, step: s.step + 1 }));
  const prevStep = () => setState(s => ({ ...s, step: Math.max(1, s.step - 1) }));

  const handleUpsellToggle = (id: string) => {
    setState(s => ({
      ...s,
      upsells: s.upsells.includes(id) ? s.upsells.filter(u => u !== id) : [...s.upsells, id]
    }));
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="text-center max-w-2xl mx-auto">
              <p className="fx-kicker text-[#6b5a3e]">
                Configure · {companyName}
              </p>
              <h2 className="fx-display mt-2 text-2xl sm:text-3xl text-navy-950">
                Get live in 2 hours
              </h2>
              <p className="mt-2 text-[12px] sm:text-sm text-navy-800 leading-relaxed">
                Setup takes less than 2 hours. Once active, you&apos;ll never lose another client to a missed call again.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-navy-800">
                Billing
              </span>
              <div className="inline-flex rounded-full border border-navy-200 p-0.5 bg-white/80 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, billingCycle: 'monthly' }))}
                  className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                    state.billingCycle === 'monthly'
                      ? 'bg-gradient-to-r from-[#e8d5a8] to-[#c8b58f] text-[#1a140c]'
                      : 'text-navy-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, billingCycle: 'annual' }))}
                  className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                    state.billingCycle === 'annual'
                      ? 'bg-gradient-to-r from-[#e8d5a8] to-[#c8b58f] text-[#1a140c]'
                      : 'text-navy-700'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy-800 mb-2.5">Voice Tier</p>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {[...PACKAGES]
                  .sort((a, b) => b.monthly - a.monthly)
                  .map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => setState(s => ({ ...s, packageId: pkg.id }))}
                    className={`p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all ${state.packageId === pkg.id ? 'border-[#c8b58f] bg-white shadow-[0_0_0_1px_rgba(200,181,143,0.35)]' : 'border-navy-200/80 bg-white/70 hover:border-[#c8b58f]/50'}`}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-navy-800">{pkg.name}</p>
                      {state.packageId === pkg.id ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Selected</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-lg sm:text-xl font-bold font-sans text-navy-950 leading-none">
                      {state.billingCycle === 'annual' ? `$${pkg.yearlyPrice.toLocaleString()}` : `$${pkg.monthly.toLocaleString()}`}
                      <span className="text-xs font-sans font-semibold text-navy-700">{state.billingCycle === 'annual' ? '/yr' : '/mo'}</span>
                    </p>
                    <p className="mt-1 text-[10px] text-navy-700 leading-snug">
                      {state.billingCycle === 'annual'
                        ? 'Annual · setup waived'
                        : `$${pkg.price.toLocaleString()} setup + first month`}
                    </p>
                    <p className="mt-1.5 text-[10px] text-navy-600 line-clamp-2">{pkg.description}</p>
                    <ul className="mt-2 space-y-0.5 text-[10px] sm:text-[11px] text-navy-800">
                      {pkg.features.slice(0, 3).map(f => (
                        <li key={f} className="flex items-start gap-1.5">
                          <span className="text-navy-950 shrink-0">✓</span>
                          <span className="line-clamp-1">{f}</span>
                        </li>
                      ))}
                      {pkg.features.length > 3 ? (
                        <li className="text-navy-500">+{pkg.features.length - 3} more</li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {UPSELLS.length > 0 && (
            <div className="fx-ui-sans">
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy-700 dark:text-navy-300 mb-4">Additional add-ons</p>
              <p className="mb-4 text-sm font-medium text-navy-600 dark:text-navy-400 leading-relaxed">
                Optional extras beyond your voice tier. Priced separately — not included unless selected.
              </p>
              <div className="space-y-4">
                {[...UPSELLS]
                  .sort((a, b) => ((b as { monthlyPrice?: number }).monthlyPrice ?? 0) - ((a as { monthlyPrice?: number }).monthlyPrice ?? 0))
                  .map(u => {
                  const isChecked = state.upsells.includes(u.id);
                  const isUnifiedChat = u.id === 'unified_chat';
                  const features = 'features' in u ? (u as { features?: string[] }).features : undefined;
                  return (
                    <label
                      key={u.id}
                      className={`flex items-start gap-4 cursor-pointer group block p-5 sm:p-6 rounded-2xl border-2 transition-all ${
                        isUnifiedChat
                          ? 'bg-gradient-to-br from-navy-50 to-white dark:from-navy-900/60 dark:to-navy-950/80 border-navy-200 dark:border-white/20'
                          : 'bg-white dark:bg-navy-900/40 border-silver-100 dark:border-navy-800'
                      } ${isChecked ? 'ring-2 ring-[#c8b58f] ring-offset-2 dark:ring-offset-navy-950' : ''}`}
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleUpsellToggle(u.id)}
                          className="sr-only peer"
                        />
                        <div className={`w-6 h-6 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                          isChecked 
                            ? 'bg-navy-900 dark:bg-white border-navy-900 dark:border-white' 
                            : 'bg-transparent border-navy-300 dark:border-navy-600 group-hover:border-navy-400'
                        }`}>
                          {isChecked && (
                            <svg className="w-4 h-4 text-white dark:text-navy-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-bold text-base text-navy-900 dark:text-white">{u.name}</p>
                          {isUnifiedChat && (
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-navy-900/10 dark:bg-white/10 text-navy-600 dark:text-navy-300">
                              Concierge
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-navy-700 dark:text-navy-400 leading-relaxed">{u.description}</p>
                        {features && features.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-700 dark:text-navy-400">
                            {features.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-navy-400 dark:bg-navy-500" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span className="font-bold text-base text-navy-900 dark:text-white flex-shrink-0 ml-4 text-right">
                        {u.price ? `+$${u.price}` : null}
                        {'monthlyPrice' in u && (u as { monthlyPrice?: number }).monthlyPrice ? (
                          <span className="block text-xs font-medium text-navy-700 dark:text-navy-400 mt-0.5">
                            ${(u as { monthlyPrice: number }).monthlyPrice}/mo
                          </span>
                        ) : u.price ? (
                          <span className="block text-xs font-medium text-navy-700 dark:text-navy-400 mt-0.5">one-time</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right duration-500">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold serif text-navy-900 dark:text-white">Business Details</h2>
              <p className="mt-3 text-sm text-navy-600 dark:text-navy-400 leading-relaxed">
                We use this to tailor your onboarding and connect your existing tools. Your data is never shared.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white dark:bg-navy-900/40 p-6 sm:p-8 rounded-3xl border border-silver-100 dark:border-navy-800">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase block mb-2 text-navy-700 dark:text-navy-300">Company / Showroom Name</label>
                <input
                  className="w-full p-4 rounded-xl border border-silver-200 dark:border-navy-700 dark:bg-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-white"
                  placeholder="E.g. Royal Diamonds Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase block mb-2 text-navy-700 dark:text-navy-300">Primary Contact</label>
                <input className="w-full p-4 rounded-xl border border-silver-200 dark:border-navy-700 dark:bg-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-white" placeholder="Full name" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase block mb-2 text-navy-700 dark:text-navy-300">Email</label>
                <input type="email" className="w-full p-4 rounded-xl border border-silver-200 dark:border-navy-700 dark:bg-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-white" placeholder="you@showroom.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase block mb-2 text-navy-700 dark:text-navy-300">Primary CRM</label>
                <select className="w-full p-4 rounded-xl border border-silver-200 dark:border-navy-700 dark:bg-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-white">
                  <option value="">Select your CRM</option>
                  <option>HubSpot</option>
                  <option>Salesforce</option>
                  <option>Zoho CRM</option>
                  <option>Pipedrive</option>
                  <option>GoHighLevel</option>
                  <option>None / Custom</option>
                </select>
                <p className="mt-1.5 text-xs text-navy-500 dark:text-navy-400">We&apos;ll sync call summaries and lead data here.</p>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="max-w-md mx-auto space-y-6 animate-in zoom-in duration-500">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold serif text-navy-900 dark:text-white">Invoice &amp; Wise handoff</h2>
              <p className="mt-3 text-sm text-navy-600 dark:text-navy-400 leading-relaxed">
                We do not collect card numbers in this browser. After you confirm details, we send a Wise invoice / payment link
                and book your onboarding call. No fake PCI vault — real payment stays on Wise.
              </p>
            </div>
            <div className="bg-white dark:bg-navy-900/40 p-8 sm:p-10 rounded-3xl shadow-xl border border-silver-100 dark:border-navy-800 space-y-5">
              <div className="pb-5 border-b border-navy-100 dark:border-navy-800">
                <p className="text-[10px] font-bold uppercase text-navy-700 dark:text-navy-300 mb-1">Order summary · due today</p>
                <p className="text-3xl sm:text-4xl font-bold serif text-navy-900 dark:text-white">${total.toLocaleString()}</p>
                <p className="text-xs text-navy-700 dark:text-navy-400 mt-2">
                  {selectedPackage.name} · {state.billingCycle === 'annual' ? (
                    <>Annual ${selectedPackage.yearlyPrice.toLocaleString()} (setup waived)</>
                  ) : (
                    <>
                      Setup ${selectedPackage.price.toLocaleString()} + first month ${selectedPackage.monthly.toLocaleString()}
                      {upsellTotal + upsellMonthlyTotal > 0 ? ' + add-ons' : ''}
                      · then <span className="font-semibold">${monthlyTotal.toLocaleString()}/mo</span>
                    </>
                  )}
                </p>
              </div>
              <ol className="space-y-3 text-sm text-navy-700 dark:text-navy-300 list-decimal pl-5">
                <li>We email a Wise invoice for the amount above (or open your payment link if configured).</li>
                <li>Book a 30-minute strategy / onboarding call.</li>
                <li>Deployment starts after payment confirmation — typically under 2 hours once assets are ready.</li>
              </ol>
              <div className="flex flex-col gap-3 pt-2">
                {WISE_PAYMENT_URL ? (
                  <a
                    href={WISE_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fx-btn fx-btn-primary w-full text-center"
                  >
                    Pay with Wise · ${total.toLocaleString()}
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-navy-300 dark:border-navy-600 px-4 py-3 text-xs text-navy-600 dark:text-navy-400">
                    Your Wise invoice is emailed to you after you confirm below. No card details are taken on this page.
                  </div>
                )}
                <a
                  href={CAL_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fx-btn fx-btn-ghost w-full text-center"
                >
                  Book a strategy call
                </a>
              </div>
            </div>
            <p className="text-[10px] text-center text-navy-600 dark:text-navy-500 uppercase tracking-widest">
              Invoice / Wise · no card fields on this page
            </p>
          </div>
        );
      case 4:
        return (
          <div className="text-center space-y-6 py-16 sm:py-20 animate-in bounce-in duration-700">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto text-5xl">✓</div>
            <h2 className="text-3xl sm:text-4xl font-bold serif text-navy-900 dark:text-white">Deployment Started</h2>
            <p className="text-lg sm:text-xl text-navy-700 dark:text-navy-300 max-w-lg mx-auto leading-relaxed">
              Invoice requested. Expect a Wise payment link and onboarding reach-out shortly. You can also book a strategy call while you wait.
            </p>
            <p className="text-sm text-navy-500 dark:text-navy-400 max-w-md mx-auto">
              Check your inbox for deployment details and next steps.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-navy-900 dark:bg-white text-white dark:text-navy-950 rounded-full font-bold text-xs uppercase tracking-widest hover:shadow-2xl transition-all"
            >
              Return to Showroom
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pt-24 pb-40 md:pb-36 px-6 bg-transparent transition-colors">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-10">
          <img
            src={fcShad}
            alt="Fourcee mark"
            className={`h-10 md:h-12 object-contain ${isDarkMode ? 'invert' : ''}`}
          />
        </div>
        {state.step < 4 && (
          <div className="flex justify-between items-center mb-16 px-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex-1 flex flex-col items-center gap-3 relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-md ${state.step >= s ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950' : 'bg-silver-100 dark:bg-navy-800 text-navy-300'}`}>
                  {s}
                </div>
                <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${state.step >= s ? 'text-navy-900 dark:text-white' : 'text-navy-500 dark:text-navy-300'}`}>
                  {s === 1 ? 'Configure' : s === 2 ? 'Details' : 'Checkout'}
                </span>
                {s < 3 && <div className={`absolute top-6 left-[60%] w-[80%] h-[2px] ${state.step > s ? 'bg-navy-900 dark:bg-white' : 'bg-silver-100 dark:bg-navy-800'}`} />}
              </div>
            ))}
          </div>
        )}
        
        {renderStep()}

        {state.step < 4 && (
          <div className="mt-16 flex justify-between items-center relative z-30 min-h-[72px] pb-24 sm:pb-20">
            <button 
              type="button"
              onClick={prevStep}
              disabled={state.step === 1}
              className={`text-navy-600 dark:text-navy-500 font-bold text-[10px] uppercase tracking-widest hover:text-navy-900 dark:hover:text-white transition-colors ${state.step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
            >
              ← Prev
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                nextStep();
              }}
              className="fx-btn fx-btn-primary px-12 py-5 text-xs cursor-pointer shrink-0 select-none touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {state.step === 3 ? `Request invoice · $${total.toLocaleString()}` : 'Forward →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
