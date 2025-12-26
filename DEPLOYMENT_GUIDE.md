# Deployment Guide for StockMaster Pro

## 1. Run Locally (Windows)

1.  Navigate to the `web` folder: `c:\antigravity\stock management\web`
2.  Double-click **`start_server.bat`**.
3.  A terminal window will open, and the app will be accessible at [http://localhost:8000](http://localhost:8000).

## 2. Deploy to Netlify (Recommended)

Netlify allows you to host static sites for free by simply dragging and dropping your folder.

1.  Go to [app.netlify.com](https://app.netlify.com) and sign up/log in.
2.  Navigate to the **"Sites"** tab.
3.  Drag the **`web`** folder from your file explorer and drop it into the "Drag and drop your site folder here" area on Netlify.
4.  Your site will be live instantly! Netlify will provide a public URL (e.g., `stockmaster-pro.netlify.app`).

## 3. Deploy to GitHub Pages

If you want to host it on GitHub:

1.  Create a new repository on GitHub.
2.  Upload the contents of the `web` folder to the repository.
3.  Go to **Settings** > **Pages**.
4.  Under "Source", select **Deploy from a branch**.
5.  Select **main** (or master) as the branch and **/** (root) as the folder.
6.  Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.
