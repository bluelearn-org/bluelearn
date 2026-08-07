import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { getMyIdentity } from "@/lib/api/identity";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";
import { client } from "@/lib/api/apiClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getAvatarUrl, getInitials } from "@/lib/profile";
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_PATTERN,
} from "@/lib/authValidation";

export const Route = createFileRoute("/settings/profile")({
  component: RouteComponent,
  loader: async ({ abortController }) => {
    return getMyIdentity({ signal: abortController.signal });
  },
});

function RouteComponent() {
  const { profile: initialProfile } = Route.useLoaderData();
  const [profile, setProfile] = useState({
    displayName: initialProfile.display_name || "",
    username: initialProfile.username || "",
    bio: initialProfile.bio || "",
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (profile.username.length < MIN_USERNAME_LENGTH) {
      toast.error(
        `Username must be at least ${MIN_USERNAME_LENGTH} characters`
      );
      return;
    }
    if (!USERNAME_PATTERN.test(profile.username)) {
      toast.error(
        "Username may only contain letters, numbers, hyphens, and underscores"
      );
      return;
    }

    setSaving(true);

    try {
      const res = await client.me.$patch({
        json: {
          display_name: profile.displayName || null,
          username: profile.username,
          bio: profile.bio || null,
        },
      });
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("Username already taken");
        }
        throw new Error(`Save failed: ${res.status}`);
      }
      toast.success("Profile saved successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Public Profile
          </h1>
        </div>

        <Button
          variant="default"
          className="btn-pri shrink-0"
          size="lg"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </header>

      <section>
        <div className="space-y-3 py-5 first:pt-0">
          <div className="space-y-1">
            <FieldLabel className="font-mono tracking-[0.08em] uppercase">
              Profile Picture
            </FieldLabel>
          </div>

          <div className="flex items-center gap-5">
            <Avatar className="size-24 bg-secondary">
              <AvatarImage
                src={getAvatarUrl(initialProfile.id)}
                alt={profile.displayName || profile.username}
              />
              <AvatarFallback className="bg-secondary text-2xl font-bold">
                {getInitials(profile.displayName || profile.username)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col items-start gap-2">
              <Badge
                variant="default"
                className="mono-micro h-auto rounded-full border border-badge-border bg-badge py-1 tracking-[0.08em] whitespace-normal text-badge-foreground"
              >
                Custom profile photos coming soon!
              </Badge>
              <div className="cursor-not-allowed">
                <Button
                  variant="outline"
                  disabled
                  className="btn-sec"
                  size="lg"
                >
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 py-5 first:pt-0">
          <div className="space-y-1">
            <FieldLabel
              htmlFor="display-name"
              className="font-mono tracking-[0.08em] uppercase"
            >
              Display Name
            </FieldLabel>
            <p className="text-xs text-muted-foreground">
              Publicly visible. Defaults to your username when blank.
            </p>
          </div>

          <Input
            id="display-name"
            name="display-name"
            type="text"
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            className="h-10 rounded-md"
            value={profile.displayName}
            onChange={(e) => {
              setProfile({
                ...profile,
                displayName: e.target.value,
              });
            }}
          />
        </div>

        <div className="space-y-3 py-5 first:pt-0">
          <div className="space-y-1">
            <FieldLabel
              required
              htmlFor="username"
              className="font-mono tracking-[0.08em] uppercase"
            >
              Username
            </FieldLabel>
            <p className="text-xs text-muted-foreground">
              Your unique handle across Bluelearn.
            </p>
          </div>

          <Input
            id="username"
            name="username"
            type="text"
            maxLength={MAX_USERNAME_LENGTH}
            className="h-10 rounded-md"
            required
            value={profile.username}
            onChange={(e) => {
              setProfile({
                ...profile,
                username: e.target.value,
              });
            }}
          />
        </div>

        <div className="space-y-3 py-5 first:pt-0">
          <div className="space-y-1">
            <FieldLabel
              htmlFor="bio"
              className="font-mono tracking-[0.08em] uppercase"
            >
              Bio
            </FieldLabel>
            <p className="text-xs text-muted-foreground">
              Short bio, visible on your profile.
            </p>
          </div>

          <textarea
            id="bio"
            name="bio"
            maxLength={MAX_BIO_LENGTH}
            className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            rows={3}
            value={profile.bio}
            onChange={(e) => {
              setProfile({
                ...profile,
                bio: e.target.value,
              });
            }}
          />
        </div>
      </section>
    </div>
  );
}
