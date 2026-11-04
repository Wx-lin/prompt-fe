import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHARACTERS } from '@/features/character-library/official-characters';
import { characterAssetUrl } from './character-asset-url';

const base = 'https://aigc-prompt-images-1310986640.cos.ap-guangzhou.myqcloud.com/site-assets/character/501c7fa62e77';

describe('character asset URLs', () => {
  it.each(['/character-library/a.webp', '/character-outfits/a.png', '/character-visuals/a.png', '/character-demo/a.png'])('uses COS in production and local assets in development: %s', (src) => {
    expect(characterAssetUrl(src, 'production')).toBe(base + src);
    expect(characterAssetUrl(src, 'development')).toBe(src);
  });

  it.each(['data:image/png;base64,abc', '/api/character-assets/42/image', 'https://example.com/test.png', '/guide/wechat-contact.jpg', '/character-library-other/a.png'])('does not rewrite unrelated or private URLs: %s', (src) => {
    expect(characterAssetUrl(src, 'production')).toBe(src);
  });

  it('maps every official character to its existing full resolution asset', () => {
    expect(OFFICIAL_CHARACTERS).toHaveLength(100);
    for (const character of OFFICIAL_CHARACTERS) {
      expect(existsSync(join(process.cwd(), 'public', character.image.slice(1))), character.image).toBe(true);
      expect(characterAssetUrl(character.image, 'production')).toBe(base + character.image);
      if (character.id.startsWith('drama-')) expect(character.image).toMatch(/-hd\.webp$/);
    }
  });
});
