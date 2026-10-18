import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { ContentAccess } from "@bluelearn/schemas";
import type { ComponentProps } from "react";
import type { GuideReader } from "@/components/GuideReader";
import { MatureContentNotice } from "@/components/MatureContentNotice";
import { useAuth } from "@/lib/authContext";
import { getGuide } from "@/lib/api/guides";
import { getVariantBySlug } from "@/lib/api/variants";

export function useMatureContent(
  props: ComponentProps<typeof GuideReader> & { variantSlug?: string }
) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const mature = props.guide.disclaimers.includes("mature");
  const key = `${props.guide.slug}/${props.variantSlug ?? ""}/${user?.id ?? "anonymous"}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const [result, setResult] = useState<{
    key: string;
    access: ContentAccess;
    body: string | null;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mature || loading) return;
    const controller = new AbortController();
    setResult(null);
    setError(null);
    setPending(true);
    const options = { signal: controller.signal };
    const request = props.variantSlug
      ? getVariantBySlug(props.guide.slug, props.variantSlug, options)
      : getGuide(props.guide.slug, options);
    request
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          access: data.content_access ?? "sign_in_required",
          body: null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to confirm your age. Please reload to try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [key, mature, loading, props.guide.slug, props.variantSlug]);

  if (!mature) return { body: props.guide.body, contentNotice: undefined };

  const current = result?.key === key ? result : null;
  const access =
    current?.access ?? (user ? "date_of_birth_required" : "sign_in_required");
  const continueReading = async () => {
    setPending(true);
    setError(null);
    try {
      const data = props.variantSlug
        ? await getVariantBySlug(props.guide.slug, props.variantSlug, {
            mature: "confirmed",
          })
        : await getGuide(props.guide.slug, { mature: "confirmed" });
      if (activeKey.current !== key) return;
      setResult({
        key,
        access: data.content_access ?? "sign_in_required",
        body: "current" in data ? (data.current?.body ?? null) : data.body,
      });
    } catch {
      if (activeKey.current === key)
        setError("Unable to load this guide. Please try again.");
    } finally {
      if (activeKey.current === key) setPending(false);
    }
  };

  return {
    body: current?.body ?? null,
    contentNotice:
      access === "allowed" && current ? undefined : (
        <MatureContentNotice
          access={access}
          pending={pending || loading}
          error={error}
          onBack={() =>
            router.history.canGoBack()
              ? router.history.back()
              : navigate({ to: "/guides" })
          }
          onSignIn={() =>
            navigate({ to: "/login", search: { confirmAge: true } })
          }
          onSettings={() => navigate({ to: "/settings/account" })}
          onContinue={continueReading}
        />
      ),
  };
}
