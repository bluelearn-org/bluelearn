import { useState } from "react";
import {
  FilePlus,
  FileSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash,
} from "lucide-react";

import type { GuideContribution } from "@/types/contributions";

import { cn } from "@/lib/utils";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectDraftModal } from "@/components/modals/SelectDraftModal";

type GuideOption = Pick<GuideContribution, "title"> & {
  localDraftId: string;
};

type Props = {
  guides: Array<GuideOption>;
  activeGuideId: string;
  hideActionBtns?: boolean;

  onSelectGuide: (localDraftId: string) => void;
  onAddGuide: () => void;
  onDeleteGuide: (localDraftId: string) => void;
};

export const EditorSidebar = ({
  guides,
  activeGuideId,
  hideActionBtns = false,
  onSelectGuide,
  onAddGuide,
  onDeleteGuide,
}: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectDraftModalOpen, setSelectDraftModalOpen] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Array<string>>([]);

  const handleSelectExistingDrafts = (draftIds: Array<string>) => {
    setSelectedDrafts(draftIds);
  };

  return (
    <aside
      className={cn(
        "sticky top-[65px] max-h-[calc(100vh-65px)] shrink-0 self-start overflow-y-auto transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex min-h-16 items-center",
          collapsed
            ? "justify-center px-2"
            : hideActionBtns
              ? "justify-end px-4"
              : "justify-between px-4"
        )}
      >
        {/* Action buttons */}
        {!collapsed && !hideActionBtns && (
          <div className="grid w-full grid-cols-2">
            <DropdownMenu modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="icon-lg"
                      className="btn-pri"
                      aria-label="Add guide draft"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>

                <TooltipContent>
                  <p>Add Draft</p>
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent
                align="start"
                className="w-48 font-mono uppercase"
              >
                <DropdownMenuItem asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectDraftModalOpen(true)}
                    className="w-full justify-start"
                    aria-label="Select existing draft"
                  >
                    <FileSearch className="h-4 w-4" />
                    Select Existing Draft
                  </Button>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onAddGuide}
                    className="w-full justify-start"
                    aria-label="Create blank draft"
                  >
                    <FilePlus className="h-4 w-4" />
                    Create Blank Draft
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-lg"
                  onClick={() => onDeleteGuide(activeGuideId)}
                  className="btn-destructive"
                  disabled={guides.length <= 1}
                  aria-label="Delete guide"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </TooltipTrigger>

              <TooltipContent>
                <p>Remove Draft</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Collapse & Expand button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setCollapsed((prev) => !prev)}
              className="btn-outline shrink-0"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4 transition-transform duration-200" />
              ) : (
                <PanelLeftClose className="h-4 w-4 transition-transform duration-200" />
              )}
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <p>{collapsed ? "Show Sidebar" : "Hide Sidebar"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      {/* Guide Drafts */}
      <ul>
        {guides.map((guide, index) => {
          const active = guide.localDraftId === activeGuideId;

          const displayTitle = guide.title.trim() || `Guide ${index + 1}`;

          return (
            <li key={guide.localDraftId}>
              <button
                type="button"
                onClick={() => onSelectGuide(guide.localDraftId)}
                className={cn(
                  "data-label flex w-full items-center py-4 text-left transition-colors",
                  collapsed ? "justify-center px-0" : "gap-4 px-2",
                  "hover:font-bold hover:text-brand-bright-blue",
                  active && "!font-bold !text-brand-bright-blue"
                )}
                title={collapsed ? displayTitle : undefined}
                aria-current={active ? "step" : undefined}
              >
                <span className="shrink-0">{index + 1}</span>

                {!collapsed && (
                  <span className="min-w-0 truncate">{displayTitle}</span>
                )}
              </button>

              <Separator />
            </li>
          );
        })}
      </ul>

      {selectDraftModalOpen && (
        <SelectDraftModal
          open={selectDraftModalOpen}
          onOpenChange={setSelectDraftModalOpen}
          selectedDrafts={selectedDrafts}
          onDraftsChange={handleSelectExistingDrafts}
        />
      )}
    </aside>
  );
};
