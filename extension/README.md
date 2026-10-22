# Algo Visualizer browser extension

Adds a **▶ Visualize** button (bottom-right) to problem pages:

- **LeetCode**: opens your Python code from the editor plus Example 1's input, and runs it.
  Switch the editor to Python3 first.
- **Codeforces**: opens the first sample input in input/output mode. Your code isn't on the
  page, so the visualizer keeps the code you last used there; paste yours if it's different.

Nothing is sent anywhere except the visualizer tab you open: code and input travel in the
link's `#…` part, which browsers never send to a server.

## Install (Chrome, Edge, Brave)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder.
4. Open a LeetCode or Codeforces problem and click **▶ Visualize**.

After pulling changes, click the reload icon on the extension's card.
