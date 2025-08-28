import { fromBase64, toBase64 } from '../yjsProvider';

describe('yjsProvider helpers', () => {
  it('encodes and decodes base64', () => {
    const u8 = new Uint8Array([1, 2, 3, 255]);
    const b64 = toBase64(u8);
    const back = fromBase64(b64);
    expect(Array.from(back)).toEqual(Array.from(u8));
  });
});

