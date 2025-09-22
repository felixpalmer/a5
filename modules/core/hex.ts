// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

export function hexToU64(hex: string): bigint {
  return BigInt(`0x${hex}`);
}
  
export function u64ToHex(index: bigint): string {
  return index.toString(16);
}