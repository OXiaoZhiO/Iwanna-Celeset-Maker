# I Wanna Maker - 模块说明

## 目录结构

```
modules/
├── constants.js   # 全局常量和状态变量
├── renderer.js    # 画布渲染
├── input.js       # 输入处理
├── camera.js      # 相机系统
├── map.js         # 地图编辑
├── player.js      # 玩家物理
├── ui.js          # 用户界面
├── io.js          # 导入导出
└── main.js        # 入口
```

## 模块依赖关系

```
main.js (入口)
    ├── constants.js (全局变量)
    ├── renderer.js (渲染)
    ├── input.js (输入)
    ├── camera.js (相机)
    ├── map.js (地图)
    ├── player.js (玩家物理)
    ├── ui.js (UI)
    └── io.js (导入导出)
```

## 模块说明

### constants.js
游戏的核心常量和全局状态变量。
- 地图尺寸常量（TILE, MAP_GRID, MAP_SIZE）
- 玩家物理常数（GRAVITY, MOVE_SPEED, JUMP_POWER 等）
- 游戏状态（editMode, currentTool, camera, mouse, keys, map, spawn, player）

### renderer.js
负责所有游戏元素的Canvas绑定和渲染。
- resizeCanvas() - 适配窗口尺寸
- draw() - 渲染地图边界、网格、方块、玩家

### input.js
处理所有用户输入。
- 鼠标/触摸事件（编辑地图）
- 键盘事件（移动、ESC切换模式、R复活）
- 移动端虚拟按键

### camera.js
控制游戏世界的可视区域。
- updateCamera() - 编辑模式手动移动 / 游戏模式跟随玩家

### map.js
地图编辑功能。
- placeTile() - 放置/删除方块
- pushHistory() - 保存历史记录
- 撤销/重做/清空功能

### player.js
玩家物理引擎。
- physics() - 移动、碰撞、重力
- getFeetTile() - 获取脚下方块
- checkSpikeCollision() - 尖刺碰撞检测
- respawn() - 复活

### ui.js
用户界面管理。
- showToast() - 显示提示
- updateHud() - 更新游戏HUD
- toggleMode() - 切换编辑/游戏模式
- 全屏功能

### io.js
地图数据的导入导出，使用**自定义压缩算法**（不依赖外部库）。

**压缩格式：**
1. 头部标识：`IWM2` (4字节)
2. 出生点：网格坐标 (2字节)
3. 方块数据：游程编码(RLE) + Base64编码

**导出流程：**
1. 收集所有方块，按坐标排序
2. 游程编码：连续相同类型方块合并为 `[类型][数量][X][Y]`
3. 转为字节数组
4. Base64编码
5. 复制到剪贴板

**类型映射：**
- `A`: block, `B`: spike, `C`: goal, `D`: jump
- `E`: tramp, `F`: boost, `G`: ice, `H`: oneway

### main.js
游戏入口模块。
- init() - 初始化所有系统
- loop() - 主循环（60fps）

## 方块类型

| type | 名称 | 说明 |
|------|------|------|
| block | 方块 | 灰色实心，可站立 |
| spike | 尖刺 | 红色三角形，接触即死 |
| goal | 终点 | 旗杆，触碰后通关 |
| jump | 梯子 | 棕色栏杆，可攀爬 |
| tramp | 弹簧 | 提供向上弹力 |
| boost | 加速带 | 橙色，提升水平速度 |
| ice | 冰面 | 浅蓝色，低摩擦 |
| oneway | 单向平台 | 紫色，只从上方可通过 |

## 快捷键

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 移动 / 相机移动 |
| 空格 | 跳跃 |
| ESC | 切换编辑/游戏模式 |
| R | 复活玩家 |
| 右键 | 删除方块 |

## 物理系统

- **重力**：0.65 像素/帧²
- **最大下落速度**：15 像素/帧
- **移动速度**：5 像素/帧
- **跳跃力**：11.2 像素/帧
- **跳跃缓冲**：6帧（允许提前按键）
- **Coyote Time**：6帧（离开地面后仍可跳跃）
