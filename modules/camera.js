/**
 * =====================================================
 * camera.js - 相机系统模块
 * =====================================================
 * 
 * 相机控制游戏世界的可视区域
 * 两种模式：
 * - 编辑模式：用户通过键盘或按钮手动控制相机
 * - 游戏模式：相机平滑跟随玩家
 */

/**
 * updateCamera - 更新相机位置
 * 
 * 【编辑模式】
 * - 使用WASD或方向键移动相机
 * - 相机移动速度由CAM_SPEED定义
 * - 限制相机不能超出地图边界
 * 
 * 【游戏模式】
 * - 相机目标位置：玩家居中
 * - 使用线性插值（lerp）实现平滑跟随
 * - 0.2的系数使跟随有一定的惯性
 * - 同样限制在地图边界内
 */
function updateCamera() {
    // ===== 编辑模式：手动控制相机 =====
    if (editMode) {
        const spd = CAM_SPEED;
        
        // 水平移动（A/D或方向键）
        if (keys['a'] || keys['ArrowLeft']) camera.x -= spd;
        if (keys['d'] || keys['ArrowRight']) camera.x += spd;
        
        // 垂直移动（W/S或方向键）
        if (keys['w'] || keys['ArrowUp']) camera.y -= spd;
        if (keys['s'] || keys['ArrowDown']) camera.y += spd;
        
        // 限制相机范围：不能小于0，不能超过地图边界
        camera.x = Math.max(0, Math.min(MAP_SIZE - w, camera.x));
        camera.y = Math.max(0, Math.min(MAP_SIZE - h, camera.y));
        return;
    }
    
    // ===== 游戏模式：跟随玩家 =====
    
    // 计算目标位置（玩家居中）
    const tarX = player.x - w / 2 + player.w / 2;
    const tarY = player.y - h / 2 + player.h / 2;
    
    // 平滑跟随：当前坐标向目标坐标移动20%
    // 公式：newPos = oldPos + (targetPos - oldPos) * factor
    camera.x += (tarX - camera.x) * 0.2;
    camera.y += (tarY - camera.y) * 0.2;
    
    // 限制在地图边界内
    camera.x = Math.max(0, Math.min(MAP_SIZE - w, camera.x));
    camera.y = Math.max(0, Math.min(MAP_SIZE - h, camera.y));
}
