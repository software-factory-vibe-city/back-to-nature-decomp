mkdir -p build
npx tsx tools/build/genDisasmSymbols.ts --write
spimdisasm singleFileDisasm \
  --arch-level MIPS1 \
  --disasm-unknown \
  ./extracted/iso/slus_011.15 build \
  --start 0x800 \
  --vram 0x80010000 \
  --instr-category r3000gte \
  --split-functions build/functions \
  --function-info build/functions.csv \
  --compiler PSYQ \
  --endian little \
  --gp 0x8005E274 \
  --symbol-addrs build/disassembler_symbol_addrs.txt
rm -f build/slus_011_*.text.s

# Second pass WITHOUT --disasm-unknown, used only for section-layout analysis
# (bootstrap.ts -> analyzeLayout.ts). With --disasm-unknown, spimdisasm invents
# giant phantom "functions" inside data regions (e.g. a 26KB blob spanning
# libpad's pdresres tail plus real data), which breaks boundary inference.
mkdir -p build/without-unknown
spimdisasm singleFileDisasm \
  --arch-level MIPS1 \
  ./extracted/iso/slus_011.15 build/without-unknown \
  --start 0x800 \
  --vram 0x80010000 \
  --instr-category r3000gte \
  --function-info build/without-unknown/functions.csv \
  --compiler PSYQ \
  --endian little \
  --gp 0x8005E274 \
  --symbol-addrs build/disassembler_symbol_addrs.txt
rm -f build/without-unknown/slus_011_*.text.s
