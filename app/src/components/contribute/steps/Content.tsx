import { Suspense, lazy, useEffect, useState } from "react";

const Editor = lazy(() => import("../editor/Editor"));

type PropTypes = {
  body: string;
  onBodyChange: (body: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

export const Content = ({ body, onBodyChange, onUploadImage }: PropTypes) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted) {
    return (
      <Suspense fallback={<EditorFallback />}>
        <Editor
          value={body}
          onChange={onBodyChange}
          onUploadImage={onUploadImage}
        />
      </Suspense>
    );
  } else {
    return <EditorFallback />;
  }
};

const EditorFallback = () => {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Loading Editor...
    </div>
  );
};
