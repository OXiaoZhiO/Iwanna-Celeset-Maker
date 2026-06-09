/**
 * =====================================================
 * input.js - 输入处理模块
 * =====================================================
 * 
 * 负责处理所有用户输入：
 * - 鼠标输入（桌面端编辑）
 * - 触摸输入（移动端编辑和游戏）
 * - 键盘输入（移动和功能键）
 * - 虚拟按键（移动端摇杆）
 */

// =====================================================
// 鼠标坐标更新函数
// =====================================================

/**
 * updateMouseWorld - 更新鼠标的世界坐标
 * 
 * 世界坐标 = 屏幕坐标 + 相机偏移
 * 用于确定鼠标在游戏世界中的实际位置
 */
function updateMouseWorld() {
    mouse.worldX = mouse.screenX + camera.x;
    mouse.worldY = mouse.screenY + camera.y;
}

/**
 * updateMouseGrid - 更新鼠标的网格对齐坐标
 * 
 * 功能：
 * - 将世界坐标转换为网格坐标
 * - 向下取整确保对齐到网格左上角
 * - 边界限制防止超出地图范围
 */
function updateMouseGrid() {
    // 向下取整并乘以TILE得到网格左上角坐标
    let gx = Math.floor(mouse.worldX / TILE) * TILE;
    let gy = Math.floor(mouse.worldY / TILE) * TILE;
    
    // 限制在地图范围内
    mouse.gridX = Math.max(0, Math.min(MAP_SIZE - TILE, gx));
    mouse.gridY = Math.max(0, Math.min(MAP_SIZE - TILE, gy));
}

/**
 * updateMouse - 统一更新鼠标所有坐标
 * 
 * 流程：
 * 1. 获取鼠标相对画布的屏幕坐标
 * 2. 转换为世界坐标
 * 3. 对齐到网格
 */
function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.screenX = e.clientX - rect.left;
    mouse.screenY = e.clientY - rect.top;
    updateMouseWorld();
    updateMouseGrid();
}

// =====================================================
// 鼠标编辑事件
// =====================================================

// 鼠标移动：更新坐标，拖拽时放置/删除方块
canvas.addEventListener('mousemove', e => {
    updateMouse(e);
    if(mouse.dragPlacing && editMode) placeTile();
    if(mouse.dragDeleting && editMode) deleteTile();
});

// 鼠标进入：更新初始坐标
canvas.addEventListener('mouseenter', e => {
    updateMouse(e);
});

// 鼠标按下：左键放置/右键删除
canvas.addEventListener('mousedown', e => {
    updateMouse(e);
    if(e.button === 0){  // 左键
        mouse.left = true;
        mouse.dragPlacing = true;
        placeTile();
    }
    if(e.button === 2){  // 右键
        mouse.right = true;
        mouse.dragDeleting = true;
        mouse.dragPlacing = false; // 右键时取消左键放置
        deleteTile();
    }
});

// 鼠标释放：停止放置/删除
canvas.addEventListener('mouseup', e => {
    if(e.button === 0) { mouse.left = false; mouse.dragPlacing = false; }
    if(e.button === 2) { mouse.right = false; mouse.dragDeleting = false; }
});

// 禁用右键菜单
canvas.addEventListener('contextmenu', e => e.preventDefault());

// =====================================================
// 触摸编辑事件
// =====================================================
// 触摸事件用于移动设备和平板

// 触摸开始：更新坐标，开始拖拽放置
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];  // 获取第一个触点
    const evt = { clientX: touch.clientX, clientY: touch.clientY };
    updateMouse(evt);
    mouse.dragPlacing = true;
    placeTile();
});

// 触摸移动：更新坐标，拖拽时放置
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const evt = { clientX: touch.clientX, clientY: touch.clientY };
    updateMouse(evt);
    if(mouse.dragPlacing && editMode) placeTile();
    if(mouse.dragDeleting && editMode) deleteTile();
});

// 触摸结束：停止放置
canvas.addEventListener('touchend', e => {
    e.preventDefault();
    mouse.dragPlacing = false;
});

canvas.addEventListener('touchcancel', e => {
    e.preventDefault();
    mouse.dragPlacing = false;
});

// =====================================================
// 键盘事件
// =====================================================

// 键盘按下：记录按键状态，响应功能键
window.addEventListener('keydown', e => {
    keys[e.key] = true;  // 记录按键状态
    
    // ESC：切换编辑/游戏模式
    if(e.key==='Escape') toggleMode();
    
    // R：复活玩家
    if(e.key==='r') respawn();
    
    // 跳跃按键：只有在释放过跳跃键后才能再次触发
    if ((e.key === ' ' || e.key === 'w' || e.key === 'ArrowUp') && !editMode && player.jumpReleased) {
        player.jumpPressed = true;
        player.jumpHeld = true;
        player.jumpReleased = false; // 标记已按下，未释放
    }
});

// 键盘释放：清除按键状态
window.addEventListener('keyup', e => { 
    keys[e.key] = false; 
    // 跳跃按键释放
    if (e.key === ' ' || e.key === 'w' || e.key === 'ArrowUp') {
        player.jumpHeld = false;
        player.jumpReleased = true; // 标记已释放
    }
});

// =====================================================
// 移动端虚拟按键
// =====================================================

// 获取虚拟按键DOM元素
const leftBtn = document.getElementById('mobileLeft');    // 左移
const rightBtn = document.getElementById('mobileRight');  // 右移
const jumpBtn = document.getElementById('mobileJump');     // 跳跃
const downBtn = document.getElementById('mobileDown');    // 下蹲/下梯子

/**
 * bindMobileKey - 绑定虚拟按键
 * @param {HTMLElement} btn - 虚拟按键元素
 * @param {string[]} keyList - 对应的键盘按键列表
 * 
 * 功能：
 * - ontouchstart: 按下时设置keys中对应按键为true
 * - ontouchend: 释放时设置keys中对应按键为false
 * - onclick: 支持鼠标点击（用于PC端测试）
 * - 阻止默认行为避免页面滚动
 */
function bindMobileKey(btn, keyList) {
    btn.ontouchstart = (e) => {
        e.preventDefault();
        keyList.forEach(k => {
            keys[k] = true;
            // 跳跃键特殊处理
            if ((k === ' ' || k === 'w') && !editMode && player.jumpReleased) {
                player.jumpPressed = true;
                player.jumpHeld = true;
                player.jumpReleased = false;
            }
        });
    };
    btn.ontouchend = (e) => {
        e.preventDefault();
        keyList.forEach(k => {
            keys[k] = false;
            // 跳跃键释放
            if (k === ' ' || k === 'w') {
                player.jumpHeld = false;
                player.jumpReleased = true;
            }
        });
    };
    btn.ontouchcancel = btn.ontouchend;  // 取消时等同于释放
    
    // 添加鼠标点击支持（PC端也能使用虚拟按键）
    btn.onmousedown = (e) => {
        e.preventDefault();
        keyList.forEach(k => {
            keys[k] = true;
            // 跳跃键特殊处理
            if ((k === ' ' || k === 'w') && !editMode && player.jumpReleased) {
                player.jumpPressed = true;
                player.jumpHeld = true;
                player.jumpReleased = false;
            }
        });
    };
    btn.onmouseup = (e) => {
        e.preventDefault();
        keyList.forEach(k => {
            keys[k] = false;
            // 跳跃键释放
            if (k === ' ' || k === 'w') {
                player.jumpHeld = false;
                player.jumpReleased = true;
            }
        });
    };
    btn.onmouseleave = btn.onmouseup;  // 离开按钮时释放
}

/**
 * initMobileKeys - 初始化虚拟按键绑定
 * 无论移动端还是PC端，只要mobileEnabled为true就绑定
 */
function initMobileKeys() {
    bindMobileKey(leftBtn,  ['a']);      // A键 = 左移
    bindMobileKey(rightBtn, ['d']);      // D键 = 右移
    bindMobileKey(jumpBtn,  [' ', 'w']); // 空格/W = 跳跃
    bindMobileKey(downBtn,  ['s']);      // S键 = 下蹲
}

// 移动设备上默认绑定虚拟按键
if (isMobile) {
    initMobileKeys();
}

// =====================================================
// 编辑模式相机移动按钮（移动端）
// =====================================================

// 获取相机控制按钮DOM元素
const camGroup = document.getElementById('camGroup');  // 按钮组容器
const camUp = document.getElementById('camUp');       // 向上
const camDown = document.getElementById('camDown');  // 向下
const camLeft = document.getElementById('camLeft');  // 向左
const camRight = document.getElementById('camRight');// 向右

/**
 * bindCamBtn - 绑定相机移动按钮
 * @param {HTMLElement} btn - 按钮元素
 * @param {number} dx - 水平移动量
 * @param {number} dy - 垂直移动量
 * 
 * 使用requestAnimationFrame实现平滑连续移动
 * 按住按钮时持续移动，松开时停止
 */
function bindCamBtn(btn, dx, dy) {
    let pressing = false;  // 是否正在按住
    
    function update() {
        // 如果松开或退出编辑模式，停止移动
        if (!pressing || !editMode) return;
        
        // 移动相机
        camera.x += dx;
        camera.y += dy;
        
        // 限制相机在地图范围内
        camera.x = Math.max(0, Math.min(MAP_SIZE - w, camera.x));
        camera.y = Math.max(0, Math.min(MAP_SIZE - h, camera.y));
        
        // 继续移动
        requestAnimationFrame(update);
    }
    
    btn.ontouchstart = (e) => { e.preventDefault(); pressing = true; update(); };
    btn.ontouchend = (e) => { e.preventDefault(); pressing = false; };
    btn.ontouchcancel = () => { pressing = false; };
}

/**
 * initCameraControls - 初始化相机控制按钮
 * 绑定上下左右四个方向的相机移动
 */
function initCameraControls() {
    bindCamBtn(camUp, 0, -CAM_SPEED);    // 上：y减小
    bindCamBtn(camDown, 0, CAM_SPEED);    // 下：y增大
    bindCamBtn(camLeft, -CAM_SPEED, 0);  // 左：x减小
    bindCamBtn(camRight, CAM_SPEED, 0);  // 右：x增大
}

/**
 * updateMobileUI - 更新移动端UI显示状态
 * 
 * 根据当前模式（编辑/游戏）显示/隐藏不同的控制元素：
 * - 编辑模式：显示相机控制，隐藏游戏虚拟按键
 * - 游戏模式：隐藏相机控制，显示游戏虚拟按键
 */
function updateMobileUI() {
    if (isMobile) {
        camGroup.style.display = editMode ? "block" : "none";
        leftBtn.style.display = editMode ? 'none' : 'block';
        rightBtn.style.display = editMode ? 'none' : 'block';
        jumpBtn.style.display = editMode ? 'none' : 'block';
        downBtn.style.display = editMode ? 'none' : 'block';
    }
}
