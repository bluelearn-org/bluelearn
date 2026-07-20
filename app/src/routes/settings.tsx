import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { client } from "@/lib/api/apiClient";

export const Route = createFileRoute("/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const [activeSection, setActiveSection] = useState("account");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState("system");

  const [displayName, setDisplayName] = useState("Johnny Doeser");
  const [username, setUsername] = useState("John_Doe99");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await client.me.$patch({
        json: {
          username,
          display_name: displayName || null,
          bio: bio || null,
        },
      });
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <div className="flex min-h-[calc(100svh_-_64px)]">
        {/* Left Sidebar Navigation */}
        <div className="w-64 shrink-0 space-y-3 border-r border-border p-6">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setActiveSection("account");
              setAppearanceOpen(false);
            }}
            className={cn(
              "h-auto w-full justify-start rounded-md p-4 font-mono tracking-[0.08em] uppercase",
              activeSection === "account" && "bg-muted text-foreground"
            )}
          >
            Account
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setActiveSection("advanced");
              setAppearanceOpen(false);
            }}
            className={cn(
              "h-auto w-full justify-start rounded-md p-4 font-mono tracking-[0.08em] uppercase",
              activeSection === "advanced" && "bg-muted text-foreground"
            )}
          >
            Advanced
          </Button>

          {/* Appearance Button with Dropdown */}
          <div className="rounded-md border border-border">
            <button
              onClick={() => setAppearanceOpen(!appearanceOpen)}
              className={cn(
                "mono-micro flex w-full items-center justify-between p-4 tracking-[0.08em] uppercase"
              )}
            >
              <span>Appearance</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  appearanceOpen && "rotate-180"
                )}
              />
            </button>

            {appearanceOpen && (
              <div className="space-y-2 border-t border-border bg-muted p-4">
                <button
                  onClick={() => setAppearance("light")}
                  className={cn(
                    "block font-mono tracking-[0.08em] uppercase",
                    appearance === "light"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  Light
                </button>
                <button
                  onClick={() => setAppearance("dark")}
                  className={cn(
                    "block font-mono tracking-[0.08em] uppercase",
                    appearance === "dark"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  Dark
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 px-8 py-8 lg:px-16">
          {/* Account Section */}
          {activeSection === "account" && (
            <div className="mb-6">
              <div>
                <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
                  Account
                </h1>
                <p className="font-mono text-sm text-muted-foreground">
                  Make changes to your account details
                </p>
              </div>

              <Separator className="mb-8 bg-border" />

              <div className="space-y-6">
                <Field>
                  <FieldLabel className="w-fit border-b border-foreground pb-0.5 font-mono tracking-[0.08em] uppercase">
                    Display Name
                  </FieldLabel>
                  <p className="mb-1 font-sans text-xs text-muted-foreground">
                    Publicly visible (if blank, defaults to username)
                  </p>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="border border-border"
                  />
                </Field>

                <Field>
                  <FieldLabel className="w-fit border-b border-foreground pb-0.5 font-mono tracking-[0.08em] uppercase">
                    Username
                  </FieldLabel>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border border-border"
                  />
                </Field>

                <Field>
                  <FieldLabel className="w-fit border-b border-foreground pb-0.5 font-mono tracking-[0.08em] uppercase">
                    Bio
                  </FieldLabel>
                  <Input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="border border-border"
                  />
                </Field>

                {saveError && (
                  <p className="font-mono text-sm text-destructive">
                    {saveError}
                  </p>
                )}

                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Advanced Section */}
          {activeSection === "advanced" && (
            <div className="mb-6">
              <div>
                <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
                  Advanced
                </h1>
              </div>

              <Separator className="mb-8 bg-border" />

              <div className="space-y-2">
                <div>
                  <a href="#" className="font-mono tracking-[0.08em] uppercase">
                    Terms of Service
                  </a>
                </div>

                <div>
                  <a href="#" className="font-mono tracking-[0.08em] uppercase">
                    Privacy Policy
                  </a>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="destructive"
                    className="font-mono tracking-[0.08em] uppercase"
                  >
                    Delete Account
                  </Button>
                  <p className="mt-3 font-mono text-sm tracking-[0.08em] text-destructive uppercase">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
