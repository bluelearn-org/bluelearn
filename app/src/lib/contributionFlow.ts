// type step always exists
export const typeStep = [{ id: "type", title: "Contribution Type" }] as const;

// flow definitions
export const flows = {
  guide: [
    { id: "guide-details", title: "Guide Details" },
    { id: "content", title: "Content" },
    { id: "submit", title: "Submit" },
  ],

  variant: [
    { id: "variant-details", title: "Variant Details" },
    { id: "content", title: "Content" },
    { id: "submit", title: "Submit" },
  ],

  objective: [
    { id: "objective-details", title: "Objective Details" },
    { id: "target-ordering", title: "Order Target Guides" },
    { id: "objective-ordering", title: "Order Guides" },
    { id: "submit", title: "Submit" },
  ],
} as const;
