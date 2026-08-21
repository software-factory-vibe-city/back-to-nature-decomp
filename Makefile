# === PSX Matching Decompilation Build System ===

# Toolchain - change GCC_VERSION to experiment (2.7.2, 2.8.1, 2.95.2)
GCC_VERSION := 2.95.2
CC          := tools/vendor/old-gcc/build-gcc-$(GCC_VERSION)-psx/cc1
MASPSX      := python3 tools/vendor/maspsx/maspsx.py
CROSS       := mips-linux-gnu-
AS          := $(CROSS)as
LD          := $(CROSS)ld
OBJCOPY     := $(CROSS)objcopy
CPP         := $(CROSS)cpp

# Flags — baseline defaults (Silent Hill proven config)
CPPFLAGS    := -Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -DINCLUDE_ASM_USE_MACRO_INC=1 -lang-c -D_LANGUAGE_C
ASFLAGS     := -march=r3000 -mtune=r3000 -EL -G8 -no-pad-sections -Iinclude -Iinclude/psyq

# Overlay containers were built -G0, and this is a per-container fact of the
# original build rather than a per-file override. The fingerprint: 145,741 words
# of overlay .text contain not one gp-relative access, against 17.99 per 1000
# words in the PS-X EXE's .text, with every one of the 13 code members measuring
# exactly zero. Under -G8 a translation unit's small globals become .comm and are
# reached through $gp; and $gp holds the EXE's small-data base at run time, so a
# separately linked overlay emitting gp-relative accesses would resolve them
# against the wrong section — -G0 is the only build that runs.
# Reproduce: npx tsx tools/diagnostics/overlayFlagFingerprint.ts
OVERLAY_G   := -G0
OVERLAY_ASFLAGS := -march=r3000 -mtune=r3000 -EL $(OVERLAY_G) -no-pad-sections -Iinclude -Iinclude/psyq

# Per-file flag overrides (CC1FLAGS_<stem> := <extra flags>)
-include configs/flag_overrides.mk

# Baseline cc1 flags. Kept as a plain literal list because
# tools/agent/decompToolchain.ts reads this line and is the single source of
# truth for every diagnostic tool's flags — a conditional here would be dropped
# by its `$(...)` stripping and every tool would silently lose a flag.
CC1FLAGS    := -O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon -fverbose-asm -msoft-float -mgas -fgnu-linker -quiet

# Per-file flag configuration
# Usage: $(eval $(call FlagsSwitch,$<)) in recipe
# Sets CC1_EFFECTIVE, SRC_ASFLAGS, MASPSX_FLAGS for the given source file.
# Appends any per-file overrides from flag_overrides.mk, and swaps the
# small-data threshold for overlay containers (see OVERLAY_G above).
define FlagsSwitch
CC1_EFFECTIVE := $(if $(filter src/overlays/%,$(1)),$(subst -G8,$(OVERLAY_G),$(CC1FLAGS)),$(CC1FLAGS)) $(CC1FLAGS_$(basename $(notdir $(1))))
MASPSX_FLAGS := --aspsx-version 2.80 --use-comm-section --run-assembler
SRC_ASFLAGS := $(if $(filter src/overlays/%,$(1)),$(OVERLAY_ASFLAGS),$(ASFLAGS))
endef

# Paths
TARGET      := extracted/iso/slus_011.15
BUILD_DIR   := build
BASENAME    := slus_011

# Splat outputs
LD_SCRIPT   := $(BUILD_DIR)/$(BASENAME).ld
BUILT_BIN   := $(BUILD_DIR)/$(BASENAME).bin
BUILT_ELF   := $(BUILD_DIR)/$(BASENAME).elf

# Payload parameters — read from binary header at build time
PAYLOAD_OFF := $(shell python3 -c "print(0x800)")
PAYLOAD_SZ  := $(shell python3 -c "import struct; f=open('$(TARGET)','rb'); f.seek(0x1c); print(struct.unpack('<I',f.read(4))[0])")

# Disassembly output (lives in build/)
FUNCTIONS_CSV := $(BUILD_DIR)/functions.csv

# Source collection — splat generates .s files into build/asm/
#
# Object collection is per container and explicit. GNU make's `**` is not
# recursive (it expands to `*/`), so a glob over src/ would silently miss
# src/overlays/<id>/ and, worse, would link overlay objects into the PS-X EXE
# if it ever matched them.
C_SRCS      := $(wildcard src/*.c)
ASM_SRCS    := $(shell find $(BUILD_DIR)/asm -name '*.s' -not -path '*/nonmatchings/*' 2>/dev/null)
C_OBJS      := $(patsubst src/%.c,$(BUILD_DIR)/src/%.c.o,$(C_SRCS))
ASM_OBJS    := $(patsubst $(BUILD_DIR)/asm/%.s,$(BUILD_DIR)/asm/%.s.o,$(ASM_SRCS))
ALL_OBJS    := $(C_OBJS) $(ASM_OBJS)

# --- Overlay containers ----------------------------------------------------
#
# One splat config per binary is not a choice: target_path, sha1 and basename
# are top-level in splat, and an overlay is a different file with a different
# hash. Containers are discovered from the configs the bootstrap writes, so a
# newly solved member joins the build with no edit here.
# Containers come from the manifest, not from the configs they generate: wiping
# a container's config must not delete the rule that rebuilds it.
OVERLAY_MANIFEST := configs/overlays.json
OVERLAYS := $(shell python3 -c "import json;d=json.load(open('$(OVERLAY_MANIFEST)'));print(' '.join(m['id'] for m in d['members'] if m.get('classification',{}).get('verdict')=='code' and m.get('base',{}).get('verdict')=='resolved'))" 2>/dev/null)
ENGINE_SYMS     := $(BUILD_DIR)/engine_syms.txt

# Default target
all: check

# ---------------------------------------------------------------------------
# Full pipeline: disassemble → configure → split → build → verify
# ---------------------------------------------------------------------------

# Disassemble every container with spimdisasm (generates functions.csv +
# per-function .s files).
#
# Order is a dependency chain, not a preference. The PS-X EXE is disassembled
# first because its own `.text` is the reference body the member classifier
# judges against — a body of known code from this project, in place of
# thresholds calibrated on one game. Only then can the archive be decoded,
# classified, and its members' load addresses solved; an overlay carries no
# header to tell the disassembler where it loads.
disassemble:
	npx tsx tools/build/disassemble.ts --container exe
	npx tsx tools/build/bootstrap.ts --write
	npx tsx tools/build/extractArchive.ts --write
	npx tsx tools/build/classifyArchiveMembers.ts --write
	npx tsx tools/build/extractArchive.ts --write --extract
	npx tsx tools/build/solveOverlayBase.ts --write
	npx tsx tools/diagnostics/overlayIdentity.ts --write

# Split the binary with splat
split:
	npx tsx tools/build/bootstrap.ts --write
	npx tsx tools/build/mergeFragments.ts --write
	npx tsx tools/build/addLibSymbols.ts --write
	npx tsx tools/build/patchSplatForLibs.ts --write
	npx tsx tools/build/addDepObjects.ts --write
	SPIMDISASM_ARCHLEVEL=1 splat split configs/splat/exe.yaml
	@for i in 1 2 3; do \
		npx tsx tools/build/fixCrossFileRefs.ts --write 2>&1 | tee /tmp/crossfile_$$; \
		if grep -q "No cross-file" /tmp/crossfile_$$; then break; fi; \
		SPIMDISASM_ARCHLEVEL=1 splat split configs/splat/exe.yaml; \
	done
	npx tsx tools/build/mergeFragments.ts --write
	SPIMDISASM_ARCHLEVEL=1 splat split configs/splat/exe.yaml
	npx tsx tools/build/patchLinkerBss.ts --write
	npx tsx tools/build/patchLibBss.ts --write
	@printf 'INCLUDE "build/undefined_funcs_auto.txt"\nINCLUDE "build/undefined_syms_auto.txt"\n' >> $(LD_SCRIPT)
	@if [ -f build/dep_syms.txt ]; then printf 'INCLUDE "build/dep_syms.txt"\n' >> $(LD_SCRIPT); fi
	@if [ -f build/lib_bss_syms.txt ]; then printf 'INCLUDE "build/lib_bss_syms.txt"\n' >> $(LD_SCRIPT); fi
	npx tsx tools/build/classifyGlobals.ts --write
	npx tsx tools/agent/contextExport.ts --all
	npx tsx tools/build/genProjectProfile.ts --write

# ---------------------------------------------------------------------------
# Compile + link
# ---------------------------------------------------------------------------

# An INCLUDE_ASM stub assembles the disassembly by `.include`, so its object
# depends on that `.s` and not only on the `.c`. Without this a re-split that
# renames a call target leaves the old object in place and the link either fails
# on a name that no longer exists or, worse, succeeds against a stale one.
# The stem carries the container directory, so the function name is its
# basename; the wildcard covers every container's assembly tree.
.SECONDEXPANSION:

# Compile C: cpp -> cc1 -> maspsx -> .o
$(BUILD_DIR)/src/%.c.o: src/%.c $$(wildcard $(BUILD_DIR)/asm/nonmatchings/$$(notdir $$*)/*.s $(BUILD_DIR)/*/asm/nonmatchings/$$(notdir $$*)/*.s)
	@mkdir -p $(dir $@)
	$(eval $(call FlagsSwitch,$<))
	$(CPP) $(CPPFLAGS) $< -o $(BUILD_DIR)/src/$*.i
	$(CC) $(CC1_EFFECTIVE) $(BUILD_DIR)/src/$*.i -o $(BUILD_DIR)/src/$*.s
	$(MASPSX) $(MASPSX_FLAGS) --gnu-as-path $(AS) -o $@ $(SRC_ASFLAGS) $(BUILD_DIR)/src/$*.s

# Assemble .s files (splat outputs to build/asm/)
$(BUILD_DIR)/asm/%.s.o: $(BUILD_DIR)/asm/%.s
	@mkdir -p $(dir $@)
	$(AS) $(ASFLAGS) $< -o $@

# Link. The game-rodata subsegment block of splat.yaml is derived, never
# hand-maintained: attribution iff the owning function is compiled C, extent
# = the owner's .o .rodata size. Objects exist here, so this is the earliest
# point the derivation can run; on drift (a jump-table function flipped
# stub<->C) it rederives, re-splits, and rebuilds once.
$(BUILT_ELF): $(ALL_OBJS) $(LD_SCRIPT)
	@if npx tsx tools/build/deriveRodataSplits.ts; then \
		$(LD) -EL -T $(LD_SCRIPT) -Map $(BUILD_DIR)/$(BASENAME).map -o $@; \
	elif [ -z "$$DERIVE_RODATA_RETRY" ]; then \
		echo "rodata attribution drift — rederiving splat.yaml and rebuilding"; \
		npx tsx tools/build/deriveRodataSplits.ts --write; \
		$(MAKE) split; \
		DERIVE_RODATA_RETRY=1 $(MAKE) $@; \
	else \
		echo "deriveRodataSplits: still inconsistent after rederivation"; \
		exit 1; \
	fi

# Extract raw binary
$(BUILT_BIN): $(BUILT_ELF)
	$(OBJCOPY) -O binary $< $@

# Verify match against original payload. The rodata-attribution check runs
# unconditionally here so a splat.yaml edit on an already-built tree is
# caught even when no relink is needed (the link rule self-heals the rest).
# `check-exe` names the PS-X EXE container explicitly; `check` stays its alias so
# every existing invocation and note keeps working.
check-exe: check

check: $(BUILT_BIN)
	@npx tsx tools/build/deriveRodataSplits.ts
	@dd if=$(TARGET) bs=1 skip=$(PAYLOAD_OFF) count=$(PAYLOAD_SZ) 2>/dev/null | \
		sha256sum | awk '{print $$1}' > $(BUILD_DIR)/original.sha256
	@dd if=$(BUILT_BIN) bs=1 skip=$(PAYLOAD_OFF) count=$(PAYLOAD_SZ) 2>/dev/null | \
		sha256sum | awk '{print $$1}' > $(BUILD_DIR)/built.sha256
	@if diff -q $(BUILD_DIR)/original.sha256 $(BUILD_DIR)/built.sha256 > /dev/null 2>&1; then \
		echo "OK: $(BUILT_BIN) matches original payload"; \
	else \
		echo "MISMATCH: $(BUILT_BIN) does not match original payload"; \
		echo "  original: $$(cat $(BUILD_DIR)/original.sha256)"; \
		echo "  built:    $$(cat $(BUILD_DIR)/built.sha256)"; \
		exit 1; \
	fi
	@npx tsx tools/build/genProjectProfile.ts --write > /dev/null && echo "Refreshed configs/project-profile.md (byte-identity verified)"

# ---------------------------------------------------------------------------
# Overlay containers
# ---------------------------------------------------------------------------

# The PS-X EXE's symbol table, as absolute definitions for every overlay link.
#
# Once the EXE links, the linked ELF is the authority and is a declared
# prerequisite, so renaming a function in src/ relinks every overlay. A stale
# list would link cleanly and call the wrong function, which is why the link
# rule below re-checks it rather than trusting the timestamp.
#
# Before the EXE links — a new project whose library integration is not finished
# — the export falls back to the project's own symbol tables. That is weaker: it
# cannot see a symbol only the link defines. It is offered anyway because it is
# what lets overlay work begin before the executable is buildable, and the tool
# names which source it used.
ifeq ($(wildcard $(BUILT_ELF)),)
$(ENGINE_SYMS):
	@echo "note: no linked PS-X EXE yet — the engine export falls back to the project symbol tables"
	npx tsx tools/build/exportEngineSymbols.ts --write
else
$(ENGINE_SYMS): $(BUILT_ELF)
	npx tsx tools/build/exportEngineSymbols.ts --write
endif

define OverlayRules
$(1)_C_SRCS := $$(wildcard src/overlays/$(1)/*.c)
$(1)_ASM_SRCS := $$(shell find $(BUILD_DIR)/$(1)/asm -name '*.s' -not -path '*/nonmatchings/*' 2>/dev/null)
$(1)_OBJS := $$(patsubst src/%.c,$(BUILD_DIR)/src/%.c.o,$$($(1)_C_SRCS)) \
             $$(patsubst $(BUILD_DIR)/$(1)/asm/%.s,$(BUILD_DIR)/$(1)/asm/%.s.o,$$($(1)_ASM_SRCS))

$(BUILD_DIR)/$(1)/asm/%.s.o: $(BUILD_DIR)/$(1)/asm/%.s
	@mkdir -p $$(dir $$@)
	$$(AS) $$(OVERLAY_ASFLAGS) $$< -o $$@

$(BUILD_DIR)/$(1)/$(1).elf: $$($(1)_OBJS) $(BUILD_DIR)/$(1)/$(1).ld $(ENGINE_SYMS)
	@npx tsx tools/build/exportEngineSymbols.ts --check
	$$(LD) -EL -T $(BUILD_DIR)/$(1)/$(1).ld -Map $(BUILD_DIR)/$(1)/$(1).map -o $$@

$(BUILD_DIR)/$(1)/$(1).bin: $(BUILD_DIR)/$(1)/$(1).elf
	$$(OBJCOPY) -O binary $$< $$@

# An overlay's check compares against its extracted member bytes, which is why
# the archive extraction has to be reproducible.
check-$(1): $(BUILD_DIR)/$(1)/$(1).bin
	@sha256sum < extracted/overlays/$(1).bin | awk '{print $$$$1}' > $(BUILD_DIR)/$(1)/original.sha256
	@sha256sum < $(BUILD_DIR)/$(1)/$(1).bin  | awk '{print $$$$1}' > $(BUILD_DIR)/$(1)/built.sha256
	@if diff -q $(BUILD_DIR)/$(1)/original.sha256 $(BUILD_DIR)/$(1)/built.sha256 > /dev/null 2>&1; then \
		echo "OK: $(1) matches its extracted member"; \
	else \
		echo "MISMATCH: $(1) does not match its extracted member"; \
		echo "  original: $$$$(cat $(BUILD_DIR)/$(1)/original.sha256)"; \
		echo "  built:    $$$$(cat $(BUILD_DIR)/$(1)/built.sha256)"; \
		exit 1; \
	fi

$(1): $(BUILD_DIR)/$(1)/$(1).bin

split-$(1):
	npx tsx tools/build/bootstrapOverlay.ts --container $(1) --write
	SPIMDISASM_ARCHLEVEL=1 splat split configs/splat/$(1).yaml
	@cat $(BUILD_DIR)/$(1)/ld_includes.txt >> $(BUILD_DIR)/$(1)/$(1).ld

# Rebuild one overlay's config from nothing without touching any other container.
wipe-$(1):
	rm -f configs/splat/$(1).yaml configs/symbols/$(1).txt
	rm -rf $(BUILD_DIR)/$(1)
	@echo "$(1) wiped. Run 'make split-$(1) && make check-$(1)'."

.PHONY: check-$(1) split-$(1) wipe-$(1) $(1)
endef

$(foreach overlay,$(OVERLAYS),$(eval $(call OverlayRules,$(overlay))))

# Everything: the PS-X EXE plus every overlay container.
check-all: check $(addprefix check-,$(OVERLAYS))
	@echo "All $(words $(OVERLAYS)) overlay container(s) and the PS-X EXE match."

split-all: split $(addprefix split-,$(OVERLAYS))

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

# Setup submodules and tools
setup:
	git submodule update --init --recursive

# Show decompilation progress
progress:
	@npx tsx tools/diagnostics/progress.ts

# Config convergence guard: re-run the split pipeline across every container and
# assert that NO tracked config or generated header changes. With fourteen
# containers the fixpoint is harder to reach than with one, and a chain that
# oscillates in a single container fails the guard for the whole project — which
# is the point: convergence is a property of the pipeline, not of one binary. A dirty result means either
# the committed state was not converged (someone committed mid-derivation)
# or the environment drifted (tool version change) — both need human review,
# not a silent commit. Run after fresh clones and before committing.
config-check:
	@$(MAKE) split-all > /dev/null 2>&1
	@git diff --exit-code configs/ include/ > /dev/null || { \
		echo "CONFIG DRIFT DETECTED — make split changed tracked files:"; \
		git diff --stat configs/ include/; \
		echo "Review and commit deliberately, or revert."; \
		exit 1; \
	}
	@echo "OK: configs are converged (make split produced no tracked-file changes)"

# Clean build artifacts + splat output
clean:
	rm -rf $(BUILD_DIR)
	rm -f configs/undefined_funcs_auto.txt configs/undefined_syms_auto.txt
	rm -f $(LD_SCRIPT)

# Wipe generated configs for bootstrap testing
# Usage: make wipe && make split && make && make check
wipe:
	rm -f configs/symbols/exe.txt
	rm -f configs/disassembler_symbol_addrs.txt
	@# Strip subsegments from splat.yaml, keeping header
	@python3 -c "\
import re; \
lines = open('configs/splat/exe.yaml').readlines(); \
idx = next(i for i,l in enumerate(lines) if l.strip() == 'subsegments:'); \
open('configs/splat/exe.yaml','w').writelines(lines[:idx+1])"
	rm -rf $(BUILD_DIR)
	@echo "Configs wiped. Run 'make split && make && make check' to rebuild from scratch."

.PHONY: all disassemble split check check-exe check-all split-all setup progress clean wipe
