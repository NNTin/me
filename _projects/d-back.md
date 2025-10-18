---
title: 'd-back'
excerpt: 'd-back'
categories:
  - projects
tags:
#  - projects
---
## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/d-back)](https://github.com/nntin/d-back/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/d-back)](https://github.com/nntin/d-back/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/d-back)](https://github.com/nntin/d-back/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/d-back)](https://github.com/nntin/d-back/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/d-back)](https://github.com/nntin/d-back/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/d-back)](https://github.com/nntin/d-back)
[![Top Language](https://img.shields.io/github/languages/top/nntin/d-back)](https://github.com/nntin/d-back)

This project sits between [**d-cogs**]({{ site.baseurl }}/projects/d-cogs/) and [**d-zone**]({{ site.baseurl }}/projects/d-zone/) as part of a larger system.

**d-back** is the backend WebSocket server, written in Python. It receives real-time Discord events from **d-cogs**, a Red-DiscordBot plugin, and passes that data along to **d-zone**, a web frontend that visualizes user activity as an ambient simulation.

---

**d-back** is a lightweight Python module that implements both **WebSocket communication** and basic **static file serving**. It acts as the middle layer between a data source and frontend visualization — particularly tailored for driving d-zone.

The project is published on **[PyPI](https://pypi.org/project/d-back/)** and supports:

- **Python 3.8 to 3.13**
- **WebSockets library versions 10 through 16**

This broad compatibility is intentional — I wanted **d-back** to be usable across a wide variety of Python environments.

---

### ⚙️ Key Features

- 📡 **WebSocket server** for live data broadcasting
- 🧾 **Static file serving** (optional) can be used to serve [**d-zone**](https://github.com/nntin/d-zone)
- 🧠 **Callback interface**: allows registering custom handlers (e.g. for user presence, messages)
- 🧪 **Fallback mock mode** when no callback is registered — useful for development or testing
- 🔐 **Optional OAuth2 authentication**: protects endpoints when desired
- 🔁 **Broadcasts key events**, such as message sends or presence updates, to connected clients
- ✅ **Test matrix** covers every supported Python/WebSocket version combination to ensure cross-version stability

---

### 🧠 What I Learned

This was the first Python project in a long time where I could start fresh and define structure from the ground up.

- It was also my **first time publishing a package to PyPI**, which helped me understand packaging and distribution workflows more deeply
- I learned more about the Python ecosystem's **core configuration files**, such as `setup.cfg`, `pyproject.toml`
- Writing the version-spanning test matrix pushed me to think more modularly about dependencies and compatibility
- I plan to generate full project documentation in the future — mainly to deepen my understanding of Python tooling

---

Now that d-back supports a wide range of Python and WebSocket versions, I could finally move on to the next step: implementing real-time Discord data via registered callbacks — powered by [d-cogs]({{ site.baseurl }}/projects/d-cogs/).
