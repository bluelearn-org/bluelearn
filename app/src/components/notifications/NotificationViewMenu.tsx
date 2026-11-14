import { ChevronDown } from "lucide-react";

import type { NotificationListView } from "@/lib/useNotificationList";
import { CATEGORY_VIEWS, FILTER_VIEWS } from "@/lib/useNotificationList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationViewMenuProps = {
  view: NotificationListView;
  onViewChange: (view: NotificationListView) => void;
};

export function NotificationViewMenu({
  view,
  onViewChange,
}: NotificationViewMenuProps) {
  const viewItem = (option: NotificationListView) => (
    <DropdownMenuItem
      key={option.label}
      className="text-xs"
      onSelect={() => onViewChange(option)}
    >
      {option.label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 font-mono text-xs font-bold tracking-[0.08em] uppercase"
        >
          {view.label}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 font-mono">
        {FILTER_VIEWS.map(viewItem)}
        <DropdownMenuSeparator />
        {CATEGORY_VIEWS.map(viewItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
