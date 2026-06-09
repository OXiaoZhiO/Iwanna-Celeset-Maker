/**
 * =====================================================
 * player.js - 玩家物理与碰撞模块（Celeste风格）
 * =====================================================
 * 
 * 实现Celeste风格的玩家物理系统：
 * - 跳跃宽限期（Coyote Time）
 * - 狼跳（Wall Jump）
 * - 预输入跳（Jump Buffer）
 * - 短按小跳/长按大跳
 * - 二段跳
 * - 顶头跳修正
 * - 沿墙下落速度减慢
 * - 修复下落过快穿过单向板
 */

// =====================================================
// 游戏统计变量
// =====================================================
let deathCount = 0;        // 死亡次数
let gameTime = 0;          // 游戏时间（毫秒）
let timerInterval = null;  // 计时器interval ID

/**
 * startGameTimer - 开始游戏计时器
 */
function startGameTimer() {
    deathCount = 0;
    gameTime = 0;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!editMode && !player.dead) {
            gameTime += 100;
        }
    }, 100);
}

/**
 * stopGameTimer - 停止游戏计时器
 */
function stopGameTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * incrementDeathCount - 增加死亡计数
 */
function incrementDeathCount() {
    deathCount++;
}

/**
 * formatTime - 格式化时间显示
 * 格式：分分:秒秒:毫毫（精确到0.01秒）
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // 毫秒部分（精确到0.01秒，即百分秒）
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
}

// =====================================================
// 碰撞检测辅助函数
// =====================================================

/**
 * getFeetTile - 获取玩家脚下的方块
 * 
 * @returns {Object|null} 脚下的方块，未踩在任何方块上返回null
 */
function getFeetTile() {
    // 检测玩家底部中心位置的方块
    const footX = player.x + player.w / 2;
    // 检测玩家底部以下指定像素的位置（确保能检测到脚下的方块）
    const footY = player.y + player.h + FEET_DETECT_OFFSET;
    
    for (let t of map) {
        let tx = t.x, ty = t.y;
        if (footX >= tx && footX < tx + TILE &&
            footY >= ty && footY < ty + TILE) {
            return t;
        }
    }
    return null;
}

/**
 * getCurrentTile - 获取脚下方块的中文名称（用于HUD显示）
 */
function getCurrentTile() {
    let feet = getFeetTile();
    if (feet) {
        switch(feet.type){
            case 'block': return '方块';
            case 'ice': return '冰面';
            case 'spike': return '尖刺';
            case 'tramp': return '弹簧';
            case 'jump': return '梯子';
            case 'oneway': return '单向板';
            case 'boost': return '传送带';
            case 'goal': return '终点';
            default: return '未知';
        }
    }
    return '无';
}

/**
 * checkSpikeCollision - 尖刺精确碰撞检测（三角形）
 * 
 * 尖刺模型：等腰三角形，底边在下方，顶点在上
 * 玩家模型：20x20像素的圆形（实际碰撞盒是20x20的正方形）
 * 
 * 检测逻辑：检查玩家碰撞盒的四个角和中心点是否在尖刺三角形内
 */
function checkSpikeCollision(p, spike) {
    const sx = spike.x;
    const sy = spike.y;
    const sw = TILE;
    const sh = TILE;
    
    // 尖刺三角形的三个顶点
    const v1 = { x: sx + sw/2, y: sy };           // 顶点（上）
    const v2 = { x: sx + sw, y: sy + sh };         // 右下角
    const v3 = { x: sx, y: sy + sh };              // 左下角
    
    // 玩家碰撞盒的四个角和中心点
    const playerPoints = [
        { x: p.x, y: p.y },                           // 左上角
        { x: p.x + p.w, y: p.y },                     // 右上角
        { x: p.x, y: p.y + p.h },                     // 左下角
        { x: p.x + p.w, y: p.y + p.h },               // 右下角
        { x: p.x + p.w/2, y: p.y + p.h/2 }           // 中心点
    ];
    
    // 检查任意一个点是否在三角形内
    for (const point of playerPoints) {
        if (isPointInTriangle(point, v1, v2, v3)) {
            return true;
        }
    }
    
    return false;
}

/**
 * isPointInTriangle - 判断点是否在三角形内
 * 使用重心坐标法
 */
function isPointInTriangle(p, v1, v2, v3) {
    const d1 = sign(p, v1, v2);
    const d2 = sign(p, v2, v3);
    const d3 = sign(p, v3, v1);
    
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    
    return !(hasNeg && hasPos);
}

/**
 * sign - 计算叉积符号
 */
function sign(p1, p2, p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

/**
 * checkWallCollision - 检测玩家是否贴墙（用于蹬墙跳）
 * @returns {Object|null} 返回墙的方向和方块信息，冰块不可蹬墙跳
 */
function checkWallCollision() {
    // 检测左侧墙
    for (let t of map) {
        // 冰块不能蹬墙跳
        const isSolidWall = t.type === 'block';
        if (!isSolidWall) continue;
        
        const tx = t.x, ty = t.y;
        // 左侧碰撞检测
        if (player.x <= tx + TILE && player.x + player.w > tx + TILE &&
            player.y + player.h > ty && player.y < ty + TILE) {
            return { side: 'left', tile: t };
        }
        // 右侧碰撞检测
        if (player.x + player.w >= tx && player.x < tx &&
            player.y + player.h > ty && player.y < ty + TILE) {
            return { side: 'right', tile: t };
        }
    }
    return null;
}

// =====================================================
// 玩家复活
// =====================================================

// lastCheckpoint: 最近激活的存档点位置
let lastCheckpoint = null;

function respawn() {
    // 如果有存档点，重生到存档点位置；否则重生到出生点
    const respawnPoint = lastCheckpoint || spawn;
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    player.onLadder = false;
    player.jumps = 0;
    player.wallSlide = false;
    player.jumpReleased = true;
    player.grounded = false;
}

/**
 * checkCheckpointCollision - 检查玩家是否碰撞到存档点
 */
function checkCheckpointCollision() {
    // 检测玩家与存档点的碰撞
    for (let tile of map) {
        if (tile.type === 'checkpoint') {
            // 使用简单的AABB碰撞检测
            if (player.x < tile.x + TILE &&
                player.x + player.w > tile.x &&
                player.y < tile.y + TILE &&
                player.y + player.h > tile.y) {
                // 激活存档点
                lastCheckpoint = { x: tile.x, y: tile.y };
            }
        }
    }
}

/**
 * checkGoalCollision - 检查玩家是否碰撞到终点
 */
function checkGoalCollision() {
    // 调试：输出所有终点位置
    const goals = map.filter(t => t.type === 'goal');
    if (goals.length === 0) {
        // 没有终点，直接返回
        return false;
    }
    
    for (let tile of goals) {
        // 方法1：玩家AABB碰撞检测
        const playerCenterX = player.x + player.w / 2;
        const playerCenterY = player.y + player.h / 2;
        
        // 方法2：玩家中心点在终点方块内
        const collision = 
            playerCenterX >= tile.x &&
            playerCenterX <= tile.x + TILE &&
            playerCenterY >= tile.y &&
            playerCenterY <= tile.y + TILE;
        
        // 调试输出（当玩家接近终点时）
        if (Math.abs(playerCenterX - tile.x - TILE/2) < TILE * GOAL_DETECT_RANGE && 
            Math.abs(playerCenterY - tile.y - TILE/2) < TILE * GOAL_DETECT_RANGE) {
            console.log('终点检测：', {
                playerCenterX: playerCenterX,
                playerCenterY: playerCenterY,
                tileX: tile.x,
                tileY: tile.y,
                tileCenterX: tile.x + TILE/2,
                tileCenterY: tile.y + TILE/2,
                collision: collision
            });
        }
        
        if (collision) {
            console.log('=== 到达终点！===');
            // 到达终点！停止计时
            stopGameTimer();
            
            // 立即切换到编辑模式
            if (!editMode) {
                toggleMode();
            }
            
            // 显示通关消息（切换模式后显示）
            setTimeout(() => {
                showToast('🎉 通关！用时：' + formatTime(gameTime) + ' | 死亡：' + deathCount + '次', WIN_TOAST_DURATION);
            }, WIN_TOAST_DELAY);
            
            return true;
        }
    }
    return false;
}

// =====================================================
// 玩家物理与碰撞（核心）
// =====================================================

/**
 * physics - 玩家物理更新主函数（Celeste风格）
 */
function physics() {
    if (editMode || player.dead) return;

    // ===== 保存上一帧状态（在重置之前）=====
    const wasGrounded = player.grounded;
    
    // 检测脚下是否为冰面（使用上一帧的位置）
    const feetTile = getFeetTile();
    const onIce = feetTile && feetTile.type === 'ice';

    // ===== 重置状态 =====
    player.grounded = false;
    player.onLadder = false;
    player.wallSlide = false;

    // ===== 存档点碰撞检测 =====
    checkCheckpointCollision();

    // ===== 终点碰撞检测 =====
    if (checkGoalCollision()) {
        return; // 到达终点，不继续物理更新
    }

    // ===== 死亡检测 =====
    if (player.y > MAP_SIZE + DEATH_BOUNDARY) {
        player.dead = true;
        incrementDeathCount(); // 增加死亡计数
        setTimeout(respawn, RESPAWN_DELAY);
        return;
    }

    // ===== 预输入处理 =====
    let wantsJump = player.jumpPressed;
    player.jumpPressed = false; // 消耗跳跃按键

    // ===== 水平移动 =====
    let moveInput = 0;
    if (keys['a'] || keys['ArrowLeft']) moveInput = -1;
    if (keys['d'] || keys['ArrowRight']) moveInput = 1;
    
    // ===== 加速与减速 =====
    // 冰面减速很慢，普通地面减速快
    const deceleration = wasGrounded ? (onIce ? ICE_DECELERATION : NORMAL_DECELERATION) : AIR_DECELERATION;
    
    if (moveInput !== 0) {
        player.vx += moveInput * MOVE_SPEED * ACCELERATION;
    } else {
        player.vx *= deceleration;
    }
    
    // ===== 速度限制 =====
    // 冰面最大速度为10，普通地面为5
    const maxSpeed = wasGrounded && onIce ? ICE_MAX_SPEED : MAX_HORIZ_SPEED;
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
    player.vx = Math.abs(player.vx) < MIN_SPEED_THRESHOLD ? 0 : player.vx; // 微小速度归零

    // ===== 检测贴墙状态 =====
    const wallInfo = checkWallCollision();
    
    // ===== 沿墙下滑 =====
    if (wallInfo && !player.grounded && player.vy > 0) {
        player.wallSlide = true;
        // 只有非冰墙才减速下滑，冰墙保持原有速度
        if (wallInfo.tile.type !== 'ice') {
            player.vy = Math.min(player.vy, WALL_SLIDE_SPEED);
        }
        // 沿墙时保持微小的水平速度防止卡墙
        const wallDirection = wallInfo.side === 'left' ? 1 : -1;
        if (Math.abs(player.vx) < WALL_PUSH_THRESHOLD) {
            player.vx = wallDirection * WALL_PUSH_SPEED;
        }
    }

    // ===== 预测下一帧位置 =====
    let nextX = player.x + player.vx;
    let nextY = player.y + player.vy;

    // ===== 实心方块碰撞 =====
    let headBumped = false;
    map.forEach(t => {
        // 实心方块类型：普通方块、冰面（弹簧的X轴碰撞单独处理）
        const isSolid = t.type === 'block' || t.type === 'ice';
        // 弹簧也需要X轴碰撞（侧面阻挡）
        const isTramp = t.type === 'tramp';
        if (!isSolid && !isTramp) return;

        let tx = t.x, ty = t.y;
        
        // X轴碰撞检测（所有实心方块和弹簧都有侧面碰撞）
        if (nextX + player.w > tx && nextX < tx + TILE &&
            player.y + player.h > ty && player.y < ty + TILE) {
            nextX = player.vx > 0 ? tx - player.w : tx + TILE;
            player.vx = 0;
        }
        
        // Y轴碰撞检测（只有普通方块和冰面）
        if (isSolid) {
            if (nextY + player.h > ty && nextY < ty + TILE &&
                player.x + player.w > tx && player.x < tx + TILE) {
                if (player.vy > 0) {
                    // 下落中：贴在方块顶面
                    nextY = ty - player.h;
                    player.grounded = true;
                    player.jumps = 0; // 落地重置跳跃次数
                    player.jumpReleased = true; // 落地重置跳跃释放状态
                    player.vy = 0;
                } else if (player.vy < 0) {
                    // 上升中撞到方块底面：顶头吸附
                    nextY = ty + TILE;
                    player.vy = HEAD_BOOP_VELOCITY;
                    player.headStick = HEAD_STICK_FRAMES; // 设置吸附帧数
                    headBumped = true;
                }
            }
        }
    });

    // ===== 应用位置 =====
    player.x = nextX;
    player.y = nextY;

    // ===== 非冰面急停 =====
    // 松开按键后非冰面上快速停下
    if (player.grounded && !onIce && moveInput === 0 && Math.abs(player.vx) < STOP_SPEED_THRESHOLD) {
        player.vx = 0;
    }

    // ===== 地图边界限制 =====
    player.x = Math.max(0, Math.min(MAP_SIZE - player.w, player.x));
    player.y = Math.max(0, Math.min(MAP_SIZE - player.h, player.y));
    
    // ===== 更新Coyote时间 =====
    if (player.grounded) {
        player.grace = COYOTE_TIME;
    } else {
        player.grace = Math.max(0, player.grace - 1);
    }

    // ===== 更新跳跃缓冲 =====
    if (wantsJump) {
        player.jumpBuffer = JUMP_BUFFER;
    } else {
        player.jumpBuffer = Math.max(0, player.jumpBuffer - 1);
    }

    // ===== 跳跃处理 =====
    if (player.jumpBuffer > 0) {
        // 地面跳跃（含Coyote时间）
        if (player.grace > 0) {
            // 根据是否按住跳跃键选择跳跃力量
            player.vy = player.jumpHeld ? -JUMP_POWER : -JUMP_SHORT_POWER;
            player.grounded = false;
            player.grace = 0;
            player.jumpBuffer = 0;
        }
        // 蹬墙跳（沿墙下滑时跳跃）- 不消耗跳跃次数
        else if (player.wallSlide && wallInfo) {
            const wallDirection = wallInfo.side === 'left' ? 1 : -1;
            player.vx = wallDirection * WALL_JUMP_X;
            player.vy = WALL_JUMP_Y;
            player.wallSlide = false;
            player.jumpBuffer = 0;
            // 推开玩家防止卡墙
            player.x += wallDirection * WALL_JUMP_PUSH;
        }
        // 二段跳（空中且未下滑时触发）- 消耗一次跳跃次数
        else if (!player.wallSlide && player.jumps < MAX_JUMPS - 1) {
            player.vy = -JUMP_SHORT_POWER; // 二段跳只能是短跳
            player.jumps++;
            player.jumpBuffer = 0;
        }
    }

    // ===== 跳跃高度控制（短按/长按） =====
    if (!player.jumpHeld && player.vy < 0) {
        // 松开跳跃键，增加重力让跳跃变低
        player.vy += JUMP_RELEASE_GRAVITY;
    }

    // ===== 重力 =====
    if (!player.onLadder) {
        // 顶头吸附期间暂停重力
        if (player.headStick > 0) {
            player.headStick--;
            player.vy = 0; // 保持静止
        } else {
            player.vy += GRAVITY;
            if (player.vy > MAX_FALL_SPEED) {
                player.vy = MAX_FALL_SPEED;
            }
        }
    }

    // ===== 道具与机关碰撞 =====
    map.forEach(t => {
        let tx = t.x, ty = t.y;
        
        let collide = !(
            player.x + player.w < tx || player.x > tx + TILE ||
            player.y + player.h < ty || player.y > ty + TILE
        );
        if (!collide) return;

        // 尖刺
        if (t.type === 'spike') {
            if (checkSpikeCollision(player, t)) {
                player.dead = true;
                incrementDeathCount(); // 增加死亡计数
                setTimeout(respawn, RESPAWN_DELAY);
                return;
            }
        }
        
        // 终点：在checkGoalCollision()中处理，这里跳过
        if (t.type === 'goal') {
            return; // 不做碰撞处理，让checkGoalCollision()处理
        }

        // 弹簧
        if (t.type === 'tramp') {
            const cy = player.y + player.h / 2;
            const top = ty;
            const bottom = ty + TILE;
            
            if (player.vy > 0 && cy < top + TRAMP_COLLISION_THRESHOLD) {
                player.vy = -SPRING_BOUNCE;
                player.y = top - player.h;
                player.jumps = 0; // 弹簧弹起时重置跳跃次数
            }
            if (player.vy < 0 && cy > bottom - TRAMP_COLLISION_THRESHOLD) {
                player.vy = SPRING_DOWN_BOUNCE;
                player.y = bottom;
            }
        }

        // 梯子
        if (t.type === 'jump') {
            player.onLadder = true;
            player.vy = 0;
            player.jumps = 0; // 在梯子上重置跳跃
            
            if (keys['w'] || keys['ArrowUp']) player.vy = -LADDER_SPEED;
            if (keys['s'] || keys['ArrowDown']) player.vy = LADDER_SPEED;
        }

        // 加速带
        if (t.type === 'boost') {
            player.vx *= BOOST_BASE;
        }

        // 单向平台（修复下落过快穿过问题）
        if (t.type === 'oneway') {
            const playerBottom = player.y + player.h;
            const platformTop = ty;
            
            // 只有从上方下落且速度较小时才能站上去
            if (player.vy >= ONE_WAY_THRESHOLD && 
                playerBottom >= platformTop && 
                playerBottom <= platformTop + player.vy + 4) {
                player.y = platformTop - player.h;
                player.vy = 0;
                player.grounded = true;
                player.jumps = 0; // 站在单向板上重置跳跃次数
            }
        }
    });
}
