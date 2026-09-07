import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Download,
  FileCheck2,
  LockKeyhole,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  getDownloadNichanueTicketQueryKey,
  getVerifyNichanuePaymentQueryKey,
  useConfirmPhoneVerification,
  useCreateNichanueApplication,
  useDownloadNichanueTicket,
  useGetNichanueConfig,
  useInitializeNichanuePayment,
  useStartPhoneVerification,
  useVerifyNichanuePayment,
  type NichanueApplication,
} from '@workspace/api-client-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Step = 1 | 2 | 3 | 4;

const frustrations = [
  'My loan application was declined',
  'My phone number is not accepted for credit',
  'I do not have enough documentation',
  'I do not know where to start',
  'I need emergency funds',
];

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatFee(amount: number, currency: string) {
  return `${currency || 'KES'} ${amount.toLocaleString('en-KE')}`;
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of 4`} data-testid="progress-journey">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex items-center gap-2">
          <div
            className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold transition-colors ${
              item < step
                ? 'border-[#1c6b5d] bg-[#1c6b5d] text-white'
                : item === step
                  ? 'border-[#174b5b] bg-[#174b5b] text-white'
                  : 'border-[#cbd5d8] bg-white text-[#718087]'
            }`}
            data-testid={`progress-step-${item}`}
          >
            {item < step ? <Check size={14} strokeWidth={3} /> : item}
          </div>
          {item < 4 ? <div className={`h-px w-5 sm:w-10 ${item < step ? 'bg-[#1c6b5d]' : 'bg-[#dbe2e4]'}`} /> : null}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[#193d49]">
      {children}
    </label>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#dbe3e5] bg-white p-5 shadow-sm sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

function Home() {
  const configQuery = useGetNichanueConfig();
  const startVerification = useStartPhoneVerification();
  const confirmVerification = useConfirmPhoneVerification();
  const createApplication = useCreateNichanueApplication();
  const initializePayment = useInitializeNichanuePayment();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [selectedFrustrations, setSelectedFrustrations] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [application, setApplication] = useState<NichanueApplication | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [message, setMessage] = useState('');
  const [ticketError, setTicketError] = useState('');

  const config = configQuery.data;
  const paymentQuery = useVerifyNichanuePayment(paymentReference, {
    query: {
      enabled: Boolean(paymentReference),
      queryKey: getVerifyNichanuePaymentQueryKey(paymentReference),
      retry: false,
    },
  });
  const ticketQuery = useDownloadNichanueTicket(application?.applicationId ?? '', {
    query: {
      enabled: false,
      queryKey: getDownloadNichanueTicketQueryKey(application?.applicationId ?? ''),
      retry: false,
    },
  });

  useEffect(() => {
    if (paymentQuery.data?.paid && application) setStep(4);
  }, [application, paymentQuery.data]);

  const feeLabel = useMemo(
    () => formatFee(config?.feeKes ?? 0, config?.currency ?? 'KES'),
    [config?.currency, config?.feeKes],
  );

  const toggleFrustration = (item: string) => {
    setSelectedFrustrations((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  };

  const handleStartVerification = () => {
    setMessage('');
    if (name.trim().length < 2 || phone.trim().length < 9) {
      setMessage('Please enter your full name and a valid phone number.');
      return;
    }
    startVerification.mutate(
      { data: { phone: phone.trim() } },
      {
        onSuccess: (result) => {
          setVerificationId(result.verificationId);
          setVerificationStarted(true);
          setMessage(result.message || 'A verification code has been sent.');
        },
        onError: (error) => setMessage(errorText(error, 'We could not send the code. Please try again.')),
      },
    );
  };

  const handleConfirmVerification = () => {
    setMessage('');
    if (code.trim().length < 4) {
      setMessage('Enter a verification code with at least 4 digits.');
      return;
    }
    confirmVerification.mutate(
      { data: { phone: phone.trim(), code: code.trim(), verificationId } },
      {
        onSuccess: (result) => {
          if (!result.verified) {
            setMessage(result.message || 'That code could not be verified.');
            return;
          }
          setVerified(true);
          setMessage(result.message || 'Your phone number has been verified.');
          setStep(2);
        },
        onError: (error) => setMessage(errorText(error, 'We could not verify your phone. Please try again.')),
      },
    );
  };

  const handleCreateApplication = () => {
    setMessage('');
    if (!selectedFrustrations.length || !consent) {
      setMessage('Select at least one option and agree to the use of your information.');
      return;
    }
    createApplication.mutate(
      {
        data: {
          name: name.trim(),
          phone: phone.trim(),
          frustrations: selectedFrustrations,
          verificationId,
          consent,
        },
      },
      {
        onSuccess: (result) => {
          setApplication(result);
          setStep(3);
        },
        onError: (error) => setMessage(errorText(error, 'We could not save your application. Please try again.')),
      },
    );
  };

  const handleInitializePayment = () => {
    setMessage('');
    if (!application || !email.includes('@')) {
      setMessage('Enter a valid email address to receive your payment receipt.');
      return;
    }
    initializePayment.mutate(
      { data: { applicationId: application.applicationId, email: email.trim() } },
      {
        onSuccess: (result) => {
          setPaymentReference(result.reference);
          setPaymentStarted(true);
          if (result.authorizationUrl && !result.demoMode) {
            window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
          }
        },
        onError: (error) => setMessage(errorText(error, 'We could not start the payment. Please try again.')),
      },
    );
  };

  const handleDownloadTicket = async () => {
    setTicketError('');
    const result = await ticketQuery.refetch();
    if (!result.data) {
      setTicketError('Your ticket is not available yet. Please try again shortly.');
      return;
    }
    const url = URL.createObjectURL(result.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nichanue-${application?.nichanueId ?? 'ticket'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (configQuery.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#f5f8f9] px-5 py-6">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="h-9 w-36 rounded-lg bg-[#dfe7e9]" />
          <div className="mt-16 grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
            <div className="h-44 rounded-2xl bg-[#e6edef]" />
            <div className="h-[500px] rounded-2xl bg-[#e6edef]" />
          </div>
        </div>
      </div>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#f5f8f9] p-6">
        <Panel className="max-w-md text-center">
          <CircleAlert className="mx-auto mb-4 text-[#b8554b]" size={32} />
          <h1 className="text-2xl font-bold text-[#174b5b]">Service unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#63747a]">
            We are making a few updates. Please try again in a moment.
          </p>
          <button
            data-testid="button-retry-config"
            onClick={() => configQuery.refetch()}
            className="focus-ring mt-6 inline-flex items-center gap-2 rounded-lg bg-[#174b5b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a]"
          >
            <RefreshCw size={16} /> Try again
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f5f8f9] text-[#173945]">
      <div className="mx-auto min-h-[100dvh] max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" data-testid="brand-nichanue">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#174b5b] text-white">
              <span className="text-lg font-bold">N</span>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">NICHANUE</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#718087]">Loan access support</p>
            </div>
          </div>
          <div
            className="hidden items-center gap-2 rounded-lg border border-[#dbe3e5] bg-white px-3 py-2 text-xs font-semibold text-[#63747a] sm:flex"
            data-testid="status-private"
          >
            <LockKeyhole size={14} className="text-[#1c6b5d]" /> Your information is private
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[.75fr_1.25fr] lg:gap-14 lg:pt-8">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="flex items-end justify-between gap-4 lg:block">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#1c6b5d]">Application process</p>
                <h1 className="mt-3 max-w-sm text-4xl font-bold leading-tight tracking-tight text-[#174b5b] sm:text-5xl">
                  Clear steps to better <span className="text-[#1c6b5d]">loan access.</span>
                </h1>
              </div>
              <div className="lg:mt-10">
                <StepDots step={step} />
              </div>
            </div>
            <p className="mt-6 max-w-sm text-sm leading-6 text-[#63747a]">
              Nichanue helps you prepare your request, understand your options, and keep a record of your application.
            </p>
            <div className="mt-8 hidden border-l-2 border-[#dbe3e5] pl-4 lg:block">
              <p className="text-sm font-semibold text-[#174b5b]">
                Step {step}: {step === 1 ? 'Verify your phone' : step === 2 ? 'Tell us what you need' : step === 3 ? 'Complete payment' : 'Download your ticket'}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#718087]">A short, guided process. You can review each answer before continuing.</p>
            </div>
          </aside>

          <section className="journey-enter" key={step}>
            {config.demoMode ? (
              <div className="mb-4 rounded-xl border border-[#e7d59b] bg-[#fff9e8] p-4 text-sm leading-6 text-[#765b1c]" data-testid="status-demo-mode">
                <strong>Demo mode.</strong> You can preview the full journey without making a real payment. Your information is still handled securely.
              </div>
            ) : null}
            {message ? (
              <div
                className={`mb-4 rounded-xl border p-4 text-sm leading-6 ${
                  verified || paymentQuery.data?.paid
                    ? 'border-[#b8d8ce] bg-[#edf8f4] text-[#226653]'
                    : 'border-[#e4beb8] bg-[#fff3f1] text-[#8b4038]'
                }`}
                data-testid="status-message"
              >
                {message}
              </div>
            ) : null}

            {step === 1 ? (
              <Panel>
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[.14em] text-[#1c6b5d]">Step 1 of 4</span>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#174b5b] sm:text-3xl">
                      Let&apos;s get started{ name ? `, ${name.split(' ')[0]}` : '' }.
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#63747a]">
                      Enter your name and phone number. We&apos;ll use your phone to confirm your identity.
                    </p>
                  </div>
                  <div className="hidden rounded-xl bg-[#edf8f4] p-3 text-[#1c6b5d] sm:block">
                    <Phone size={22} />
                  </div>
                </div>
                <div className="space-y-5">
                  <div>
                    <FieldLabel htmlFor="name">Full name</FieldLabel>
                    <input
                      id="name"
                      data-testid="input-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="For example, Amina Wanjiku"
                      className="focus-ring w-full rounded-lg border border-[#cbd7da] bg-white px-4 py-3.5 text-sm text-[#173945] outline-none transition-colors placeholder:text-[#9aa8ad] focus:border-[#1c6b5d]"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                    <div className="flex overflow-hidden rounded-lg border border-[#cbd7da] bg-white focus-within:border-[#1c6b5d]">
                      <span className="flex items-center border-r border-[#e1e8e9] px-3 text-sm font-semibold text-[#63747a]">+254</span>
                      <input
                        id="phone"
                        data-testid="input-phone"
                        value={phone.replace(/^\+?254/, '')}
                        onChange={(event) => setPhone(`+254${event.target.value.replace(/\D/g, '')}`)}
                        placeholder="7XX XXX XXX"
                        className="focus-ring min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-[#9aa8ad]"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#718087]">Never enter your mobile money PIN here.</p>
                  </div>
                  {!verificationStarted ? (
                    <button
                      data-testid="button-start-verification"
                      onClick={handleStartVerification}
                      disabled={startVerification.isPending}
                      className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-[#174b5b] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a] disabled:cursor-wait disabled:opacity-60"
                    >
                      {startVerification.isPending ? <RefreshCw className="soft-pulse" size={17} /> : <Phone size={17} />}
                      {startVerification.isPending ? 'Sending code...' : 'Send verification code'}
                    </button>
                  ) : (
                    <div className="space-y-4 rounded-xl bg-[#f1f7f5] p-4">
                      <div className="flex gap-3 text-sm leading-6 text-[#226653]">
                        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                        <p>
                          A code was sent to <strong>{phone}</strong>. {startVerification.data?.demoMode ? 'For demo mode, use 1234.' : 'Check your messages.'}
                        </p>
                      </div>
                      <div>
                        <FieldLabel htmlFor="code">Verification code</FieldLabel>
                        <input
                          id="code"
                          data-testid="input-verification-code"
                          value={code}
                          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="••••"
                          className="focus-ring w-full rounded-lg border border-[#cbd7da] bg-white px-4 py-3.5 text-center font-mono text-lg tracking-[.4em] outline-none"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                      </div>
                      <button
                        data-testid="button-confirm-verification"
                        onClick={handleConfirmVerification}
                        disabled={confirmVerification.isPending}
                        className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-[#1c6b5d] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#155749] disabled:opacity-60"
                      >
                        {confirmVerification.isPending ? <RefreshCw className="soft-pulse" size={17} /> : <ArrowRight size={17} />}
                        {confirmVerification.isPending ? 'Verifying...' : 'Verify phone number'}
                      </button>
                    </div>
                  )}
                </div>
              </Panel>
            ) : null}

            {step === 2 ? (
              <Panel>
                <div className="mb-8">
                  <span className="text-xs font-semibold uppercase tracking-[.14em] text-[#1c6b5d]">Step 2 of 4</span>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#174b5b] sm:text-3xl">What best describes your situation?</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#63747a]">Select all that apply. Your answers help us give you clearer guidance.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {frustrations.map((item, index) => {
                    const selected = selectedFrustrations.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        data-testid={`button-frustration-${index}`}
                        onClick={() => toggleFrustration(item)}
                        className={`focus-ring flex min-h-[66px] items-center justify-between gap-3 rounded-lg border p-4 text-left text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-[#1c6b5d] bg-[#edf8f4] text-[#226653]'
                            : 'border-[#d5e0e2] bg-white text-[#365964] hover:border-[#8db8ad]'
                        }`}
                      >
                        <span>{item}</span>
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? 'border-[#1c6b5d] bg-[#1c6b5d] text-white' : 'border-[#b8c8cc]'}`}>
                          {selected ? <Check size={14} strokeWidth={3} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-7 flex cursor-pointer gap-3 rounded-lg border border-[#dbe3e5] bg-[#f8fafb] p-4 text-sm leading-6 text-[#536b72]">
                  <input
                    data-testid="input-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#1c6b5d]"
                  />
                  <span>I agree that Nichanue may use this information to support my application and provide relevant guidance.</span>
                </label>
                <button
                  data-testid="button-continue-application"
                  onClick={handleCreateApplication}
                  disabled={createApplication.isPending}
                  className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#174b5b] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a] disabled:opacity-60"
                >
                  {createApplication.isPending ? <RefreshCw className="soft-pulse" size={17} /> : <ArrowRight size={17} />}
                  {createApplication.isPending ? 'Saving your application...' : 'Continue'}
                </button>
                <button data-testid="button-back-to-verification" onClick={() => setStep(1)} className="focus-ring mx-auto mt-4 flex items-center gap-1 text-xs font-semibold text-[#718087] hover:text-[#174b5b]">
                  <ArrowLeft size={14} /> Back
                </button>
              </Panel>
            ) : null}

            {step === 3 ? (
              <Panel>
                <div className="mb-8">
                  <span className="text-xs font-semibold uppercase tracking-[.14em] text-[#1c6b5d]">Step 3 of 4</span>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#174b5b] sm:text-3xl">Complete your application.</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#63747a]">A small service fee covers application processing and your downloadable Nichanue ticket.</p>
                </div>
                <div className="mb-6 flex items-center justify-between rounded-xl bg-[#174b5b] p-5 text-white">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#c6dcda]">Service fee</p>
                    <p className="mt-1 font-mono text-3xl font-medium text-[#f6c453]" data-testid="text-fee">{feeLabel}</p>
                  </div>
                  <FileCheck2 size={35} className="text-[#f6c453]" />
                </div>
                {!paymentStarted ? (
                  <div className="space-y-5">
                    <div>
                      <FieldLabel htmlFor="email">Email for your receipt</FieldLabel>
                      <input
                        id="email"
                        data-testid="input-email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@example.com"
                        className="focus-ring w-full rounded-lg border border-[#cbd7da] bg-white px-4 py-3.5 text-sm outline-none placeholder:text-[#9aa8ad] focus:border-[#1c6b5d]"
                        inputMode="email"
                        autoComplete="email"
                      />
                    </div>
                    <div className="flex gap-3 rounded-lg border border-[#dbe3e5] bg-[#f8fafb] p-4 text-xs leading-5 text-[#63747a]">
                      <LockKeyhole size={16} className="mt-0.5 shrink-0 text-[#1c6b5d]" />
                      <p>Payments are securely processed by Paystack. Nichanue does not see your card details.</p>
                    </div>
                    <button
                      data-testid="button-start-payment"
                      onClick={handleInitializePayment}
                      disabled={initializePayment.isPending}
                      className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-[#1c6b5d] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#155749] disabled:opacity-60"
                    >
                      {initializePayment.isPending ? <RefreshCw className="soft-pulse" size={17} /> : <ArrowRight size={17} />}
                      {initializePayment.isPending ? 'Preparing payment...' : `Pay ${feeLabel}`}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#d5e0e2] bg-[#f1f7f5] p-5">
                    <div className="flex gap-3">
                      <CheckCircle2 className="shrink-0 text-[#1c6b5d]" size={22} />
                      <div>
                        <p className="font-semibold text-[#226653]">{config.demoMode ? 'Demo payment is ready.' : 'Payment is ready.'}</p>
                        <p className="mt-1 text-sm leading-6 text-[#63747a]">
                          {config.demoMode ? 'Use the button below to check the demo payment status.' : 'The Paystack payment window is open. Return here after completing payment.'}
                        </p>
                      </div>
                    </div>
                    <button
                      data-testid="button-verify-payment"
                      onClick={() => paymentQuery.refetch()}
                      disabled={paymentQuery.isFetching}
                      className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#174b5b] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a] disabled:opacity-60"
                    >
                      {paymentQuery.isFetching ? <RefreshCw className="soft-pulse" size={17} /> : <ShieldCheck size={17} />}
                      {paymentQuery.isFetching ? 'Checking payment...' : 'I have completed payment'}
                    </button>
                    {paymentQuery.isError || (paymentQuery.data && !paymentQuery.data.paid) ? (
                      <p className="mt-3 text-center text-xs text-[#8b4038]" data-testid="status-payment-error">
                        {paymentQuery.data?.message || 'Payment has not been confirmed yet. Try again after completing payment.'}
                      </p>
                    ) : null}
                  </div>
                )}
                <button data-testid="button-back-to-frustrations" onClick={() => setStep(2)} className="focus-ring mx-auto mt-4 flex items-center gap-1 text-xs font-semibold text-[#718087] hover:text-[#174b5b]">
                  <ArrowLeft size={14} /> Back
                </button>
              </Panel>
            ) : null}

            {step === 4 && application ? (
              <Panel className="overflow-hidden">
                <div className="relative -mx-5 -mt-5 mb-7 overflow-hidden bg-[#174b5b] px-5 py-8 text-white sm:-mx-8 sm:-mt-8 sm:px-8">
                  <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-[#f6c453]/30" />
                  <div className="relative flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#f6c453] text-[#174b5b]">
                      <Check size={25} strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[.14em] text-[#f6c453]">Step 4 of 4</span>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Application received.</h2>
                      <p className="mt-2 text-sm leading-6 text-[#c6dcda]">Your application has been received. Keep this Nichanue ID for reference.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-dashed border-[#bfd0d0] bg-[#f8fafb] p-5 text-center sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#718087]">Nichanue ID</p>
                  <p className="mt-2 font-mono text-3xl font-medium tracking-[.06em] text-[#174b5b]" data-testid="text-nichanue-id">{application.nichanueId}</p>
                  <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 text-xs text-[#718087]">
                    <span className="h-px flex-1 bg-[#dbe3e5]" /><span>Paid application</span><span className="h-px flex-1 bg-[#dbe3e5]" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button data-testid="button-download-ticket" onClick={handleDownloadTicket} disabled={ticketQuery.isFetching} className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-[#174b5b] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a] disabled:opacity-60">
                    {ticketQuery.isFetching ? <RefreshCw className="soft-pulse" size={17} /> : <Download size={17} />} {ticketQuery.isFetching ? 'Preparing ticket...' : 'Download your ticket'}
                  </button>
                  <button data-testid="button-start-over" onClick={() => window.location.reload()} className="focus-ring flex items-center justify-center gap-2 rounded-lg border border-[#cbd7da] bg-white px-5 py-4 text-sm font-semibold text-[#365964] transition-colors hover:bg-[#f1f7f5]">
                    <RefreshCw size={17} /> Start a new application
                  </button>
                </div>
                {ticketError ? <p className="mt-3 text-center text-xs text-[#8b4038]" data-testid="status-ticket-error">{ticketError}</p> : null}
                <div className="mt-7 flex items-start gap-3 border-t border-[#e1e8e9] pt-5 text-xs leading-5 text-[#63747a]">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#1c6b5d]" />
                  <p>Save this ticket. Use your Nichanue ID when contacting our support team.</p>
                </div>
              </Panel>
            ) : null}
          </section>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe3e5] pt-5 text-xs text-[#718087]">
          <span>© Nichanue · Kenya</span>
          <span className="flex items-center gap-1.5"><LockKeyhole size={12} /> Privacy first</span>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/not-found" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;