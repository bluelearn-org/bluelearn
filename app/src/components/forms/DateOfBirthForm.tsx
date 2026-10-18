import { useState } from "react";
import { dateOfBirthSchema } from "@bluelearn/schemas";
import { toast } from "sonner";
import { updateMyDateOfBirth } from "@/lib/api/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";

export function DateOfBirthForm({
  initialValue,
  onComplete,
}: {
  initialValue: string | null;
  onComplete?: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (value && !dateOfBirthSchema.safeParse(value).success) {
      setError("Enter a valid date of birth that is not in the future.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyDateOfBirth(value || null);
      setSaved(value);
      toast.success("Date of birth saved.");
      onComplete?.();
    } catch {
      setError("Unable to save your date of birth. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="space-y-3 border-t border-border py-3" onSubmit={submit}>
      <div className="space-y-1">
        <FieldLabel
          htmlFor="date-of-birth"
          className="font-mono tracking-[0.08em] uppercase"
        >
          Date of birth{" "}
          {onComplete && (
            <span className="text-muted-foreground">(optional)</span>
          )}
        </FieldLabel>
        <p
          id="date-of-birth-description"
          className="text-xs text-muted-foreground"
        >
          Used to confirm your age for mature content. Only visible to you.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="date-of-birth"
          name="date-of-birth"
          type="date"
          autoComplete="bday"
          aria-describedby={
            error
              ? "date-of-birth-description date-of-birth-error"
              : "date-of-birth-description"
          }
          aria-invalid={Boolean(error)}
          max={new Date().toISOString().slice(0, 10)}
          className="h-10 min-w-0 flex-1 rounded-md dark:[color-scheme:dark]"
          value={value}
          disabled={saving}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <Button
          type="submit"
          className="btn-pri h-10"
          disabled={saving || (!onComplete && value === saved)}
        >
          {saving ? "Saving..." : onComplete ? "Continue" : "Save"}
        </Button>
        {onComplete && (
          <Button
            type="button"
            variant="outline"
            className="btn-sec h-10"
            onClick={onComplete}
            disabled={saving}
          >
            Skip for now
          </Button>
        )}
      </div>
      {error && (
        <p
          id="date-of-birth-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  );
}
