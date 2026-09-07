import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Eye, EyeOff } from "lucide-react";
import { signIn, signOut, updateEmail, updatePassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/authValidation";
import { deleteMyAccount, getMyIdentity } from "@/lib/api/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  loader: async ({ abortController }) => {
    return getMyIdentity({ signal: abortController.signal });
  },
});

function RouteComponent() {
  const { email: initialEmail, profile } = Route.useLoaderData();
  const currentEmail = initialEmail || "";
  const username = profile.username;

  const [email, setEmail] = useState<string>(currentEmail);

  const [password, setPassword] = useState({
    old: "",
    new: "",
    confirmNew: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [isPasswordEditing, setIsPasswordEditing] = useState(false);

  const navigate = useNavigate();

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== username) return;

    setIsDeleting(true);
    try {
      await deleteMyAccount();
      await signOut();
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setIsDeleting(false);
    }
  };

  const trimmedEmail = email.trim();
  const emailChanged = trimmedEmail !== currentEmail;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSaveEmail = emailChanged && emailValid && !saving;

  const canUpdatePassword =
    password.old.length > 0 &&
    password.new.length > 0 &&
    password.confirmNew.length > 0 &&
    !updating;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveEmail) return;

    setSaving(true);

    const { error } = await updateEmail(trimmedEmail);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification emails sent. Please check your inbox.");
    }

    setSaving(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdatePassword) return;

    setUpdating(true);

    if (password.new.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
      setUpdating(false);
      return;
    }

    if (password.new !== password.confirmNew) {
      toast.error("New passwords do not match.");
      setUpdating(false);
      return;
    }

    if (!currentEmail) {
      toast.error("No user email found.");
      setUpdating(false);
      return;
    }

    // Verify old password by attempting to sign in
    const { error: signInError } = await signIn(currentEmail, password.old);

    if (signInError) {
      toast.error("Incorrect old password.");
      setUpdating(false);
      return;
    }

    // Update to new password
    const { error: updateAuthError } = await updatePassword(password.new);

    if (updateAuthError) {
      toast.error(updateAuthError.message);
    } else {
      toast.success("Password updated.");
      setIsPasswordEditing(false);
      setPassword({ old: "", new: "", confirmNew: "" });
    }

    setUpdating(false);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header className="space-y-1.5 border-b border-border pb-5">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Account
        </h1>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
          Authentication
        </h2>

        <div className="border-t border-border">
          <form className="space-y-3 py-3" onSubmit={handleSave}>
            <div className="space-y-1">
              <FieldLabel
                htmlFor="email"
                className="font-mono tracking-[0.08em] uppercase"
              >
                Email
              </FieldLabel>
              <p className="text-xs text-muted-foreground">
                Used to sign in. Changing it sends a confirmation link to both
                the old and new address.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-10 rounded-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="btn-pri h-10"
                disabled={!canSaveEmail}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>

          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                Password
              </FieldLabel>
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            {!isPasswordEditing ? (
              <Button
                variant="outline"
                size="lg"
                className="btn-sec"
                onClick={() => setIsPasswordEditing(true)}
              >
                Change password
              </Button>
            ) : (
              <form className="space-y-4" onSubmit={handleUpdate}>
                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="old-password"
                    className="font-mono text-xs tracking-[0.08em] uppercase"
                  >
                    Old Password
                  </FieldLabel>
                  <div className="relative w-full">
                    <Input
                      autoFocus
                      id="old-password"
                      name="current-password"
                      type={showOldPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="h-10 rounded-md pr-10"
                      value={password.old}
                      onChange={(e) => {
                        setPassword({
                          ...password,
                          old: e.target.value,
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      aria-label={
                        showOldPassword
                          ? "Hide old password"
                          : "Show old password"
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showOldPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="new-password"
                    className="font-mono text-xs tracking-[0.08em] uppercase"
                  >
                    New Password
                  </FieldLabel>
                  <div className="relative w-full">
                    <Input
                      id="new-password"
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="h-10 rounded-md pr-10"
                      value={password.new}
                      onChange={(e) => {
                        setPassword({
                          ...password,
                          new: e.target.value,
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={
                        showNewPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="confirm-password"
                    className="font-mono text-xs tracking-[0.08em] uppercase"
                  >
                    Confirm New Password
                  </FieldLabel>
                  <div className="relative w-full">
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type={showConfirmNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="h-10 rounded-md pr-10"
                      value={password.confirmNew}
                      onChange={(e) => {
                        setPassword({
                          ...password,
                          confirmNew: e.target.value,
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      aria-label={
                        showConfirmNewPassword
                          ? "Hide confirm new password"
                          : "Show confirm new password"
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="btn-sec"
                    onClick={() => {
                      setIsPasswordEditing(false);
                      setPassword({ old: "", new: "", confirmNew: "" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="btn-pri"
                    disabled={!canUpdatePassword}
                  >
                    {updating ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
          Delete account
        </h2>

        <div className="space-y-4 border-t py-5">
          <p className="text-xs text-muted-foreground">
            Deleting your account is permanent and cannot be undone.
            Contributions you authored stay published but are no longer
            attributed to you.
          </p>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="lg" className="btn-danger">
                Delete account
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0 sm:max-w-md">
              <DialogHeader className="gap-2 p-5 pb-0">
                <span className="mono-micro text-destructive">
                  Permanent action
                </span>
                <DialogTitle className="editorial-heading text-lg">
                  Delete account
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Deleting your account signs you out and closes it for good.
                  Contributions you authored stay published without your name.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 p-5">
                <FieldLabel
                  htmlFor="delete-confirm"
                  className="mono-micro text-muted-foreground"
                >
                  Type{" "}
                  <span className="text-foreground normal-case">
                    "{username}"
                  </span>{" "}
                  to confirm
                </FieldLabel>
                <Input
                  id="delete-confirm"
                  className="h-10 rounded-md font-mono placeholder:text-muted-foreground/50"
                  autoComplete="off"
                  aria-invalid={
                    deleteConfirmText.length > 0 &&
                    deleteConfirmText !== username
                  }
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={username}
                />
              </div>

              <DialogFooter className="p-5 pt-0">
                <DialogClose asChild>
                  <Button variant="outline" size="lg" className="btn-sec">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  size="lg"
                  className="btn-danger"
                  disabled={deleteConfirmText !== username || isDeleting}
                  onClick={handleDeleteAccount}
                >
                  {isDeleting ? "Deleting..." : "Delete account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
}
