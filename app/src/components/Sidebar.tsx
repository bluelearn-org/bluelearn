export const Sidebar = ({ children }: { children: React.ReactNode }) => {
  return (
    <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">
      {children}
    </aside>
  );
};
