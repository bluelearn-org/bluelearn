import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md", className)}
      {...props}
    >
      <Card className="rounded-md bg-background shadow-none">
        {/* Header */}
        <CardHeader className="space-y-4 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Registration
          </p>

          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Create your account
            </CardTitle>

            <CardDescription className="text-sm text-muted-foreground">
              Join BlueLearn to start creating, learning, and collaborating.
            </CardDescription>
          </div>
        </CardHeader>

        {/* Form */}
        <CardContent className="border-t p-6">
          <form className="space-y-6">
            <FieldGroup className="space-y-5">
              <Field className="space-y-2">
                <FieldLabel className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  Username
                </FieldLabel>

                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Choose a username"
                  className="h-10 rounded-md"
                  required
                />
              </Field>

              <Field className="space-y-2">
                <FieldLabel className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  Email
                </FieldLabel>

                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="me@example.com"
                  className="h-10 rounded-md"
                  required
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field className="space-y-2">
                  <FieldLabel className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Password
                  </FieldLabel>

                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 rounded-md"
                    required
                  />
                </Field>

                <Field className="space-y-2">
                  <FieldLabel className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Confirm Password
                  </FieldLabel>

                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 rounded-md"
                    required
                  />
                </Field>
              </div>

              <FieldDescription className="text-xs text-muted-foreground">
                Passwords must be at least <span className="font-medium text-foreground">8 characters</span> long.
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>

        {/* Footer */}
        <CardFooter className="flex flex-col gap-5 px-6">
          <Field orientation="horizontal">
            <Checkbox
              id="terms-checkbox-2"
              name="terms-checkbox-2"
              defaultChecked
            />
            <FieldContent>
              <FieldLabel htmlFor="terms-checkbox-2">
                Accept terms of service
              </FieldLabel>
              <FieldDescription className="font-mono">
                By clicking this checkbox, you agree to the terms of service and privacy policy.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Button
            type="submit"
            className="btn-pri w-full"
          >
            Create account
          </Button>

          <FieldDescription className="text-center text-sm">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-foreground transition-colors hover:underline"
            >
              Sign in
            </a>
          </FieldDescription>
        </CardFooter>
      </Card>
    </div>
  )
}