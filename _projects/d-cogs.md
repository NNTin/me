---
title: 'd-cogs'
excerpt: 'd-cogs'
categories:
  - projects
tags:
#  - projects
---
## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/d-cogs)](https://github.com/nntin/d-cogs/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/d-cogs)](https://github.com/nntin/d-cogs/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/d-cogs)](https://github.com/nntin/d-cogs/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/d-cogs)](https://github.com/nntin/d-cogs/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/d-cogs)](https://github.com/nntin/d-cogs/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/d-cogs)](https://github.com/nntin/d-cogs)
[![Top Language](https://img.shields.io/github/languages/top/nntin/d-cogs)](https://github.com/nntin/d-cogs)

This project completes the trio alongside [**d-back**]({{ site.baseurl }}/projects/d-back/) and [**d-zone**]({{ site.baseurl }}/projects/d-zone/).

**d-cogs** is a plugin for [Red-DiscordBot](https://github.com/Cog-Creators/Red-DiscordBot) that connects real Discord events to the backend server (**d-back**) — powering the **d-zone** frontend with live data.

---

I’ve worked with Red-DiscordBot in the past and developed custom cogs for managing Discord communities, so getting started here was quick. The cog system in Red is quite flexible, making it easy to hook into relevant events and forward them.

**d-cogs** depends on **d-back** and registers the appropriate callbacks. From there, it streams real-time events like user presence and messages into the simulation, making **d-zone** reflect actual Discord activity.

---

### ⚙️ Config Options

The cog supports a few basic configuration flags:

- Set **OAuth2 client ID and secret**
- Toggle **OAuth2 protection** for frontend access
- Toggle whether to **ignore offline users**
- Optionally serve **custom static files** over `d-back`

---

With all three parts now connected — the cog plugin, the WebSocket server, and the frontend — this system functions end-to-end. While **d-cogs** itself is relatively lightweight, it plays the key role of injecting real data into the simulation.
