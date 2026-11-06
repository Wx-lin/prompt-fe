import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterWorkbench } from './character-workbench';
import { createInitialValues } from './character-data';
import { referenceEditPrompt, referenceImageBase64 } from './character-reference';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const image = 'data:image/png;base64,aGVsbG8=';
const output = (base64 = 'd29ybGQ=') => new Response(JSON.stringify({ data: { image_base64: base64, mime_type: 'image/png' } }), { status: 200 });

describe('角色参考图微调', () => {
  it('清除原有配饰时向模型明确要求移除', () => {
    const base = { ...createInitialValues(), accessories: '眼镜' };
    const prompt = referenceEditPrompt({ ...base, accessories: '' }, base, '', '');
    expect(prompt).toMatch(/(?:移除|去除|清除).*配饰/);
  });
  it('官方角色使用其图片和相对官方配置的修改，不强制未改的默认值', async () => {
    const base = createInitialValues();
    const fetcher = vi.fn().mockResolvedValue(output()); vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={{ ...base, hairStyle: '马尾' }} exampleImage={image} exampleValues={base} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request.reference_image_base64).toBe('aGVsbG8=');
    expect(request.prompt).toContain('马尾');
    expect(request.prompt).not.toContain(`年龄：${base.age}`);
    expect(request.prompt).toContain('保留');
  });

  it('新建时占位示例图不用作参考', async () => {
    const fetcher = vi.fn().mockResolvedValue(output()); vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={createInitialValues()} newCharacter en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('reference_image_base64');
  });

  it('成功后以新图和当时配置为基线继续微调', async () => {
    const base = createInitialValues();
    const fetcher = vi.fn().mockResolvedValue(output()); vi.stubGlobal('fetch', fetcher);
    const props = { en: false, canUndo: false, onChange: vi.fn(), onApplyOutfit: vi.fn() };
    const { rerender } = render(<CharacterWorkbench {...props} values={{ ...base, hairStyle: '马尾' }} exampleImage={image} exampleValues={base} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await screen.findByAltText('AI 生成的角色预览');
    rerender(<CharacterWorkbench {...props} values={{ ...base, hairStyle: '马尾', hairColor: '金色' }} exampleImage={image} exampleValues={base} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const request = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(request.reference_image_base64).toBe('d29ybGQ=');
    expect(request.prompt).toContain('金色');
    expect(request.prompt).not.toContain('马尾');
  });

  it('官方图读取失败时提示错误且不发送生图请求', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={createInitialValues()} exampleImage='/character-library/example.webp' exampleValues={createInitialValues()} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/参考图/));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toMatch(/^\/_next\/image\?/);
  });
  it('新角色已有生成图后，AI 描述沿用配置并优先执行本次描述', async () => {
    const base = createInitialValues();
    const preview = { src: image, signature: JSON.stringify([base, null, '', '']) };
    const apply = vi.fn().mockReturnValue({ ...base, hairStyle: '马尾', aiDetails: '旧细节，新细节' });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { hairStyle: '马尾' }, unmapped: '' } }), { status: 200 })).mockResolvedValueOnce(output());
    vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={base} initialPreview={preview} newCharacter en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} onApplyAi={apply} />);
    fireEvent.change(screen.getByLabelText('描述角色，AI 快速创建'), { target: { value: '换成马尾' } });
    fireEvent.click(screen.getByRole('button', { name: '生成角色' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(apply).toHaveBeenCalledWith(expect.anything(), false);
    const request = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(request.reference_image_base64).toBe('aGVsbG8=');
    expect(request.prompt).toContain('换成马尾');
    expect(request.prompt).not.toContain('旧细节');
  });

  it('旧图片缺失配置快照时不发送生图请求', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={createInitialValues()} initialPreview={{ src: image, signature: 'invalid' }} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/对应的角色配置/));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('官方默认预览表情未改变时不要求修改表情', async () => {
    const base = { ...createInitialValues(), baseExpression: '', expressions: '微笑,平静' };
    const fetcher = vi.fn().mockResolvedValue(output()); vi.stubGlobal('fetch', fetcher);
    render(<CharacterWorkbench values={{ ...base, hairStyle: '马尾' }} exampleImage={image} exampleValues={base} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '确认生成' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).prompt).not.toContain('表情：微笑');
  });

  it('都市女生使用图片优化器加载特定官方资源', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['original'], { type: 'image/png' }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(referenceImageBase64('/character-outfits/stage-transparent.png', new AbortController().signal)).resolves.toBe('b3JpZ2luYWw=');
    expect(fetcher.mock.calls[0][0]).toMatch(/^\/_next\/image\?/);
  });

});
