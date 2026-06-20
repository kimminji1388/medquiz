# MedQuiz Locker

MedQuiz Locker is a simple static quiz web app for medical exam practice.

It does not use npm, React, Next.js, Firebase, or login yet. It runs with plain HTML, CSS, JavaScript, JSON, and image files.

## Current Structure

These are the files that should be deployed to GitHub Pages:

```text
index.html
app.js
styles.css
data/questions.json
assets/images/
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

## Local Save Behavior

Quiz records are saved with `localStorage`.

This means records are saved separately for each browser and each website URL.

Examples:

```text
http://127.0.0.1:8765/
https://yourname.github.io/medquiz-locker/
```

Those two addresses have separate saved records. When the app is moved from local testing to GitHub Pages, existing local records will not automatically appear on the GitHub Pages URL.

Each friend who opens the GitHub Pages site will have their own browser-local records. Records are not shared between people unless Firebase/login is added later.

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

## Not Included Yet

These are intentionally not included in this stage:

```text
Firebase
Login
Account-based sync
npm
React
Next.js
```

For now, this is a GitHub Pages-ready static web app.
