# StudyOS

Your Personal Study Operating System

## Description
A comprehensive offline-first study planning and tracking application built for students.

## Features
- Plan your study schedule
- Track your learning progress
- Practice problems and assessments
- Fully functional offline
- Progressive Web App (PWA) support
- Works on desktop and mobile devices

## Installation
1. Clone this repository
   ```bash
   git clone https://github.com/DELHIKALADKA/studyos.git
   ```
2. Navigate to the StudyOS folder
   ```bash
   cd studyos/StudyOS
   ```
3. Open `index.html` in your browser
4. Start studying!

## Technologies
- **Frontend:** JavaScript, CSS, HTML
- **Architecture:** Offline-first with Service Worker
- **Storage:** Local database for offline functionality
- **Mobile:** PWA support for app-like experience

## Getting Started
1. Visit the app and create an account or continue as a guest
2. Set up your courses and study materials
3. Create a study schedule
4. Begin tracking your progress

## Live Deployment (GitHub Pages)

The app is published to:

**https://DELHIKALADKA.github.io/studyos/**

Deployment is handled by `.github/workflows/pages.yml`:

1. Go to **Settings → Pages** in this repo and set **Source → GitHub Actions**.
   - ⚠️ GitHub Pages for **private** repos requires GitHub Pro (or make the repo public).
2. Push to `main` (or press **Run workflow** in the Actions tab) — the `StudyOS/` folder is deployed automatically.
3. After the first deploy, open the site on your phone and use **Settings → Install on your phone** to add it to the home screen. It then runs full-screen and offline.

## Project Structure
```
StudyOS/
├── index.html          # Main application file
├── manifest.webmanifest # PWA configuration
├── sw.js               # Service Worker
├── style.css           # Main stylesheet
├── js/                 # JavaScript modules
│   ├── app.js          # Main application logic
│   ├── auth.js         # Authentication system
│   ├── db.js           # Database management
│   ├── store.js        # State management
│   ├── ui.js           # UI components
│   └── pages-*.js      # Page components
├── css/                # Additional stylesheets
├── icons/              # App icons and logos
├── db/                 # Database files
└── vendor/             # Third-party libraries
```

## License
[Add your license here]

## Contributing
Contributions welcome! Feel free to submit issues and pull requests.

## Author
DELHIKALADKA
