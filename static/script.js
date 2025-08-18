// script.js

// ====== GLOBAL STATE VARIABLES ======
let currentQuiz = null;            // Stores currently loaded quiz JSON
let currentQuestionIndex = 0;      // Current question number in quiz
let selectedAnswers = [];          // Stores user's selected option indexes
let timerInterval;                 // Holds setInterval reference for quiz timer
let timeLeft = 60;                 // Time left for the current question
let userData = null;               // Stores current user data
let currentCharts = {};            // Stores current chart instances
const CHART_COLORS = {
    'python': '#4CAF50',
    'excel': '#2196f3',
    'sql': '#FFC107',
    'default': '#9E9E9E'
};

// ====== UI SECTION DISPLAY FUNCTIONS ======

function showSection(sectionId) {
    const sections = ['dashboard-container', 'profile-container', 'quiz-interface'];
    sections.forEach(id => {
        document.getElementById(id).style.display = (id === sectionId) ? 'block' : 'none';
    });
}

function setActiveMenuItem(menuItem) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.getElementById(menuItem);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

// ====== QUIZ TOPIC AND CHART RENDERING ======

function getTopicIcon(topic) {
    topic = topic.toLowerCase();
    if (topic.includes("excel")) return "fas fa-file-excel";
    if (topic.includes("python")) return "fab fa-python";
    if (topic.includes("sql")) return "fas fa-database";
    return "fas fa-book";
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderQuizTopics() {
    fetch('/quizzes')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('quiz-topics');
            container.innerHTML = ''; // Clear existing topics
            for (let topic in data) {
                const wrapper = document.createElement('div');
                wrapper.className = 'topic-wrapper';
                const topicHeader = document.createElement('div');
                topicHeader.className = 'quiz-topic-header';
                topicHeader.innerHTML = `
                    <i class="${getTopicIcon(topic)} topic-icon"></i>
                    <span>${capitalize(topic)}</span>
                    <i class="fas fa-chevron-down toggle-icon" style="margin-left:auto;"></i>
                `;
                const quizList = document.createElement('div');
                quizList.className = 'sub-quiz-list';
                data[topic].forEach(quiz => {
                    const quizLink = document.createElement('div');
                    quizLink.className = 'sidebar-item sub-quiz';
                    quizLink.innerHTML = `<i class="fas fa-play"></i> ${quiz}`;
                    quizLink.addEventListener('click', () => loadQuiz(topic, quiz));
                    quizList.appendChild(quizLink);
                });
                topicHeader.addEventListener('click', () => {
                    quizList.classList.toggle('collapsed');
                    topicHeader.querySelector('.toggle-icon').classList.toggle('rotate');
                });
                wrapper.appendChild(topicHeader);
                wrapper.appendChild(quizList);
                container.appendChild(wrapper);
            }
        });
}

function renderPerformanceCharts() {
    if (currentCharts.topicScore) {
        currentCharts.topicScore.destroy();
    }
    if (currentCharts.topicCompletion) {
        currentCharts.topicCompletion.destroy();
    }

    fetch('/api/performance')
        .then(res => res.json())
        .then(performanceData => {
            if (!performanceData || !performanceData.scores) return;

            const scoresByTopic = performanceData.scores;
            const scoreLabels = Object.keys(scoresByTopic);
            const scoreDataSet = Object.values(scoresByTopic);
            const scoreCtx = document.getElementById('topicScoreChart');

            if (scoreCtx && scoreLabels.length > 0) {
                currentCharts.topicScore = new Chart(scoreCtx, {
                    type: 'bar',
                    data: {
                        labels: scoreLabels,
                        datasets: [{
                            label: 'Total Score by Topic',
                            data: scoreDataSet,
                            backgroundColor: '#4caf50'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }

            const completionByTopic = performanceData.completion;
            const completionLabels = Object.keys(completionByTopic);
            const completionDataSet = Object.values(completionByTopic);
            
            // Assign a consistent color to each topic
            const completionColors = completionLabels.map(label => {
                const topic = label.toLowerCase();
                return CHART_COLORS[topic] || CHART_COLORS['default'];
            });

            const completionCtx = document.getElementById('topicCompletionChart');
            if (completionCtx && completionLabels.length > 0) {
                currentCharts.topicCompletion = new Chart(completionCtx, {
                    type: 'doughnut',
                    data: {
                        labels: completionLabels,
                        datasets: [{
                            label: 'Quizzes Completed (%)',
                            data: completionDataSet,
                            backgroundColor: completionColors,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                    }
                });
            }
        }).catch(err => {
            console.error("Performance data loading error:", err);
        });
}

function renderBadgeProgress() {
    fetch('/api/badges')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('badge-progress-container');
            container.innerHTML = ''; // Clear existing badges

            const badgeData = [
                { id: 'beginner', name: 'Beginner', icon: 'fas fa-star', target: 1, color: 'var(--badge-beginner)' },
                { id: 'learner', name: 'Learner', icon: 'fas fa-graduation-cap', target: 5, color: 'var(--badge-learner)' },
                { id: 'performer', name: 'Performer', icon: 'fas fa-award', target: 1, color: 'var(--badge-performer)' },
                { id: 'expert', name: 'Expert', icon: 'fas fa-brain', target: 3, color: 'var(--badge-expert)' },
            ];

            badgeData.forEach(badge => {
                const progress = data.progress[badge.id] || 0;
                const percentage = Math.min((progress / badge.target) * 100, 100);
                const isEarned = data.earned.includes(badge.id);

                const badgeHtml = `
                    <div class="badge-progress">
                        <div class="badge-icon" style="background-color: ${badge.color};">
                            <i class="${badge.icon}"></i>
                        </div>
                        <div class="badge-label">${badge.name}</div>
                        <div class="badge-progress-bar">
                            <div class="badge-progress-fill" style="width: ${percentage}%; background-color: ${badge.color};"></div>
                        </div>
                        <div class="badge-count">${isEarned ? 'Earned' : `${progress} / ${badge.target}`}</div>
                    </div>
                `;
                container.innerHTML += badgeHtml;
            });
        }).catch(err => {
            console.error("Badge data loading error:", err);
        });
}


// ====== CORE QUIZ LOGIC (Unchanged from previous versions) ======
function loadQuiz(topic, quizName) {
    fetch(`/quiz/${topic}/${quizName}`)
        .then(res => res.json())
        .then(data => {
            currentQuiz = data;
            currentQuestionIndex = 0;
            selectedAnswers = new Array(data.questions.length).fill(null);
            renderQuestion();
            startTimer();
        });
}

function saveCurrentAnswer() {
    const selected = document.querySelector('input[name="option"]:checked');
    if (selected) {
        selectedAnswers[currentQuestionIndex] = parseInt(selected.value);
    }
}

function renderQuestion() {
    const quizInterface = document.getElementById('quiz-interface');
    const q = currentQuiz.questions[currentQuestionIndex];

    let optionsHtml = '';
    const prevSelected = selectedAnswers[currentQuestionIndex];

    q.options.forEach((opt, i) => {
        const checked = (prevSelected !== null && !isNaN(prevSelected) && parseInt(prevSelected) === i) ? 'checked' : '';
        optionsHtml += `
            <label class="option">
                <input type="radio" name="option" value="${i}" ${checked}>
                ${opt}
            </label>
        `;
    });

    let progress = `Question ${currentQuestionIndex + 1} / ${currentQuiz.questions.length}`;
    let timeText = `Time Left: <span id="timer">${timeLeft}s</span>`;

    quizInterface.innerHTML = `
        <div class="quiz-header">
            <h2>${currentQuiz.title}</h2>
            <div class="quiz-progress">${progress}</div>
            <div class="quiz-timer">${timeText}</div>
        </div>
        <div class="question-card">
            <p><strong>${q.question}</strong></p>
            <div class="options">
                ${optionsHtml}
            </div>
        </div>
        <div class="quiz-navigation">
            <button class="quiz-btn" onclick="prevQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''}>Previous</button>
            <button class="quiz-btn" onclick="nextQuestion()" ${currentQuestionIndex === currentQuiz.questions.length - 1 ? 'style=\'display:none\'' : ''}>Next</button>
            ${currentQuestionIndex === currentQuiz.questions.length - 1 ? `<button class="quiz-btn" onclick="submitQuiz()">Submit</button>` : ''}
        </div>
    `;

    const radios = quizInterface.querySelectorAll('input[name="option"]');
    radios.forEach(r => {
        r.addEventListener('change', () => {
            selectedAnswers[currentQuestionIndex] = parseInt(r.value);
        });
    });

    startTimer();
    showSection('quiz-interface');
}

function nextQuestion() {
    saveCurrentAnswer();
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    saveCurrentAnswer();
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function startTimer() {
    timeLeft = 60;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const timerEl = document.getElementById("timer");
        if (timerEl) timerEl.innerText = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            saveCurrentAnswer();
            if (currentQuestionIndex < currentQuiz.questions.length - 1) {
                currentQuestionIndex++;
                renderQuestion();
            } else {
                submitQuiz();
            }
        }
        timeLeft--;
    }, 1000);
}

function submitQuiz() {
    saveCurrentAnswer();
    let score = 0;
    currentQuiz.questions.forEach((q, i) => {
        const userAns = selectedAnswers[i];
        if (userAns !== null && !isNaN(userAns) && parseInt(userAns) === parseInt(q.correct)) {
            score++;
        }
    });

    clearInterval(timerInterval);

    fetch('/submit_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            score: score,
            quiz_title: currentQuiz.title,
            answers: selectedAnswers,
            total_questions: currentQuiz.questions.length
        })
    }).then(res => res.json())
      .then(data => {
          renderResultReview(score);
      });
}

function renderResultReview(score) {
    const quizInterface = document.getElementById('quiz-interface');
    const total = currentQuiz.questions.length;

    let reviewHtml = `
        <div class="quiz-header">
            <h2>${currentQuiz.title} - Result Review</h2>
        </div>
        <div class="card" style="text-align:center;">
            <h3>Your Score: ${score} / ${total}</h3>
            <p>See below for correct answers and explanations:</p>
        </div>
    `;

    currentQuiz.questions.forEach((q, i) => {
        const selected = selectedAnswers[i];
        reviewHtml += `
            <div class="question-card">
                <p><strong>Q${i + 1}:</strong> ${q.question}</p>
                <ul style="list-style:none;padding-left:0;">
                    ${q.options.map((opt, idx) => `
                        <li style="margin: 4px 0; padding: 5px; border-radius:5px;
                            ${idx === q.correct ? 'background: #d4edda; font-weight:bold;' : ''}
                            ${selected === idx && selected !== q.correct ? 'background: #f8d7da;' : ''}">
                            ${idx === selected ? '👉 ' : ''}${opt}
                        </li>
                    `).join('')}
                </ul>
                <p><em>Explanation:</em> ${q.explanation}</p>
            </div>
        `;
    });

    reviewHtml += `
        <div class="quiz-navigation" style="justify-content:center;">
            <button class="quiz-btn" onclick="location.reload()">Back to Dashboard</button>
        </div>
    `;

    quizInterface.innerHTML = reviewHtml;
    showSection('quiz-interface');
}

// ====== DOMContentLoaded: Initial setup and event listeners ======
document.addEventListener('DOMContentLoaded', () => {
    // Initial view
    showSection('dashboard-container');
    setActiveMenuItem('dashboard-link');
    renderPerformanceCharts();
    renderBadgeProgress();
    renderQuizTopics();

    // Event listeners for sidebar navigation
    document.getElementById('dashboard-link').addEventListener('click', () => {
        showSection('dashboard-container');
        setActiveMenuItem('dashboard-link');
        renderPerformanceCharts();
        renderBadgeProgress();
    });

    document.getElementById('profile-link').addEventListener('click', () => {
        showSection('profile-container');
        setActiveMenuItem('profile-link');
    });

    document.getElementById('logout-link').addEventListener('click', () => {
        window.location.href = '/logout';
    });

    // ===== CHANGE PASSWORD MODAL =====
    const changePasswordModal = document.getElementById('changePasswordModal');
    const openChangePasswordBtn = document.getElementById('openChangePasswordModal');
    const closeChangePasswordBtn = document.getElementById('closeChangePasswordModal');
    const changePasswordForm = document.getElementById('changePasswordForm');

    if (openChangePasswordBtn) {
        openChangePasswordBtn.addEventListener('click', () => {
            changePasswordModal.style.display = 'block';
        });
    }
    if (closeChangePasswordBtn) {
        closeChangePasswordBtn.addEventListener('click', () => {
            changePasswordModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (e) => {
        if (e.target === changePasswordModal) {
            changePasswordModal.style.display = 'none';
        }
    });

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(changePasswordForm);
            fetch('/change_password', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                const msg = document.getElementById('changePasswordMessage');
                if (data.success) {
                    msg.textContent = data.message;
                    msg.className = 'success';
                    setTimeout(() => {
                        changePasswordModal.style.display = 'none';
                        changePasswordForm.reset();
                        msg.textContent = '';
                    }, 2000);
                } else {
                    msg.textContent = data.message;
                    msg.className = 'error';
                }
            });
        });
    }
});