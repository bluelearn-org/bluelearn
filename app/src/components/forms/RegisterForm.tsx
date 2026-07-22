import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { signUp } from "@/lib/auth";
import { validateRegister } from "@/lib/authValidation";
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

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateRegister({
      username,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    });
    if (errors) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    setSubmitting(true);
    const { error } = await signUp(email, password, username);

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
            Registration
          </p>

          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Create your account
            </CardTitle>

            <CardDescription className="text-sm text-muted-foreground">
              Join Bluelearn to start creating, learning, and collaborating.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          {/* Form */}
          <CardContent className="border-t p-6">
            <FieldGroup className="space-y-5">
              <Field className="space-y-2">
                <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                  Username
                </FieldLabel>

                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Choose a username"
                  className="h-10 rounded-md"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Field>

              <Field className="space-y-2">
                <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                  Email
                </FieldLabel>

                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="me@example.com"
                  className="h-10 rounded-md"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field className="space-y-2">
                  <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                    Password
                  </FieldLabel>

                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 rounded-md"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>

                <Field className="space-y-2">
                  <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                    Confirm Password
                  </FieldLabel>

                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 rounded-md"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <FieldDescription className="text-xs text-muted-foreground">
                Passwords must be at least{" "}
                <span className="font-medium text-foreground">
                  8 characters
                </span>{" "}
                long.
              </FieldDescription>
            </FieldGroup>
          </CardContent>

          {/* Footer */}
          <CardFooter className="flex flex-col gap-5 px-6">
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
              {submitting ? "Creating account..." : "Create account"}
            </Button>

            <FieldDescription className="text-center text-sm">
              Already have an account?{" "}
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
