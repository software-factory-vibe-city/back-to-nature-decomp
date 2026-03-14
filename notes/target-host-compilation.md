# Compiling for Host Architecture (x86-64)

## Premise

Once we have matching C source, we can compile it with a modern compiler targeting the host machine instead of MIPS R3000. The game logic is just C — the hardware dependency comes entirely from PSY-Q SDK calls and a handful of MIPS-specific constructs (GTE coprocessor instructions, scratch pad access, memory-mapped I/O). Replace those with a compatibility layer and the game runs natively.

This is exactly what the N64 decomp scene has done successfully with Super Mario 64 and Zelda: Ocarina of Time.

## Precedent Projects

### PsyCross (OpenDriver2) — Most Directly Relevant

**URL:** [OpenDriver2/PsyCross](https://github.com/OpenDriver2/PsyCross)

PsyCross is a PSY-Q compatibility/translation layer that allows PSY-Q-based code to run on modern platforms. It reimplements PSY-Q SDK functions (libgpu, libgte, libcd, etc.) using modern APIs. This is the closest existing project to what we'd need — a drop-in replacement for PSY-Q that compiles on x86-64.

**Key insight:** PsyCross was built specifically for the Driver 2 decompilation. It maps PSY-Q GPU primitives to OpenGL, reimplements GTE math in software, and stubs the BIOS/kernel layer. The approach is proven and directly applicable.

### Ship of Harkinian / libultraship (Zelda OoT)

**URLs:** [HarbourMasters/Shipwright](https://github.com/HarbourMasters/Shipwright), [Kenix3/libultraship](https://github.com/Kenix3/libultraship)

The gold standard for decomp-to-PC-port. The ZeldaRE matching decompilation completed in Nov 2021. Ship of Harkinian then built `libultraship` — a drop-in reimplementation of the N64's `libultra` SDK — so the decompiled C code runs on PC with minimal changes.

**Architecture:**
- `libultraship` replaces N64 SDK calls with modern equivalents
- Multiple rendering backends: DirectX 11, OpenGL, Metal
- Asset extraction from ROM into archive files (.otr/.o2r)
- Enhancement layer on top (widescreen, higher framerate, etc.)

**Lesson:** The SDK compatibility layer is the critical piece. Game code doesn't change much — the abstraction lives below it.

### SM64 PC Port

**URL:** [sm64-port/sm64-port](https://github.com/sm64-port/sm64-port)

The first major N64 decomp PC port. Demonstrated that once you have matching C, the port is a tractable engineering problem, not a research problem. Has been forked to run on PS2, PS3, Xbox, DOS, and more.

### DevilutionX (Diablo)

**URLs:** [diasurgical/devilution](https://github.com/diasurgical/devilution), [diasurgical/DevilutionX](https://github.com/diasurgical/DevilutionX)

Started as a matching decompilation of the original Diablo (aided by debug symbols left in the Japanese PS1 port). Became DevilutionX — a cross-platform port running on Android, iOS, Switch, PS4, Vita, 3DS, Amiga, and more.

**Lesson:** Matching decomp → PC port is a well-trodden path. The decomp phase and the port phase are separable — you can do them in parallel or sequentially.

### Silent Hill Decomp

**URL:** [Vatuu/silent-hill-decomp](https://github.com/Vatuu/silent-hill-decomp)

99.77% decompiled as of early 2026. PC port expected to follow. Demonstrates that PSX matching decompilations can reach completion, and that the PC port is the natural next step.

## Hardware Dependencies in This Game

The game (SLUS-01115) uses the following PSX subsystems, all of which must be abstracted:

### 1. GPU — Graphics Processing Unit

The PSX GPU is accessed via command packets sent through DMA or I/O ports, not through a framebuffer API. The game uses:

**Primitives** (from libgpu.h):
- Flat/Gouraud-shaded triangles and quads: `POLY_F3`, `POLY_FT3`, `POLY_G3`, `POLY_GT3`, `POLY_F4`, `POLY_FT4`, `POLY_G4`, `POLY_GT4`
- Lines: `LINE_F2`, `LINE_G2`, `LINE_F3`, `LINE_G3`
- Sprites: `SPRT`, `SPRT_16`, `SPRT_8`
- Tiles: `TILE`, `TILE_16`, `TILE_8`, `TILE_1`
- Draw/display environments: `DRAWENV`, `DISPENV`

**Ordering Table (OT):**
The PSX uses an ordering table for depth sorting — a linked list of GPU command packets sorted by Z depth. Primitives are inserted into the OT at a Z index, then the entire OT is DMA'd to the GPU in one shot. This is a PSX-specific pattern that must be reimplemented.

**Key GPU functions called:**
```c
ResetGraph(mode)
SetDefDrawEnv(env, x, y, w, h)
SetDefDispEnv(env, x, y, w, h)
DrawSync(mode)
SetVideoMode(MODE_NTSC)  // mode 0
GsInitGraph(320, 240, 0, 0, 0)
GsDefDispBuff(0, 0, 0, 240)
GsInit3D()
```

**Abstraction strategy:** Translate GPU command packets to OpenGL/Vulkan draw calls. PsyCross does exactly this. Each primitive type maps to a textured or colored triangle/quad. The OT becomes a depth-sorted render queue.

### 2. GTE — Geometry Transform Engine (Coprocessor 2)

The GTE is a fixed-point math coprocessor for 3D transformations. It has 32 data registers and 32 control registers, accessed via `mtc2`/`mfc2`/`ctc2`/`cfc2` instructions and dedicated `cop2` opcodes.

**Operations used:**
| GTE Op | Purpose |
|--------|---------|
| RTPS / RTPT | Perspective transform (1 / 3 vertices) |
| MVMVA | Matrix-vector multiply and add |
| NCLIP | Normal clipping (backface culling) |
| AVSZ3 / AVSZ4 | Average Z for OT insertion |
| NCS / NCT / NCDS / NCDT | Normal color (lighting) |
| NCCS / NCCT | Normal color with color matrix |
| OP | Outer product (cross product) |
| SQR | Square of vector |
| DPCS / DPCT | Depth cue color |
| INTPL | Interpolation |
| GPF / GPL | General purpose interpolation |

**Data registers include:**
- V0, V1, V2 — input vertices (SVECTOR: short x, y, z)
- SXY0–SXY2, SXYP — screen coordinates output
- SZ0–SZ3 — screen Z values
- RGB, RGB0–RGB2 — color I/O
- IR0–IR3 — intermediate results
- MAC0–MAC3 — accumulators

**Control registers include:**
- 3x3 rotation matrix (R11–R33)
- Translation vector (TRX, TRY, TRZ)
- Light matrix, light color matrix, background color
- Screen offset (OFX, OFY), projection distance (H)
- Depth queue (DQA, DQB), Z scale factors (ZSF3, ZSF4)

**In C code, GTE access appears as inline assembly macros:**
```c
gte_ldv0(&vertex);           // load vertex 0
gte_rtps();                   // perspective transform
gte_stsxy(&screen_xy);       // store screen coordinates
gte_nclip();                  // backface cull check
gte_avsz3();                  // average Z for OT
```

**Abstraction strategy:** Software emulation of GTE operations. All GTE math is fixed-point (no floats) — the operations are well-documented. Replace inline `asm("cop2 ...")` with C function calls that perform equivalent fixed-point math. PSn00bSDK and PsyCross both have GTE software implementations.

**Reference:** [psx-spx.consoledev.net/geometrytransformationenginegte](https://psx-spx.consoledev.net/geometrytransformationenginegte/) — complete register and operation documentation.

### 3. SPU — Sound Processing Unit

24 voice channels, ADPCM-encoded samples, hardware reverb.

**Functions called:**
```c
SpuInit()
SpuSetKey(on_off, voice_mask)
SpuSetAllKeysStatus(status)
// Voice configuration: pitch, volume, ADPCM address, ADSR envelope
```

**SPU constants:** `SPU_00CH` through `SPU_23CH` (bit flags for 24 channels), transfer modes (`SPU_TRANSFER_BY_DMA`, `SPU_TRANSFER_BY_IO`).

**Abstraction strategy:** Map SPU voices to SDL_mixer or OpenAL sources. Decode ADPCM samples to PCM at load time. Reverb can be approximated or skipped initially.

### 4. CD-ROM Subsystem

**Functions called:**
```c
CdInit()
CdControl(cmd, param, result)
CdControlB(cmd, param, result)  // blocking
CdRead(sectors, buf, mode)
CdSearchFile(fp, name)
CdReadFile(name, addr, nbyte)
CdPlay(mode, track, offset)     // CD-DA audio
```

**Abstraction strategy:** Replace CD reads with filesystem reads from an extracted disc image directory. `CdSearchFile` becomes a path lookup. `CdRead` becomes `fread`. CD-DA playback can use decoded audio files via SDL.

### 5. Controller Input

```c
PadInitDirect(buf1, buf2)
PadStartCom()
PadGetState(port)
PadSetMainMode(socket, offs, lock)
```

**Button constants:** `PADLup`, `PADRdown`, `PADstart`, `PADselect`, `PADL1`, `PADR1`, etc.

**Abstraction strategy:** Map to SDL_GameController. The PSX pad state is a 16-bit button bitfield read from a buffer — trivial to populate from SDL input.

### 6. Memory Card

```c
MemCardInit(0)
MemCardStart()
McxStartCom()
InitCARD(val)
StartCARD()
```

**Abstraction strategy:** Map to filesystem save/load. Memory card data is just a 128KB block with 15 save slots — write to a local file instead.

### 7. BIOS / Kernel

```c
ResetCallback()
VSyncCallback(func)
VSync(mode)
SetMem(2)
FlushCache()
EnterCriticalSection()
ExitCriticalSection()
```

**Event system:** Hardware interrupts (VBLANK, GPU, CDROM, SPU, etc.) dispatched through an event table with descriptors like `HwVBLANK`, `EvSpCOMP`, `EvMdINTR`.

**Abstraction strategy:**
- `VSync` → SDL frame timing (16.67ms for 60Hz NTSC)
- `VSyncCallback` → call the registered function once per frame in the main loop
- `ResetCallback` → no-op
- `FlushCache` → no-op (x86 has coherent caches)
- Critical sections → mutex or just no-op (single-threaded game logic)
- `SetMem` → no-op

**Reference:** [psx-spx.consoledev.net/kernelbios](https://psx-spx.consoledev.net/kernelbios/) — complete BIOS call documentation. Also: [grumpycoders/pcsx-redux OpenBIOS](https://github.com/grumpycoders/pcsx-redux) — open-source PSX BIOS reimplementation.

### 8. Scratch Pad

1KB of fast SRAM at `0x1F800000`–`0x1F8003FF`, accessed via the `getScratchAddr(offset)` macro.

**Abstraction strategy:** Allocate a 1KB static buffer. Replace `getScratchAddr(n)` with `&scratch_pad[n]`.

### 9. Memory Layout / Address Space

PSX uses fixed addresses:
- `0x80000000`–`0x801FFFFF` — 2MB main RAM (cached via kseg0)
- `0xA0000000`–`0xA01FFFFF` — same RAM, uncached (kseg1)
- `0x1F800000` — scratch pad

The game has hardcoded pointers like `D_8005E274` (GP base), `D_80070CC0`, `D_800B8014`, etc.

**Abstraction strategy:** Allocate a 2MB array as "PSX RAM" and rebase all pointers, OR (simpler) just let the linker place globals naturally — the C code uses symbol names, not raw addresses. Only code that does raw address arithmetic needs fixing.

## Architecture

```
┌─────────────────────────────────────────┐
│           Game Code (C source)          │
│  Matched decompilation, minimally       │
│  modified — #ifdef HOST where needed    │
└────────────────┬────────────────────────┘
                 │ PSY-Q API calls
                 ▼
┌─────────────────────────────────────────┐
│       PSY-Q Compatibility Layer         │
│                                         │
│  libgpu_host.c — GPU primitives → GL    │
│  libgte_host.c — GTE software math      │
│  libspu_host.c — SPU → SDL audio        │
│  libcd_host.c  — CD → filesystem        │
│  libpad_host.c — Pad → SDL input        │
│  kernel_host.c — BIOS stubs             │
│  libetc_host.c — VSync/timing           │
│  libgs_host.c  — GS library → GL        │
│  libmcrd_host.c — Memory card → file    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Platform Backend                │
│  SDL2 (window, input, audio, timing)    │
│  OpenGL 3.3+ (rendering)               │
└─────────────────────────────────────────┘
```

The game code stays as close to the matched decompilation as possible. The compatibility layer provides the same function signatures as PSY-Q headers but with host implementations. Conditional compilation (`#ifdef TARGET_HOST`) handles the few places where game code touches hardware directly.

## Implementation Strategy

### Phase 0: Parallel Build Target

Add a `host` target to the Makefile that compiles the same `src/*.c` files with the system GCC/Clang instead of the MIPS cross-compiler. Initially everything will fail to link — that's fine. The goal is to get compilation working, then link against stubs.

```makefile
host: $(HOST_C_OBJECTS)
    $(CC) -o btn_host $^ -lSDL2 -lGL -lm
```

### Phase 1: Stub Everything

Write empty stubs for every PSY-Q function the game calls. The game will compile, link, and run — doing nothing visible. This proves the build pipeline works.

Priority order for stubs:
1. `kernel.h` / `libapi.h` — BIOS calls (mostly no-ops)
2. `libetc.h` — `VSync`, `ResetCallback`, `PadInit`
3. `libgpu.h` — `ResetGraph`, `SetDefDrawEnv`, `DrawSync`
4. `libcd.h` — `CdInit` and friends
5. `libspu.h` — `SpuInit` and friends
6. `libgte.h` — GTE init functions
7. `libgs.h` — GS library

### Phase 2: Frame Loop + Window

Implement `VSync()` as "wait for next frame, poll SDL events, swap buffers." Implement `VSyncCallback` to call the registered function. This gets the game's main loop spinning with a visible (empty) window.

### Phase 3: GTE Software Emulation

Replace all GTE inline assembly with C functions. This is mechanical — every GTE operation is fully documented. The key data types are already defined in `libgte.h`:

```c
typedef struct {
    short m[3][3];  // 3x3 rotation matrix (fixed-point 1.3.12)
    long  t[3];     // translation vector
} MATRIX;

typedef struct {
    long vx, vy, vz, pad;
} VECTOR;

typedef struct {
    short vx, vy, vz, pad;
} SVECTOR;
```

GTE operations are fixed-point math on these types. RTPS (perspective transform), for example:
1. Multiply rotation matrix by input vertex
2. Add translation vector
3. Divide by Z to project to screen coordinates
4. Output screen XY and Z depth

Reference implementations exist in PsyCross and PSn00bSDK.

### Phase 4: GPU Rendering

Implement the ordering table and primitive rendering:

1. `ClearOTag` / `ClearOTagR` — initialize the OT linked list
2. Primitive setup macros (`SetPolyFT4`, `SetSemiTrans`, etc.) — these just fill struct fields, they work as-is
3. `DrawOTag` — walk the OT linked list, translate each primitive to OpenGL draw calls
4. `LoadImage` / `StoreImage` — texture upload/download (VRAM management)

The PSX GPU works in 16-bit color (5.5.5.1 ABGR). Textures use CLUTs (color lookup tables) with 4-bit or 8-bit indices. The rendering backend needs to handle this format conversion.

### Phase 5: Audio

1. Decode VAG (ADPCM) samples to PCM
2. Map SPU voices to SDL_mixer channels
3. Implement `SpuSetKey` as play/stop on the corresponding SDL channel
4. CD-DA tracks → decoded audio files played via SDL

### Phase 6: Input + Save

Map SDL controller/keyboard events to the PSX pad buffer format. Memory card operations become file I/O.

## Key Challenges

### GTE Inline Assembly

The biggest mechanical challenge. Every GTE access in C code looks like:

```c
gte_ldv0(&v0);    // actually: asm("mtc2 %0, $0" : : "r"(v0.vx | v0.vy << 16))
gte_rtps();       // actually: asm("cop2 0x0180001")
gte_stsxy(&xy);   // actually: asm("mfc2 %0, $14" : "=r"(xy))
```

These are defined as inline asm macros in `include/psyq/inline_c.h`. For the host build, we need to provide alternative macro definitions that call C functions instead:

```c
#ifdef TARGET_HOST
  #define gte_ldv0(v)  gte_sw_ldv0(v)
  #define gte_rtps()   gte_sw_rtps()
  #define gte_stsxy(p) gte_sw_stsxy(p)
#endif
```

### Fixed-Point Arithmetic

The PSX has no FPU. All math is integer/fixed-point. GTE uses 1.3.12 format (1 sign bit, 3 integer bits, 12 fractional bits) for matrix elements and 1.15.16 for vectors. This all works fine on x86 — it's just integer math — but overflow behavior must match. The GTE clamps and sets flags on overflow; a software implementation must replicate this.

### Ordering Table Depth Sorting

The OT is a fixed-size array (commonly 1024–4096 entries) where each entry is a linked list of GPU commands at that Z depth. Front-to-back rendering is achieved by walking the OT from back to front. This is trivial to implement but must be correct — wrong OT handling causes Z-fighting or invisible geometry.

### Double Buffering

The PSX uses two display/draw environments, swapped each frame. `GsDefDispBuff(0, 0, 0, 240)` sets up a 320x240 double buffer in VRAM. On PC, this maps naturally to OpenGL's front/back buffer swap, but VRAM coordinate calculations in the game code may need adjustment.

### Timing

PSX games are timed to VBLANK (60Hz NTSC / 50Hz PAL). `VSync(0)` blocks until the next VBLANK. The main loop looks like:

```
while (1) {
    process_input();
    update_game_state();
    build_display_list();
    DrawSync(0);    // wait for GPU
    VSync(0);       // wait for VBLANK
    swap_buffers();
}
```

On PC, replace with SDL's frame timing. Games that assume exactly 60Hz updates may need delta-time adjustments, but many PSX games are frame-locked and work fine at fixed 60 FPS.

## Existing Code to Leverage

| Project | What to Take | URL |
|---------|-------------|-----|
| PsyCross | PSY-Q → modern API translation layer | [OpenDriver2/PsyCross](https://github.com/OpenDriver2/PsyCross) |
| PSn00bSDK | GTE software emulation, GPU command queue | [Lameguy64/PSn00bSDK](https://github.com/Lameguy64/PSn00bSDK) |
| OpenBIOS | BIOS call implementations | [pcsx-redux OpenBIOS](https://github.com/grumpycoders/pcsx-redux) |
| libultraship | Architecture reference for SDK compat layers | [Kenix3/libultraship](https://github.com/Kenix3/libultraship) |
| PCSX-Redux | GTE/GPU/SPU emulation reference | [grumpycoders/pcsx-redux](https://github.com/grumpycoders/pcsx-redux) |

## What This Enables

Beyond "run the game on PC":

1. **Debugging** — run under gdb/lldb, add printf logging, use AddressSanitizer
2. **Understanding** — watch functions execute with real data, inspect variables at runtime
3. **Testing** — unit test decompiled functions against expected behavior
4. **Modding** — once it runs natively, modification is trivial
5. **Accelerated decompilation** — runtime traces reveal what functions do, what types are, what data structures look like

The host build doesn't need to be perfect to be useful. Even a partially working build that runs the init sequence and crashes provides more information about the code than static analysis alone.

## Hardware Reference Documentation

- [PSX Memory Map](https://psx-spx.consoledev.net/memorymap/)
- [GPU Command Reference](https://psx-spx.consoledev.net/graphicsprocessingunitgpu/)
- [GTE Register & Operation Reference](https://psx-spx.consoledev.net/geometrytransformationenginegte/)
- [SPU Reference](https://psx-spx.consoledev.net/soundprocessingunitgpu/)
- [BIOS Call Reference](https://psx-spx.consoledev.net/kernelbios/)
- [DMA Channel Reference](https://psx-spx.consoledev.net/dmachannels/)
- [Interrupt Reference](https://psx-spx.consoledev.net/interrupts/)
