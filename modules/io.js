/**
 * =====================================================
 * io.js - 地图导入导出模块（自定义压缩）
 * =====================================================
 * 
 * 使用自定义压缩算法，不依赖外部库
 * 
 * 【压缩格式设计】
 * 
 * 1. 头部标识：固定字符串 "IWM2" (4字节)
 * 
 * 2. 出生点：格式 "P" + X坐标 + Y坐标
 *    - X,Y是网格坐标(0-49)，各占1字节
 * 
 * 3. 方块数据：使用游程编码(RLE) + 增量编码
 *    - 格式：[类型字符][数量][起始X][起始Y]
 *    - 数量大于1时启用游程编码，否则只存储单个方块
 * 
 * 4. 坐标编码：使用自定义的64字符表进行Base64编码
 *    - 表格："ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
 *    - 每3字节数据编码为4个字符
 * 
 * 【类型映射表】
 * - 'A': block (方块)
 * - 'B': spike (尖刺)
 * - 'C': goal (终点)
 * - 'D': jump (梯子)
 * - 'E': tramp (弹簧)
 * - 'F': boost (加速带)
 * - 'G': ice (冰面)
 * - 'H': oneway (单向平台)
 * - '0': 游程编码标记（数量>1时前缀）
 */

// =====================================================
// 自定义Base64编码/解码
// =====================================================

// 64字符编码表
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 将3个字节编码为4个Base64字符
 */
function encodeBase64Chunk(b1, b2, b3) {
    return CHARSET[b1 >> 2] +
           CHARSET[((b1 & 3) << 4) | (b2 >> 4)] +
           CHARSET[((b2 & 15) << 2) | (b3 >> 6)] +
           CHARSET[b3 & 63];
}

/**
 * 将4个Base64字符解码为3个字节
 */
function decodeBase64Chunk(c1, c2, c3, c4) {
    const v1 = CHARSET.indexOf(c1);
    const v2 = CHARSET.indexOf(c2);
    const v3 = CHARSET.indexOf(c3);
    const v4 = CHARSET.indexOf(c4);
    return [
        (v1 << 2) | (v2 >> 4),
        ((v2 & 15) << 4) | (v3 >> 2),
        ((v3 & 3) << 6) | v4
    ];
}

/**
 * 字节数组转Base64字符串
 */
function bytesToBase64(bytes) {
    let result = '';
    let i = 0;
    while (i < bytes.length) {
        const b1 = bytes[i++] || 0;
        const b2 = bytes[i++] || 0;
        const b3 = bytes[i++] || 0;
        result += encodeBase64Chunk(b1, b2, b3);
    }
    // 处理填充
    const padding = (3 - (bytes.length % 3)) % 3;
    if (padding > 0) {
        result = result.slice(0, -padding);
    }
    return result;
}

/**
 * Base64字符串转字节数组
 */
function base64ToBytes(base64) {
    // 恢复填充
    const padding = (4 - (base64.length % 4)) % 4;
    let str = base64 + '='.repeat(padding);
    
    const bytes = [];
    for (let i = 0; i < str.length; i += 4) {
        const chunk = decodeBase64Chunk(str[i], str[i+1], str[i+2], str[i+3]);
        bytes.push(chunk[0], chunk[1], chunk[2]);
    }
    // 移除填充对应的字节
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
        bytes.pop();
    }
    return bytes;
}

// =====================================================
// 类型映射表
// =====================================================

// 类型字符到类型名的映射
const TYPE_FROM_CHAR = {
    'A': 'block',
    'B': 'spike',
    'C': 'goal',
    'D': 'jump',
    'E': 'tramp',
    'F': 'boost',
    'G': 'ice',
    'H': 'oneway'
};

// 类型名到字符的映射
const TYPE_TO_CHAR = {};
for (const [k, v] of Object.entries(TYPE_FROM_CHAR)) {
    TYPE_TO_CHAR[v] = k;
}

// =====================================================
// 地图导出
// =====================================================

document.getElementById('export').onclick = async () => {
    try {
        // ===== 第一步：收集数据 =====
        // 存储每个方块的类型和网格坐标
        const data = [];
        
        // 按x,y排序以便后续游程编码
        const sortedTiles = [...map].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
        
        // ===== 第二步：游程编码 =====
        let i = 0;
        while (i < sortedTiles.length) {
            const tile = sortedTiles[i];
            const typeChar = TYPE_TO_CHAR[tile.type];
            if (!typeChar) { i++; continue; }
            
            // 计算连续相同类型的方块数量
            let count = 1;
            const startX = tile.x / 32;
            const startY = tile.y / 32;
            
            while (i + count < sortedTiles.length) {
                const next = sortedTiles[i + count];
                const nextTypeChar = TYPE_TO_CHAR[next.type];
                const nextX = next.x / 32;
                const nextY = next.y / 32;
                
                if (nextTypeChar === typeChar && 
                    nextX === startX + count && 
                    nextY === startY) {
                    count++;
                } else {
                    break;
                }
            }
            
            // 编码格式：类型 + 数量(可选) + X + Y
            // 如果数量>1，使用游程编码标记'0'表示后面的字节是数量
            if (count > 1) {
                // 格式：类型 + '0' + 数量 + X + Y
                data.push(typeChar, '0', count, Math.floor(startX), Math.floor(startY));
            } else {
                // 格式：类型 + X + Y
                data.push(typeChar, Math.floor(startX), Math.floor(startY));
            }
            
            i += count;
        }
        
        // ===== 第三步：转为字节数组 =====
        const bytes = [];
        
        // 添加头部标识 "IWM2"
        bytes.push(0x49, 0x57, 0x4D, 0x32);
        
        // 添加出生点坐标
        const spawnX = spawn.x / 32;
        const spawnY = spawn.y / 32;
        bytes.push(Math.floor(spawnX), Math.floor(spawnY));
        
        // 添加方块数据
        for (const item of data) {
            if (typeof item === 'string') {
                bytes.push(item.charCodeAt(0));
            } else {
                bytes.push(item);
            }
        }
        
        // ===== 第四步：Base64编码 =====
        const compressed = bytesToBase64(bytes);
        
        // ===== 第五步：复制到剪贴板 =====
        const success = await copyToClipboard(compressed);
        if (success) {
            showToast("✅ 导出成功（已复制）");
        } else {
            // 回退：显示导出码供手动复制
            showExportModal(compressed);
        }
    } catch (e) {
        console.error("导出错误", e);
        showToast("❌ 导出失败");
    }
};

/**
 * showExportModal - 显示导出码弹窗（回退方案）
 */
function showExportModal(code) {
    // 移除已存在的弹窗
    const existing = document.getElementById('tempExportModal');
    if (existing) document.body.removeChild(existing);
    
    const modal = document.createElement('div');
    modal.id = 'tempExportModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = `
        <div style="
            background: #1a1a2e; padding: 20px; border-radius: 10px;
            max-width: 90%; width: 500px; color: #fff;
        ">
            <h3 style="margin:0 0 15px">导出代码</h3>
            <p style="margin:0 0 10px;font-size:14px;color:#aaa">请全选复制以下代码：</p>
            <textarea readonly style="
                width: 100%; height: 120px; background: #0f0f1a;
                border: 1px solid #333; color: #0f0; padding: 10px;
                font-family: monospace; font-size: 12px; resize: none;
                box-sizing: border-box;
            ">${code}</textarea>
            <button onclick="
                this.closest('div').querySelector('textarea').select();
                document.execCommand('copy');
                const m = document.getElementById('tempExportModal');
                if (m) document.body.removeChild(m);
                showToast('已复制！');
            " style="
                margin-top: 10px; width: 100%; padding: 10px;
                background: #4CAF50; border: none; color: #fff;
                border-radius: 5px; cursor: pointer; font-size: 16px;
            ">复制</button>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * readFromClipboardWithModal - 显示导入弹窗获取地图代码
 */
function readFromClipboardWithModal() {
    return new Promise((resolve) => {
        // 移除已存在的弹窗
        const existing = document.getElementById('tempImportModal');
        if (existing) document.body.removeChild(existing);
        
        const modal = document.createElement('div');
        modal.id = 'tempImportModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="
                background: #1a1a2e; padding: 20px; border-radius: 10px;
                max-width: 90%; width: 500px; color: #fff;
            ">
                <h3 style="margin:0 0 15px">导入地图</h3>
                <p style="margin:0 0 10px;font-size:14px;color:#aaa">请粘贴地图代码：</p>
                <textarea id="importCodeInput" style="
                    width: 100%; height: 120px; background: #0f0f1a;
                    border: 1px solid #333; color: #fff; padding: 10px;
                    font-family: monospace; font-size: 12px; resize: none;
                    box-sizing: border-box;
                "></textarea>
                <div style="display:flex;gap:10px;margin-top:10px">
                    <button onclick="
                        const val = document.getElementById('importCodeInput').value.trim();
                        const m = document.getElementById('tempImportModal');
                        if (m) document.body.removeChild(m);
                        window.__importResolve(val);
                    " style="
                        flex:1; padding: 10px; background: #2196F3; border: none;
                        color: #fff; border-radius: 5px; cursor: pointer; font-size: 16px;
                    ">导入</button>
                    <button onclick="
                        const m = document.getElementById('tempImportModal');
                        if (m) document.body.removeChild(m);
                        window.__importResolve(null);
                    " style="
                        flex:1; padding: 10px; background: #666; border: none;
                        color: #fff; border-radius: 5px; cursor: pointer; font-size: 16px;
                    ">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        window.__importResolve = resolve;
    });
}

/**
 * copyToClipboard - 复制文本到剪贴板
 * 
 * 优先使用 Clipboard API，失败时使用回退方案
 */
async function copyToClipboard(text) {
    // 方法1：Clipboard API
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // 忽略，继续尝试回退方案
    }
    
    // 方法2：execCommand 回退
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch (e) {
        return false;
    }
}

/**
 * readFromClipboard - 从剪贴板读取文本
 * 
 * 优先使用 Clipboard API，失败时返回 null
 */
async function readFromClipboard() {
    try {
        return await navigator.clipboard.readText();
    } catch (e) {
        return null;
    }
}

// =====================================================
// 地图导入
// =====================================================

document.getElementById('import').onclick = async () => {
    try {
        let input;
        
        // 优先尝试从剪贴板读取
        input = await readFromClipboard();
        if (!input) {
            // 剪贴板读取失败：使用弹窗输入
            input = await readFromClipboardWithModal();
            if (!input) return;
        }
        
        // ===== 第一步：Base64解码 =====
        const bytes = base64ToBytes(input);
        if (!bytes || bytes.length < 6) {
            throw new Error("数据格式错误");
        }
        
        // ===== 第二步：验证头部 =====
        if (bytes[0] !== 0x49 || bytes[1] !== 0x57 || 
            bytes[2] !== 0x4D || bytes[3] !== 0x32) {
            throw new Error("无效的地图格式");
        }
        
        // ===== 第三步：读取出生点 =====
        const spawnGridX = bytes[4];
        const spawnGridY = bytes[5];
        spawn = { x: spawnGridX * 32, y: spawnGridY * 32 };
        
        // ===== 第四步：解码方块数据 =====
        map = [];
        let i = 6;
        
        while (i < bytes.length) {
            const typeChar = String.fromCharCode(bytes[i]);
            i++;
            
            const typeName = TYPE_FROM_CHAR[typeChar];
            if (!typeName) continue;
            
            // 检查是否有游程编码标记
            let count = 1;
            if (i < bytes.length && bytes[i] === '0'.charCodeAt(0)) {
                i++;  // 跳过'0'标记
                count = bytes[i];  // 读取数量
                i++;
            }
            
            // 读取起始坐标
            if (i + 1 >= bytes.length) break;
            const gridX = bytes[i];
            const gridY = bytes[i + 1];
            i += 2;
            
            // 添加方块（根据数量）
            for (let j = 0; j < count; j++) {
                map.push({
                    x: (gridX + j) * 32,
                    y: gridY * 32,
                    type: typeName
                });
            }
        }
        
        // 保存到历史
        pushHistory();
        
        showToast("✅ 导入成功！");
    } catch (e) {
        console.error("导入错误", e);
        showToast("❌ 导入失败");
    }
};

// =====================================================
// 加载默认地图
// =====================================================

/**
 * loadDefaultMap - 加载游戏内置的默认演示地图
 * 
 * 默认地图使用自定义压缩格式存储，与导入功能格式一致
 */
function loadDefaultMap() {
    try {
        // 默认地图编码（用户提供）
        const defaultCode = 'SVdNMgoKQTAXCAFBCAJBDgJBHgJBCANBDgNDEANEFANEFwNEGgNBHgNBCARBMAQOBEQUBEQXBEQaBEEeBEEIBUIMBUEOBUEeBUcIBkgwAwkGRwwGQQ4GQR4GRwgHRwwHQQ4HQR4HRwgIRwwIQQ4IQR4IRwgJRwwJQQ4JQR4JRwgKRwwKRjAEDQpCFApCGApCGwpFHQpBHgpBMAQIC0cwBQwLQTAOEQs';
        
        // ===== 第一步：Base64解码 =====
        const bytes = base64ToBytes(defaultCode);
        if (!bytes || bytes.length < 6) {
            throw new Error("数据格式错误");
        }
        
        // ===== 第二步：验证头部 =====
        if (bytes[0] !== 0x49 || bytes[1] !== 0x57 || 
            bytes[2] !== 0x4D || bytes[3] !== 0x32) {
            throw new Error("无效的地图格式");
        }
        
        // ===== 第三步：读取出生点 =====
        const spawnGridX = bytes[4];
        const spawnGridY = bytes[5];
        spawn = { x: spawnGridX * 32, y: spawnGridY * 32 };
        
        // ===== 第四步：解码方块数据 =====
        map = [];
        let i = 6;
        
        while (i < bytes.length) {
            const typeChar = String.fromCharCode(bytes[i]);
            i++;
            
            const typeName = TYPE_FROM_CHAR[typeChar];
            if (!typeName) continue;
            
            // 检查是否有游程编码标记
            let count = 1;
            if (i < bytes.length && bytes[i] === '0'.charCodeAt(0)) {
                i++;  // 跳过'0'标记
                count = bytes[i];  // 读取数量
                i++;
            }
            
            // 读取起始坐标
            if (i + 1 >= bytes.length) break;
            const gridX = bytes[i];
            const gridY = bytes[i + 1];
            i += 2;
            
            // 添加方块（根据数量）
            for (let j = 0; j < count; j++) {
                map.push({
                    x: (gridX + j) * 32,
                    y: gridY * 32,
                    type: typeName
                });
            }
        }
        
        // 保存到历史
        pushHistory();
        
        console.log("✅ 默认地图加载成功");
    } catch (e) {
        console.error("❌ 默认地图加载失败", e);
    }
}
