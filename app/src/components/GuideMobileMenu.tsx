import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ellipsis, ListChecks } from "lucide-react";
import type { GuideReference } from "@bluelearn/schemas";

import type { GuideModalType } from "@/components/GuideActionModals";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GuideActionModals,
  guideActions,
} from "@/components/GuideActionModals";
import { PrerequisitesModal } from "@/components/modals/PrerequisitesModal";

type GuideMobileMenuProps = {
  slug: string;
  currentVariantSlug: string | null;
  variantId: string | null;
  guideTitle: string;
  menuItems: Array<{ label: string; to: string; icon: React.ReactNode }>;
  prerequisites?: Array<GuideReference>;
  isOfficial?: boolean;
};

export function GuideMobileMenu({
  slug,
  currentVariantSlug,
  variantId,
  guideTitle,
  menuItems,
  prerequisites,
  isOfficial = false,
}: GuideMobileMenuProps) {
  const [activeModal, setActiveModal] = useState<
    GuideModalType | "prerequisites" | null
  >(null);
  const close = (open: boolean) => !open && setActiveModal(null);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 cursor-pointer rounded-md md:hidden"
            aria-label="Guide options"
          >
            <Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52 font-mono">
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.to} asChild>
              <Link to={item.to} className="cursor-pointer text-xs">
                {item.icon}
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {guideActions(isOfficial).map((action) => (
            <DropdownMenuItem
              key={action.type}
              className="cursor-pointer text-xs"
              onSelect={() => setActiveModal(action.type)}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          ))}

          {prerequisites && (
            <DropdownMenuItem
              className="cursor-pointer text-xs"
              onSelect={() => setActiveModal("prerequisites")}
            >
              <ListChecks className="h-4 w-4" />
              Prerequisites
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <GuideActionModals
        active={activeModal === "prerequisites" ? null : activeModal}
        onOpenChange={close}
        slug={slug}
        currentVariantSlug={currentVariantSlug}
        variantId={variantId}
        isOfficial={isOfficial}
      />

      {prerequisites && (
        <PrerequisitesModal
          open={activeModal === "prerequisites"}
          onOpenChange={close}
          prerequisites={prerequisites}
          guideTitle={guideTitle}
          slug={slug}
        />
      )}
    </>
  );
}
