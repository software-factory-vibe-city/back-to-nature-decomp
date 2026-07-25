mkdir -p build
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
  --symbol-addrs configs/disassembler_symbol_addrs.txt
rm -f build/slus_011_*.text.s
