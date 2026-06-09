/**
 * =====================================================
 * map.js - 地图编辑模块
 * =====================================================
 * 
 * 负责地图的编辑操作和历史记录管理：
 * - 方块的放置与删除
 * - 撤销/重做功能
 * - 工具按钮绑定
 */

// =====================================================
// 历史记录管理
// =====================================================

/**
 * pushHistory - 保存当前地图状态到历史记录
 * 
 * 调用时机：
 * - 放置或删除方块后
 * - 放置出生点后
 * - 清空地图后
 * 
 * 实现逻辑：
 * 1. histIdx后移一位
 * 2. 删除当前位置之后的所有历史（丢弃被撤销的操作）
 * 3. 将当前状态转为JSON字符串存入数组
 */
function pushHistory() {
    histIdx++;                                    // 后移历史指针
    history.length = histIdx;                      // 截断后面被撤销的记录
    history.push(JSON.stringify({ map, spawn })); // 深拷贝当前状态
}

// =====================================================
// 地图编辑核心功能
// =====================================================

/**
 * placeTile - 放置或删除地图方块
 * 
 * 编辑模式下调用：
 * - 鼠标/触摸按下时
 * - 拖拽放置时
 * 
 * 逻辑分支：
 * 1. 右键或擦除工具：删除鼠标所在位置的方块
 * 2. 放置出生点：更新spawn坐标
 * 3. 放置其他方块：添加到map数组（避免重复）
 */
function placeTile() {
    if (!editMode) return;  // 仅编辑模式可用
    
    const x = mouse.gridX;  // 当前网格坐标
    const y = mouse.gridY;

    // ===== 右键删除方块 或 擦除工具 =====
    if (mouse.right || currentTool === 'erase') {
        // filter保留不匹配的元素，即删除x,y位置的方块
        map = map.filter(t => !(t.x === x && t.y === y));
        pushHistory();
        return;
    }
    
    // ===== 放置出生点 =====
    if (currentTool === 'player') {
        // 检查该位置是否有任何方块（不能放在任何非空地块上）
        const hasAnyTile = map.some(t => t.x === x && t.y === y);
        if (!hasAnyTile) {
            spawn = { x, y };
            pushHistory();
        }
        return;
    }
    
    // ===== 放置其他方块类型（包括存档点）=====
    // 检查该位置是否已有方块
    const exist = map.some(t => t.x === x && t.y === y);
    if (!exist) {
        map.push({ x, y, type: currentTool });
        pushHistory();
    }
}

/**
 * deleteTile - 删除指定位置的方块（用于右键拖拽删除）
 */
function deleteTile() {
    if (!editMode) return;  // 仅编辑模式可用
    
    const x = mouse.gridX;  // 当前网格坐标
    const y = mouse.gridY;
    
    // 删除该位置的方块
    const beforeLength = map.length;
    map = map.filter(t => !(t.x === x && t.y === y));
    
    // 只有实际删除了方块才记录历史
    if (map.length !== beforeLength) {
        pushHistory();
    }
}

// =====================================================
// 撤销/重做功能
// =====================================================

// 撤销按钮：回到上一个历史状态
document.getElementById('undo').onclick = () => {
    if (histIdx<=0) return;  // 没有更早的历史
    histIdx--;
    const d = JSON.parse(history[histIdx]);
    map = d.map;
    spawn = d.spawn;
};

// 重做按钮：前进到下一个历史状态
document.getElementById('redo').onclick = () => {
    if (histIdx>=history.length-1) return;  // 没有更晚的历史
    histIdx++;
    const d = JSON.parse(history[histIdx]);
    map = d.map;
    spawn = d.spawn;
};

// 清空地图按钮
document.getElementById('clear').onclick = () => {
    map = [];              // 清空所有方块
    pushHistory();         // 保存到历史
    showToast("✅ 地图已清空");
};

// =====================================================
// 工具按钮绑定
// =====================================================

// 工具ID与类型的映射关系
const toolList = {
    player:'player',   // 出生点工具
    block:'block',     // 方块工具
    spike:'spike',     // 尖刺工具
    goal:'goal',       // 终点工具
    checkpoint:'checkpoint', // 存档点工具
    jump:'jump',       // 梯子
    tramp:'tramp',     // 弹簧
    boost:'boost',     // 加速带
    ice:'ice',         // 冰面
    oneway:'oneway',   // 单向板
    erase:'erase'      // 擦除工具
};

/**
 * initToolButtons - 初始化工具按钮点击事件
 * 
 * 每个按钮点击时：
 * 1. 设置currentTool为对应的工具类型
 * 2. 移除所有按钮的active样式
 * 3. 给当前按钮添加active样式（蓝色背景）
 */
function initToolButtons() {
    for (let id in toolList) {
        document.getElementById(id).onclick = () => {
            currentTool = toolList[id];
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        };
    }
}
