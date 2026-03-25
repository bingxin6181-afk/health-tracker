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
// 状态管理
// ============================================
const AppState = {
    currentPoopStar: CONFIG.DEFAULT_SMOOTHNESS,
    currentSleepStar: 3,
    currentSportStar: CONFIG.DEFAULT_INTENSITY,
    selectedMealType: null,

    setPoopStar(n) {
        this.currentPoopStar = n;
        updateStarUI('poop-stars', n);
    },

    setSleepStar(n) {
        this.currentSleepStar = n;
        updateStarUI('sleep-stars', n);
    },

    setSportStar(n) {
        this.currentSportStar = n;
        updateStarUI('sport-stars', n);
    }
};

// ============================================
// 工具函数
// ============================================
function get(id) {
    return document.getElementById(id);
}

function showToast(msg) {
    const toast = get('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function openModal(id) {
    get(id).classList.add('active');
}

function closeModal(id) {
    get(id).classList.remove('active');
}

function updateStarUI(containerId, count) {
    const container = get(containerId);
    if (!container) return;
    const stars = container.querySelectorAll('.star-btn');
    stars.forEach((btn, idx) => {
        btn.classList.toggle('active', idx < count);
    });
}

function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${month}月${day}日 ${weekdays[date.getDay()]}`;
}

// ============================================
// API 层
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
                throw new Error('请求超时');
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

    getToday() {
        return this.get('/api/today');
    },

    addWater() {
        return this.post('/api/water');
    },

    addPee() {
        return this.post('/api/pee');
    },

    addPoop(data) {
        return this.post('/api/poop', data);
    },

    updateMeal(data) {
        return this.post('/api/meal', data);
    },

    addSport(data) {
        return this.post('/api/sport', data);
    },

    recordSleep(data) {
        return this.post('/api/sleep/quality', data);
    }
};

// ============================================
// UI 更新
// ============================================
function updateDashboard(data) {
    const waterCount = data.water_logs?.length || 0;
    const peeCount = data.pee_logs?.length || 0;
    const poopCount = data.poop_logs?.length || 0;

    get('water-count').textContent = waterCount;
    get('pee-count').textContent = peeCount;
    get('poop-count').textContent = poopCount;

    // 睡眠信息
    let sleepText = '--';
    if (data.wake_up_actual && data.bed_time_actual) {
        sleepText = '已记录';
    } else if (data.wake_up_actual) {
        sleepText = data.wake_up_actual;
    } else if (data.bed_time_actual) {
        sleepText = data.bed_time_actual;
    }
    get('sleep-info').textContent = sleepText;
}

function renderLogs(data) {
    const container = get('today-logs');
    const logs = [];

    // 喝水记录
    if (data.water_logs?.length > 0) {
        const lastTime = data.water_logs[data.water_logs.length - 1];
        logs.push({
            icon: '💧',
            bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
            title: `喝水 x${data.water_logs.length}`,
            time: `最新 ${lastTime}`,
            value: `${data.water_logs.length}杯`
        });
    }

    // 排尿记录
    if (data.pee_logs?.length > 0) {
        const lastTime = data.pee_logs[data.pee_logs.length - 1];
        logs.push({
            icon: '🚽',
            bg: 'linear-gradient(135deg, #E0F7FA, #B2EBF2)',
            title: `排尿 x${data.pee_logs.length}`,
            time: `最新 ${lastTime.time || '刚刚'}`,
            value: `${data.pee_logs.length}次`
        });
    }

    // 排便记录
    if (data.poop_logs?.length > 0) {
        const last = data.poop_logs[data.poop_logs.length - 1];
        logs.push({
            icon: '💩',
            bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
            title: '排便 ' + '⭐'.repeat(last.smoothness || 3),
            time: last.time,
            value: last.note || '无备注'
        });
    }

    // 三餐记录
    if (data.meals) {
        const icons = { breakfast: '🍳', lunch: '🍱', dinner: '🍲' };
        const names = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
        const bgs = {
            breakfast: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
            lunch: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)',
            dinner: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)'
        };

        ['breakfast', 'lunch', 'dinner'].forEach(type => {
            const meal = data.meals[type];
            if (meal?.time) {
                logs.push({
                    icon: icons[type],
                    bg: bgs[type],
                    title: names[type],
                    time: meal.time,
                    value: meal.food || '未备注'
                });
            }
        });
    }

    // 运动记录
    if (data.sports?.length > 0) {
        data.sports.forEach(sport => {
            logs.push({
                icon: '🏃',
                bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD9)',
                title: sport.type || '运动',
                time: sport.time || '刚刚',
                value: `${sport.duration}分钟`
            });
        });
    }

    // 睡眠记录
    if (data.sleep_quality) {
        logs.push({
            icon: '😴',
            bg: 'linear-gradient(135deg, #EDE7F6, #D1C4E9)',
            title: '睡眠质量',
            time: data.bed_time_actual || '',
            value: '⭐'.repeat(data.sleep_quality)
        });
    }

    // 渲染
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div>今天还没有记录哦</div>
            </div>
        `;
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-icon" style="background: ${log.bg}">${log.icon}</div>
            <div class="log-content">
                <div class="log-title">${log.title}</div>
                <div class="log-time">${log.time}</div>
            </div>
            <div class="log-value">${log.value}</div>
        </div>
    `).join('');
}

// ============================================
// 数据加载
// ============================================
async function loadTodayData() {
    try {
        const data = await API.getToday();
        updateDashboard(data);
        renderLogs(data);
    } catch (error) {
        console.error('加载失败:', error);
        showToast('加载失败: ' + error.message);
    }
}

// ============================================
// 快速操作
// ============================================
async function quickWater() {
    try {
        const result = await API.addWater();
        if (result.success) {
            showToast(`💧 第${result.cup}杯水`);
            if (navigator.vibrate) navigator.vibrate(50);
            loadTodayData();
        }
    } catch (error) {
        showToast('记录失败');
    }
}

async function quickPee() {
    try {
        const result = await API.addPee();
        if (result.success) {
            showToast('🚽 排尿已记录');
            loadTodayData();
        }
    } catch (error) {
        showToast('记录失败');
    }
}

// ============================================
// 模态框操作
// ============================================
function openPoopModal() {
    openModal('poop-modal');
    AppState.setPoopStar(CONFIG.DEFAULT_SMOOTHNESS);
    get('poop-note').value = '';
}

function setPoopStar(n) {
    AppState.setPoopStar(n);
}

async function submitPoop() {
    const note = get('poop-note').value.slice(0, CONFIG.MAX_NOTE_LENGTH);

    try {
        await API.addPoop({
            smoothness: AppState.currentPoopStar,
            note: note
        });
        closeModal('poop-modal');
        showToast('💩 记录成功');
        loadTodayData();
    } catch (error) {
        showToast('记录失败');
    }
}

// 用餐
function openMealModal() {
    openModal('meal-modal');
    AppState.selectedMealType = null;
    document.querySelectorAll('.meal-option').forEach(opt => opt.classList.remove('selected'));
    get('meal-food').value = '';
    get('meal-duration').value = '20';
}

function selectMeal(type) {
    AppState.selectedMealType = type;
    document.querySelectorAll('.meal-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.type === type);
    });
}

async function submitMeal() {
    if (!AppState.selectedMealType) {
        showToast('请选择餐次');
        return;
    }

    const food = get('meal-food').value.slice(0, CONFIG.MAX_TEXT_LENGTH);
    const duration = parseInt(get('meal-duration').value) || 20;

    try {
        await API.updateMeal({
            type: AppState.selectedMealType,
            food: food,
            duration: duration,
            time: new Date().toTimeString().slice(0, 5)
        });
        closeModal('meal-modal');
        showToast('🍽️ 用餐已记录');
        loadTodayData();
    } catch (error) {
        showToast('记录失败');
    }
}

// 运动
function openSportModal() {
    openModal('sport-modal');
    AppState.setSportStar(CONFIG.DEFAULT_INTENSITY);
    get('sport-type').value = '';
    get('sport-duration').value = '30';
}

function setSportStar(n) {
    AppState.setSportStar(n);
}

async function submitSport() {
    const type = get('sport-type').value.slice(0, 50);
    const duration = parseInt(get('sport-duration').value) || 30;

    if (!type) {
        showToast('请输入运动类型');
        return;
    }

    try {
        await API.addSport({
            type: type,
            duration: duration,
            intensity: AppState.currentSportStar
        });
        closeModal('sport-modal');
        showToast('🏃 运动已记录');
        loadTodayData();
    } catch (error) {
        showToast('记录失败');
    }
}

// 睡眠
function openSleepModal() {
    openModal('sleep-modal');
    AppState.setSleepStar(3);
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    get('wake-time').value = '';
    get('bed-time').value = '';
}

function setSleepStar(n) {
    AppState.setSleepStar(n);
}

async function submitSleep() {
    const wakeTime = get('wake-time').value;
    const bedTime = get('bed-time').value;

    if (!wakeTime && !bedTime) {
        showToast('请至少填写一个时间');
        return;
    }

    try {
        if (wakeTime) {
            await API.post('/api/sleep/wake', { time: wakeTime });
        }
        if (bedTime) {
            await API.post('/api/sleep/bed', {
                time: bedTime,
                sleepiness_level: 3
            });
        }

        await API.recordSleep({ quality: AppState.currentSleepStar });

        closeModal('sleep-modal');
        showToast('😴 睡眠已记录');
        loadTodayData();
    } catch (error) {
        showToast('记录失败');
    }
}

// ============================================
// Tab 切换
// ============================================
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    if (tab === 'today') {
        loadTodayData();
    } else if (tab === 'data') {
        showToast('📊 数据看板开发中');
    } else if (tab === 'settings') {
        showToast('⚙️ 设置开发中');
    }
}

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 设置日期
    get('current-date').textContent = formatDate(new Date());

    // 加载数据
    loadTodayData();

    // 设置默认时间
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const wakeInput = get('wake-time');
    const bedInput = get('bed-time');
    if (wakeInput) wakeInput.value = timeStr;
    if (bedInput) bedInput.value = timeStr;
});

// 点击遮罩关闭模态框
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});
