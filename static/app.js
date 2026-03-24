// 安全获取元素（不存在返回null，不报错）
function get(id) {
    return document.getElementById(id);
}

// 安全设置textContent
function setText(id, text) {
    const el = get(id);
    if (el) el.textContent = text;
}

// 安全设置value
function setValue(id, val) {
    const el = get(id);
    if (el) el.value = val;
}

// 全局变量
let currentPoopStar = 3;
let currentSleepQuality = 3;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 设置日期
    const dateEl = get('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('zh-CN');
    
    // 设置默认时间（如果元素存在）
    const now = new Date().toTimeString().slice(0, 5);
    setValue('actual-wake-time', now);
    setValue('actual-bed-time', now);
    setValue('meal-time', now);
    setValue('meal-actual-time', now);
    
    // 加载数据
    loadTodayData();
    
    // 初始化图表（如果页面有）
    if (get('trendChart')) {
        loadWeeklyStats();
    }
});

// 加载今日数据
async function loadTodayData() {
    try {
        const res = await fetch('/api/today');
        const data = await res.json();
        updateDashboard(data);
        renderLogs(data);
        updateSleepDisplay(data);
    } catch (e) {
        console.error('加载失败:', e);
    }
}

function updateDashboard(data) {
    // 更新计数（安全方式）
    const waterCount = data.water_logs ? data.water_logs.length : 0;
    const peeCount = data.pee_logs ? data.pee_logs.length : 0;
    const poopCount = data.poop_logs ? data.poop_logs.length : 0;
    
    setText('water-count', waterCount);
    setText('pee-count', peeCount);
    setText('poop-count', poopCount);
    
    // 睡眠信息
    let sleepText = '--';
    if (data.sleep_duration) {
        sleepText = data.sleep_duration + 'h';
    } else if (data.wake_up_actual || data.bed_time_actual) {
        sleepText = '已记录';
    }
    setText('sleep-info', sleepText);
    
    // 运动分钟数
    let sportMinutes = 0;
    if (data.sports) {
        sportMinutes = data.sports.reduce((sum, s) => sum + (s.duration || 0), 0);
    }
    setText('sport-count', sportMinutes);
}

function updateSleepDisplay(data) {
    const container = get('sleep-records');
    if (!container) return;
    
    let html = '';
    if (data.wake_up_actual) {
        const lateText = data.is_late ? ` (晚了${data.late_minutes}分钟)` : '';
        html += `<div>⏰ 起床: ${data.wake_up_actual}${lateText}</div>`;
    }
    if (data.bed_time_actual) {
        const sleepyText = data.sleepiness_level ? ` (困意${data.sleepiness_level}/5)` : '';
        html += `<div>🌙 入睡: ${data.bed_time_actual}${sleepyText}</div>`;
    }
    if (data.sleep_quality) {
        html += `<div>📊 昨晚质量: ${'⭐'.repeat(data.sleep_quality)}</div>`;
    }
    container.innerHTML = html || '<div class="text-gray-400">今日尚未记录睡眠</div>';
}

function renderLogs(data) {
    const container = get('today-logs');
    if (!container) return;
    
    let html = '';
    
    if (data.water_logs && data.water_logs.length > 0) {
        html += `<div class="bg-blue-50 p-3 rounded-xl flex justify-between items-center">
            <span>💧 喝水 x${data.water_logs.length}</span>
            <span class="text-gray-500 text-sm">最新: ${data.water_logs[data.water_logs.length-1]}</span>
        </div>`;
    }
    
    if (data.pee_logs && data.pee_logs.length > 0) {
        html += `<div class="bg-cyan-50 p-3 rounded-xl flex justify-between items-center">
            <span>🚽 排尿 x${data.pee_logs.length}</span>
        </div>`;
    }
    
    if (data.poop_logs && data.poop_logs.length > 0) {
        const last = data.poop_logs[data.poop_logs.length-1];
        html += `<div class="bg-amber-50 p-3 rounded-xl flex justify-between items-center">
            <span>💩 排便 ${'⭐'.repeat(last.smoothness)}</span>
            <span class="text-gray-500 text-sm">${last.time}</span>
        </div>`;
    }
    
    if (data.meals) {
        ['breakfast', 'lunch', 'dinner'].forEach(type => {
            const meal = data.meals[type];
            if (meal && meal.time) {
                const icons = {breakfast: '🍳', lunch: '🍱', dinner: '🍽️'};
                html += `<div class="bg-orange-50 p-3 rounded-xl flex justify-between items-center">
                    <div>
                        <span>${icons[type]} ${meal.food || '未备注'}</span>
                        <div class="text-xs text-gray-500">${meal.duration}分钟</div>
                    </div>
                    <span class="text-gray-500 text-sm">${meal.time}</span>
                </div>`;
            }
        });
    }
    
    container.innerHTML = html || '<div class="text-gray-400 text-center py-4">今日暂无记录</div>';
}

// Tab切换
function switchTab(tab) {
    const todayPage = get('page-today');
    const dataPage = get('page-data');
    const todayTab = get('tab-today');
    const dataTab = get('tab-data');
    
    if (!todayPage || !dataPage) return; // 安全退出
    
    if (tab === 'today') {
        todayPage.classList.remove('hidden');
        dataPage.classList.add('hidden');
        if (todayTab) todayTab.className = 'flex-1 py-3 text-center tab-active';
        if (dataTab) dataTab.className = 'flex-1 py-3 text-center tab-inactive';
        loadTodayData();
    } else {
        todayPage.classList.add('hidden');
        dataPage.classList.remove('hidden');
        if (todayTab) todayTab.className = 'flex-1 py-3 text-center tab-inactive';
        if (dataTab) dataTab.className = 'flex-1 py-3 text-center tab-active';
        loadDataDashboard();
    }
}

// 模态框通用函数
function openModal(id) {
    const el = get(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = get(id);
    if (el) el.classList.add('hidden');
}

function showToast(msg) {
    const div = document.createElement('div');
    div.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
}

// ==================== 具体功能 ====================

// 喝水
async function quickWater() {
    try {
        const res = await fetch('/api/water', {method: 'POST'});
        const result = await res.json();
        if (result.success) {
            if (navigator.vibrate) navigator.vibrate(50);
            showToast(`💧 第${result.cup}杯水`);
            loadTodayData();
        }
    } catch (e) {
        showToast('记录失败');
    }
}

async function undoWater() {
    try {
        const res = await fetch('/api/water/undo', {method: 'POST'});
        const result = await res.json();
        if (result.success) {
            showToast(`↩️ 已撤销`);
            loadTodayData();
        } else {
            showToast('⚠️ 没有可撤销的记录');
        }
    } catch (e) {
        showToast('撤销失败');
    }
}

// 排尿
async function quickPee() {
    try {
        const res = await fetch('/api/pee', {method: 'POST'});
        const result = await res.json();
        if (result.success) {
            showToast(`🚽 排尿记录 ${result.time}`);
            loadTodayData();
        }
    } catch (e) {
        showToast('记录失败');
    }
}

function setReminder() {
    if ('Notification' in window) {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                showToast('⏰ 已开启整点提醒');
                localStorage.setItem('peeReminder', 'true');
            }
        });
    }
}

// 排便
function openPoopModal() {
    openModal('poop-modal');
    setPoopStar(3);
}

function setPoopStar(n) {
    currentPoopStar = n;
    document.querySelectorAll('.poop-star').forEach((btn, idx) => {
        if (btn) {
            btn.textContent = idx < n ? '⭐' : '☆';
            btn.classList.toggle('text-amber-500', idx < n);
            btn.classList.toggle('text-gray-300', idx >= n);
        }
    });
}

async function submitPoop() {
    const noteEl = get('poop-note');
    const note = noteEl ? noteEl.value : '';
    
    try {
        await fetch('/api/poop', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({smoothness: currentPoopStar, note})
        });
        closeModal('poop-modal');
        showToast('💩 记录成功');
        if (noteEl) noteEl.value = '';
        loadTodayData();
    } catch (e) {
        showToast('记录失败');
    }
}

async function undoPoop() {
    try {
        const res = await fetch('/api/poop/undo', {method: 'POST'});
        const result = await res.json();
        if (result.success) {
            showToast('↩️ 已撤销');
            loadTodayData();
        } else {
            showToast('⚠️ 没有可撤销的记录');
        }
    } catch (e) {
        showToast('撤销失败');
    }
}

// 睡眠
function openWakeModal() {
    openModal('wake-modal');
}

function openBedModal() {
    openModal('bed-modal');
}

function openSleepQualityModal() {
    openModal('sleep-quality-modal');
}

async function submitWake() {
    const timeEl = get('actual-wake-time');
    const time = timeEl ? timeEl.value : new Date().toTimeString().slice(0, 5);
    
    try {
        await fetch('/api/sleep/wake', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({time})
        });
        closeModal('wake-modal');
        showToast('⏰ 起床打卡成功');
        loadTodayData();
    } catch (e) {
        showToast('打卡失败');
    }
}

async function submitBed() {
    const timeEl = get('actual-bed-time');
    const time = timeEl ? timeEl.value : new Date().toTimeString().slice(0, 5);
    
    try {
        await fetch('/api/sleep/bed', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({time, sleepiness_level: 3})
        });
        closeModal('bed-modal');
        showToast('🌙 入睡打卡成功');
        loadTodayData();
    } catch (e) {
        showToast('打卡失败');
    }
}

function setSleepQuality(n) {
    currentSleepQuality = n;
    document.querySelectorAll('.quality-star').forEach((btn, idx) => {
        if (btn) btn.textContent = idx < n ? '⭐' : '☆';
    });
}

async function submitSleepQuality() {
    try {
        await fetch('/api/sleep/quality', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({quality: currentSleepQuality})
        });
        closeModal('sleep-quality-modal');
        showToast('📊 睡眠质量记录成功');
        loadTodayData();
    } catch (e) {
        showToast('记录失败');
    }
}

// 饮食（简化版）
function openMealModal(type) {
    // 简化处理，直接提示
    const food = prompt('吃了什么？');
    if (!food) return;
    
    fetch('/api/meal', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            type: type,
            food: food,
            time: new Date().toTimeString().slice(0, 5),
            duration: 20
        })
    }).then(() => {
        showToast('🍽️ 饮食记录成功');
        loadTodayData();
    });
}

// 运动（简化版）
function openSportModal() {
    const type = prompt('运动类型？(跑步/游泳/高尔夫等)');
    if (!type) return;
    const duration = prompt('时长（分钟）？');
    
    fetch('/api/sport', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            type: type,
            duration: parseInt(duration) || 30,
            intensity: 3
        })
    }).then(() => {
        showToast('🏃 运动记录成功');
        loadTodayData();
    });
}

// 练嗓（简化版）
function openVoiceModal() {
    const duration = prompt('练嗓时长（分钟）？');
    if (!duration) return;
    
    fetch('/api/voice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            duration: parseInt(duration),
            type: '发声'
        })
    }).then(() => {
        showToast('🎤 练嗓记录成功');
        loadTodayData();
    });
}

// 自定义模块（简化版）
function openCustomModal() {
    const name = prompt('模块名称？');
    if (!name) return;
    const value = prompt('记录值？');
    
    fetch('/api/custom', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            module_name: name,
            value: value
        })
    }).then(() => {
        showToast('✅ 自定义记录成功');
        loadTodayData();
    });
}

// 数据看板（简化版）
function loadDataDashboard() {
    showToast('📊 数据看板加载中...');
    // 简化版，实际使用时可扩展
}

function loadWeeklyStats() {
    // 简化版
}