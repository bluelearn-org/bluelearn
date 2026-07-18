import { CardFooter } from "@/components/ui/card";
import { FooterStats } from "@/components/cards/FooterStats";

type Data = {
  stats?: Array<{ label: string; data: string | number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  data: Data;
};

export const Footer = ({ data }: PropTypes) => {
  return (
    <CardFooter className="grid grid-cols-2 border-t p-0 sm:grid-cols-4 [&>*:last-child]:border-r-0">
      {data.stats?.map((g: { label: string; data: string | number }) => {
        return <FooterStats key={g.label} label={g.label} data={g.data} />;
      })}
      {data.actionBtns}
    </CardFooter>
  );
};
