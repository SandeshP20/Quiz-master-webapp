<!-- Quiz Master -->
Quiz Master is an interactive and educational web application that allows users to test their knowledge on various topics, track their progress, and earn badges for their achievements. The application is built with a focus on gamification and a responsive design to ensure a great experience on any device.



<!-- Features -->

User Authentication: The application provides a complete authentication system with user registration, login, and a password recovery feature using a security question.

Dynamic Quizzes: Quizzes are loaded dynamically from JSON files, which allows you to easily add new topics without changing the core application code.

Gamification: A tiered badge system rewards users for their efforts. Badges like 

Beginner, Learner, Performer, Expert, Master, and Legend are earned based on quiz scores and completion history.

Performance Tracking: A central dashboard displays a summary of completed quizzes and uses Chart.js to create dynamic, visual charts of user performance.

Responsive Design: The CSS is written with responsiveness in mind to ensure the application looks and functions well across different screen sizes.

<!-- Technologies Used -->

<!-- Backend: -->
Flask (Python): A lightweight, minimalistic framework that handles all server-side logic, including user authentication, session management, and serving quiz data.

JSON: Used for data storage. User profiles and performance statistics are stored in 

users.json, while quiz questions are stored in separate JSON files within a quizzes directory.

<!-- Frontend: -->
HTML: Structures the user interface using login.html for authentication and index.html for the main dashboard and quiz interface.

CSS: Defines the application's look and feel with a modern and clean style, a custom color palette, and icons from Font Awesome.

JavaScript: The core of the client-side interactivity, handling dynamic behaviors like switching views, managing the quiz timer, and communicating with the backend via fetch requests.

Chart.js: A JavaScript library used to generate dynamic charts that provide a clear overview of user performance.


<!-- Installation -->
Follow these steps to set up and run the project on your local machine.
<!-- Install Dependencies: -->
The only external dependency is Flask. Install it using the provided requirements.txt file.

pip install -r requirements.txt

Run the Application:
python app.py

Access the Application:
Open your web browser and go to http://127.0.0.1:5000 to see the login page.

<!-- How to Use -->

Register: On the login screen, create a new account by providing a username, password, and a security question/answer.

Login: Use your new credentials to log in. This will take you to the main dashboard.

Take a Quiz: Select a topic from the sidebar to view available quizzes. Click on a quiz to start it.

Track Progress: After completing a quiz, your score and performance data are sent to the backend and recorded. Check your dashboard to view your progress and earned badges.



<!-- Future Enhancements -->

Migrate to a Relational Database: To solve scalability issues and allow for more robust features, replace the JSON data storage with a database like PostgreSQL or MongoDB.

Enhance Security: Implement proper password hashing and use a more secure password recovery method, such as email-based tokens, to improve user data security.

Centralized Admin Panel: Build a dedicated admin interface to allow content creators to easily manage quiz content and topics directly through the application.

Leaderboard System: Add a global leaderboard to enhance the gamification aspect and drive user retention.