import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FieldLabel } from "@/components/ui/field";

export type FloorGuide = {
  id: string;
  slug: string | null;
  title: string | null;
};

type SubjectFloorEditorProps = {
  subjectName: string;
  // The floor as stored.
  floor: ReadonlyArray<FloorGuide>;
  // Every guide an admin may add; published bases, by id.
  guides: ReadonlyArray<FloorGuide>;
  onSave: (guideBaseIds: Array<string>) => Promise<void>;
};

const label = (guide: FloorGuide) => guide.title ?? guide.slug ?? guide.id;

const sameSet = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length &&
  [...a].sort().every((id, i) => id === [...b].sort()[i]);

// Edits one subject's prerequisite floor as a whole and saves it in one call,
// so a half-finished edit never reaches readers. Remount (key) per subject.
export function SubjectFloorEditor({
  subjectName,
  floor,
  guides,
  onSave,
}: SubjectFloorEditorProps) {
  const storedIds = floor.map((guide) => guide.id);
  const [ids, setIds] = useState<Array<string>>(storedIds);
  const [saving, setSaving] = useState(false);

  const known = new Map<string, FloorGuide>();
  for (const guide of floor) known.set(guide.id, guide);
  for (const guide of guides) known.set(guide.id, guide);

  const chosen = ids.flatMap((id) => {
    const guide = known.get(id);
    return guide ? [guide] : [];
  });
  const candidates = guides
    .filter((guide) => !ids.includes(guide.id))
    .map((guide) => ({
      value: guide.id,
      label: label(guide),
      description: guide.slug ?? undefined,
    }));
  const dirty = !sameSet(ids, storedIds);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(ids);
      toast.success(`Saved the ${subjectName} floor.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the floor."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <p className="text-xs text-muted-foreground">
        A walkthrough scoped to {subjectName} shows these guides as assumed
        knowledge and does not expand their prerequisites. Pick what every
        reader of {subjectName} is expected to know already.
      </p>

      <ul className="divide-y divide-border border-y border-border">
        {chosen.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">
            No floor yet: scoped walkthroughs climb to every prerequisite.
          </li>
        )}
        {chosen.map((guide) => (
          <li
            key={guide.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{label(guide)}</p>
              {guide.slug && (
                <p className="mono-micro text-muted-foreground">{guide.slug}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label(guide)} from the floor`}
              disabled={saving}
              onClick={() => setIds(ids.filter((id) => id !== guide.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <FieldLabel className="mono-micro text-muted-foreground">
          Add a guide
        </FieldLabel>
        <Combobox
          items={candidates}
          value=""
          onValueChange={(id) => setIds([...ids, id])}
          disabled={saving || candidates.length === 0}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className="btn-sec"
          disabled={!dirty || saving}
          onClick={() => setIds(storedIds)}
        >
          Reset
        </Button>
        <Button className="btn-pri" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving..." : "Save floor"}
        </Button>
      </div>
    </section>
  );
}
