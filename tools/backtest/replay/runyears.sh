#!/bin/bash
# runyears.sh MENU TAGPREFIX YEAR... : run zmulti2 per year, retry up to 4x (resumable) if killed
M=$1; P=$2; shift 2
for y in "$@"; do
  for a in 1 2 3 4; do
    python3 zmulti2.py npz$y $M $P$y >> log$P$y.txt 2>&1 && break
    echo "[$(date +%H:%M)] $y attempt $a ended with error - retrying" >> log$P$y.txt; sleep 20
  done
done
