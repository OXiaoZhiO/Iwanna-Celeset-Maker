/**
 * =====================================================
 * renderer.js - 画布渲染模块
 * =====================================================
 * 
 * 负责所有游戏元素的绘制，包括：
 * - 地图边界和网格
 * - 各种类型的方块（方块、尖刺、梯子、弹簧等）
 * - 玩家出生点标记
 * - 玩家角色
 * - 编辑模式下的鼠标选中框
 */

// 获取画布元素和2D渲染上下文
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/**
 * resizeCanvas - 调整画布尺寸以适配窗口
 * 
 * 功能说明：
 * - 获取窗口的逻辑尺寸（w, h）
 * - 根据设备像素比（dpr）设置画布实际像素尺寸
 * - 这确保在Retina等高清屏幕上渲染清晰
 * 
 * 高清屏幕适配原理：
 * - dpr = 2 表示每1个CSS像素对应2个物理像素
 * - 设置canvas.width = w * dpr 使画布有更多物理像素
 * - 使用ctx.setTransform保持坐标系一致
 */
function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;  // 获取设备像素比
    w = window.innerWidth;                // 视口宽度
    h = window.innerHeight;              // 视口高度
    
    // 设置画布实际像素尺寸
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    
    // 设置CSS显示尺寸
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    
    // 重置变换矩阵，适配高清屏幕
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * draw - 主渲染函数，每帧调用
 * 
 * 渲染层次（从后到前）：
 * 1. 背景清空
 * 2. 地图边界框（红色外框 + 黑色内框）
 * 3. 网格线
 * 4. 所有地图方块
 * 5. 出生点标记（蓝色圆点）
 * 6. 编辑模式：鼠标选中框（白色虚线）
 * 7. 游戏模式：玩家角色
 */
function draw() {
    // 清空画布
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    
    // 应用相机偏移，实现视角滚动
    ctx.translate(-camera.x, -camera.y);

    // ===== 绘制地图边界 =====
    // 外框：红色粗线
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
    
    // 内框：黑色细线
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, MAP_SIZE - 6, MAP_SIZE - 6);

    // ===== 绘制网格线 =====
    ctx.strokeStyle = '#0f0f0f';  // 几乎不可见的深灰色
    
    // 垂直网格线
    for (let x = 0; x <= MAP_SIZE; x += TILE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_SIZE);
        ctx.stroke();
    }
    
    // 水平网格线
    for (let y = 0; y <= MAP_SIZE; y += TILE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_SIZE, y);
        ctx.stroke();
    }

    // ===== 绘制地图所有方块 =====
    // 遍历map数组，根据type绘制不同方块
    map.forEach(t => {
        const x = t.x, y = t.y;
        switch (t.type) {
            // 方块：灰色实心方块
            case 'block':
                ctx.fillStyle = '#666';
                ctx.fillRect(x, y, TILE, TILE);
                ctx.strokeStyle = '#222';
                ctx.strokeRect(x, y, TILE, TILE);
                break;
            
            // 尖刺：红色三角形（朝上）
            case 'spike':
                ctx.fillStyle = '#ff2222';
                ctx.beginPath();
                ctx.moveTo(x + TILE/2, y);           // 顶点
                ctx.lineTo(x + TILE, y + TILE);     // 右下角
                ctx.lineTo(x, y + TILE);            // 左下角
                ctx.closePath();
                ctx.fill();
                break;
            
            // 梯子：棕色栏杆造型
            case 'jump':
                ctx.fillStyle = '#8B4513';
                // 左右两根立柱
                ctx.fillRect(x + 3, y, 5, TILE);
                ctx.fillRect(x + TILE - 8, y, 5, TILE);
                // 三根横档
                ctx.fillRect(x + 3, y + 7, TILE - 6, 3);
                ctx.fillRect(x + 3, y + 15, TILE - 6, 3);
                ctx.fillRect(x + 3, y + 23, TILE - 6, 3);
                break;
            
            // 弹簧：带黄色弹簧线的金属底座
            case 'tramp':
                // 金属底座
                ctx.fillStyle = '#777';
                ctx.fillRect(x + 4, y, TILE - 8, 5);
                ctx.fillRect(x + 6, y + TILE - 6, TILE - 12, 6);
                // 弹簧线
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                let cx = x + TILE / 2;
                for(let i = 0; i < 4; i++){
                    let off = i * 6;
                    ctx.moveTo(cx - 8, y + TILE - 8 - off);
                    ctx.lineTo(cx + 8, y + TILE - 12 - off);
                }
                ctx.stroke();
                break;
            
            // 加速带：橙色背景 + 白色箭头
            case 'boost':
                ctx.fillStyle = '#ff9900';
                ctx.fillRect(x, y, TILE, TILE);
                ctx.fillStyle = '#fff';
                // 三个向右箭头
                for(let i=0;i<3;i++){
                    let ox = x + 8 + i*6;
                    ctx.beginPath();
                    ctx.moveTo(ox, y+10);
                    ctx.lineTo(ox+6, y+16);
                    ctx.lineTo(ox, y+22);
                    ctx.fill();
                }
                break;
            
            // 冰面：浅蓝色半透明
            case 'ice':
                ctx.fillStyle = '#a0d8ff';
                ctx.fillRect(x, y, TILE, TILE);
                // 高光条纹
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(x + 4, y + 8, TILE - 8, 4);
                ctx.fillRect(x + 8, y + 18, TILE - 16, 3);
                break;
            
            // 单向平台：紫色半透明薄板 + 向上箭头
            case 'oneway':
                ctx.fillStyle = '#b277ff';
                const thinH = TILE * 0.4;  // 高度为格子40%
                ctx.fillRect(x, y, TILE, thinH);
                // 向上箭头
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(x + TILE/2, y + 3);
                ctx.lineTo(x + TILE/2 - 5, y + 10);
                ctx.lineTo(x + TILE/2 + 5, y + 10);
                ctx.closePath();
                ctx.fill();
                break;
            
            // 终点：旗杆 + 红色旗帜
            case 'goal':
                // 旗杆（黄色），触地
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(x + 14, y, 4, TILE);
                // 红色三角形旗帜
                ctx.fillStyle = '#ff2222';
                ctx.beginPath();
                ctx.moveTo(x + 18, y + 4);
                ctx.lineTo(x + TILE - 4, y + TILE * 0.35);
                ctx.lineTo(x + 18, y + TILE * 0.7);
                ctx.closePath();
                ctx.fill();
                break;
            
            // 存档点：绿色/黄色旗帜，旗杆触地
            case 'checkpoint':
                // 旗杆（灰色），触地
                ctx.fillStyle = '#666';
                ctx.fillRect(x + 14, y, 4, TILE);
                // 根据是否激活选择颜色（绿色或黄色）
                const checkpointActive = lastCheckpoint && 
                    lastCheckpoint.x === t.x && lastCheckpoint.y === t.y;
                ctx.fillStyle = checkpointActive ? '#ffff00' : '#00ff00';
                ctx.beginPath();
                ctx.moveTo(x + 18, y + 4);
                ctx.lineTo(x + TILE - 4, y + TILE * 0.35);
                ctx.lineTo(x + 18, y + TILE * 0.7);
                ctx.closePath();
                ctx.fill();
                break;
        }
    });

    // ===== 绘制出生点标记 =====
    // 蓝色圆点表示玩家出生位置
    ctx.fillStyle = '#00aaff';
    ctx.beginPath();
    ctx.arc(spawn.x + TILE/2, spawn.y + TILE/2, 8, 0, Math.PI * 2);
    ctx.fill();

    // ===== 编辑模式：绘制鼠标选中框 =====
    // 白色虚线框显示当前网格位置
    if (editMode) {
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([5, 3]);  // 5像素线段，3像素间隔
        ctx.strokeRect(mouse.gridX, mouse.gridY, TILE, TILE);
        ctx.setLineDash([]);      // 重置虚线样式
    }

    // ===== 游戏模式：绘制玩家 =====
    // 玩家模型：圆形，带眼睛和描边
    if (!editMode) {
        // 计算眼睛方向（面向移动方向）
        let eyeDirection = player.vx > 0.1 ? 1 : (player.vx < -0.1 ? -1 : 0);
        if (eyeDirection === 0) {
            eyeDirection = 1; // 默认朝右
        }
        
        // 确定描边颜色：有二段跳时橙红色，没有时蓝色
        const hasDoubleJump = player.jumps < MAX_JUMPS - 1;
        const outlineColor = hasDoubleJump ? '#ff6600' : '#00aaff';
        
        // 绘制外发光效果
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = 8;
        
        // 绘制描边
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + 10, player.y + 10, 11, 0, Math.PI * 2);
        ctx.stroke();
        
        // 关闭阴影，绘制主体
        ctx.shadowBlur = 0;
        ctx.fillStyle = player.dead ? '#ff2222' : '#ffffff';
        ctx.beginPath();
        ctx.arc(player.x + 10, player.y + 10, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制眼睛
        ctx.fillStyle = '#333';
        const eyeOffset = eyeDirection * 3;
        // 左眼
        ctx.beginPath();
        ctx.arc(player.x + 6 + eyeOffset, player.y + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // 右眼
        ctx.beginPath();
        ctx.arc(player.x + 14 + eyeOffset, player.y + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制眼睛高光
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(player.x + 6.5 + eyeOffset, player.y + 7.5, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(player.x + 14.5 + eyeOffset, player.y + 7.5, 1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();  // 恢复坐标系，撤销camera的translate
}
