import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export const NotFound = () => {
  return (
    <main className="container mx-auto p-4 pt-16">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="data-label">404 - Not Found</EmptyTitle>
          <EmptyDescription className="data-value">
            The page you&apos;re looking for doesn&apos;t exist.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
};
