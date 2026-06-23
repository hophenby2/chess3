# HTML5 单文件打包说明

本文档用于把本项目这类 `Vite + React + TypeScript` 前端打包成一个可直接双击打开的 HTML 文件。

适用目录示例：

- `app/frontend`
- `v51/app/frontend`

打包后的 HTML 会内联：

- React/TypeScript 编译后的 JavaScript
- Tailwind/CSS 样式
- 本地图片资源，例如棋子图片、棋盘背景

最终产物可以通过 `file://` 直接双击运行，不需要启动 Vite 开发服务器。

---

## 一、已有打包命令

### 普通版本

```bash
cd /Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/app/frontend
npm run build:single
```

输出文件：

```text
/Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/app/frontend/深海棋战-单文件版.html
```

### v51 版本

```bash
cd /Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/v51/app/frontend
npm run build:single
```

输出文件：

```text
/Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/v51/app/frontend/深海棋战-v51-单文件版.html
```

---

## 二、首次使用前准备

如果目标目录还没有安装依赖，先执行：

```bash
cd 目标版本/app/frontend
npm install
```

然后再执行：

```bash
npm run build:single
```

---

## 三、单文件打包原理

原项目的 `index.html` 里通常有：

```html
<script type="module" src="/src/main.tsx"></script>
```

浏览器不能直接执行 `.tsx`，所以双击 `index.html` 会空白。

单文件打包分两步：

1. 使用 Vite 把 `.tsx`、React、CSS、图片编译成浏览器能运行的静态产物。
2. 使用 Node 脚本把构建出的 `.js` 和 `.css` 内容内联回 HTML。

最终 HTML 结构类似：

```html
<style>
  /* 打包后的 CSS */
</style>

<script type="module">
  // 打包后的 JS
</script>
```

图片通过 Vite 的 `assetsInlineLimit` 转成 `data:` URL，直接进入 JS/CSS，因此可以离线显示。

---

## 四、关键源码适配

为了让 HTML 可以通过 `file://` 双击运行，需要做三类适配。

### 1. 路由适配

`BrowserRouter` 依赖服务器路径，`file://` 下容易失效。

修改 `src/App.tsx`：

```tsx
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
```

加入：

```tsx
const Router =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? HashRouter
    : BrowserRouter;
```

并把：

```tsx
<BrowserRouter>
  <AppRoutes />
</BrowserRouter>
```

改成：

```tsx
<Router>
  <AppRoutes />
</Router>
```

### 2. 配置请求适配

本地 HTML 没有 `/api/config` 服务，所以要跳过该请求。

修改 `src/lib/config.ts`：

```ts
export async function loadRuntimeConfig(): Promise<void> {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    configLoading = false;
    console.log('Running from local HTML file, skipping runtime config fetch');
    return;
  }

  // 原有 fetch('/api/config') 逻辑继续保留
}
```

### 3. 图片本地化

如果代码里使用 CDN 图片：

```ts
'https://mgx-backend-cdn.metadl.com/.../piece-xxx.png'
```

需要改为本地导入，例如 `src/game/pieces.ts`：

```ts
import anglerfishImage from '../../../../assets/images/piece-anglerfish.png';
import crabImage from '../../../../assets/images/piece-crab.png';
import jellyfishImage from '../../../../assets/images/piece-jellyfish.png';
import krakenImage from '../../../../assets/images/piece-kraken.png';
import lanternfishImage from '../../../../assets/images/piece-lanternfish.png';
import leviathanImage from '../../../../assets/images/piece-leviathan.png';
import seasnakeImage from '../../../../assets/images/piece-seasnake.png';
import sharkImage from '../../../../assets/images/piece-shark.png';

const PIECE_IMAGES = {
  lanternfish: lanternfishImage,
  jellyfish: jellyfishImage,
  crab: crabImage,
  seasnake: seasnakeImage,
  anglerfish: anglerfishImage,
  shark: sharkImage,
  kraken: krakenImage,
  leviathan: leviathanImage,
};
```

棋盘背景同理，例如 `src/components/Board.tsx`：

```tsx
import boardBackground from '../../../../assets/images/bg-deep-sea-abyss.jpg';
```

然后把远程背景地址改成：

```tsx
style={{
  backgroundImage: `url(${boardBackground})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}}
```

---

## 五、Vite 单文件构建配置

在目标前端目录创建：

```text
vite.single.config.ts
```

内容：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-single-build',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

关键配置说明：

- `base: './'`：使用相对路径，避免 `/assets/...` 在 `file://` 下失效。
- `cssCodeSplit: false`：尽量合并成一个 CSS 文件。
- `assetsInlineLimit: 100_000_000`：把图片等资源内联成 `data:` URL。
- `inlineDynamicImports: true`：避免拆出多个 JS chunk。

---

## 六、HTML 内联脚本

在目标前端目录创建：

```text
scripts/build-single-html.mjs
```

普通版本可使用：

```js
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist-single-build');
const outputFile = path.join(root, '深海棋战-单文件版.html');

function resolveAssetPath(assetPath) {
  const normalized = assetPath.replace(/^\.\//, '').replace(/^\//, '');
  return path.join(distDir, normalized);
}

async function inlineHtml() {
  let html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');

  html = html.replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '');

  html = await replaceAsync(
    html,
    /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g,
    async (_match, href) => {
      const css = await fs.readFile(resolveAssetPath(href), 'utf8');
      return `<style>\n${css}\n</style>\n`;
    }
  );

  html = await replaceAsync(
    html,
    /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
    async (_match, src) => {
      const js = await fs.readFile(resolveAssetPath(src), 'utf8');
      return `<script type="module">\n${js}\n</script>`;
    }
  );

  html = html.replace(/<link\s+rel="sitemap"[^>]*>\s*/g, '');

  await fs.writeFile(outputFile, html, 'utf8');

  const stats = await fs.stat(outputFile);
  console.log(
    `Created ${path.relative(root, outputFile)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
  );
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  const replacements = await Promise.all(
    matches.map((match) => replacer(...match))
  );

  let index = 0;
  return input.replace(pattern, () => replacements[index++]);
}

await inlineHtml();
```

如果是 v51，可以把输出文件名改成：

```js
const outputFile = path.join(root, '深海棋战-v51-单文件版.html');
```

---

## 七、package.json 脚本

在目标前端目录的 `package.json` 中添加：

```json
{
  "scripts": {
    "build:single": "vite build --config vite.single.config.ts && node scripts/build-single-html.mjs"
  }
}
```

如果已有 `scripts`，只需要追加 `build:single` 这一项。

---

## 八、完整打包命令

```bash
cd 目标版本/app/frontend
npm install
npm run build:single
```

生成后，直接双击输出的 HTML 文件即可。

---

## 九、验证方法

### 1. 检查文件大小

```bash
ls -lh 深海棋战-单文件版.html
```

如果图片已内联，通常会有数 MB 到十几 MB。

### 2. 检查是否还有本地外链资源

```bash
rg 'src="/|href="/|/assets/|rel="modulepreload"|rel="sitemap"' 深海棋战-单文件版.html
```

正常情况下不应该再有必须依赖本地服务器的 `/assets/...` 引用。

### 3. 双击测试

直接双击 HTML 文件，浏览器应能显示游戏首页。

---

## 十、常见问题

### 1. 双击后页面空白

可能原因：

- 没有使用 `HashRouter`
- JS/CSS 没有成功内联
- 仍存在 `/assets/...` 绝对路径
- 浏览器控制台有运行错误

### 2. 图片不显示

可能原因：

- 图片仍然使用远程 CDN 地址
- 图片没有通过 `import` 进入 Vite 构建链路
- `assetsInlineLimit` 太小，图片没有被内联

### 3. 登录、云存档、后端接口不可用

单文件 HTML 主要用于离线运行前端游戏。需要后端服务的功能，例如登录、云存档、接口请求，双击 HTML 时通常不可用。

### 4. 文件很大

这是正常现象。因为 JS、CSS、图片全部被塞进一个 HTML 文件里，体积会明显增加。

---

## 十一、当前已完成的版本

### 普通版本

```text
/Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/app/frontend/深海棋战-单文件版.html
```

### v51 版本

```text
/Users/happyelements/Downloads/深海克苏鲁战棋游戏_v8/v51/app/frontend/深海棋战-v51-单文件版.html
```
