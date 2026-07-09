import { CardFooter } from "@/components/ui/card";
import { FooterStats } from "@/components/cards/FooterStats";

type Data = {
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  data: Data;
};

export const Footer = ({ data }: PropTypes) => {
  return (
    <CardFooter className="grid grid-cols-2 border-t p-0 lg:grid-cols-4">
      {data.stats?.map((g: { label: string; data: number }) => {
        return <FooterStats label={g.label} data={g.data} />;
      })}
      {data.actionBtns}
    </CardFooter>
  );
};
