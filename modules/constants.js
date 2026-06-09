/**
 * =====================================================
 * constants.js - 游戏全局常量与状态变量
 * =====================================================
 * 
 * 【地图尺寸相关】
 * - TILE: 单个网格的像素尺寸（32x32像素）
 * - MAP_GRID: 地图网格数量（50x50格）
 * - MAP_SIZE: 地图总像素尺寸（TILE × MAP_GRID = 1600像素）
 */
const TILE = 32;                // 单个网格像素尺寸
const MAP_GRID = 50;            // 地图网格尺寸 50x50
const MAP_SIZE = MAP_GRID * TILE;// 地图总像素尺寸

// 设备像素比，适配高清屏幕（Retina显示屏）
let dpr = window.devicePixelRatio || 1;
// 视口宽度和高度（逻辑像素）
let w, h;

// =====================================================
// 游戏模式与工具
// =====================================================
// editMode: true = 编辑模式，false = 游玩模式
let editMode = true;
// currentTool: 当前选中的编辑工具类型
// 可选值: 'player'(出生点), 'block'(方块), 'spike'(尖刺), 'goal'(终点),
//         'erase'(擦除), 'jump'(梯子), 'tramp'(弹簧), 'boost'(加速带),
//         'ice'(冰面), 'oneway'(单向平台)
let currentTool = 'player';

// =====================================================
// 相机与鼠标系统
// =====================================================
// camera: 视图相机坐标，控制可视区域的偏移
let camera = { x: 0, y: 0 };

// mouse: 鼠标状态对象
// - screenX/screenY: 鼠标在屏幕上的坐标
// - worldX/worldY: 鼠标在世界坐标中的位置
// - gridX/gridY: 鼠标对齐到网格后的坐标
// - left/right: 鼠标左右键是否按下
// - dragPlacing: 是否正在拖拽放置方块
let mouse = {
    screenX: 0, screenY: 0,     // 鼠标屏幕坐标
    worldX: 0, worldY: 0,       // 鼠标世界坐标
    gridX: 0, gridY: 0,         // 鼠标网格对齐坐标
    left: false, right: false,  // 鼠标按键状态
    dragPlacing: false,          // 是否拖拽放置
    dragDeleting: false          // 是否拖拽删除
};

// keys: 键盘按键状态对象，存储每个按下的键
// 例如 keys['a'] = true 表示A键被按下
let keys = {};

// =====================================================
// 地图与出生点
// =====================================================
// map: 地图方块数组，每个元素包含 { x, y, type }
// - x, y: 方块左上角的世界坐标
// - type: 方块类型 ('block', 'spike', 'goal' 等)
let map = [];

// spawn: 玩家出生点位置
let spawn = { x: 5 * TILE, y: 5 * TILE }; // 默认出生在地图中央附近

// =====================================================
// 撤销重做历史
// =====================================================
// history: 历史记录数组，存储每次操作后的地图状态快照
const history = [];
// histIdx: 当前历史记录索引，指向最后一次操作的状态
let histIdx = -1;

// =====================================================
// 玩家物理属性
// =====================================================
// player: 玩家实体状态
// - x, y: 玩家位置（左上角）
// - w, h: 玩家宽高
// - vx, vy: 水平和垂直速度
// - grounded: 是否在地面上
// - dead: 是否死亡
// - jumpBuffer: 跳跃缓冲计数器（允许提前按键）
// - grace: coyote time计数器（离开地面后短时间内仍可跳跃）
// - onLadder: 是否在梯子上
// - jumps: 当前剩余跳跃次数（0=无跳跃，1=二段跳可用）
// - wallSlide: 是否沿墙下滑
// - jumpHeld: 是否按住跳跃键
// - jumpPressed: 是否刚按下跳跃键（用于预输入）
let player = {
    x: 5 * TILE, y: 5 * TILE, w: 20, h: 20,
    vx: 0, vy: 0, grounded: false, dead: false,
    jumpBuffer: 0, grace: 0, onLadder: false,
    jumps: 0, wallSlide: false, jumpHeld: false, jumpPressed: false,
    headStick: 0, jumpReleased: true  // jumpReleased: 是否已释放跳跃键（用于防止按住触发二段跳）
};

// =====================================================
// 物理常数（游戏平衡性参数）
// =====================================================
const GRAVITY = 0.65;           // 重力加速度
const MAX_FALL_SPEED = 15;     // 最大下落速度
const MOVE_SPEED = 4.5;          // 水平移动速度
const ACCELERATION = 0.5;        // 移动加速度
const LADDER_SPEED = 3.3;      // 攀爬梯子速度
const SPRING_BOUNCE = 15.0;     // 弹簧向上弹力
const SPRING_DOWN_BOUNCE = 5.5;// 弹簧向下弹力
const BOOST_BASE = 1.32;       // 加速带倍率
const MAX_HORIZ_SPEED = 5;    // 最大水平速度
const ICE_FRICTION = 0.99;     // 冰面摩擦系数（摩擦力非常小，滑行很远）
const NORMAL_FRICTION = 0.86;  // 普通地面摩擦系数（10帧停下 ≈ 0.86^10 ≈ 0.22）
const ICE_DECELERATION = 0.95; // 冰面减速系数（几乎不减速）
const NORMAL_DECELERATION = 0.8; // 普通地面减速系数
const AIR_DECELERATION = 0.92; // 空中减速系数
const ICE_MAX_SPEED = 7;      // 冰面最大速度
const MIN_SPEED_THRESHOLD = 0.1; // 微小速度阈值（低于此值归零）
const STOP_SPEED_THRESHOLD = 0.5; // 急停速度阈值（低于此值直接停下）
const FEET_DETECT_OFFSET = 2;  // 脚下检测偏移量（像素）
const WALL_PUSH_SPEED = 0.5;   // 沿墙时保持的微小水平速度（防止卡墙）
const WALL_PUSH_THRESHOLD = 1; // 触发沿墙推力的速度阈值
const WALL_JUMP_PUSH = 4;      // 蹬墙跳后推开玩家的距离（像素）
const TRAMP_COLLISION_THRESHOLD = 8; // 弹簧碰撞检测阈值（像素）
const DEATH_BOUNDARY = 100;    // 死亡检测边界（超出地图边界多少像素后死亡）
const RESPAWN_DELAY = 600;     // 死亡后重生延迟（毫秒）
const GOAL_DETECT_RANGE = 3;   // 终点检测范围（格子数）
const WIN_TOAST_DELAY = 100;   // 通关消息显示延迟（毫秒）
const WIN_TOAST_DURATION = 3000; // 通关消息显示时长（毫秒）

// =====================================================
// Celeste风格物理参数
// =====================================================
const JUMP_POWER = 12.0;       // 跳跃初速度（长按）
const JUMP_SHORT_POWER = 10.0; // 短跳初速度
const JUMP_RELEASE_GRAVITY = 0.1; // 松开跳跃键后的额外重力
const COYOTE_TIME = 8;         // Coyote时间（离开地面后仍可跳跃的帧数）
const JUMP_BUFFER = 12;        // 跳跃预输入缓冲帧数
const WALL_SLIDE_SPEED = 2.0;  // 沿墙下滑速度
const WALL_JUMP_X = 8.0;       // 狼跳水平推力
const WALL_JUMP_Y = -12.0;     // 狼跳垂直推力
const MAX_JUMPS = 2;           // 最大跳跃次数（含二段跳）
const HEAD_BOOP_VELOCITY = 0;  // 顶头时的反弹速度（设为0实现吸附）
const HEAD_STICK_FRAMES = 5;   // 顶头吸附帧数
const ONE_WAY_THRESHOLD = 0.1; // 单向板检测阈值（修复下落穿过问题）

// =====================================================
// 移动端适配
// =====================================================
// isMobile: 检测是否为移动设备
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
// CAM_SPEED: 编辑模式下相机移动速度（像素/帧）
const CAM_SPEED = 8;
