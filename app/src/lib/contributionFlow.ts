// type step always exists
export const typeStep = [{ id: "type", title: "Contribution Type" }] as const;

// flow definitions
export const flows = {
  guide: [
    { id: "guide-details", title: "Guide Details" },
    { id: "content", title: "Content" },
    { id: "preview-guide", title: "Preview" },
  ],

  variant: [
    { id: "variant-details", title: "Variant Details" },
    { id: "content", title: "Content" },
    { id: "preview-guide", title: "Preview" },
  ],

  objective: [
    { id: "objective-details", title: "Objective Details" },
    { id: "target-ordering", title: "Order Target Guides" },
    { id: "objective-ordering", title: "Order Guides" },
    { id: "preview-objective", title: "Preview" },
  ],
} as const;
