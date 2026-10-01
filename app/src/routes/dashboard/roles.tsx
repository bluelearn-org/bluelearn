import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ChevronDown,
  ShieldMinus,
  ShieldPlus,
  SquareArrowRightExit,
} from "lucide-react";
import { toast } from "sonner";
import { userRoleSchema } from "@bluelearn/schemas";
import type { UserRole, UserStatus } from "@/lib/api/dashboard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RolesTable } from "@/components/tables/RolesTable";
import {
  addRole,
  fetchRoleTable,
  removeRole,
  toggleAFK,
} from "@/lib/api/dashboard";

// same enum as `:roleName`
// so you can't offer a role the server rejects (hopefully)
const ROLE_OPTIONS: ReadonlyArray<UserRole> = userRoleSchema.options;

export const Route = createFileRoute("/dashboard/roles")({
  loader: async ({ abortController }) => {
    const data = await fetchRoleTable({ signal: abortController.signal });
    return { data };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const roles = Route.useLoaderData();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submittingChange, setSubmittingChange] = useState(false);

  // Role for "add role"/"remove role"
  const [changeRole, setChangeRole] = useState<UserRole>("verifier");

  const handleToggleAFK = async () => {
    setSubmittingChange(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          toggleAFK(
            id,
            roles.data.find((r) => r.id === id)?.status as UserStatus
          )
        )
      );
      setSelectedIds(new Set());
      await router.invalidate();
      toast.info("Successfully toggled AFK status for user(s)!");
    } catch (err) {
      toast.error("Could not toggle AFK for one or more users.");
    } finally {
      setSubmittingChange(false);
    }
  };

  const handleAddRole = async () => {
    setSubmittingChange(true);
    try {
      await Promise.all([...selectedIds].map((id) => addRole(id, changeRole)));
      setSelectedIds(new Set());
      await router.invalidate();
      toast.info('Successfully added role "' + changeRole + '" to user(s)!');
    } catch (err) {
      toast.error(
        'Could not add role "' + changeRole + '" to one or more users.'
      );
    } finally {
      setSubmittingChange(false);
    }
  };

  const handleRemoveRole = async () => {
    setSubmittingChange(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => removeRole(id, changeRole))
      );
      setSelectedIds(new Set());
      await router.invalidate();
      toast.info(
        'Successfully removed role "' + changeRole + '" from user(s)!'
      );
    } catch (err) {
      toast.error(
        'Could not remove role "' + changeRole + '" from one or more users.'
      );
    } finally {
      setSubmittingChange(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-5 sm:gap-6">
        <div className="space-y-1.5">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Manage Roles
          </h1>
        </div>

        <div className="flex gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center justify-start capitalize"
                disabled={submittingChange}
                aria-label="Select role"
              >
                {changeRole}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-40 font-mono">
              <DropdownMenuLabel className="text-xs">Role</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={changeRole}
                onValueChange={(v) => setChangeRole(v as UserRole)}
              >
                {ROLE_OPTIONS.map((role) => (
                  <DropdownMenuRadioItem
                    key={role}
                    value={role}
                    className="text-xs capitalize"
                  >
                    {role}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || submittingChange}
            onClick={handleToggleAFK}
          >
            <SquareArrowRightExit />
            Toggle AFK
          </Button>

          <Button
            variant="default"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || submittingChange}
            onClick={handleAddRole}
          >
            <ShieldPlus />
            Add Role
          </Button>

          <Button
            variant="destructive"
            className="flex items-center justify-start"
            disabled={selectedIds.size === 0 || submittingChange}
            onClick={handleRemoveRole}
          >
            <ShieldMinus />
            Remove Role
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="overflow-x-auto">
          <RolesTable
            roleData={roles.data}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </div>
      </section>
    </div>
  );
}
