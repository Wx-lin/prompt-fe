import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterImagePreview } from './character-image-preview';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('角色图片预览', () => {
  it('仅点击生成时请求，完成后提供下载，并在设定变更时提示重新生成', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { image_base64: 'YWJj', mime_type: 'image/png' }, error: null }), { status: 200 }));
    const { rerender } = render(<CharacterImagePreview prompt="角色一" aspectRatio="16:9" en={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '生成角色预览图' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ prompt: '角色一', aspect_ratio: '16:9' });
    expect(await screen.findByRole('img', { name: '角色预览图' })).toHaveAttribute('src', 'data:image/png;base64,YWJj');
    expect(screen.getByRole('link', { name: '下载图片' })).toHaveAttribute('download');
    rerender(<CharacterImagePreview prompt="角色二" aspectRatio="16:9" en={false} />);
    expect(screen.getByText(/配置已更改/)).toBeVisible();
  });

  it('不支持的比例清楚提示，并使用默认比例生成', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: 'YWJj', mime_type: 'image/png' } }), { status: 200 }));
    render(<CharacterImagePreview prompt="角色一" aspectRatio="2:3" en={false} />);
    expect(screen.getByText(/暂不支持.*1:1/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '生成角色预览图' }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ prompt: '角色一', aspect_ratio: '1:1' });
    await screen.findByRole('img', { name: '角色预览图' });
  });

  it('请求失败给出可重试提示，不展示服务端敏感信息', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'secret upstream info' } }), { status: 503 }));
    render(<CharacterImagePreview prompt="角色一" en={false} />);
    fireEvent.click(screen.getByRole('button', { name: '生成角色预览图' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法生成');
    expect(screen.queryByText('secret upstream info')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新生成' })).toBeEnabled();
  });

  it('未登录也能主动生成角色预览', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { image_base64: 'YWJj', mime_type: 'image/png' }, error: null }), { status: 200 }));
    render(<CharacterImagePreview prompt="角色一" en={false} />);
    fireEvent.click(screen.getByRole('button', { name: '生成角色预览图' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('img', { name: '角色预览图' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('生成中阻止重复请求', async () => {
    let complete!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<CharacterImagePreview prompt="角色一" en={false} />);
    fireEvent.click(screen.getByRole('button', { name: '生成角色预览图' }));
    expect(screen.getByRole('button', { name: '生成中…' })).toBeDisabled();
    complete(new Response('{}', { status: 503 }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
