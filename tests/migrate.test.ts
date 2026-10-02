import {describe, it, expect} from 'vitest';
import {migrate} from 'a5/core/migrate';
import {hexToU64} from 'a5/core/hex';
import fixtures from './fixtures/migrate.json';

describe('migrate', () => {
  it('maps v0 cell ids to v1 cell ids', () => {
    for (const {v0, v1} of fixtures) {
      expect(migrate(hexToU64(v0))).toBe(hexToU64(v1));
    }
  });
});
