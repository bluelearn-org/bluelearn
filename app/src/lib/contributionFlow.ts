// type step always exists
export const typeStep = [
  { id: "type", title: "Contribution Type" },
] as const;


// flow definitions
export const flows = {
  subject: [
    { id: "subject-details", title: "Subject Details" },
    { id: "submit", title: "Submit" },
  ],

  guide: [
    { id: "guide-details", title: "Guide Details" },
    { id: "content", title: "Content" },
    { id: "submit", title: "Submit" },
  ],

  variant: [
    { id: "base-guide", title: "Select Base Guide" },
    { id: "variant-details", title: "Variant Details" },
    { id: "content", title: "Content" },
    { id: "submit", title: "Submit" },
  ],

  path: [
    { id: "path-details", title: "Path Details" },
    { id: "path-guides", title: "Select Guides" },
    { id: "path-ordering", title: "Order Guides" },
    { id: "submit", title: "Submit" },
  ],
} as const;
