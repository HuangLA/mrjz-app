const DOTA_MINIMAP_IMAGE_SIZE = 400;
const DOTA_MINIMAP_CONTENT_LEFT = 0;
const DOTA_MINIMAP_CONTENT_RIGHT = 400;
const DOTA_MINIMAP_CONTENT_TOP = 0;
const DOTA_MINIMAP_CONTENT_BOTTOM = 400;

// OpenDota ward logs store Dota world coordinates divided by 128.
const OPENDOTA_COORDINATE_SCALE = 128;

// Calibrated for the 400x400 minimap_game.png currently used by H5 and the mini program.
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
  const imageX =
    DOTA_MINIMAP_CONTENT_LEFT +
    ((normalizedX - DOTA_MINIMAP_COORDINATE_MIN_X) / DOTA_MINIMAP_COORDINATE_SPAN_X) *
      (DOTA_MINIMAP_CONTENT_RIGHT - DOTA_MINIMAP_CONTENT_LEFT);
  const imageY =
    DOTA_MINIMAP_CONTENT_BOTTOM -
    ((normalizedY - DOTA_MINIMAP_COORDINATE_MIN_Y) / DOTA_MINIMAP_COORDINATE_SPAN_Y) *
      (DOTA_MINIMAP_CONTENT_BOTTOM - DOTA_MINIMAP_CONTENT_TOP);

  return {
    left: clamp((imageX / DOTA_MINIMAP_IMAGE_SIZE) * 100, 0, 100),
    top: clamp((imageY / DOTA_MINIMAP_IMAGE_SIZE) * 100, 0, 100),
  };
}

function normalizeDotaMapCoordinate(value, min, max, fallback) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return clamp(numericValue, min, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
