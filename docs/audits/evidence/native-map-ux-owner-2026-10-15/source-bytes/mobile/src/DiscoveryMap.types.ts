export type DiscoveryMapProps = {
  height?: number;
  points: any[];
  selected: string;
  scopeKey: string;
  focus: number;
  motion: boolean;
  onSelect: (slug: string) => void;
};
