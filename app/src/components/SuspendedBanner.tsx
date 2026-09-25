import { useSuspensionStatus } from "@/lib/authContext";

export function SuspendedBanner() {
  const status = useSuspensionStatus();

  if (status !== "suspended") return null;

  return (
    <div
      role="alert"
      className="border-b border-orange-800 bg-orange-700 px-8 py-3 text-sm text-white"
    >
      Warning! Your account has been suspended, you may not submit any guides,
      for more info contact info@bluelearn.org
    </div>
  );
}
