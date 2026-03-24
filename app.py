from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
from datetime import datetime, date, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Supabase配置
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

@app.route("/")
def index():
    return render_template("index.html")

# API: 获取今天的记录
@app.route("/api/today", methods=["GET"])
def get_today():
    today = date.today().isoformat()
    
    result = supabase.table("health_logs").select("*").eq("log_date", today).execute()
    
    if not result.data:
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

# API: 记录喝水
@app.route("/api/water", methods=["POST"])
def add_water():
    today = date.today().isoformat()
    current_time = datetime.now().strftime("%H:%M")
    
    record = supabase.table("health_logs").select("water_logs").eq("log_date", today).execute()
    
    if record.data:
        water_logs = record.data[0]["water_logs"] or []
        water_logs.append(current_time)
        
        supabase.table("health_logs").update({
            "water_logs": water_logs,
            "total_water": len(water_logs) * 250
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True, "time": current_time, "cup": len(water_logs)})

# API: 撤销喝水
@app.route("/api/water/undo", methods=["POST"])
def undo_water():
    today = date.today().isoformat()
    
    record = supabase.table("health_logs").select("water_logs").eq("log_date", today).execute()
    
    if record.data and record.data[0]["water_logs"]:
        water_logs = record.data[0]["water_logs"]
        if len(water_logs) > 0:
            removed_time = water_logs.pop()
            
            supabase.table("health_logs").update({
                "water_logs": water_logs,
                "total_water": len(water_logs) * 250
            }).eq("log_date", today).execute()
            
            return jsonify({"success": True, "removed": removed_time, "remaining": len(water_logs)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 记录排尿
@app.route("/api/pee", methods=["POST"])
def add_pee():
    today = date.today().isoformat()
    current_time = datetime.now().strftime("%H:%M")
    
    record = supabase.table("health_logs").select("pee_logs").eq("log_date", today).execute()
    
    if record.data:
        pee_logs = record.data[0]["pee_logs"] or []
        pee_logs.append({"time": current_time})
        
        supabase.table("health_logs").update({
            "pee_logs": pee_logs
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True, "time": current_time})

# API: 记录排便
@app.route("/api/poop", methods=["POST"])
def add_poop():
    data = request.json
    today = date.today().isoformat()
    current_time = datetime.now().strftime("%H:%M")
    
    record = supabase.table("health_logs").select("poop_logs").eq("log_date", today).execute()
    
    if record.data:
        poop_logs = record.data[0]["poop_logs"] or []
        poop_logs.append({
            "time": current_time,
            "smoothness": data.get("smoothness", 3),
            "note": data.get("note", "")
        })
        
        supabase.table("health_logs").update({
            "poop_logs": poop_logs
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True})

# API: 撤销排便
@app.route("/api/poop/undo", methods=["POST"])
def undo_poop():
    today = date.today().isoformat()
    
    record = supabase.table("health_logs").select("poop_logs").eq("log_date", today).execute()
    
    if record.data and record.data[0]["poop_logs"]:
        poop_logs = record.data[0]["poop_logs"]
        if len(poop_logs) > 0:
            poop_logs.pop()
            
            supabase.table("health_logs").update({
                "poop_logs": poop_logs
            }).eq("log_date", today).execute()
            
            return jsonify({"success": True, "remaining": len(poop_logs)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 记录三餐
@app.route("/api/meal", methods=["POST"])
def update_meal():
    data = request.json
    today = date.today().isoformat()
    meal_type = data["type"]
    
    record = supabase.table("health_logs").select("meals").eq("log_date", today).execute()
    
    if record.data:
        meals = record.data[0]["meals"]
        meals[meal_type] = {
            "time": data.get("time", datetime.now().strftime("%H:%M")),
            "plan_time": data.get("plan_time"),
            "food": data.get("food", ""),
            "duration": data.get("duration", 0),
            "calories": data.get("calories"),
            "is_social": data.get("is_social", False),
            "companions": data.get("companions", ""),
            "topic": data.get("topic", ""),
            "thoughts": data.get("thoughts", "")
        }
        
        supabase.table("health_logs").update({
            "meals": meals
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True})

# API: 睡眠计划
@app.route("/api/sleep/plan", methods=["POST"])
def set_sleep_plan():
    data = request.json
    today = date.today()
    
    plan_data = {
        "user_id": "default_user",
        "wake_up_plan": data.get("wake_up_plan"),
        "bed_time_plan": data.get("bed_time_plan"),
        "effective_from": today.isoformat(),
        "effective_to": data.get("effective_to", today.isoformat())
    }
    
    supabase.table("sleep_plans").insert(plan_data).execute()
    return jsonify({"success": True})

@app.route("/api/sleep/plan/today", methods=["GET"])
def get_today_plan():
    today = date.today().isoformat()
    result = supabase.table("sleep_plans").select("*").lte("effective_from", today).gte("effective_to", today).execute()
    return jsonify(result.data[0] if result.data else {})

# API: 起床打卡
@app.route("/api/sleep/wake", methods=["POST"])
def record_wake():
    data = request.json
    today = date.today().isoformat()
    
    update_data = {
        "wake_up_actual": data.get("time"),
        "wake_up_date": today,
        "is_late": data.get("is_late", False),
        "late_minutes": data.get("late_minutes", 0)
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    return jsonify({"success": True})

# API: 入睡打卡
@app.route("/api/sleep/bed", methods=["POST"])
def record_bed():
    data = request.json
    today = date.today().isoformat()
    
    update_data = {
        "bed_time_actual": data.get("time"),
        "bed_time_date": today,
        "sleepiness_level": data.get("sleepiness_level", 3)
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    return jsonify({"success": True})

# API: 睡眠质量（次日打卡）
@app.route("/api/sleep/quality", methods=["POST"])
def record_sleep_quality():
    data = request.json
    today = date.today().isoformat()
    
    update_data = {
        "sleep_quality": data.get("quality"),
        "sleep_note": data.get("note", "")
    }
    
    supabase.table("health_logs").update(update_data).eq("log_date", today).execute()
    return jsonify({"success": True})

# API: 记录运动
@app.route("/api/sport", methods=["POST"])
def add_sport():
    data = request.json
    today = date.today().isoformat()
    
    record = supabase.table("health_logs").select("sports").eq("log_date", today).execute()
    
    if record.data:
        sports = record.data[0]["sports"] or []
        sports.append({
            "type": data.get("type", "运动"),
            "duration": data.get("duration", 0),
            "intensity": data.get("intensity", 3),
            "time": data.get("time", datetime.now().strftime("%H:%M"))
        })
        
        supabase.table("health_logs").update({
            "sports": sports
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True})

# API: 撤销运动
@app.route("/api/sport/undo", methods=["POST"])
def undo_sport():
    today = date.today().isoformat()
    
    record = supabase.table("health_logs").select("sports").eq("log_date", today).execute()
    
    if record.data and record.data[0]["sports"]:
        sports = record.data[0]["sports"]
        if len(sports) > 0:
            removed = sports.pop()
            
            supabase.table("health_logs").update({
                "sports": sports
            }).eq("log_date", today).execute()
            
            return jsonify({"success": True, "removed_type": removed["type"], "remaining": len(sports)})
    
    return jsonify({"success": False, "message": "没有可撤销的记录"})

# API: 练嗓记录
@app.route("/api/voice", methods=["POST"])
def add_voice():
    data = request.json
    today = date.today().isoformat()
    
    record = supabase.table("health_logs").select("voice_practice").eq("log_date", today).execute()
    
    if record.data:
        voice_logs = record.data[0]["voice_practice"] or []
        voice_logs.append({
            "time": datetime.now().strftime("%H:%M"),
            "duration": data.get("duration", 0),
            "type": data.get("type", "发声"),
            "note": data.get("note", ""),
            "has_audio": data.get("has_audio", False)
        })
        
        supabase.table("health_logs").update({
            "voice_practice": voice_logs
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True})

# API: 自定义模块
@app.route("/api/custom", methods=["POST"])
def add_custom_record():
    data = request.json
    today = date.today().isoformat()
    module_name = data.get("module_name")
    
    record = supabase.table("health_logs").select("custom_modules").eq("log_date", today).execute()
    
    if record.data:
        custom = record.data[0]["custom_modules"] or {}
        if module_name not in custom:
            custom[module_name] = []
        
        custom[module_name].append({
            "time": datetime.now().strftime("%H:%M"),
            "value": data.get("value"),
            "note": data.get("note", "")
        })
        
        supabase.table("health_logs").update({
            "custom_modules": custom
        }).eq("log_date", today).execute()
    
    return jsonify({"success": True})

# API: 获取统计（支持天数参数）
@app.route("/api/stats", methods=["GET"])
def get_stats():
    days = request.args.get('days', 7, type=int)
    start_date = (date.today() - timedelta(days=days)).isoformat()
    
    result = supabase.table("health_logs").select("*").gte("log_date", start_date).order("log_date").execute()
    return jsonify(result.data)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)