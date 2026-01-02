export interface Topic {
  id: string;
  query: string;
  label: string;
}

export const TOPICS: Topic[] = [
  {
    id: "manchester-united",
    query: "Manchester United",
    label: "Football"
  },
  {
    id: "software",
    query: "software development programming",
    label: "Software"
  },
  {
    id: "startups",
    query: "startups venture capital",
    label: "Startups"
  },
  {
    id: "russia",
    query: "Russia politics",
    label: "Russian Politics"
  },
];
