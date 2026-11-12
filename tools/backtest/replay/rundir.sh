#!/bin/bash
# rundir.sh YEAR... : direction test (zdir.py = zmulti2 with the test engine copy), resumable
for y in "$@"; do
  for a in 1 2 3 4; do
    python3 zdir.py npz$y dirvars.json DIR$y >> logDIR$y.txt 2>&1 && break
    echo "[$(date +%H:%M)] $y attempt $a error - retry" >> logDIR$y.txt; sleep 20
  done
done
