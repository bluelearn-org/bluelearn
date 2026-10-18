import { ArrowLeft, LogIn } from "lucide-react";
import type { ContentAccess } from "@bluelearn/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const matureContentColor = "text-[#ad4600] dark:text-[#e87524]";
const warningFont = { fontFamily: '"Geist Mono Variable", monospace' };

export function MatureContentIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-current font-sans text-base font-semibold tracking-tighter",
        className
      )}
    >
      18+
    </span>
  );
}

export function MatureContentNotice({
  access,
  onBack,
  onSignIn,
  onSettings,
  onContinue,
  pending = false,
  error,
}: {
  access: ContentAccess;
  onBack: () => void;
  onSignIn: () => void;
  onSettings: () => void;
  onContinue: () => void;
  pending?: boolean;
  error?: string | null;
}) {
  const needsBirthDate = access === "date_of_birth_required";
  const signedOut = access === "sign_in_required";
  const canContinue = access === "confirmation_required";
  return (
    <section
      aria-label="Mature content"
      className="flex min-h-[304px] flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div
        className={cn("flex flex-col items-center gap-1", matureContentColor)}
      >
        <MatureContentIcon />
        <h2
          style={warningFont}
          className="font-mono text-lg leading-6 font-bold uppercase"
        >
          Mature content
        </h2>
      </div>
      {(signedOut || needsBirthDate) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {signedOut
            ? "Sign in to confirm your age"
            : "Enter your date of birth to confirm your age"}
        </p>
      )}
      <div
        className={cn(
          "flex items-center justify-center gap-3",
          canContinue ? "mt-10" : "mt-4"
        )}
      >
        <Button
          variant="outline"
          className="h-7 gap-2 bg-muted px-3 font-mono text-[10px] font-bold uppercase"
          onClick={onBack}
          style={warningFont}
        >
          <ArrowLeft />
          Go back
        </Button>
        {(signedOut || needsBirthDate || canContinue) && (
          <Button
            className="h-7 gap-2 bg-foreground px-3 font-mono text-[10px] font-bold text-background uppercase hover:bg-foreground/90"
            disabled={pending}
            style={warningFont}
            onClick={
              signedOut ? onSignIn : needsBirthDate ? onSettings : onContinue
            }
          >
            {signedOut && <LogIn />}
            {signedOut
              ? "Sign in"
              : needsBirthDate
                ? "Account settings"
                : pending
                  ? "Loading..."
                  : "Continue"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
