export type DotaMapPercentPosition = {
  left: number;
  top: number;
};

export declare function mapDotaMapCoordinatesToPercent(
  x: number | null | undefined,
  y: number | null | undefined,
): DotaMapPercentPosition;
