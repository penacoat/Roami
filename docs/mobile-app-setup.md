
Roami iOS app (for testing) setup - Expo (Mac, iPhone)

Part 1: Install the tools (one time)

Install Node.js (the LTS version) from nodejs.org. This also installs npm.
Install Git from git-scm.com. Mac users can check whether it’s already there by running git --version in Terminal.
Install VS Code from code.visualstudio.com.
On your iPhone, install Expo Go from the App Store (developer: 650 Industries, Inc.). It should be version 57.x.
Create a free account at expo.dev. Remember the email and password.
Open Expo Go, tap the avatar icon in the top right, and sign in with that account.

Part 2: Get the code
Open Terminal and run these one at a time:
bash
cd ~/Documents
git clone https://github.com/YOUR-USERNAME/roami.git
cd roami/mobile
npm install
If GitHub asks you to sign in, use GitHub Desktop (desktop.github.com) to clone instead, or run gh auth login.

Part 3: Run the app
Run each of these separately, not pasted together:
bash
npx expo login
Enter your Expo email and password when asked. Then:
bash
npx expo start

A QR code appears. Scan it with your iPhone Camera app and tap the banner. The app opens in Expo Go and shows the starter screen.

Checklist if it doesn’t work:
> Your phone and computer must be on the same Wi-Fi.
> On your iPhone, go to Settings → Expo Go and turn on Local Network.
> You must be signed in to the same Expo account in both the terminal and the Expo Go app.
> If Expo Go says the project needs a newer version, make sure your Expo Go is 57.x.

If npm install fails with a permissions error (EACCES), run the sudo chown command shown in the error message, then run npm install again.
If the connection times out (common on school Wi-Fi), stop the server with Ctrl+C and run npx expo start --tunnel.

Part 4: Day to day
Before you start working: git pull
To run the app: cd roami/mobile, then npx expo start. Leave that terminal open while you work, and press Ctrl+C to stop.
To save your work:
bash
git add .
git commit -m "describe what you changed"
git push
The server only runs on your own computer, so closing your terminal doesn’t affect anyone else.

Remember to replace YOUR-USERNAME with your GitHub username (or paste the exact clone URL from the green Codebutton).
