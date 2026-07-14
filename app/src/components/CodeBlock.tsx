import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy code", error);
    }
  }

  return (
    <div className="relative my-6 overflow-hidden rounded-lg border bg-muted">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground uppercase">
          {language ?? "text"}
        </span>

        <Button variant="ghost" size="sm" onClick={handleCopy} type="button">
          {copied ? (
            <>
              <Check />
              Copied
            </>
          ) : (
            <>
              <Copy />
              Copy
            </>
          )}
        </Button>
      </div>

      <pre className="m-0 overflow-x-auto border-0 bg-transparent p-4">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    </div>
  );
}
