import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface WizardSettings {
  completed: boolean;
  unit: 'meters' | 'feet';
  widthM: number;
  heightM: number;
  location: {
    name: string;
    lat: number;
    lon: number;
  } | null;
  theme: 'light' | 'dark' | 'auto';
}

interface SetupWizardProps {
  isOpen: boolean;
  onComplete: (settings: WizardSettings) => void;
  onSkip: () => void;
}

export function SetupWizard({ isOpen, onComplete, onSkip }: SetupWizardProps) {
  const { signIn, signUp, user } = useAuth();
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<'meters' | 'feet'>('meters');
  const [width, setWidth] = useState('6');
  const [height, setHeight] = useState('4');
  const [location, setLocation] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  // Auth step state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const steps = [
    { title: 'Create Account', description: 'Save your garden to the cloud' },
    { title: 'Welcome', description: 'Let\'s set up your allotment garden' },
    { title: 'Units', description: 'Choose your preferred measurement' },
    { title: 'Plot Size', description: 'Define your garden dimensions' },
    { title: 'Location', description: 'Where is your garden?' },
    { title: 'Theme', description: 'Choose your preferred appearance' },
    { title: 'Ready!', description: 'Your setup is complete' },
  ];

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        await signUp(authEmail, authPassword);
        toast.success('Account created! Check your email to confirm.');
      } else {
        await signIn(authEmail, authPassword);
        toast.success('Welcome back! 🌱');
      }
      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/allotment/`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Browser redirects — loading state persists until redirect
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handleGetLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Reverse geocode to get location name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const locationName =
            data.address?.city ||
            data.address?.town ||
            data.address?.county ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

          setLocation({
            name: locationName,
            lat: latitude,
            lon: longitude,
          });
          setLocationError(null);
        } catch (error) {
          setLocation({
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lon: longitude,
          });
        }

        setLocationLoading(false);
      },
      (error) => {
        setLocationError(
          error.code === 1
            ? 'Location permission denied'
            : error.code === 2
              ? 'Location unavailable'
              : 'Location request failed'
        );
        setLocationLoading(false);
      }
    );
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    const settings: WizardSettings = {
      completed: true,
      unit,
      widthM: unit === 'meters' ? parseFloat(width) : parseFloat(width) * 0.3048,
      heightM: unit === 'meters' ? parseFloat(height) : parseFloat(height) * 0.3048,
      location,
      theme,
    };

    localStorage.setItem('allotment-setup-complete', 'true');
    localStorage.setItem('allotment-settings', JSON.stringify(settings));
    onComplete(settings);
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-2xl w-full">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-foreground">{steps[step].title}</h2>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-72 py-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-4xl mb-2">🌱</div>
                <p className="text-sm text-muted-foreground">
                  Save your garden plans across devices and never lose your work.
                </p>
              </div>

              {/* Google */}
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center gap-2"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              {/* Tab toggle */}
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/50 text-sm">
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${authMode === 'signup' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${authMode === 'signin' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Sign in
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-2">
                <Input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
                <Input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={6} />
                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {authMode === 'signup' ? 'Create Account & Continue' : 'Sign In & Continue'}
                </Button>
              </form>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className="text-2xl font-bold text-foreground">Welcome to Allotment Buddy!</h3>
              <p className="text-muted-foreground">
                Let's set up your garden planner in just a few steps. You can change these settings anytime.
              </p>
              <div className="pt-4 space-y-3 text-left">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Plan your garden layout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Track plant companions and rotation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Get weather and frost date info</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Take photos of your plants</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">Which measurement system would you like to use?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setUnit('meters')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    unit === 'meters'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">📏</div>
                  <p className="font-semibold text-foreground">Metric</p>
                  <p className="text-xs text-muted-foreground">Meters & Centimeters</p>
                </button>
                <button
                  onClick={() => setUnit('feet')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    unit === 'feet'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">📐</div>
                  <p className="font-semibold text-foreground">Imperial</p>
                  <p className="text-xs text-muted-foreground">Feet & Inches</p>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <p className="text-muted-foreground">What are the dimensions of your garden plot?</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Width ({unit === 'meters' ? 'm' : 'ft'})
                  </label>
                  <Input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="6"
                    min="1"
                    step="0.5"
                    className="text-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Height ({unit === 'meters' ? 'm' : 'ft'})
                  </label>
                  <Input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="4"
                    min="1"
                    step="0.5"
                    className="text-lg"
                  />
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  📐 Your plot size: <strong>{width} × {height} {unit === 'meters' ? 'meters' : 'feet'}</strong>
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  You can adjust this later in the garden settings.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Help us get your local weather and frost date info
              </p>
              <div className="border border-border rounded-lg p-4 space-y-3">
                {location ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">📍 {location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°
                      </p>
                    </div>
                    <button
                      onClick={() => setLocation(null)}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    {locationError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>
                    )}
                    <Button
                      onClick={handleGetLocation}
                      disabled={locationLoading}
                      className="w-full"
                    >
                      {locationLoading ? 'Getting location...' : '📍 Use My Current Location'}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      or skip this step to set it later
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">How would you like the app to look?</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">☀️</div>
                  <p className="font-semibold text-foreground text-sm">Light</p>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">🌙</div>
                  <p className="font-semibold text-foreground text-sm">Dark</p>
                </button>
                <button
                  onClick={() => setTheme('auto')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    theme === 'auto'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">🔄</div>
                  <p className="font-semibold text-foreground text-sm">Auto</p>
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-foreground">You're All Set!</h3>
              <div className="space-y-3 text-left bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">✓</span>
                  <div>
                    <p className="font-medium text-foreground text-sm">Garden Size: {width} × {height} {unit === 'meters' ? 'm' : 'ft'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">✓</span>
                  <div>
                    <p className="font-medium text-foreground text-sm">Measurement: {unit === 'meters' ? 'Metric' : 'Imperial'}</p>
                  </div>
                </div>
                {location && (
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">✓</span>
                    <div>
                      <p className="font-medium text-foreground text-sm">Location: {location.name}</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-4">
                Start by adding plants to your garden from the plant sidebar. Good luck! 🌱
              </p>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 justify-between pt-6 border-t border-border">
          {step === 0 ? (
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Skip for now
            </button>
          ) : (
            <Button variant="outline" onClick={handlePrevious} className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}

          <Button
            onClick={step === steps.length - 1 ? handleFinish : handleNext}
            className="gap-2"
          >
            {step === steps.length - 1 ? (
              <>
                <Check className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
