---
title: 'd-zone'
excerpt: 'd-zone'
categories:
  - projects
tags:
#  - projects
---
## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/d-zone)](https://github.com/nntin/d-zone/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/d-zone)](https://github.com/nntin/d-zone/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/d-zone)](https://github.com/nntin/d-zone/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/d-zone)](https://github.com/nntin/d-zone/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/d-zone)](https://github.com/nntin/d-zone/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/d-zone)](https://github.com/nntin/d-zone)
[![Top Language](https://img.shields.io/github/languages/top/nntin/d-zone)](https://github.com/nntin/d-zone)

This project is part of a connected system made up of [**d-back**]({{ site.baseurl }}/projects/d-back/) and [**d-cogs**]({{ site.baseurl }}/projects/d-cogs/).  
**d-zone** is the web-based frontend — a live, ambient simulation that visualizes Discord user activity.

It connects to **d-back**, a custom Python WebSocket server, which receives real-time events from **d-cogs**, a Red-DiscordBot plugin that streams live data from Discord servers.

---

**d-zone** started as a visual experiment — a frontend simulation of Discord server activity brought to life through a voxel-inspired world. The original project was already quite rich: it featured **procedural world generation**, animated cubes representing users with **status-based sprites** (online, idle, offline), **hopping movement**, and even **speech bubbles** when users spoke.

My fork of the project ([Sep 19, 2020 commit](https://github.com/d-zone-org/d-zone/commit/95b72961db482a8fdb7e78c1c786e835fc5c1324)) built on top of that foundation. At first, I contributed **Heroku one-click deployment** and later added **Docker containerization**. Eventually, I stripped away the legacy backend and focused on refactoring the frontend to better integrate with my own ecosystem.

---

### 🔧 Refactorings

When I revisited the project, I applied several key structural changes:

- **Removed the server component** entirely, keeping d-zone focused purely as a frontend
- Migrated from **CommonJS to ES modules**, with **TypeScript** support

---

### 🚀 New Features

In the process, I added several upgrades to improve flexibility, usability, and maintainability:

- 🌐 **WebSocket URL fallback and selection**: previously, the WebSocket server URL was hardcoded. Now users can provide or switch endpoints.
- 🔄 **Versioned builds with GitHub Pages**: each build is deployed under a version tag, allowing users to switch between different frontend versions directly from the browser.
- 🔐 **Discord OAuth2 support** (optional): adds frontend-level authentication, allowing backends to enforce user verification if needed.
- 🧪 **Testing**:
  - Unit tests via **Vitest**
  - End-to-end tests with **Playwright**
  - Test results published with **Allure**
- ☁️ **Deployed via Vercel**: for quick and clean CI-based hosting.

---

### 🧠 What I Learned

Although I have a strong background in **backend development** and **CI/CD workflows**, my experience with frontend work was more limited. d-zone pushed me out of that comfort zone — and I ended up learning a lot in the process.

- I gained hands-on experience with **modern frontend tooling**, especially around refactoring codebases to TypeScript and ES modules
- It was my **first time implementing an OAuth2 flow**, which gave me a better understanding of authentication patterns in browser-based apps
- I was already familiar with unit and E2E testing in principle, but this was my first time working with **Playwright** and integrating **Allure** reporting
- On the CI/CD side, I had to dig deeper into **GitHub Actions test matrix strategies**, learning how to **merge results across jobs** in a clean pipeline
- And, perhaps most importantly — I started to learn the subtle art of **vibecoding**

Together with [**d-back**](https://github.com/nntin/d-back) and [**d-cogs**](https://github.com/nntin/d-cogs), this was my first return to open-source development after a long break — but with a stronger sense of structure and intentionality than in the past.

---

d-zone now functions as a focused frontend — flexible, testable, and adaptable — and it's only one piece of a broader system. Next up: [d-back]({{ site.baseurl }}/projects/d-back/).
