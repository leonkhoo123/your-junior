import { useState, useEffect, useRef, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupAdmin, getSetupStatus, checkAuthStatus } from '@/api/api-auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, User, Lock, Loader2, Sun, Moon, Shield, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useTheme } from '@/components/theme-provider';

const SetupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [serverName, setServerName] = useState('Your Junior');
  const [isSystemDark, setIsSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => { setIsSystemDark(e.matches); };
    mq.addEventListener("change", handler);
    return () => { mq.removeEventListener("change", handler); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSetupStatus()
      .then(async (res) => {
        if (res.setup_required) {
          if (!cancelled) setIsChecking(false);
          return;
        }
        try {
          await checkAuthStatus();
          if (!cancelled) void navigate('/home', { replace: true });
        } catch {
          if (!cancelled) void navigate('/login', { replace: true });
        }
      })
      .catch(() => { if (!cancelled) setIsChecking(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { status?: string; data?: { service_name?: string } }) => {
        if (data.data?.service_name) setServerName(data.data.service_name);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => { void navigate('/login', { replace: true }); }, 2000);
      return () => { clearTimeout(timer); };
    }
  }, [success, navigate]);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (username.length < 6 || username.length > 32) {
      toast.error("Username must be 6-32 characters");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await setupAdmin(username, password);
      setSuccess(true);
      toast.success("Admin account created! Redirecting to login...");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && passwordRef.current) {
      e.preventDefault();
      passwordRef.current.focus();
    }
  };

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Account Created</h2>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-primary/5 via-background to-primary/10 lg:from-background lg:via-background lg:to-primary/5">
      {/* Left Panel — Branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 text-center px-12 max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-8">
            <Logo className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            {serverName}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Welcome! Create your admin account to get started.
          </p>
          <div className="mt-12 flex gap-6 justify-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Secure Setup</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 relative">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (theme === "system") {
                setTheme(isSystemDark ? "light" : "dark");
              } else {
                setTheme(theme === "dark" ? "light" : "dark");
              }
            }}
            title="Toggle theme"
          >
            {(theme === "dark" || (theme === "system" && isSystemDark)) ? (
              <Moon className="h-[1.2rem] w-[1.2rem]" />
            ) : (
              <Sun className="h-[1.2rem] w-[1.2rem]" />
            )}
          </Button>
        </div>

        {/* Mobile branding */}
        <div className="lg:hidden relative w-full max-w-[360px] text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-5">
            <Logo className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            {serverName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your admin account to get started.
          </p>
        </div>

        <div className="w-full max-w-[360px] space-y-2 text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            First-Time Setup
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Create your admin account
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-[360px] space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="setup-username" className="text-sm font-medium text-foreground">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); }}
                onKeyDown={handleUsernameKeyDown}
                placeholder="Choose a username"
                className="pl-10 h-11 bg-background border-2 rounded-xl transition-all duration-150 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="setup-password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="setup-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); }}
                placeholder="At least 8 characters"
                className="pl-10 pr-10 h-11 bg-background border-2 rounded-xl transition-all duration-150 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                autoComplete="new-password"
                ref={passwordRef}
                required
              />
              <button
                type="button"
                onClick={() => { setShowPassword(!showPassword); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="setup-confirm-password" className="text-sm font-medium text-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="setup-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); }}
                placeholder="Re-enter your password"
                className="pl-10 h-11 bg-background border-2 rounded-xl transition-all duration-150 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Admin Account
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SetupPage;
