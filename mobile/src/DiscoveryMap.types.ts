export type DiscoveryMapProps = {
  points: any[];
  selected: string;
  scopeKey: string;
  focus: number;
  motion: boolean;
  onSelect: (slug: string) => void;
};
