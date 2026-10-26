import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/authContext";
import { getSubjectFollow, setSubjectFollow } from "@/lib/api/subjects";

type Props = { slug: string; name: string };

export function SubjectFollowButton({ slug, name }: Props) {
  const { user, loading } = useAuth();
  if (loading) return <Button disabled>Loading...</Button>;
  if (!user) {
    return (
      <Button asChild className="btn-pri shrink-0">
        <Link to="/login" aria-label={`Follow ${name}`}>
          Follow
        </Link>
      </Button>
    );
  }
  return <FollowControl key={`${user.id}:${slug}`} slug={slug} name={name} />;
}

function FollowControl({ slug, name }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    getSubjectFollow(slug, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setFollowing(data.following);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [slug, attempt]);

  const toggle = async () => {
    if (following === null || saving) return;
    setSaving(true);
    try {
      const data = await setSubjectFollow(slug, !following);
      setFollowing(data.following);
      await router.invalidate();
    } catch {
      toast.error("Could not update followed subject. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="shrink-0 text-right">
        <p role="alert" className="mb-2 text-sm text-muted-foreground">
          Follow state unavailable.
        </p>
        <Button
          variant="outline"
          aria-label="Retry loading follow state"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="shrink-0"
      variant={following ? "outline" : "default"}
      disabled={following === null || saving}
      aria-label={`${following ? "Unfollow" : "Follow"} ${name}`}
      aria-pressed={following ?? false}
      aria-busy={following === null || saving}
      onClick={toggle}
    >
      {following === null
        ? "Loading..."
        : saving
          ? "Saving..."
          : following
            ? "Following"
            : "Follow"}
    </Button>
  );
}
