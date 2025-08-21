from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import os
import json
from datetime import datetime, timedelta
import secrets

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

USER_FILE = 'users.json'
RESET_CODE_TTL_MINUTES = 15

if os.path.exists(USER_FILE):
    with open(USER_FILE, 'r') as f:
        users = json.load(f)
else:
    users = {}

def save_users():
    """Persist users dict to USERS_FILE"""
    with open(USER_FILE, 'w') as f:
        json.dump(users, f, indent=4)

def get_available_quizzes():
    """Reads the quizzes directory to get all available quizzes by topic."""
    quizzes = {}
    quiz_dir = os.path.join(os.path.dirname(__file__), 'quizzes')
    if os.path.exists(quiz_dir):
        for topic in os.listdir(quiz_dir):
            topic_path = os.path.join(quiz_dir, topic)
            if os.path.isdir(topic_path):
                quizzes[topic.capitalize()] = [f for f in os.listdir(topic_path) if f.endswith('.json')]
    return quizzes

def compute_badges_for_user(user):
    """
    Recompute badges for a user based on history.
    Rules (tiered):
      - Beginner: at least 1 quiz taken
      - Learner: at least 5 quizzes and average score >= 3
      - Performer: any quiz with score >= 4
      - Expert: >=3 quizzes with score >=4 in same topic
      - Master: any perfect score (score == total questions for that quiz)
      - Legend: >=3 perfect scores in same topic
    """
    badges = set()

    history = user.get('history', [])
    if not history:
        # default
        badges.add("Beginner")
        return sorted(list(badges))

    badges.add("Beginner")

    total_quizzes = len(history)
    total_score = sum(entry.get('score', 0) for entry in history)
    avg_score = total_score / total_quizzes if total_quizzes else 0

    if total_quizzes >= 5 and avg_score >= 3:
        badges.add("Learner")

    if any(entry.get('score', 0) >= 4 for entry in history):
        badges.add("Performer")

    topic_scores = {}
    topic_quiz_counts = {}
    topic_perfect_counts = {}
    for entry in history:
        quiz_title = entry.get('quiz', '')
        # infer topic from first word (same logic as frontend)
        topic = quiz_title.split(" ")[0] if quiz_title else "General"
        score = entry.get('score', 0)

        topic_scores.setdefault(topic, []).append(score)
        topic_quiz_counts[topic] = topic_quiz_counts.get(topic, 0) + 1

        total_q = entry.get('total_questions')
        if total_q is not None:
            if score == total_q:
                topic_perfect_counts[topic] = topic_perfect_counts.get(topic, 0) + 1

    # Expert: >=3 quizzes with score >=4 in same topic
    for topic, scores in topic_scores.items():
        high_scores = sum(1 for s in scores if s >= 4)
        if high_scores >= 3:
            badges.add("Expert")

    # Master: any perfect score (if we have total_questions info)
    if any(entry.get('total_questions') is not None and entry.get('score', 0) == entry.get('total_questions') for entry in history):
        badges.add("Master")

    # Legend: >=3 perfect scores in same topic (based on recorded perfect counts)
    for topic, perfect_count in topic_perfect_counts.items():
        if perfect_count >= 3:
            badges.add("Legend")

    # Always return sorted list for stable ordering
    return sorted(list(badges))


@app.route('/')
def home():
    username = session.get('username')
    user = users.get(username)
    if not user:
        return redirect(url_for('login'))
    return render_template('index.html', user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if username in users and users[username]['password'] == password:
            session['username'] = username
            users[username].setdefault('stats', {})
            users[username]['stats']['last_login'] = datetime.now().strftime("%Y-%m-%d %H:%M")
            save_users()
            return redirect(url_for('home'))
        return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    confirm_password = request.form['confirm_password']
    email = request.form.get('email', '')

    # Optional security question fields (may be empty)
    security_question = request.form.get('security_question', '').strip()
    security_answer = request.form.get('security_answer', '').strip()

    if username in users:
        return render_template('login.html', register_error="Username already exists")
    if password != confirm_password:
        return render_template('login.html', register_error="Passwords don't match")

    users[username] = {
        "password": password,
        "name": username,
        "email": email,
        "badges": ["Beginner"],
        "stats": {
            "quizzes_taken": 0,
            "total_score": 0,
            "last_login": datetime.now().strftime("%Y-%m-%d %H:%M")
        },
        "history": []
    }

    # Store optional security question + (hashed?) answer
    if security_question and security_answer:
        users[username]['security_question'] = security_question
        users[username]['security_answer'] = security_answer  

    save_users()
    session['username'] = username
    return redirect(url_for('home'))

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/submit_result', methods=['POST'])
def submit_result():
    if 'username' not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()
    score = data.get('score', 0)
    quiz_title = data.get('quiz_title', '')
    answers = data.get('answers', [])
    total_questions = data.get('total_questions')  

    user = users.get(session['username'])
    if user:
        # Update stats
        user.setdefault('stats', {})
        user['stats']['quizzes_taken'] = user['stats'].get('quizzes_taken', 0) + 1
        user['stats']['total_score'] = user['stats'].get('total_score', 0) + score

        # Save quiz history (include total_questions if provided)
        history_item = {
            "quiz": quiz_title,
            "score": score,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        if total_questions is not None:
            history_item['total_questions'] = int(total_questions)

        user.setdefault('history', []).append(history_item)

        # Recompute badges based on updated history
        new_badges = compute_badges_for_user(user)
        user['badges'] = new_badges

        save_users()
        return jsonify({"message": "Stats updated", "badges": new_badges})

    return jsonify({"error": "User not found"}), 404


@app.route('/api/performance')
def get_performance_data():
    username = session.get('username')
    if not username:
        return jsonify({"error": "Not logged in"}), 401

    user = users.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    history = user.get('history', [])
    
    # Get total available quizzes to calculate completion percentage
    available_quizzes = get_available_quizzes()

    # Aggregate data from user history
    quiz_attempts_by_topic = {}
    total_scores_by_topic = {}
    
    for entry in history:
        quiz_title = entry.get('quiz', '')
        score = entry.get('score', 0)
        # Infer topic from the first word of the quiz title (e.g., "Python Basics")
        topic = quiz_title.split(" ")[0].capitalize() if quiz_title else "General"

        quiz_attempts_by_topic[topic] = quiz_attempts_by_topic.get(topic, 0) + 1
        total_scores_by_topic[topic] = total_scores_by_topic.get(topic, 0) + score

    # Structure data for the frontend
    performance_data = {
        'completion': {},
        'scores': {},
        'badges': []
    }

    # Calculate completion percentages
    for topic, quizzes in available_quizzes.items():
        total_quizzes = len(quizzes)
        attempts = quiz_attempts_by_topic.get(topic, 0)
        percentage = (attempts / total_quizzes) * 100 if total_quizzes > 0 else 0
        performance_data['completion'][topic] = round(percentage)

    performance_data['scores'] = total_scores_by_topic

    # Create a simple badge progress tracker (placeholder logic)
    # This logic is a simplified representation. A real implementation would need more complex rules.
    for topic, completion in performance_data['completion'].items():
        if completion < 50:
            next_badge = f"{topic} Beginner"
            to_go = "More quizzes to go"
        elif completion < 80:
            next_badge = f"{topic} Intermediate"
            to_go = f"{80 - completion}% to the next badge"
        else:
            next_badge = f"{topic} Master"
            to_go = "You've earned the highest badge!"
        
        performance_data['badges'].append({
            'topic': topic,
            'progress': completion,
            'next_badge': next_badge,
            'to_go': to_go
        })

    return jsonify(performance_data)


@app.route('/api/badges')
def get_badge_data():
    username = session.get('username')
    if not username:
        return jsonify({"error": "Not logged in"}), 401

    user = users.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Get earned badges from user
    earned = user.get('badges', [])

    # Build simple progress data (you can expand rules later)
    progress = {
        "beginner": 1 if "Beginner" in earned else 0,
        "learner": sum(1 for h in user.get("history", [])),  # quizzes taken
        "performer": 1 if any(h.get("score", 0) >= 4 for h in user.get("history", [])) else 0,
        "expert": sum(1 for h in user.get("history", []) if h.get("score", 0) >= 4),
    }

    return jsonify({
        "earned": [b.lower() for b in earned],
        "progress": progress
    })

# --------------------
# Quizzes listing/loaders (unchanged)
# --------------------
@app.route('/quizzes')
def list_quizzes():
    quizzes = {}
    quiz_dir = os.path.join(os.path.dirname(__file__), 'quizzes')
    for topic in os.listdir(quiz_dir):
        topic_path = os.path.join(quiz_dir, topic)
        if os.path.isdir(topic_path):
            quizzes[topic] = []
            for quiz_file in os.listdir(topic_path):
                if quiz_file.endswith('.json'):
                    quizzes[topic].append(quiz_file[:-5])
    return jsonify(quizzes)

@app.route('/quiz/<topic>/<quiz_name>')
def get_quiz(topic, quiz_name):
    try:
        with open(f'quizzes/{topic}/{quiz_name}.json') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "Quiz not found"}), 404

@app.route('/user_data')
def user_data():
    username = session.get('username')
    if not username or username not in users:
        return jsonify({})
    return jsonify(users[username])

# --------------------
# Forgot password flow (no email server assumed)
# --------------------
@app.route('/forgot_password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    identifier = (data.get('username_or_email') or '').strip()
    if not identifier:
        return jsonify({"error": "Provide username or email"}), 400

    # Find user by username or email
    found_user = None
    found_username = None
    for uname, u in users.items():
        if uname == identifier or (u.get('email') and u.get('email') == identifier):
            found_user = u
            found_username = uname
            break

    if not found_user:
        return jsonify({"error": "User not found"}), 404

    # If security question present, ask it
    if found_user.get('security_question'):
        return jsonify({
            "security_question": found_user['security_question'],
            "username": found_username
        })

    # Otherwise generate a reset code (no email backend) and return it to caller.
    code = secrets.token_urlsafe(6)
    expiry = (datetime.now() + timedelta(minutes=RESET_CODE_TTL_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
    found_user.setdefault('reset', {})
    found_user['reset']['code'] = code
    found_user['reset']['expires_at'] = expiry
    save_users()

    # NOTE: since no email is configured, we return the code in response.
    # Frontend should prompt user to copy/paste this code into reset form.
    return jsonify({
        "message": "Reset code generated (expires in {} minutes). Use this code to reset your password.".format(RESET_CODE_TTL_MINUTES),
        "reset_code": code,
        "username": found_username
    })

# --------------------
# Endpoint to verify security question answer and issue a short lived reset token
# --------------------
@app.route('/verify_security_answer', methods=['POST'])
def verify_security_answer():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    answer = data.get('security_answer', '').strip()

    if not username or username not in users:
        return jsonify({"error": "User not found"}), 404

    user = users[username]
    expected = user.get('security_answer')
    if expected and answer and answer.lower() == expected.lower():
        # issue reset code same as above
        code = secrets.token_urlsafe(6)
        expiry = (datetime.now() + timedelta(minutes=RESET_CODE_TTL_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
        user.setdefault('reset', {})
        user['reset']['code'] = code
        user['reset']['expires_at'] = expiry
        save_users()
        return jsonify({"message": "Verified", "reset_code": code})
    else:
        return jsonify({"error": "Incorrect answer"}), 400

# --------------------
# Change password endpoint:
# --------------------
@app.route('/change_password', methods=['POST'])
def change_password():
    # If modal form was submitted, Flask handles form-data
    if 'username' in session and 'old_password' in request.form:
        username = session['username']
        old_password = request.form.get('old_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if not old_password or not new_password or not confirm_password:
            return jsonify({"success": False, "message": "All fields are required"})

        if new_password != confirm_password:
            return jsonify({"success": False, "message": "New passwords do not match"})

        user = users.get(username)
        if not user:
            return jsonify({"success": False, "message": "User not found"})

        if user.get('password') != old_password:
            return jsonify({"success": False, "message": "Old password incorrect"})

        user['password'] = new_password
        save_users()
        return jsonify({"success": True, "message": "Password changed successfully"})

    # Mode 2: Reset password via reset code (forgot password flow)
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    reset_code = data.get('reset_code', '').strip()
    new_password = data.get('new_password', '').strip()

    if username and reset_code and new_password:
        user = users.get(username)
        if not user:
            return jsonify({"error": "User not found"}), 404

        reset_info = user.get('reset')
        if not reset_info:
            return jsonify({"error": "No reset requested for this user"}), 400

        # Check expiry
        expires_at = reset_info.get('expires_at')
        try:
            expires_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
        except Exception:
            expires_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M")

        if datetime.now() > expires_dt:
            return jsonify({"error": "Reset code expired"}), 400

        if reset_info.get('code') != reset_code:
            return jsonify({"error": "Invalid reset code"}), 400

        # All good - change password and remove reset info
        user['password'] = new_password
        user.pop('reset', None)
        save_users()
        return jsonify({"message": "Password reset successfully"})

    return jsonify({"error": "Invalid request"}), 400

# --------------------
# Run server
# --------------------
if __name__ == '__main__':
    app.run(debug=True)
