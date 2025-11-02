#!/bin/bash
set -e
wasm-pack build --target web --out-dir ./web/pkg --release .
