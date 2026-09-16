export function buildPageMeta(title: string, description: string) {
  const pageTitle = `${title} | Bluelearn`;

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
  ];
}
