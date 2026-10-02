'use client';

import * as React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

const COUNTRIES = [
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+27', name: 'ZA', flag: '🇿🇦' },
  { code: '+61', name: 'AU', flag: '🇦🇺' },
  { code: '+91', name: 'IN', flag: '🇮🇳' },
  { code: '+33', name: 'FR', flag: '🇫🇷' },
  { code: '+49', name: 'DE', flag: '🇩🇪' },
  { code: '+251', name: 'ET', flag: '🇪🇹' },
  { code: '+971', name: 'AE', flag: '🇦🇪' },
  { code: '+81', name: 'JP', flag: '🇯🇵' },
  // { code: '+39', name: 'IT', flag: '🇮🇹' },
];

export interface MiniPhoneProps {
  className?: string;
  isDarkMode?: boolean;
  businessName?: string;
  leadId?: string;
  /** From content.json → liveDemo.phoneCountryDefault (e.g. "+1"). */
  phoneCountryDefault?: string;
  ctaLabel?: string;
  helperCopy?: string;
  onCallCompleted?: () => void;
}

export function MiniPhone({
  className,
  isDarkMode = true,
  businessName = 'PLACEHOLDER Business',
  leadId,
  phoneCountryDefault,
  ctaLabel,
  helperCopy,
  onCallCompleted,
}: MiniPhoneProps) {
  const matchedDefault = COUNTRIES.find((c) => c.code === phoneCountryDefault) ?? COUNTRIES[0];
  const [selectedCountry, setSelectedCountry] = React.useState(matchedDefault);
  const [phone, setPhone] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'calling' | 'success'>('idle');

  React.useEffect(() => {
    const next = COUNTRIES.find((c) => c.code === phoneCountryDefault);
    if (next) setSelectedCountry(next);
  }, [phoneCountryDefault]);

  const handleCall = async () => {
    if (!phone.trim()) return;
    setStatus('calling');
    
    try {
      const response = await fetch('https://app.fourcee.online/webhook/voice-demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: `${selectedCountry.code}${phone.replace(/\\D/g, '')}`,
          lead_id: leadId,
        }),
      });

      if (!response.ok) throw new Error('Failed to start call');
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('idle');
      alert('Failed to initiate call. Please try again.');
    }
  };

  React.useEffect(() => {
    if (status === 'success') {
      onCallCompleted?.();
    }
  }, [status, onCallCompleted]);

  const textClass = isDarkMode ? 'text-white' : 'text-[#272727]';
  const mutedClass = isDarkMode ? 'text-neutral-400' : 'text-[#535353]';
  const inputBg = isDarkMode ? 'bg-white/10 border-white/20' : 'bg-[#efefef]/85 border-[#cccccc]';

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-sm rounded-2xl p-4 sm:p-6 border backdrop-blur-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]',
        isDarkMode
          ? 'bg-white/5 border-white/20'
          : 'bg-gradient-to-br from-[#d8d8d8]/85 via-[#cccccc]/82 to-[#b8b8b8]/78 border-[#acacac]/70 shadow-[0_28px_60px_-18px_rgba(121,121,121,0.45)]',
        className
      )}
      role="group"
      aria-label={`${businessName} demo call - enter number and call`}
    >
      {status === 'success' ? (
        <div className="text-center py-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-neutral-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
            <Phone className="w-6 h-6" />
          </div>
          <p className={cn('font-bold', textClass)}>Call initiated</p>
          <p className={cn('text-xs mt-1', mutedClass)}>Check your phone</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', isDarkMode ? 'bg-white/10' : 'bg-[#ebebeb]/90')}>
              <Phone className={cn('w-5 h-5', textClass)} />
            </div>
            <div>
              <p className={cn('text-sm font-bold', textClass)}>{ctaLabel || `${businessName} demo`}</p>
              <p className={cn('text-[10px] uppercase tracking-wider', mutedClass)}>{helperCopy || "We'll call you"}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4 min-w-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={cn(
                  'h-10 sm:h-12 px-3 rounded-lg sm:rounded-xl border flex items-center gap-2 text-xs sm:text-sm font-bold min-w-[4.5rem]',
                  inputBg,
                  textClass
                )}
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-label="Country code"
              >
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="font-mono">{selectedCountry.code}</span>
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setDropdownOpen(false)} />
                  <ul
                    role="listbox"
                    className="absolute top-full left-0 mt-1 w-48 max-h-52 overflow-y-auto rounded-xl border shadow-xl z-20 py-1 bg-[#f5f5f5] dark:bg-navy-900 border-[#cccccc] dark:border-white/20 animate-in slide-in-from-top-2"
                  >
                    {COUNTRIES.map((c) => (
                      <li key={c.code} role="option">
                        <button
                          type="button"
                          className={cn(
                            'w-full px-3 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors',
                            c.code === selectedCountry.code
                              ? 'bg-navy-100 dark:bg-white/10 text-navy-900 dark:text-white'
                              : 'text-[#444444] dark:text-navy-200 hover:bg-[#e7e7e7] dark:hover:bg-white/5'
                          )}
                          onClick={() => {
                            setSelectedCountry(c);
                            setDropdownOpen(false);
                          }}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="text-[10px] font-mono opacity-80">{c.code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
              className={cn(
                'flex-1 min-w-0 h-10 sm:h-12 px-3 sm:px-4 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-medium placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-white/30',
                inputBg,
                textClass
              )}
              aria-label="Phone number"
            />
          </div>

          <button
            type="button"
            disabled={!phone.trim() || status === 'calling'}
            onClick={handleCall}
            className={cn(
              'w-full h-10 sm:h-11 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all disabled:opacity-50',
              isDarkMode
                ? 'bg-neutral-100 text-neutral-950 hover:bg-white active:scale-[0.98]'
                : 'bg-gradient-to-r from-[#4a4a4a] via-[#505050] to-[#3a3a3a] text-white hover:brightness-110 active:scale-[0.98] border border-[#6e6e6e] shadow-[0_8px_20px_rgba(111,111,111,0.35)]'
            )}
          >
            <Phone className="w-5 h-5" />
            {status === 'calling' ? 'Calling…' : 'Call'}
          </button>
        </>
      )}
    </div>
  );
}
