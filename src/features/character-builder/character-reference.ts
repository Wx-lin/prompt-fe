import { characterAssetUrl } from '@/lib/character-asset-url';
import { GROUPS, UNSPECIFIED, type CharacterValues } from './character-data';

const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
const IMAGE_GROUPS = new Set(['basic', 'role', 'face', 'hair', 'body', 'skin', 'makeup', 'expression', 'clothing']);
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function imageBaseline(signature: string): { values: CharacterValues; expression: string } | null {
  try {
    const parts: unknown = JSON.parse(signature);
    if (!Array.isArray(parts) || parts.length !== 4 || !parts[0] || typeof parts[0] !== 'object' || Array.isArray(parts[0]) || Object.values(parts[0]).some((value) => typeof value !== 'string')) return null;
    return { values: parts[0] as CharacterValues, expression: typeof parts[3] === 'string' ? parts[3] : '' };
  } catch { return null; }
}

export function initialReferenceExpression(values: CharacterValues): string {
  const choices = (values.expressions ?? '').split(/[，,]/).map((value) => value.trim()).filter((value) => value && value !== UNSPECIFIED && value !== '无');
  return choices.includes(values.baseExpression) ? values.baseExpression : choices[0] ?? '';
}

export function referenceEditPrompt(values: CharacterValues, baseline: CharacterValues, expression: string, oldExpression: string, instruction = ''): string {
  const changes = GROUPS.filter((group) => IMAGE_GROUPS.has(group.id)).flatMap((group) => group.fields
    .filter((field) => field.type !== 'toggle' && field.id !== 'expressions' && field.id !== 'baseExpression' && !(instruction && field.id === 'aiDetails') && typeof values[field.id] === 'string' && values[field.id] !== baseline[field.id] && values[field.id] !== UNSPECIFIED)
    .flatMap((field) => {
      const value = values[field.id].trim();
      const tags = (text: string) => text.split(/[，,]/).map((tag) => tag.trim()).filter((tag) => tag && tag !== '无' && tag !== UNSPECIFIED);
      const removed = field.type === 'tags' ? tags(baseline[field.id] ?? '').filter((tag) => !tags(value).includes(tag)) : [];
      return [...(removed.length ? [`移除${field.label}：${removed.join('，')}`] : []), ...(value ? [`${field.label}：${value}`] : [])];
    }));
  if (expression && expression !== oldExpression) changes.push(`表情：${expression}`);
  return [
    '基于参考图编辑同一个角色。保留人物身份、未要求改变的五官、身材、服装、姿势与画面；仅按以下要求修改。若明确要求修改人物特征，则以修改要求为准。',
    ...changes,
    instruction ? `用户本次补充要求（优先）：${instruction}` : '',
    changes.length || instruction ? '' : '保持参考图的人物和造型，生成一张自然的角色图。',
  ].filter(Boolean).join('\n');
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('invalid image'));
    reader.onerror = () => reject(new Error('invalid image'));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('image canvas unavailable');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      const match = DATA_IMAGE.exec(data);
      if (match && Math.floor(match[1].length * 3 / 4) <= MAX_REFERENCE_BYTES) return match[1];
    }
    throw new Error('image too large');
  } finally { bitmap.close(); }
}

export async function referenceImageBase64(source: string, signal: AbortSignal): Promise<string> {
  const direct = DATA_IMAGE.exec(source);
  if (direct && Math.floor(direct[1].length * 3 / 4) <= MAX_REFERENCE_BYTES) return direct[1];
  let blob: Blob;
  if (direct) {
    const bytes = Uint8Array.from(atob(direct[1]), (char) => char.charCodeAt(0));
    blob = new Blob([bytes], { type: source.slice(5, source.indexOf(';')) });
  } else {
    if ((source !== '/character-outfits/stage-transparent.png' && !/^\/character-library\/[A-Za-z0-9_./-]+$/.test(source)) || source.includes('..')) throw new Error('invalid image source');
    const url = `/_next/image?url=${encodeURIComponent(characterAssetUrl(source))}&w=1080&q=75`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('image unavailable');
    blob = await response.blob();
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('invalid image type');
  if (blob.size > MAX_REFERENCE_BYTES) return compressImage(blob);
  const match = DATA_IMAGE.exec(await dataUrlFromBlob(blob));
  if (!match) throw new Error('invalid image');
  return match[1];
}
