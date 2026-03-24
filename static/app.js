// ============================================
// 配置常量
// ============================================
const CONFIG = {
    DEFAULT_SLEEPINESS_LEVEL: 3,
    DEFAULT_INTENSITY: 3,
    DEFAULT_SMOOTHNESS: 3,
    MAX_NOTE_LENGTH: 500,
    MAX_TEXT_LENGTH: 200,
    REQUEST_TIMEOUT: 10000
};

// ============================================
// 状态管理（替代全局变量）
// ============================================
const AppState = {
    currentPoopStar: CONFIG.DEFAULT_SMOOTHNESS,
    currentSleepQuality: 3,
    
    setPoopStar(n) {
        this.currentPoopStar = n;
        updatePoopStarUI(n);
    },
    
    setSleepQuality(n) {
        this.currentSleepQuality = n;
        updateSleepQualityUI(n);
    }
};

// ============================================
// 工具函数
// ============================================

/**
 * 安全获取元素
 */
function get(id) {
    return document.getElementById(id);
}

/**
 * XSS 防护：转义 HTML 特殊字符
 */
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * 安全设置 textContent
 */
function setText(id, text) {
    const el = get(id);
    if (el) el.textContent = text;
}

/**
 * 安全设置 value
 */
function setValue(id, val) {
    const el = get(id);
    if (el) el.value = val;
}

/**
 * 截断文本
 */
function truncate(str, maxLength) {
    if (!str) return '';
    str = String(str);
    return str.length > maxLength ? str.substring(0, maxLength) : str;
}

// ============================================
// API 层 - 统一处理请求
// ============================================
const API = {
    async request(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }
            
            return await res.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查网络');
            }
            throw error;
        }
    },
    
    async get(url) {
        return this.request(url, { method: 'GET' });
    },
    
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // 具体 API 方法
    async getToday() {
        return this.get('/api/today');
    },
    
    async addWater() {
        return this.post('/api/water');
    },
    
    async undoWater() {
        return this.post('/api/water/undo');
    },
    
    async addPee() {
        return this.post('/api/pee');
    },
    
    async addPoop(data) {
        return this.post('/api/poop', data);
    },
    
    async undoPoop() {
        return this.post('/api/poop/undo');
    },
    
    async updateMeal(data) {
        return this.post('/api/meal', data);
    },
    
    async recordWake(data) {
        return this.post('/api/sleep/wake', data);
    },
    
    async recordBed(data) {
        return this.post('/api/sleep/bed', data);
    },
    
    async recordSleepQuality(data) {
        return this.post('/api/sleep/quality', data);
    },
    
    async addSport(data) {
        return this.post('/api/sport', data);
    },
    
    async addVoice(data) {
        return this.post('/api/voice', data);
    },
    
    async addCustom(data) {
        return this.post('/api/custom', data);
    }
};

// ============================================
// UI 渲染函数（使用 textContent 防止 XSS）
// ============================================

/**
 * 更新仪表盘
 */
function updateDashboard(data) {
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

/**
 * 更新睡眠显示（安全渲染）
 */
function updateSleepDisplay(data) {
    const container = get('sleep-records');
    if (!container) return;
    
    // 使用 DocumentFragment 安全构建 DOM
    const fragment = document.createDocumentFragment();
    
    if (data.wake_up_actual) {
        const div = document.createElement('div');
        const lateText = data.is_late ? ` (晚了${data.late_minutes}分钟)` : '';
        div.textContent = `⏰ 起床: ${data.wake_up_actual}${lateText}`;
        fragment.appendChild(div);
    }
    
    if (data.bed_time_actual) {
        const div = document.createElement('div');
        const sleepyText = data.sleepiness_level ? ` (困意${data.sleepiness_level}/5)` : '';
        div.textContent = `🌙 入睡: ${data.bed_time_actual}${sleepyText}`;
        fragment.appendChild(div);
    }
    
    if (data.sleep_quality) {
        const div = document.createElement('div');
        div.textContent = `📊 昨晚质量: ${'⭐'.repeat(data.sleep_quality)}`;
        fragment.appendChild(div);
    }
    
    if (!fragment.hasChildNodes()) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-gray-400';
        emptyDiv.textContent = '今日尚未记录睡眠';
        fragment.appendChild(emptyDiv);
    }
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * 渲染日志列表（安全渲染）
 */
function renderLogs(data) {
    const container = get('today-logs');
    if (!container) return;
    
    const fragment = document.createDocumentFragment();
    
    // 喝水记录
    if (data.water_logs && data.water_logs.length > 0) {
        const div = document.createElement('div');
        div.className = 'bg-blue-50 p-3 rounded-xl flex justify-between items-center';
        div.innerHTML = `
            <span>💧 喝水 x${escapeHtml(data.water_logs.length)}</span>
            <span class="text-gray-500 text-sm">最新: ${escapeHtml(data.water_logs[data.water_logs.length-1])}</span>
        `;
        fragment.appendChild(div);
    }
    
    // 排尿记录
    if (data.pee_logs && data.pee_logs.length > 0) {
        const div = document.createElement('div');
        div.className = 'bg-cyan-50 p-3 rounded-xl flex justify-between items-center';
        div.innerHTML = `<span>🚽 排尿 x${escapeHtml(data.pee_logs.length)}</span>`;
        fragment.appendChild(div);
    }
    
    // 排便记录
    if (data.poop_logs && data.poop_logs.length > 0) {
        const last = data.poop_logs[data.poop_logs.length-1];
        const div = document.createElement('div');
        div.className = 'bg-amber-50 p-3 rounded-xl flex justify-between items-center';
        div.innerHTML = `
            <span>💩 排便 ${'⭐'.repeat(last.smoothness || 3)}</span>
            <span class="text-gray-500 text-sm">${escapeHtml(last.time)}</span>
        `;
        fragment.appendChild(div);
    }
    
    // 三餐记录
    if (data.meals) {
        const icons = {breakfast: '🍳', lunch: '🍱', dinner: '🍽️'};
        const names = {breakfast: '早餐', lunch: '午餐', dinner: '晚餐'};
        
        ['breakfast', 'lunch', 'dinner'].forEach(type => {
            const meal = data.meals[type];
            if (meal && meal.time) {
                const div = document.createElement('div');
                div.className = 'bg-orange-50 p-3 rounded-xl flex justify-between items-center';
                div.innerHTML = `
                    <div>
                        <span>${icons[type]} ${escapeHtml(meal.food || '未备注')}</span>
                        <div class="text-xs text-gray-500">${escapeHtml(meal.duration || 0)}分钟</div>
                    </div>
                    <span class="text-gray-500 text-sm">${escapeHtml(meal.time)}</span>
                `;
                fragment.appendChild(div);
            }
        });
    }
    
    if (!fragment.hasChildNodes()) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-gray-400 text-center py-4';
        emptyDiv.textContent = '今日暂无记录';
        fragment.appendChild(emptyDiv);
    }
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 设置日期
    const dateEl = get('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('zh-CN');
    
    // 设置默认时间
    const now = new Date().toTimeString().slice(0, 5);
    setValue('actual-wake-time', now);
    setValue('actual-bed-time', now);
    
    // 加载数据
    loadTodayData();
    
    // 初始化图表
    if (get('trendChart')) {
        loadWeeklyStats();
    }
});

/**
 * 加载今日数据
 */
async function loadTodayData() {
    try {
        const data = await API.getToday();
        updateDashboard(data);
        renderLogs(data);
        updateSleepDisplay(data);
    } catch (error) {
        console.error('加载失败:', error);
        showToast('加载数据失败: ' + error.message);
    }
}

// ============================================
// 通用 UI 函数
// ============================================

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

// Tab 切换
function switchTab(tab) {
    const todayPage = get('page-today');
    const dataPage = get('page-data');
    const todayTab = get('tab-today');
    const dataTab = get('tab-data');
    const todayIndicator = todayTab?.querySelector('.tab-indicator');
    const dataIndicator = dataTab?.querySelector('.tab-indicator');
    
    if (!todayPage || !dataPage) return;
    
    if (tab === 'today') {
        todayPage.classList.remove('hidden');
        dataPage.classList.add('hidden');
        if (todayTab) {
            todayTab.className = 'flex-1 py-4 text-center relative font-medium text-blue-600';
        }
        if (dataTab) {
            dataTab.className = 'flex-1 py-4 text-center relative font-medium text-gray-500';
        }
        if (todayIndicator) todayIndicator.style.display = 'block';
        if (dataIndicator) dataIndicator.style.display = 'none';
        loadTodayData();
    } else {
        todayPage.classList.add('hidden');
        dataPage.classList.remove('hidden');
        if (todayTab) {
            todayTab.className = 'flex-1 py-4 text-center relative font-medium text-gray-500';
        }
        if (dataTab) {
            dataTab.className = 'flex-1 py-4 text-center relative font-medium text-blue-600';
        }
        if (todayIndicator) todayIndicator.style.display = 'none';
        if (dataIndicator) dataIndicator.style.display = 'block';
    }
}

// ============================================
// 具体功能函数
// ============================================

// 喝水
async function quickWater() {
    try {
        const result = await API.addWater();
        if (result.success) {
            if (navigator.vibrate) navigator.vibrate(50);
            showToast(`💧 第${result.cup}杯水`);
            loadTodayData();
        }
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

async function undoWater() {
    try {
        const result = await API.undoWater();
        if (result.success) {
            showToast('↩️ 已撤销');
            loadTodayData();
        } else {
            showToast('⚠️ 没有可撤销的记录');
        }
    } catch (error) {
        showToast('撤销失败: ' + error.message);
    }
}

// 排尿
async function quickPee() {
    try {
        const result = await API.addPee();
        if (result.success) {
            showToast(`🚽 排尿记录 ${result.time}`);
            loadTodayData();
        }
    } catch (error) {
        showToast('记录失败: ' + error.message);
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
    AppState.setPoopStar(CONFIG.DEFAULT_SMOOTHNESS);
}

function setPoopStar(n) {
    AppState.setPoopStar(n);
}

function updatePoopStarUI(n) {
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
    const note = truncate(noteEl ? noteEl.value : '', CONFIG.MAX_NOTE_LENGTH);
    
    try {
        await API.addPoop({
            smoothness: AppState.currentPoopStar,
            note: note
        });
        closeModal('poop-modal');
        showToast('💩 记录成功');
        if (noteEl) noteEl.value = '';
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

async function undoPoop() {
    try {
        const result = await API.undoPoop();
        if (result.success) {
            showToast('↩️ 已撤销');
            loadTodayData();
        } else {
            showToast('⚠️ 没有可撤销的记录');
        }
    } catch (error) {
        showToast('撤销失败: ' + error.message);
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
        await API.recordWake({ time });
        closeModal('wake-modal');
        showToast('⏰ 起床打卡成功');
        loadTodayData();
    } catch (error) {
        showToast('打卡失败: ' + error.message);
    }
}

async function submitBed() {
    const timeEl = get('actual-bed-time');
    const time = timeEl ? timeEl.value : new Date().toTimeString().slice(0, 5);
    
    try {
        await API.recordBed({
            time,
            sleepiness_level: CONFIG.DEFAULT_SLEEPINESS_LEVEL
        });
        closeModal('bed-modal');
        showToast('🌙 入睡打卡成功');
        loadTodayData();
    } catch (error) {
        showToast('打卡失败: ' + error.message);
    }
}

function setSleepQuality(n) {
    AppState.setSleepQuality(n);
}

function updateSleepQualityUI(n) {
    document.querySelectorAll('.quality-star').forEach((btn, idx) => {
        if (btn) btn.textContent = idx < n ? '⭐' : '☆';
    });
}

async function submitSleepQuality() {
    try {
        await API.recordSleepQuality({ quality: AppState.currentSleepQuality });
        closeModal('sleep-quality-modal');
        showToast('📊 睡眠质量记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

// 饮食
async function openMealModal(type) {
    const food = prompt('吃了什么？');
    if (!food) return;
    
    try {
        await API.updateMeal({
            type: type,
            food: truncate(food, CONFIG.MAX_TEXT_LENGTH),
            time: new Date().toTimeString().slice(0, 5),
            duration: 20
        });
        showToast('🍽️ 饮食记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

// 运动
async function openSportModal() {
    const type = prompt('运动类型？(跑步/游泳/高尔夫等)');
    if (!type) return;
    const duration = prompt('时长（分钟）？');
    
    try {
        await API.addSport({
            type: truncate(type, 50),
            duration: parseInt(duration) || 30,
            intensity: CONFIG.DEFAULT_INTENSITY
        });
        showToast('🏃 运动记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

// 练嗓
async function openVoiceModal() {
    const duration = prompt('练嗓时长（分钟）？');
    if (!duration) return;
    
    try {
        await API.addVoice({
            duration: parseInt(duration),
            type: '发声'
        });
        showToast('🎤 练嗓记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

// 自定义模块
async function openCustomModal() {
    const name = prompt('模块名称？');
    if (!name) return;
    const value = prompt('记录值？');
    
    try {
        await API.addCustom({
            module_name: truncate(name, 50),
            value: truncate(value, CONFIG.MAX_TEXT_LENGTH)
        });
        showToast('✅ 自定义记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败: ' + error.message);
    }
}

// 数据看板
function loadDataDashboard() {
    showToast('📊 数据看板加载中...');
}

function loadWeeklyStats() {
    // 实现图表加载
}