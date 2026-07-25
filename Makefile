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
CPPFLAGS    := -Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -DINCLUDE_ASM_USE_MACRO_INC=1 -lang-c
ASFLAGS     := -march=r3000 -mtune=r3000 -EL -G8 -no-pad-sections -Iinclude -Iinclude/psyq

# Per-file flag overrides (CC1FLAGS_<stem> := <extra flags>)
-include configs/flag_overrides.mk

# Per-file flag configuration
# Usage: $(eval $(call FlagsSwitch,$<)) in recipe
# Sets CC1FLAGS, MASPSX_FLAGS for the given source file.
# Appends any per-file overrides from flag_overrides.mk.
define FlagsSwitch
CC1FLAGS   := -O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon -fverbose-asm -msoft-float -mgas -fgnu-linker -quiet $(CC1FLAGS_$(basename $(notdir $(1))))
MASPSX_FLAGS := --aspsx-version 2.77 --dont-force-G0 --run-assembler
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
C_SRCS      := $(wildcard src/*.c src/**/*.c)
ASM_SRCS    := $(shell find $(BUILD_DIR)/asm -name '*.s' -not -path '*/nonmatchings/*' 2>/dev/null)
C_OBJS      := $(patsubst src/%.c,$(BUILD_DIR)/src/%.c.o,$(C_SRCS))
ASM_OBJS    := $(patsubst $(BUILD_DIR)/asm/%.s,$(BUILD_DIR)/asm/%.s.o,$(ASM_SRCS))
ALL_OBJS    := $(C_OBJS) $(ASM_OBJS)

# Default target
all: check

# ---------------------------------------------------------------------------
# Full pipeline: disassemble → configure → split → build → verify
# ---------------------------------------------------------------------------

# Disassemble the binary with spimdisasm (generates functions.csv + per-function .s files)
disassemble:
	bash tools/build/disassemble.sh

# Split the binary with splat
split:
	npx tsx tools/build/bootstrap.ts --write
	npx tsx tools/build/mergeFragments.ts --write
	npx tsx tools/build/addLibSymbols.ts --write
	npx tsx tools/build/patchSplatForLibs.ts --write
	npx tsx tools/build/addDepObjects.ts --write
	SPIMDISASM_ARCHLEVEL=1 splat split configs/splat.yaml
	@for i in 1 2 3; do \
		npx tsx tools/build/fixCrossFileRefs.ts --write 2>&1 | tee /tmp/crossfile_$$; \
		if grep -q "No cross-file" /tmp/crossfile_$$; then break; fi; \
		SPIMDISASM_ARCHLEVEL=1 splat split configs/splat.yaml; \
	done
	npx tsx tools/build/mergeFragments.ts --write
	SPIMDISASM_ARCHLEVEL=1 splat split configs/splat.yaml
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

# Compile C: cpp -> cc1 -> maspsx -> .o
$(BUILD_DIR)/src/%.c.o: src/%.c
	@mkdir -p $(dir $@)
	$(eval $(call FlagsSwitch,$<))
	$(CPP) $(CPPFLAGS) $< -o $(BUILD_DIR)/src/$*.i
	$(CC) $(CC1FLAGS) $(BUILD_DIR)/src/$*.i -o $(BUILD_DIR)/src/$*.s
	$(MASPSX) $(MASPSX_FLAGS) --gnu-as-path $(AS) -o $@ $(ASFLAGS) $(BUILD_DIR)/src/$*.s

# Assemble .s files (splat outputs to build/asm/)
$(BUILD_DIR)/asm/%.s.o: $(BUILD_DIR)/asm/%.s
	@mkdir -p $(dir $@)
	$(AS) $(ASFLAGS) $< -o $@

# Link
$(BUILT_ELF): $(ALL_OBJS) $(LD_SCRIPT)
	$(LD) -EL -T $(LD_SCRIPT) -Map $(BUILD_DIR)/$(BASENAME).map -o $@

# Extract raw binary
$(BUILT_BIN): $(BUILT_ELF)
	$(OBJCOPY) -O binary $< $@

# Verify match against original payload
check: $(BUILT_BIN)
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
# Utilities
# ---------------------------------------------------------------------------

# Setup submodules and tools
setup:
	git submodule update --init --recursive

# Show decompilation progress
progress:
	@npx tsx tools/diagnostics/progress.ts

# Config convergence guard: re-run the split pipeline and assert that NO
# tracked config or generated header changes. A dirty result means either
# the committed state was not converged (someone committed mid-derivation)
# or the environment drifted (tool version change) — both need human review,
# not a silent commit. Run after fresh clones and before committing.
config-check:
	@$(MAKE) split > /dev/null 2>&1
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
	rm -f configs/symbol_addrs.txt
	rm -f configs/disassembler_symbol_addrs.txt
	@# Strip subsegments from splat.yaml, keeping header
	@python3 -c "\
import re; \
lines = open('configs/splat.yaml').readlines(); \
idx = next(i for i,l in enumerate(lines) if l.strip() == 'subsegments:'); \
open('configs/splat.yaml','w').writelines(lines[:idx+1])"
	rm -rf $(BUILD_DIR)
	@echo "Configs wiped. Run 'make split && make && make check' to rebuild from scratch."

.PHONY: all disassemble split check setup progress clean wipe
