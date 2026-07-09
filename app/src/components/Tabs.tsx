import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type PropTypes = {
  tabs: Array<Tab>;
  defaultTab?: string;
};

export function CustomTabs({ tabs, defaultTab }: PropTypes) {
  return (
    <Tabs
      defaultValue={defaultTab ?? tabs[0]?.id}
      className="flex items-center justify-center gap-5"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
