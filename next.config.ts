import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright's baseURL uses 127.0.0.1; without this Next's dev-origin check
  // blocks HMR/client resources from that origin and breaks hydration.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      // 腾讯云 COS：正式发布内容的配图（2026-10-09 接入，见
      // aigc-prompt-backend/app/services/cos_service.py）。next/image 默认
      // 只允许同域图片，外部域名必须显式登记，否则会被静默拦截（页面空白、
      // 不报错，很容易被误判成"图片没传上去"）。
      {
        protocol: "https",
        hostname: "aigc-prompt-images-1310986640.cos.ap-guangzhou.myqcloud.com",
      },
      // 本地后端静态图片路由（开发阶段草稿预览 / 早期手写脚本图片）
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
