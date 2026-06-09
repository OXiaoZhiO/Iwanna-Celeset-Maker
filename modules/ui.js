/**
 * =====================================================
 * ui.js - 用户界面模块
 * =====================================================
 * 
 * 负责游戏界面元素的管理：
 * - 提示框（Toast）系统
 * - HUD显示更新
 * - 模式切换（编辑/游戏）
 * - 全屏功能
 */

// =====================================================
// 提示框系统
// =====================================================

// 获取提示框DOM元素
const toast = document.getElementById('gameToast');
let toastTimer = null;  // 定时器，用于自动隐藏

/**
 * showToast - 显示提示信息
 * @param {string} msg - 要显示的消息
 * @param {number} duration - 显示时长（毫秒），默认1500ms
 * 
 * 效果：
 * - 添加'show'类触发CSS过渡显示
 * - 自动隐藏（清除之前的定时器）
 */
function showToast(msg, duration = 1500) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// =====================================================
// 游戏HUD更新
// =====================================================

/**
 * updateHud - 更新游戏HUD显示
 * 
 * 显示内容：
 * - 玩家坐标（像素和网格单位）
 * - 玩家速度
 * - 玩家状态
 * - 脚下方块类型
 * - 死亡计数
 * - 游戏计时
 */
function updateHud() {
    const hud = document.getElementById('gameHud');
    if (!hud) return;
    
    // 转换像素坐标为网格坐标
    const x = (player.x / TILE).toFixed(1);
    const y = (player.y / TILE).toFixed(1);
    const vx = player.vx.toFixed(2);
    const vy = player.vy.toFixed(2);
    
    // 状态文本
    const state = player.grounded ? '地面' : '空中';
    const dead = player.dead ? '死亡' : '正常';
    const tile = getCurrentTile();
    
    // 格式化时间显示
    const timeStr = formatTime(gameTime);
    
    // 更新HUD HTML
    hud.innerHTML = `
        坐标：X ${x} , Y ${y}<br>
        速度：VX ${vx} , VY ${vy}<br>
        状态：${state} / ${dead}<br>
        脚下：${tile}<br>
        死亡：${deathCount} 次<br>
        计时：${timeStr}
    `;
}

// =====================================================
// 模式切换
// =====================================================

// 获取UI元素
const gameHud = document.getElementById('gameHud'); // 游戏HUD
const topGroup = document.getElementById('topGroup'); // 右上角按钮组

/**
 * toggleMode - 切换编辑模式与游戏模式
 * 
 * 【编辑模式 → 游戏模式】
 * - 重置相机到原点
 * - 更新UI文本
 * - 显示/隐藏对应元素
 * - 调用respawn重置玩家位置
 * 
 * 【游戏模式 → 编辑模式】
 * - 相机归零
 * - 切换UI显示
 */
function toggleMode() {
    editMode = !editMode;
    
    if (editMode) {
        // 切换到编辑模式
        // 摄像机移动到出生点位置（居中显示）
        camera.x = spawn.x - canvas.width / 2 + TILE / 2;
        camera.y = spawn.y - canvas.height / 2 + TILE / 2;
        document.getElementById('modeText').innerText = '编辑模式';
        document.getElementById('btnToggle').innerText = '切换游玩';
        topGroup.style.display = 'none';
        gameHud.style.display = 'none';
        document.body.classList.add('edit-mode');
        document.body.classList.remove('play-mode');
        // 显示工具栏（不关闭，保持打开状态）
        openToolWindow();
        // 地图管理窗口保持当前状态（不强制关闭）
        // 重置存档点
        lastCheckpoint = null;
        // 停止计时器
        stopGameTimer();
        // 重置玩家位置到起点
        respawn();
    } else {
        // 切换到游戏模式
        document.getElementById('modeText').innerText = '游玩模式';
        document.getElementById('btnToggle').innerText = '切换编辑';
        topGroup.style.display = 'flex';
        gameHud.style.display = 'block';
        document.body.classList.remove('edit-mode');
        document.body.classList.add('play-mode');
        // 隐藏工具栏
        closeToolWindow();
        // 隐藏地图管理窗口
        closeMapManager();
        // 重置存档点
        lastCheckpoint = null;
        // 开始计时器
        startGameTimer();
        respawn();  // 重置玩家位置
    }
    
    // 更新移动端UI
    updateMobileUI();
}

// 绑定模式切换按钮
document.getElementById('btnToggle').onclick = toggleMode;

// =====================================================
// 全屏功能
// =====================================================

// 获取全屏按钮
const fullBtn = document.getElementById('btnFullscreen');

/**
 * 全屏按钮点击处理
 * - 无全屏时：请求全屏，更新按钮文本
 * - 有全屏时：退出全屏，更新按钮文本
 * - 全屏状态变化时：调整画布尺寸
 */
fullBtn.onclick = () => {
    if (!document.fullscreenElement) {
        // 请求进入全屏
        document.documentElement.requestFullscreen().then(resizeCanvas).catch(()=>{});
        fullBtn.textContent = "⛶ 全屏";
    } else {
        // 退出全屏
        document.exitFullscreen();
        fullBtn.textContent = "⛶ 全屏";
    }
};

// 监听全屏状态变化，重新调整画布
window.addEventListener('fullscreenchange', resizeCanvas);

// =====================================================
// 虚拟按钮开关
// =====================================================

// 虚拟按钮状态（默认根据设备类型决定）
let mobileEnabled = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const mobileBtn = document.getElementById('btnMobile');

/**
 * 切换虚拟按钮显示
 * - 移动端默认开启
 * - PC端默认关闭
 * - 用户可手动切换
 */
function updateMobileUI() {
    if (mobileEnabled) {
        mobileBtn.classList.add('active');
        mobileBtn.textContent = '🎮 虚拟按钮 ✓';
        // 显示虚拟按钮
        document.querySelectorAll('.mobile-btn').forEach(btn => {
            btn.style.display = 'block';
        });
        // 初始化虚拟按键绑定（确保PC端也能使用）
        if (typeof initMobileKeys === 'function') {
            initMobileKeys();
        }
    } else {
        mobileBtn.classList.remove('active');
        mobileBtn.textContent = '🎮 虚拟按钮';
        // 隐藏虚拟按钮
        document.querySelectorAll('.mobile-btn').forEach(btn => {
            btn.style.display = 'none';
        });
    }
}

mobileBtn.onclick = () => {
    mobileEnabled = !mobileEnabled;
    updateMobileUI();
};

// 初始更新
updateMobileUI();

// =====================================================
// 翻页式工具栏
// =====================================================

let currentPage = 1;
const totalPages = 3;

function updatePage() {
    // 更新页面显示
    for (let i = 1; i <= totalPages; i++) {
        const page = document.getElementById('page' + i);
        if (page) {
            page.classList.toggle('active', i === currentPage);
        }
    }
    // 更新页码显示
    const indicator = document.getElementById('pageIndicator');
    if (indicator) {
        indicator.textContent = currentPage + '/' + totalPages;
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        updatePage();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updatePage();
    }
}

// 绑定翻页按钮
document.getElementById('pageNext').onclick = nextPage;
document.getElementById('pagePrev').onclick = prevPage;

// =====================================================
// 地图管理窗口
// =====================================================

const mapManagerWindow = document.getElementById('mapManagerWindow');
const openMapManagerBtn = document.getElementById('openMapManager');

function openMapManager() {
    mapManagerWindow.classList.add('show');
    openMapManagerBtn.style.display = 'none'; // 打开窗口后隐藏展开按钮
}

function closeMapManager() {
    mapManagerWindow.classList.remove('show');
    openMapManagerBtn.style.display = 'inline-block'; // 关闭窗口后显示展开按钮
}

// 绑定按钮
openMapManagerBtn.onclick = openMapManager;
document.getElementById('closeMapManager').onclick = closeMapManager;

// 阻止地图管理窗口内按钮点击事件冒泡
mapManagerWindow.addEventListener('click', (e) => {
    e.stopPropagation();
});

// =====================================================
// 工具栏窗口
// =====================================================

const toolWindow = document.getElementById('toolWindow');
const toolToggleBtn = document.getElementById('toolToggleBtn');

function openToolWindow() {
    toolWindow.classList.add('show');
    toolToggleBtn.textContent = '📂';
    toolToggleBtn.style.display = 'none'; // 打开窗口后隐藏展开按钮
}

function closeToolWindow() {
    toolWindow.classList.remove('show');
    toolToggleBtn.textContent = '📂'; // 文件夹图标
    toolToggleBtn.style.display = 'flex'; // 关闭窗口后显示展开按钮
}

function toggleToolWindow() {
    // 点击按钮只打开窗口，不关闭
    // 关闭只能通过窗口内的×按钮
    if (!toolWindow.classList.contains('show')) {
        openToolWindow();
    }
}

// 绑定按钮
toolToggleBtn.onclick = toggleToolWindow;
document.getElementById('closeToolWindow').onclick = closeToolWindow;

// 阻止工具栏窗口内按钮点击事件冒泡
toolWindow.addEventListener('click', (e) => {
    e.stopPropagation();
});

// =====================================================
// 提示消息
// =====================================================
