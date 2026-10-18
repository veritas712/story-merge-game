# 合成我们的故事

一个使用 11 张自定义照片的浏览器合成游戏。照片按用户提供的顺序映射到 1–11 级，相同等级碰撞后合成为下一级，并带有重力、边界碰撞、挤压回弹、吸附聚合、闪光粒子、新人物弹出、积分、最高分和危险线判定。

## 启动

项目使用浏览器原生 Canvas 和 JavaScript，运行时不需要安装第三方依赖。

```bash
npm run dev
```

然后打开终端输出的地址，默认是 `http://localhost:4173`。如果端口被系统占用，`server.mjs` 会自动向后尝试最多 10 个端口，并明确打印实际地址。也可以直接运行 `node server.mjs`。

## 素材位置和顺序

照片位于 `public/assets/characters/`：

| 等级 | 文件 |
| --- | --- |
| 1 | `level-01.jpg` |
| 2 | `level-02.jpg` |
| 3 | `level-03.jpg` |
| 4 | `level-04.jpg` |
| 5 | `level-05.jpg` |
| 6 | `level-06.jpg` |
| 7 | `level-07.jpg` |
| 8 | `level-08.jpg` |
| 9 | `level-09.jpg` |
| 10 | `level-10.jpg` |
| 11 | `level-11.jpg` |

要替换照片，覆盖对应文件即可；如果改扩展名，同时在 `src/config.js` 的 `image` 字段修改路径。照片顺序、名称、显示尺寸、物理半径和每次合成得分都集中在 `src/config.js` 的 `GAME_CONFIG.levels` 中。

## 调参

在 `src/config.js` 中可以调整 `gravity`、`wallBounce`、`floorBounce`、`dangerY`、`dangerHoldMs` 和 `particleLimit`。碰撞挤压强度在 `src/game.js` 的 `impact()` 中控制；合成吸附时长在 `startMerge()` 的 `duration` 中控制；新人物弹出曲线在 `createBody()` / `update()` 的 `pop` 计算中控制。

## 已验证与人工验证

已执行：

- Node.js 语法检查：`server.mjs`、`src/game.js`、`src/main.js`。
- 11 张照片均已复制到素材目录，文件路径与配置一一对应。
- 本地静态服务器可启动并提供 HTML、JS、CSS 与 JPG 文件。

需要在浏览器中人工体验的项目包括：连续投放时的手感、不同设备触控、连续多次合成、危险线结束时机以及音效权限策略。浏览器自动化环境无法可靠模拟完整的触控与物理体验。
