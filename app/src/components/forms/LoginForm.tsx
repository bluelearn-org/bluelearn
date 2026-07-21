import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("You must accept the terms of service");
      return;
    }
    setSubmitting(true);

    const { error } = await signIn(email, password);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
      <Card className="rounded-md bg-background shadow-none">
        {/* Header */}
        <CardHeader className="space-y-4 p-6">
          <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
            Authentication
          </p>

          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Welcome back
            </CardTitle>

            <CardDescription className="text-sm text-muted-foreground">
              Sign in to start sharing knowledge.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          {/* Form */}
          <CardContent className="border-t p-6">
            <FieldGroup className="space-y-5">
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

              <Field className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                    Password
                  </FieldLabel>

                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="h-10 rounded-md"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>

          {/* Footer */}
          <CardFooter className="flex flex-col gap-5 border-t p-6">
            <Field orientation="horizontal">
              <Checkbox
                id="terms-checkbox-2"
                name="terms-checkbox-2"
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="terms-checkbox-2">
                  Accept terms of service
                </FieldLabel>
                <FieldDescription className="font-mono">
                  By clicking this checkbox, you agree to the terms of service
                  and privacy policy.
                </FieldDescription>
              </FieldContent>
            </Field>

            <Button
              type="submit"
              className="btn-pri w-full"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            <FieldDescription className="text-center text-sm">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-foreground transition-colors hover:underline"
              >
                Create one
              </Link>
            </FieldDescription>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
