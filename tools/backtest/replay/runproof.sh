#!/bin/bash
for y in "$@"; do for a in 1 2 3 4; do python3 zdir.py npz$y proofvars.json PRF$y >> logPRF$y.txt 2>&1 && break; sleep 20; done; done
