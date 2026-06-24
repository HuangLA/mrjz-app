const OPENDOTA_COORDINATE_SCALE = 128;

// OpenDota ward logs store Dota world coordinates divided by 128.
// The current 400x400 minimap image is fully valid map content, so these calibrated
// bounds are stretched directly to the full image area.
const DOTA_WORLD_BOUNDS = {
  minX: 6698,
  maxX: 25843,
  minY: 6774,
  maxY: 25881,
};

const DOTA_MINIMAP_COORDINATE_MIN_X = DOTA_WORLD_BOUNDS.minX / OPENDOTA_COORDINATE_SCALE;
const DOTA_MINIMAP_COORDINATE_MAX_X = DOTA_WORLD_BOUNDS.maxX / OPENDOTA_COORDINATE_SCALE;
const DOTA_MINIMAP_COORDINATE_MIN_Y = DOTA_WORLD_BOUNDS.minY / OPENDOTA_COORDINATE_SCALE;
const DOTA_MINIMAP_COORDINATE_MAX_Y = DOTA_WORLD_BOUNDS.maxY / OPENDOTA_COORDINATE_SCALE;
const DOTA_MINIMAP_COORDINATE_SPAN_X = DOTA_MINIMAP_COORDINATE_MAX_X - DOTA_MINIMAP_COORDINATE_MIN_X;
const DOTA_MINIMAP_COORDINATE_SPAN_Y = DOTA_MINIMAP_COORDINATE_MAX_Y - DOTA_MINIMAP_COORDINATE_MIN_Y;
const DOTA_MINIMAP_COORDINATE_CENTER_X = (DOTA_MINIMAP_COORDINATE_MIN_X + DOTA_MINIMAP_COORDINATE_MAX_X) / 2;
const DOTA_MINIMAP_COORDINATE_CENTER_Y = (DOTA_MINIMAP_COORDINATE_MIN_Y + DOTA_MINIMAP_COORDINATE_MAX_Y) / 2;

export function mapDotaMapCoordinatesToPercent(x, y) {
  const normalizedX = normalizeDotaMapCoordinate(
    x,
    DOTA_MINIMAP_COORDINATE_MIN_X,
    DOTA_MINIMAP_COORDINATE_MAX_X,
    DOTA_MINIMAP_COORDINATE_CENTER_X,
  );
  const normalizedY = normalizeDotaMapCoordinate(
    y,
    DOTA_MINIMAP_COORDINATE_MIN_Y,
    DOTA_MINIMAP_COORDINATE_MAX_Y,
    DOTA_MINIMAP_COORDINATE_CENTER_Y,
  );

  return {
    left: clamp(
      ((normalizedX - DOTA_MINIMAP_COORDINATE_MIN_X) / DOTA_MINIMAP_COORDINATE_SPAN_X) * 100,
      0,
      100,
    ),
    top: clamp(
      100 - ((normalizedY - DOTA_MINIMAP_COORDINATE_MIN_Y) / DOTA_MINIMAP_COORDINATE_SPAN_Y) * 100,
      0,
      100,
    ),
  };
}

function normalizeDotaMapCoordinate(value, min, max, fallback) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return clamp(numericValue, min, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
