# PRISM RUN

An endless 3D voxel tunnel runner. You are a glowing cube stuck to the inside of
a tube built from blocks: spin around the wall to thread the gaps, leap away from
it to clear the gold bars, and collect prisms to trigger a surge.

Built with Three.js. No build step, no bundler, no dependencies to install —
every file it needs is in this repository and the browser loads them as they are.

## Play

Open `index.html` over HTTP (any static file server will do).

| Action | Touch | Keyboard |
| --- | --- | --- |
| Spin around the tube | drag left / right, or the two arrow buttons | `A` / `D` or `←` / `→` |
| Leap off the wall | tap the world, or the up button | `Space`, `W` or `↑` |
| Pause | the pause button | `P` or `Esc` |
| Start / restart | tap the card | `Enter`, `Space` or `R` |

Magenta walls can only be steered around. Gold bars sit low enough to hop.
Eight prisms charge a short surge that doubles your score and phases through
everything.

## Publishing

The whole game is static. To put it on GitHub Pages, Vercel, Netlify or any
static host, serve the repository root and use `index.html` as the entry point.
Nothing needs compiling, so there is no build command and no output directory.

## Layout

```
index.html          entry point: import map, stylesheet, stage and HUD containers
styles/main.css     the palette, the 8BIT WONDER type and the HUD layout
src/main.js         renderer, camera, frame loop
src/scene.js        the scene base class and manager
src/scenes/         GameScene — the run itself
src/game/           the tunnel, the player, obstacles, prisms and the HUD
src/hud.js          helpers for building DOM controls and readouts
src/icons.js        Lucide symbols, as CSS variables
assets/fonts/       8BIT WONDER (see FONT-README.txt)
vendor/three/       Three.js r185, vendored
```

`vendor/` is generated code. Nothing under it should be edited.
