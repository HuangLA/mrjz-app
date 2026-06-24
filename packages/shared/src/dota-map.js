const DOTA_MINIMAP_COORDINATE_MIN = 64;
const DOTA_MINIMAP_COORDINATE_MAX = 192;
const DOTA_MINIMAP_COORDINATE_SPAN = DOTA_MINIMAP_COORDINATE_MAX - DOTA_MINIMAP_COORDINATE_MIN;
const DOTA_MINIMAP_COORDINATE_CENTER = (DOTA_MINIMAP_COORDINATE_MIN + DOTA_MINIMAP_COORDINATE_MAX) / 2;

export function mapDotaMapCoordinatesToPercent(x, y) {
  const normalizedX = normalizeDotaMapCoordinate(x);
  const normalizedY = normalizeDotaMapCoordinate(y);

  return {
    left: clamp(((normalizedX - DOTA_MINIMAP_COORDINATE_MIN) / DOTA_MINIMAP_COORDINATE_SPAN) * 100, 0, 100),
    top: clamp(100 - ((normalizedY - DOTA_MINIMAP_COORDINATE_MIN) / DOTA_MINIMAP_COORDINATE_SPAN) * 100, 0, 100),
  };
}

function normalizeDotaMapCoordinate(value) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : DOTA_MINIMAP_COORDINATE_CENTER;

  return clamp(numericValue, DOTA_MINIMAP_COORDINATE_MIN, DOTA_MINIMAP_COORDINATE_MAX);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
