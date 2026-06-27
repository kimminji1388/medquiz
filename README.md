# MedQuiz Locker

MedQuiz Locker is a simple static quiz web app for medical exam practice.

It does not use npm, React, or Next.js. It runs with plain HTML, CSS, JavaScript, JSON, image files, and Firebase Web SDK CDN imports.

## Current Structure

These are the files that should be deployed to GitHub Pages:

```text
index.html
app.js
styles.css
firebase-config.js
data/questions.json
data/question-sets.json
assets/images/
manage.html
manage.js
guide.html
.github/workflows/import-quiz.yml
tools/
incoming/
archive/
.nojekyll
README.md
```

These folders are for local work only and should not be uploaded:

```text
imports/
work/
outputs/
data/backups/
```

They are listed in `.gitignore`, so Git should ignore them.

## Question Data

The app loads questions from:

```text
data/questions.json
```

Each question uses this format:

```json
{
  "id": "anatomy_01_19_41",
  "setId": "anatomy_2026_midterm",
  "subject": "Anatomy",
  "section": "Lower Limb",
  "question": "Question text",
  "choices": ["Choice 1", "Choice 2", "Choice 3", "Choice 4", "Choice 5"],
  "answer": 1,
  "explanation": "Explanation text",
  "image": "assets/images/anatomy_01_19_41.jpg"
}
```

If a question has no image, use:

```json
"image": ""
```

For a multiple-answer question, use an array of choice numbers:

```json
"answer": [1, 3]
```

Single-answer questions are graded as soon as a choice is selected. Multiple-answer questions are graded after the user selects the choices and presses `Check answer`.

## Automatic HTML Import

After the automation files have been uploaded once, new quiz HTML files can be
added without manually converting JSON or uploading extracted images.

1. Open the repository `Code` page on GitHub.
2. Open the `incoming` folder.
3. Click `Add file`, then `Upload files`.
4. Upload the HTML file and click `Commit changes`.
5. Open the `Actions` tab and wait for `Import quiz HTML` to show a green check.
6. Wait a few minutes for GitHub Pages, then refresh the quiz site.

The automation supports the current Anatomy, Biochemistry, Physiology,
Pathology, Microbiology, previous-exam, and Pharmacology HTML formats.

Keep the same HTML filename when uploading a corrected version of the same exam.
The matching question set is replaced and stable question IDs are reused. A new
filename creates a new question set.

If conversion or validation fails, the existing `questions.json` is not
committed. The existing quiz therefore remains available.

After a successful import, the source HTML is moved from `incoming` to
`archive/html`.

## Archive Or Restore Question Sets

Open the question-set manager:

```text
https://kimminji1388.github.io/medquiz/manage.html
```

1. Turn off the question sets that should no longer appear.
2. Click `Download settings`.
3. In the GitHub repository, open the `data` folder.
4. Click `Add file`, then `Upload files`.
5. Upload the downloaded `question-sets.json` and commit the change.

Archived questions disappear from the quiz, but their data, stable IDs,
localStorage records, and Firestore records remain. Turn the set on and upload
the settings again to restore it.

## Local Save Behavior

Quiz records are saved with `localStorage`.

This means records are saved separately for each browser and each website URL.

Examples:

```text
http://127.0.0.1:8765/
https://yourname.github.io/medquiz-locker/
```

Those two addresses have separate saved records. When the app is moved from local testing to GitHub Pages, existing local records will not automatically appear on the GitHub Pages URL.

Each friend who opens the GitHub Pages site will have their own browser-local records.

If a user logs in, the app also syncs records to Firebase Firestore:

```text
users/{uid}/quizRecords/{questionId}
```

When a user logs in, the app merges local records and Firestore records by `questionId`. If the same question exists in both places, the record with the newer `lastSolvedAt` wins.

If Firebase fails to load or the user does not log in, the app keeps working with local browser save.

## Run Locally

Because the app loads `data/questions.json`, open it through a local server.

If Python is installed, open a terminal in this folder and run:

```powershell
python -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

If you use VS Code, you can also use the Live Server extension.

## GitHub Pages Deployment

### 1. Create a GitHub repository

1. Go to GitHub.
2. Click New repository.
3. Choose a repository name, for example `medquiz-locker`.
4. Keep it public if you want to use free GitHub Pages easily.
5. Create the repository.

### 2. Upload the project files

Upload these files and folders:

```text
index.html
app.js
styles.css
data/
assets/
firebase-config.js
manage.html
manage.js
.github/
tools/
incoming/
archive/
.nojekyll
.gitignore
README.md
```

Do not upload these local work folders:

```text
imports/
work/
outputs/
data/backups/
```

### 3. Turn on GitHub Pages

1. Open the repository on GitHub.
2. Go to Settings.
3. Go to Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Choose branch: `main`.
6. Choose folder: `/root`.
7. Save.

After a short wait, GitHub will show a Pages URL like:

```text
https://yourname.github.io/medquiz-locker/
```

Open that URL and check:

1. Questions appear.
2. Images appear.
3. Answer checking works.
4. Wrong-only mode works after you answer incorrectly.
5. Bookmark works.
6. Refreshing the page keeps your records.

## Firebase Setup

Firebase is optional for basic local use, but needed for account sync.

In the Firebase console:

1. Open your Firebase project.
2. Go to Authentication.
3. Click Sign-in method.
4. Enable Email/Password.
5. Go to Firestore Database.
6. Create a Firestore database if it does not exist.
7. Add security rules similar to this:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/quizRecords/{questionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The Firebase web app settings are stored in:

```text
firebase-config.js
```

This file is safe to deploy for a normal Firebase web app. Security comes from Authentication and Firestore security rules, not from hiding the web config.

## Not Included Yet

These are intentionally not included in this stage:

```text
npm
React
Next.js
```

For now, this is a GitHub Pages-ready static web app with optional Firebase login sync.
