import { useState } from "react";
import { Combobox } from "@/components/ui/combobox";

type PropTypes = {
  id: string;
  items: Array<string>;
};

export function ComboboxMulti({ items }: PropTypes) {
  const [value, setValue] = useState<Array<string>>([]);

  return (
    <Combobox multiple items={items} value={value} onValueChange={setValue} />
  );
}
