import { useState } from 'react';

const ROLE_CHIPS = [
  'PhD student / researcher',
  'Medical professional',
  'Policy analyst',
  'Journalist / investigator',
  'Startup founder',
  'Engineer / developer',
  'Just exploring',
];

const DOMAIN_CHIPS = [
  'Life sciences / medicine',
  'Physical sciences',
  'Social sciences',
  'Law & policy',
  'Business & strategy',
  'Computer science',
  'Multiple / interdisciplinary',
];

interface OnboardingProps {
  onComplete: (role: string, domain: string) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'role' | 'domain' | 'done'>('role');
  const [role, setRole] = useState('');
  const [domain, setDomain] = useState('');

  const handleFinish = () => {
    const profile = {
      role,
      domain,
      onboarded_at: new Date().toISOString(),
    };
    localStorage.setItem('voicegraph_onboarded', 'true');
    localStorage.setItem('voicegraph_profile', JSON.stringify(profile));

    // POST to backend
    fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }).catch(() => {});

    onComplete(role, domain);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#09090b' }}>
      <div className="w-full max-w-lg px-6">
        {step === 'role' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Who are you?</h1>
              <p className="mt-2 text-sm text-text-muted">
                This shapes how VoiceGraph builds and interprets your knowledge.
              </p>
            </div>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. PhD researcher in computational biology, Cardiologist at NYU, Investigative journalist"
              className="w-full glass-2 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <div className="flex flex-wrap gap-2">
              {ROLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setRole(chip)}
                  className={`glass-3 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    role === chip ? 'text-text-primary ring-1 ring-white/30' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              onClick={() => role.trim() && setStep('domain')}
              disabled={!role.trim()}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
              style={{ background: 'hsla(45, 80%, 65%, 0.85)', color: '#09090b' }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'domain' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">What's your main domain?</h1>
            </div>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. Kidney disease research, Constitutional law, Climate tech"
              className="w-full glass-2 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <div className="flex flex-wrap gap-2">
              {DOMAIN_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setDomain(chip)}
                  className={`glass-3 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    domain === chip ? 'text-text-primary ring-1 ring-white/30' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {domain.trim() && (
                <p className="text-sm text-text-secondary text-center">
                  Got it. We'll organize your knowledge as a <span className="text-text-primary font-medium">{role}</span> focused on <span className="text-text-primary font-medium">{domain}</span>.
                </p>
              )}
              <button
                onClick={handleFinish}
                disabled={!domain.trim()}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
                style={{ background: 'hsla(45, 80%, 65%, 0.85)', color: '#09090b' }}
              >
                Start building →
              </button>
              <button
                onClick={() => setStep('role')}
                className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
