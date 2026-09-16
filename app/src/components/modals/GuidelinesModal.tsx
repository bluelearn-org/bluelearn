import ReactMarkdown from "react-markdown";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import guidelines from "@/data/guidelines.md?raw";

type PropsTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const GuidelinesModal = ({ open, onOpenChange }: PropsTypes) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="mono-micro">Contribution Standards</span>
          </div>

          <DialogTitle className="editorial-heading text-2xl">
            Quick Guidelines
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            The quick version of the guidelines for creating guides.
          </DialogDescription>
        </DialogHeader>

        <article className="markdown min-h-0 flex-1 scrollbar-thin [scrollbar-color:var(--border)_transparent] overflow-y-auto px-6 pt-2 pb-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <ReactMarkdown>{guidelines}</ReactMarkdown>
        </article>
      </DialogContent>
    </Dialog>
  );
};
