# WebGL2 backend

The only code in Quirk that talks to the browser's GPU API. It requires WebGL2 with
`EXT_color_buffer_float` and high precision fragment floats; `context/issues.js` reports which of
those is missing so the app can show a banner instead of failing later. Files are grouped by
responsibility; a WebGPU backend would sit beside this directory with the same concerns.

```text
webgl/
├── context/                      the one shared GL context
│   ├── issues.js                 creates the shared canvas and context, explains missing support
│   ├── WglContext.js             wraps WebGL2RenderingContext with limits and lifetime tracking
│   ├── WglMortalValueSlot.js     a value that is rebuilt when the context is lost
│   └── WglUtil.js                gl.getError and framebuffer status checks
├── shader/                       programs and how they are run
│   ├── WglArg.js                 a uniform argument passed to a shader
│   ├── WglShader.js              caches programs, binds output textures and executes shaders
│   ├── WglCompiledShader.js      compiles, links and releases programs; binds uniform arguments
│   ├── WglConfiguredShader.js    a shader bound to its arguments, ready to render into a texture
│   └── sources/                 shared vertex shader source and fragment prelude
├── operations/                  general texture calculations, independent of quantum circuits
│   ├── Shaders.js               configures colour fill, passthrough, data upload, packing and folds
│   └── shaders/                 one definition per file, including linear overlay
├── texture/                      GPU memory
│   ├── WglTexture.js             an RGBA32F or RGBA8 texture you can render into and read back
│   ├── WglPixelReadback.js       pixels on their way from the GPU, read without waiting for it
│   ├── WglPackBufferRing.js      the few buffers those reads write to, kept for the next read
│   ├── WglTexturePool.js         reuses textures by size and type instead of reallocating
│   └── WglTextureTrader.js       applies a chain of shaders to a texture, freeing intermediates
└── coder/                        array layouts
    ├── ShaderCoderTypes.js       ShaderPart, SingleTypeCoder and ShaderCoder, plus texel addressing
    ├── FloatsShaderCoder.js      the one coder: one value per RGBA32F pixel, read with texelFetch
    └── ShaderCoders.js           Inputs, Outputs and the assembly of shader parts into programs
```

## Readback and lost contexts

`readPixels` into an array blocks until the GPU has finished every command queued before it, so the
simulation reads back once per run: several textures are overlaid into one and read together
(`KetTextureUtil.mergedReadFloats`), and only the rows holding their data are read, not the rest
of a texture rounded up to a power of two.

A frame that can show its results one frame late need not wait at all. `WglTexture.startReadPixels`
reads into a buffer (`PIXEL_PACK_BUFFER`), which returns at once, then queues a fence
(`fenceSync(SYNC_GPU_COMMANDS_COMPLETE)`) and flushes. The `WglPixelReadback` it returns is polled with
`clientWaitSync(sync, 0, 0)`, and when the fence has signalled `getBufferSubData` fetches the pixels
without a wait. WebGL never signals a fence in the task that made it, so a poll in that task finds
nothing: results come a frame later at the soonest. `KetTextureUtil.startMergedReadFloats` is the
merged read in this form. A read that is no longer wanted is cancelled, which frees its fence.

The buffer is not made afresh for each read, which would allocate and free up to a megabyte of GPU
memory every animation frame. `WglPackBufferRing` hands a read a buffer of exactly its size, and takes
it back once the pixels have been fetched or the read cancelled; it keeps up to three waiting, the one
that has waited longest deleted first. Two reads under way never share a buffer, and one whose
read was cancelled before the GPU got to it can be handed on, since the GPU runs commands in order.
The fence is the read's own, made and deleted with it.

The GPU runs commands in the order it was given them, so a texture goes back to the pool as soon as
its read has been issued: whatever draws into it next is queued behind the read, which still gets
the pixels the texture had. (`test/engine/webgl/texture/WglPixelReadback.test.js` draws over a texture
before the data has been fetched and gets the first drawing.)

The browser can drop the context, for example when too many are open. A restored context has no
extensions enabled, so `WglContext` enables `EXT_color_buffer_float` again, and every value in a
`WglMortalValueSlot` is rebuilt on next use. A value made before the loss is dropped rather than
deleted: the restored context did not create it, and deleting it there would be an error. A read that
was under way when the context was lost throws from `poll` and is only dropped on `cancel`, for the
same reason; so is a buffer waiting in the ring, by the same `lifetimeCounter` and `lostAtLifetime`
the slots go by; and so is a texture kept across the loss, which `simulation/StablePrefix.js` checks
against the context's `lifetimeCounter` before it uses one.

## Shader bodies

A shader body is GLSL ES 3.00 without the version line: `WglCompiledShader` prepends `#version 300 es`,
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

`operations` uses `shader`, `coder` and `context` for reusable texture calculations. Quantum
operations remain in `simulation/gpu`: gate matrices in `gateShaders/`, and state initialization,
controls, swaps and qubit densities in `circuitShaders/`. These use the WebGL modules; WebGL
does not import simulation modules. `CircuitShaders.linearOverlay` keeps its existing method
but imports its general texture shader from `operations/shaders/`.

The existing shader/coder/texture import cycles are unchanged; directory grouping does not
make these modules independent of one another.

## Tests

`test/engine/webgl/` mirrors this directory. Every WebGL test runs once, on float textures.
