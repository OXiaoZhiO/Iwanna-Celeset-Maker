/**
 * =====================================================
 * main.js - 游戏入口模块
 * =====================================================
 * 
 * 游戏的初始化和主循环：
 * - init(): 初始化所有系统
 * - loop(): 60fps游戏主循环
 */

// =====================================================
// 初始化
// =====================================================

/**
 * init - 游戏初始化函数
 * 
 * 调用时机：游戏加载时只调用一次
 * 初始化内容：
 * 1. 设置画布尺寸
 * 2. 初始化历史记录
 * 3. 绑定工具按钮
 * 4. 绑定相机控制
 * 5. 设置移动端UI
 * 6. 加载默认地图
 * 7. 监听窗口大小变化
 */
function init() {
    resizeCanvas();          // 初始化画布
    pushHistory();           // 初始化历史记录（空地图状态）
    initToolButtons();       // 初始化工具按钮
    initCameraControls();    // 初始化相机控制
    updateMobileUI();        // 初始化移动端UI
    loadDefaultMap();        // 加载默认地图
    window.addEventListener('resize', resizeCanvas);  // 窗口大小变化时调整画布
    openToolWindow();       // 默认展开工具栏
    openMapManager();       // 默认展开地图管理窗口
    document.body.classList.add('edit-mode'); // 初始为编辑模式
    // 初始化坐标显示
    const coordText = document.getElementById('coordText');
    if (coordText) {
        coordText.textContent = `坐标：0 , 0`;
    }
}

// =====================================================
// 主循环
// =====================================================

/**
 * loop - 游戏主循环
 * 
 * 每帧执行（约60fps，使用requestAnimationFrame）：
 * 1. updateCamera() - 更新相机位置
 * 2. physics() - 更新玩家物理
 * 3. draw() - 渲染画面
 * 4. updateHud() - 更新游戏HUD（仅游戏模式）
 * 5. updateCoordDisplay() - 更新坐标显示（仅编辑模式）
 * 
 * 然后请求下一帧，形成无限循环
 */
function loop() {
    updateCamera();  // 更新相机
    physics();       // 物理更新
    draw();          // 渲染画面
    if (!editMode) updateHud();  // 仅游戏模式更新HUD
    if (editMode) updateCoordDisplay();  // 仅编辑模式更新坐标显示
    requestAnimationFrame(loop); // 请求下一帧
}

/**
 * updateCoordDisplay - 更新坐标显示为鼠标所在方块坐标
 */
function updateCoordDisplay() {
    const coordText = document.getElementById('coordText');
    if (coordText) {
        const gridX = Math.floor(mouse.gridX / TILE);
        const gridY = Math.floor(mouse.gridY / TILE);
        coordText.textContent = `坐标：${gridX} , ${gridY}`;
    }
}

// =====================================================
// 启动游戏
// =====================================================

// 初始化并启动游戏循环
init();
loop();
