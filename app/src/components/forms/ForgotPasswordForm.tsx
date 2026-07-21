import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { requestPasswordReset } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await requestPasswordReset(email);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your email for a reset link.");
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
      <Card className="rounded-md bg-background shadow-none">
        <CardHeader className="space-y-4 p-6">
          <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
            Password reset
          </p>

          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Forgot your password?
            </CardTitle>

            <CardDescription className="text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="border-t p-6">
            <Field className="space-y-2">
              <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                Email
              </FieldLabel>

              <Input
                id="email"
                type="email"
                placeholder="me@example.com"
                autoComplete="email"
                className="h-10 rounded-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
          </CardContent>

          <CardFooter className="flex flex-col gap-5 border-t p-6">
            <Button
              type="submit"
              className="btn-pri w-full"
              disabled={submitting || sent}
            >
              {submitting
                ? "Sending..."
                : sent
                  ? "Link sent"
                  : "Send reset link"}
            </Button>

            <FieldDescription className="text-center text-sm">
              Remember it?{" "}
              <Link
                to="/login"
                className="font-medium text-foreground transition-colors hover:underline"
              >
                Sign in
              </Link>
            </FieldDescription>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
