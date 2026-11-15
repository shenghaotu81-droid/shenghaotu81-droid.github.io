# Resource limits for this WSL checkout

The host has crashed repeatedly during automated WebGL/SwiftShader tests. The user
explicitly asked to finish without overloading the computer.

- Do not launch Playwright, Chromium, browser automation, WebGL, or software GPU
  rendering in this WSL environment. Do not repeat a failing GPU test.
- Use the CPU-only Node tests, JavaScript syntax checks, JSON/asset checks and
  static HTTP checks. Keep test processes sequential and memory bounded.
- Visual/manual QA belongs in a hardware-accelerated Windows browser or another
  environment explicitly selected by the user. Report unverified visual details.
- Preserve the branch workflow: the stable indoor version is already on main;
  the coastal iteration stays on `feat/open-world-garden` until user approval.
