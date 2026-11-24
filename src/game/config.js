// The numbers the whole run is built from. One file so the tunnel, the player
// and everything that collides with them agree on where the walls are.

/// Distance from the tunnel's axis to the inner face of its voxels.
export const TUBE_RADIUS = 2.6;

/// One voxel, in world units. The tunnel, the obstacles and the shards are all
/// built at this scale so the world reads as a single grid of cubes.
export const VOXEL = 0.72;

/// How far behind the player the camera sits, on the axis.
export const CAM_BACK = 6.4;

/// Where new obstacles appear — deep enough to be inside the fog.
export const SPAWN_Z = -52;

export const BASE_SPEED = 11;
export const MAX_SPEED = 28;
export const SPEED_GAIN = 0.3;

/// Prisms needed for a surge, and how long one lasts.
export const PRISM_NEED = 8;
export const SURGE_TIME = 3.2;

export const PLAYER_SIZE = 0.62;

/// Where the cube sits when it is on the wall: its centre one half-size in from
/// the wall's face, so it rests against the blocks instead of inside them.
export const REST_RADIUS = TUBE_RADIUS - PLAYER_SIZE * 0.5;

/// Collision radius of the player cube — a little under its half size, because
/// a hitbox that matches the art exactly reads as unfair when it grazes.
export const PLAYER_HALF = 0.25;

export const GRAVITY = 60;
/// Peaks about 1.15 in from the wall: well over a gold bar, never over a
/// magenta one, which is the whole difference between the two obstacles.
export const JUMP_SPEED = 11.75;

/// Radians per second the cube can orbit the tube at.
export const MAX_TURN = 3.5;

/// True on a touch screen. `any-pointer: coarse` is the honest test — checking
/// for `ontouchstart` reports touch on laptops that have none.
export const TOUCH = window.matchMedia('(any-pointer: coarse)').matches;
