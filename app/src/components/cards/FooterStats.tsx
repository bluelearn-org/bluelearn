type StatProps = {
  label: string;
  data: number;
};

export const FooterStats = ({ label, data }: StatProps) => {
  if (data) {
    return (
      <div className="border-r px-4 pb-4 sm:pb-0">
        <p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold">{data}</p>
      </div>
    );
  } else {
    return null;
  }
};
