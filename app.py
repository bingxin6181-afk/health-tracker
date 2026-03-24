from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from datetime import datetime, date, timedelta
import os
import logging
from functools import wraps
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 配置常量
DEFAULT_USER_ID = "default_user"
DEFAULT_SLEEPINESS_LEVEL = 3
DEFAULT_INTENSITY = 3
DEFAULT_SMOOTHNESS = 3
WATER_CUP_ML = 250

# Supabase配置
try:
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    raise

def handle_errors(f):
    """统一错误处理装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({"error": "Internal server error", "message": str(e)}), 500
    return decorated_function

def get_today():
    """获取今天的日期字符串"""
    return date.today().isoformat()

def get_current_time():
    """获取当前时间字符串"""
    return datetime.now().strftime("%H:%M")

def get_today_record(table: str, columns: str = "*"):
    """获取今天的健康记录"""
    today = get_today()
    result = supabase.table(table).select(columns).eq("log_date", today).execute()
    return result.data[0] if result.data else None

def validate_json(*required_fields):
    """验证请求 JSON 数据的装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 400
            
            data = request.get_json()
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return jsonify({
                    "error": "Missing required fields",
                    "missing": missing_fields
                }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route("/")
@handle_errors
def index():
    return render_template("index.html")

# API: 获取今天的记录
@app.route("/api/today", methods=["GET"])
@handle_errors
def get_today_api():
    today = get_today()
    record = get_today_record("health_logs")
    
    if not record:
        new_record = {
            "log_date": today,
            "water_logs": [],
            "pee_logs": [],
            "poop_logs": [],
            "meals": {
                "breakfast": {"time": None, "food": "", "duration": 0},
                "lunch": {"time": None, "food": "", "duration": 0},
                "dinner": {"time": None, "food": "", "duration": 0}
            },
            "sports": [],
            "voice_practice": [],
            "custom_modules": {}
        }
        result = supabase.table("health_logs").insert(new_record).execute()
        return jsonify(result.data[0] if result.data else {})
    
    return jsonify(record)

# API: 记录喝水
@app.route("/api/water", methods=["POST"])
@handle_errors
def add_water():
    today = get_today()
    current_time = get_current_time()
    record = get_today_record("health_logs", "water_logs")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    water_logs = record.get("water_logs") or []
    water_logs.append(current_time)
    
    supabase.table("health_logs").update({
        "water_logs": water_logs,
        "total_water": len(water_logs) * WATER_CUP_ML
    }).eq("log_date", today).execute()
    
    logger.info(f"Water logged: cup {len(water_logs)} at {current_time}")
    return jsonify({"success": True, "time": current_time, "cup": len(water_logs)})

# API: 撤销喝水
@app.route("/api/water/undo", methods=["POST"])
@handle_errors
def undo_water():
    today = get_today()
    record = get_today_record("health_logs", "water_logs")
    
    if not record or not record.get("water_logs"):
        return jsonify({"success": False, "message": "没有可撤销的记录"})
    
    water_logs = record["water_logs"]
    if len(water_logs) > 0:
        removed_time = water_logs.pop()
        
        supabase.table("health_logs").update({
            "water_logs": water_logs,
            "total_water": len(water_logs) * WATER_CUP_ML
        }).eq("log_date", today).execute()
        
        logger.info(f"Water undone: {removed_time}, remaining: {len(water_logs)}")
        return jsonify({"success": True, "removed": removed_time, "remaining": len(water_logs)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 记录排尿
@app.route("/api/pee", methods=["POST"])
@handle_errors
def add_pee():
    today = get_today()
    current_time = get_current_time()
    record = get_today_record("health_logs", "pee_logs")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    pee_logs = record.get("pee_logs") or []
    pee_logs.append({"time": current_time})
    
    supabase.table("health_logs").update({
        "pee_logs": pee_logs
    }).eq("log_date", today).execute()
    
    logger.info(f"Pee logged at {current_time}")
    return jsonify({"success": True, "time": current_time})

# API: 记录排便
@app.route("/api/poop", methods=["POST"])
@handle_errors
@validate_json()
def add_poop():
    data = request.get_json()
    today = get_today()
    current_time = get_current_time()
    record = get_today_record("health_logs", "poop_logs")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    # 验证 smoothness 范围
    smoothness = data.get("smoothness", DEFAULT_SMOOTHNESS)
    if not isinstance(smoothness, int) or smoothness < 1 or smoothness > 5:
        return jsonify({"error": "smoothness must be between 1 and 5"}), 400
    
    poop_logs = record.get("poop_logs") or []
    poop_logs.append({
        "time": current_time,
        "smoothness": smoothness,
        "note": str(data.get("note", ""))[:500]  # 限制长度，防止存储过大
    })
    
    supabase.table("health_logs").update({
        "poop_logs": poop_logs
    }).eq("log_date", today).execute()
    
    logger.info(f"Poop logged: {smoothness} stars at {current_time}")
    return jsonify({"success": True})

# API: 撤销排便
@app.route("/api/poop/undo", methods=["POST"])
@handle_errors
def undo_poop():
    today = get_today()
    record = get_today_record("health_logs", "poop_logs")
    
    if not record or not record.get("poop_logs"):
        return jsonify({"success": False, "message": "没有可撤销的记录"})
    
    poop_logs = record["poop_logs"]
    if len(poop_logs) > 0:
        poop_logs.pop()
        
        supabase.table("health_logs").update({
            "poop_logs": poop_logs
        }).eq("log_date", today).execute()
        
        return jsonify({"success": True, "remaining": len(poop_logs)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 记录三餐
@app.route("/api/meal", methods=["POST"])
@handle_errors
@validate_json("type")
def update_meal():
    data = request.get_json()
    today = get_today()
    
    # 验证 meal_type
    valid_meal_types = ["breakfast", "lunch", "dinner"]
    meal_type = data.get("type")
    if meal_type not in valid_meal_types:
        return jsonify({"error": f"Invalid meal type. Must be one of: {valid_meal_types}"}), 400
    
    record = get_today_record("health_logs", "meals")
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    meals = record.get("meals", {})
    meals[meal_type] = {
        "time": data.get("time", get_current_time()),
        "plan_time": data.get("plan_time"),
        "food": str(data.get("food", ""))[:200],
        "duration": max(0, int(data.get("duration", 0))),
        "calories": data.get("calories"),
        "is_social": bool(data.get("is_social", False)),
        "companions": str(data.get("companions", ""))[:100],
        "topic": str(data.get("topic", ""))[:200],
        "thoughts": str(data.get("thoughts", ""))[:500]
    }
    
    supabase.table("health_logs").update({
        "meals": meals
    }).eq("log_date", today).execute()
    
    logger.info(f"Meal logged: {meal_type}")
    return jsonify({"success": True})

# API: 睡眠计划
@app.route("/api/sleep/plan", methods=["POST"])
@handle_errors
def set_sleep_plan():
    data = request.get_json() or {}
    today = date.today()
    
    plan_data = {
        "user_id": DEFAULT_USER_ID,
        "wake_up_plan": data.get("wake_up_plan"),
        "bed_time_plan": data.get("bed_time_plan"),
        "effective_from": today.isoformat(),
        "effective_to": data.get("effective_to", today.isoformat())
    }
    
    supabase.table("sleep_plans").insert(plan_data).execute()
    logger.info("Sleep plan created")
    return jsonify({"success": True})

@app.route("/api/sleep/plan/today", methods=["GET"])
@handle_errors
def get_today_plan():
    today = get_today()
    result = supabase.table("sleep_plans").select("*").lte("effective_from", today).gte("effective_to", today).execute()
    return jsonify(result.data[0] if result.data else {})

# API: 起床打卡
@app.route("/api/sleep/wake", methods=["POST"])
@handle_errors
@validate_json()
def record_wake():
    data = request.get_json()
    today = get_today()
    
    # 验证时间格式
    time_val = data.get("time")
    if time_val and not isinstance(time_val, str):
        return jsonify({"error": "time must be a string"}), 400
    
    update_data = {
        "wake_up_actual": time_val,
        "wake_up_date": today,
        "is_late": bool(data.get("is_late", False)),
        "late_minutes": max(0, int(data.get("late_minutes", 0)))
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    logger.info(f"Wake up recorded: {time_val}")
    return jsonify({"success": True})

# API: 入睡打卡
@app.route("/api/sleep/bed", methods=["POST"])
@handle_errors
@validate_json()
def record_bed():
    data = request.get_json()
    today = get_today()
    
    time_val = data.get("time")
    sleepiness = data.get("sleepiness_level", DEFAULT_SLEEPINESS_LEVEL)
    
    # 验证 sleepiness 范围
    if not isinstance(sleepiness, int) or sleepiness < 1 or sleepiness > 5:
        return jsonify({"error": "sleepiness_level must be between 1 and 5"}), 400
    
    update_data = {
        "bed_time_actual": time_val,
        "bed_time_date": today,
        "sleepiness_level": sleepiness
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    logger.info(f"Bed time recorded: {time_val}, sleepiness: {sleepiness}")
    return jsonify({"success": True})

# API: 睡眠质量（次日打卡）
@app.route("/api/sleep/quality", methods=["POST"])
@handle_errors
@validate_json()
def record_sleep_quality():
    data = request.get_json()
    today = get_today()
    
    quality = data.get("quality")
    if quality is not None:
        if not isinstance(quality, int) or quality < 1 or quality > 5:
            return jsonify({"error": "quality must be between 1 and 5"}), 400
    
    update_data = {
        "sleep_quality": quality,
        "sleep_note": str(data.get("note", ""))[:500]
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    logger.info(f"Sleep quality recorded: {quality}")
    return jsonify({"success": True})

# API: 记录运动
@app.route("/api/sport", methods=["POST"])
@handle_errors
@validate_json()
def add_sport():
    data = request.get_json()
    today = get_today()
    record = get_today_record("health_logs", "sports")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    # 验证强度范围
    intensity = data.get("intensity", DEFAULT_INTENSITY)
    if not isinstance(intensity, int) or intensity < 1 or intensity > 5:
        return jsonify({"error": "intensity must be between 1 and 5"}), 400
    
    duration = max(0, int(data.get("duration", 0)))
    
    sports = record.get("sports") or []
    sports.append({
        "type": str(data.get("type", "运动"))[:50],
        "duration": duration,
        "intensity": intensity,
        "time": data.get("time", get_current_time())
    })
    
    supabase.table("health_logs").update({
        "sports": sports
    }).eq("log_date", today).execute()
    
    logger.info(f"Sport logged: {duration}min, intensity {intensity}")
    return jsonify({"success": True})

# API: 撤销运动
@app.route("/api/sport/undo", methods=["POST"])
@handle_errors
def undo_sport():
    today = get_today()
    record = get_today_record("health_logs", "sports")
    
    if not record or not record.get("sports"):
        return jsonify({"success": False, "message": "没有可撤销的记录"})
    
    sports = record["sports"]
    if len(sports) > 0:
        removed = sports.pop()
        
        supabase.table("health_logs").update({
            "sports": sports
        }).eq("log_date", today).execute()
        
        return jsonify({"success": True, "removed_type": removed.get("type"), "remaining": len(sports)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 练嗓记录
@app.route("/api/voice", methods=["POST"])
@handle_errors
@validate_json()
def add_voice():
    data = request.get_json()
    today = get_today()
    record = get_today_record("health_logs", "voice_practice")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    duration = max(0, int(data.get("duration", 0)))
    
    voice_logs = record.get("voice_practice") or []
    voice_logs.append({
        "time": get_current_time(),
        "duration": duration,
        "type": str(data.get("type", "发声"))[:20],
        "note": str(data.get("note", ""))[:500],
        "has_audio": bool(data.get("has_audio", False))
    })
    
    supabase.table("health_logs").update({
        "voice_practice": voice_logs
    }).eq("log_date", today).execute()
    
    logger.info(f"Voice practice logged: {duration}min")
    return jsonify({"success": True})

# API: 自定义模块
@app.route("/api/custom", methods=["POST"])
@handle_errors
@validate_json("module_name")
def add_custom_record():
    data = request.get_json()
    today = get_today()
    record = get_today_record("health_logs", "custom_modules")
    
    if not record:
        return jsonify({"error": "Record not found"}), 404
    
    module_name = str(data.get("module_name", ""))[:50]
    if not module_name:
        return jsonify({"error": "module_name cannot be empty"}), 400
    
    custom = record.get("custom_modules") or {}
    if module_name not in custom:
        custom[module_name] = []
    
    custom[module_name].append({
        "time": get_current_time(),
        "value": str(data.get("value", ""))[:200],
        "note": str(data.get("note", ""))[:500]
    })
    
    supabase.table("health_logs").update({
        "custom_modules": custom
    }).eq("log_date", today).execute()
    
    logger.info(f"Custom module logged: {module_name}")
    return jsonify({"success": True})

# API: 获取统计（支持天数参数）
@app.route("/api/stats", methods=["GET"])
@handle_errors
def get_stats():
    days = request.args.get('days', 7, type=int)
    
    # 限制最大天数，防止查询过大
    if days < 1 or days > 365:
        return jsonify({"error": "days must be between 1 and 365"}), 400
    
    start_date = (date.today() - timedelta(days=days)).isoformat()
    
    result = supabase.table("health_logs").select("*").gte("log_date", start_date).order("log_date").execute()
    return jsonify(result.data)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)