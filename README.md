# 一盏 · 中国茶事

从辨茶、冲泡到产地与茶文化：七大茶系、十三款名茶的香气、汤色、滋味、冲泡参数与辨伪要点，附发酵光谱、冲泡计时与茶缘测试。纯静态站点，无构建步骤。

在线站点（GitHub Pages）：https://sxs159733.github.io/chinese-tea-guide/

仓库为公开仓库，任何有写权限的协作者都可以直接 clone、修改、推送；推送 `main` 后由 GitHub Actions 自动发布。

## 目录结构

```
index.html              页面结构（茶系图谱 / 名茶详情 / 冲泡指南 / 茶缘测试）
assets/styles.css       全站样式与设计变量
assets/app.js           交互逻辑（筛选、切换、计时器）
assets/data.js          全部结构化内容（茶系、名茶、冲泡参数）
assets/img/             名茶与场景配图
assets/fonts/           本地字体子集
```

## 本地预览

```bash
python -m http.server 8767
```

然后访问 http://127.0.0.1:8767 。

## 改内容

内容基本集中在 `assets/data.js`：茶系、名茶条目、香气/汤色/滋味描述、冲泡参数。样式走 `assets/styles.css` 顶部的 `:root` CSS 变量，改完刷新即可。

## 协作流程

1. 仓库持有者在 GitHub 的 **Settings → Collaborators** 里邀请成员（对方用自己的 GitHub 账号接受即可，不需要 Qoder 账号）。
2. 从 `main` 拉最新代码，改动按茶系或数据字段分开提交，减少冲突。
3. 图片放到 `assets/img/`，用 kebab-case 命名，并在 `data.js` 里引用。
4. 提 PR 或直接推 `main` 都可以，推上去会自动重新部署。

### 用 AI Agent 协作

仓库是纯静态 HTML/CSS/JS，没有构建步骤和私有依赖，Codex、WorkBuddy、Qoder、Copilot 等 Agent 直接 clone 就能改。建议约定内容改动集中在 `data.js`，多人同时改时先拉最新再提交。

## 部署

仓库根目录就是可直接部署的静态站点，由 `.github/workflows/pages.yml` 在每次推送 `main` 后自动发布到 GitHub Pages，约 1–2 分钟上线。

## 说明

茶类内容为品饮记录与公开资料整理，冲泡参数可依个人口味与器具调整。
