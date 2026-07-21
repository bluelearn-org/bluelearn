type StatProps = {
  label: string;
  data: string | number;
};

export const FooterStats = ({ label, data }: StatProps) => {
  if (data) {
    return (
      <div className="border-r px-4 pb-4 sm:pb-0">
        <p className="data-label">{label}</p>
        <p className="data-value">{data}</p>
      </div>
    );
  } else {
    return null;
  }
};
