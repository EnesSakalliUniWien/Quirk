# WebGL2 backend

The only code in Quirk that talks to the browser's GPU API. It requires WebGL2 with
`EXT_color_buffer_float` and high precision fragment floats; `context/issues.js` reports which of
those is missing so the app can show a banner instead of failing later. Files are grouped by
responsibility; a WebGPU backend would sit beside this directory with the same four concerns.

```text
webgl/
├── context/                      the one shared GL context
│   ├── issues.js                 creates the shared canvas and context, explains missing support
│   ├── WglContext.js             wraps WebGL2RenderingContext with limits and lifetime tracking
│   ├── WglMortalValueSlot.js     a value that is rebuilt when the context is lost
│   └── WglUtil.js                gl.getError and framebuffer status checks
├── shader/                       programs and how they are run
│   ├── WglArg.js                 a uniform argument passed to a shader
│   ├── WglShader.js              compiles a GLSL ES 3.00 fragment shader body into a cached program
│   ├── WglConfiguredShader.js    a shader bound to its arguments, ready to render into a texture
│   └── Shaders.js                the standard shaders: colour fill, passthrough, data upload, folds
├── texture/                      GPU memory
│   ├── WglTexture.js             an RGBA32F or RGBA8 texture you can render into and read back
│   ├── WglTexturePool.js         reuses textures by size and type instead of reallocating
│   └── WglTextureTrader.js       applies a chain of shaders to a texture, freeing intermediates
└── coder/                        array layouts
    ├── ShaderCoderTypes.js       ShaderPart, SingleTypeCoder and ShaderCoder, plus texel addressing
    ├── FloatsShaderCoder.js      the one coder: one value per RGBA32F pixel, read with texelFetch
    └── ShaderCoders.js           Inputs, Outputs and the assembly of shader parts into programs
```

## Shader bodies

A shader body is GLSL ES 3.00 without the version line: `WglShader` prepends `#version 300 es`,
`highp` precision and `out vec4 fragColor`. Bodies assembled through `Inputs` and `Outputs` get
`read_<name>(k)` for each input, `len_<name>()`, `len_output()`, and must define `outputFor(k)`.
Indices are floats because the gate shaders compute them with float arithmetic; addressing converts
them to integer texel coordinates with `texelFetch`, so no half-texel offsets are involved.

## How the pieces fit

`context` is the bottom layer; everything else depends on it. `shader` and `texture` depend on
each other: a configured shader renders into a texture, and a texture returns itself to the pool.
These import cycles are safe because each side uses the other only inside methods. `coder` sits on
top: `currentShaderCoder()` returns the single float coder, which the pool and the simulation kets
consult when they size textures and build shaders.

## Tests

`test/engine/webgl/` mirrors this directory. Every WebGL test runs once, on float textures.
