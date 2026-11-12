import { useState } from "react";
import { toast } from "sonner";
import { manageSubjectsSchema } from "@bluelearn/schemas";
import type { DashboardSubject } from "@bluelearn/schemas";
import { manageSubjects } from "@/lib/api/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Mount with a snapshot of the selection so filtering can't change a pending merge.
export function ManageSubjectsDialog({
  subjects,
  onClose,
  onSaved,
}: {
  subjects: Array<DashboardSubject>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const merging = subjects.length > 1;
  const destinations = subjects.some(({ status }) => status === "published")
    ? subjects.filter(({ status }) => status === "published")
    : subjects;
  const [targetId, setTargetId] = useState(destinations[0].id);
  const [name, setName] = useState(destinations[0].name);
  const [summary, setSummary] = useState(destinations[0].summary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = destinations.find(({ id }) => id === targetId)!;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = manageSubjectsSchema.safeParse({
      subject_ids: subjects.map(({ id }) => id),
      target_id: targetId,
      name,
      summary,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await manageSubjects(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save subjects.");
      setSaving(false);
      return;
    }
    toast.success(merging ? "Subjects merged" : "Subject updated");
    try {
      await onSaved();
    } catch {
      toast.error(
        "Subjects were saved, but the table couldn't refresh. Reload the page."
      );
    }
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!saving}
        className="max-h-[90svh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {merging ? `Merge ${subjects.length} subjects` : "Edit subject"}
          </DialogTitle>
          <DialogDescription>
            {merging
              ? "Choose the subject to keep. All guide and objective tags will move to it, including saved and past revisions. The other subjects will be removed. This can't be undone."
              : "Update the name and summary without changing the subject's URL."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            {merging && (
              <>
                <ul className="max-h-32 list-disc overflow-y-auto pl-5">
                  {subjects.map((subject) => (
                    <li key={subject.id} className="break-words">
                      {subject.name}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Label htmlFor="subject-target">Subject to keep</Label>
                  <select
                    id="subject-target"
                    className="w-full rounded-md border border-input bg-background p-2"
                    value={targetId}
                    onChange={(event) => {
                      const next = destinations.find(
                        ({ id }) => id === event.target.value
                      )!;
                      setTargetId(next.id);
                      setName(next.name);
                      setSummary(next.summary ?? "");
                    }}
                  >
                    {destinations.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">
                    {target.slug
                      ? `Keeps /subjects/${target.slug}. Removed subjects' URLs will no longer work.`
                      : "The subject stays a draft until it is published."}
                  </p>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="subject-name">Name</Label>
              <Input
                id="subject-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={3}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-summary">Summary</Label>
              <Textarea
                id="subject-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={500}
              />
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : merging
                  ? "Confirm merge"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
