#!/bin/bash
# Thin wrapper. The disassembly is per-container now; see tools/build/disassemble.ts.
exec npx tsx tools/build/disassemble.ts "$@"
