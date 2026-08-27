import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { DownvoteReason } from "@/lib/api/votes";
import { castVote, getMyVote, retractVote } from "@/lib/api/votes";
import { getVariant } from "@/lib/api/variants";
import { useAuth } from "@/lib/authContext";

type MyVote = Awaited<ReturnType<typeof getMyVote>>;

type Tally = { up: number; down: number };

export function useVote(
  variantId: string | null,
  initialTally: Tally = { up: 0, down: 0 }
) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [vote, setVote] = useState<MyVote>(null);
  const [tally, setTally] = useState<Tally>(initialTally);
  const [submitting, setSubmitting] = useState(false);

  const loadTally = useCallback((id: string, signal?: AbortSignal) => {
    return getVariant(id, { signal })
      .then((variant) => setTally(variant.votes))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!variantId) return;

    const controller = new AbortController();
    loadTally(variantId, controller.signal);

    return () => controller.abort();
  }, [variantId, loadTally]);

  useEffect(() => {
    if (!variantId || !userId) {
      setVote(null);
      return;
    }

    const controller = new AbortController();
    getMyVote(variantId, { signal: controller.signal })
      .then(setVote)
      .catch(() => {
        if (!controller.signal.aborted) setVote(null);
      });

    return () => controller.abort();
  }, [variantId, userId]);

  // Every mutation reseeds from the server response, so a rejected vote never
  // leaves the buttons showing something that was not stored.
  const mutate = async (
    run: (id: string) => Promise<MyVote>,
    failure: string,
    onSuccess?: () => void
  ) => {
    if (!variantId) return false;
    if (!userId) {
      toast.error("Sign in to vote on guides.");
      return false;
    }

    setSubmitting(true);
    try {
      const submission = await run(variantId);
      setVote(submission);
      onSuccess?.();

      await loadTally(variantId);
      return true;
    } catch {
      toast.error(failure);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const upvote = () =>
    mutate(async (id) => {
      if (vote?.direction === "up") {
        await retractVote(id);
        return null;
      }
      return castVote(id, { direction: "up" });
    }, "Could not save your vote.");

  const downvote = (
    reason: DownvoteReason,
    note: string,
    onSuccess?: () => void
  ) =>
    mutate(
      (id) => castVote(id, { direction: "down", reason, note: note || null }),
      "Could not save your downvote.",
      onSuccess
    );

  const removeVote = (onSuccess: () => void) =>
    mutate(
      async (id) => {
        await retractVote(id);
        return null;
      },
      "Could not remove your vote.",
      onSuccess
    );

  return { vote, tally, submitting, upvote, downvote, removeVote };
}
