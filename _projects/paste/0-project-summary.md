---
layout: single
title: 'paste'
permalink: /projects/paste/
excerpt: 'paste'
toc: false
categories:
  - projects
tags:
#  - projects
---

## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/pasteindex)](https://github.com/nntin/pasteindex/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/pasteindex)](https://github.com/nntin/pasteindex/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/pasteindex)](https://github.com/nntin/pasteindex/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/pasteindex)](https://github.com/nntin/pasteindex/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/pasteindex)](https://github.com/nntin/pasteindex/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/pasteindex)](https://github.com/nntin/pasteindex)
[![Top Language](https://img.shields.io/github/languages/top/nntin/pasteindex)](https://github.com/nntin/pasteindex)

## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/pasteview)](https://github.com/nntin/pasteview/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/pasteview)](https://github.com/nntin/pasteview/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/pasteview)](https://github.com/nntin/pasteview/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/pasteview)](https://github.com/nntin/pasteview/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/pasteview)](https://github.com/nntin/pasteview/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/pasteview)](https://github.com/nntin/pasteview)
[![Top Language](https://img.shields.io/github/languages/top/nntin/pasteview)](https://github.com/nntin/pasteview)

**pasteview** and **pasteindex** were two companion projects I built out of a growing obsession with long-form content — starting with anime, then manga, and eventually webnovels. I often found myself reading text hosted on Pastebin, but the experience was far from ideal. These tools were my attempt to create a cleaner, more comfortable way to read — built around my own preferences and workflows.

---

### 📖 Key Features

#### pasteview:
- Minimalist Pastebin reader built with **Vue.js**
- Supports customization of **font size**, **text color**, and **background**
- Automatically **remembers user settings** (locally stored)
- Fetches Pastebin content via **CORS**, without any backend
- Built for readability, especially for long-form text like webnovels

#### pasteindex:
- Companion backend with a **RESTful API** for managing Pastebin codes
- Supports **authenticated users** to create, read, update, and delete entries
- Includes **API documentation** and token-based auth
- Acts as a personalized library of tracked Pastebin links
- Designed to integrate directly with pasteview

---

### 🛠 Technologies & Learnings

- **Vue.js**: pasteview was one of my earlier experiments with Vue and helped me understand component-based design and reactive state management.
- **REST API design**: pasteindex gave me hands-on experience with building and documenting a full API, including authentication and resource handling.
- **Frontend-backend integration**: Coordinating pasteview and pasteindex as separate services helped me think more modularly, and gave me a better grasp of CORS and client-server architecture.
- **LocalStorage**: pasteview used local storage to persist reader settings without requiring login or a backend.

---

### 🔁 Project Evolution

These tools worked well for my use case, but over time I discovered [lightnovel-crawler](https://github.com/dipu-bd/lightnovel-crawler), a more powerful community-driven project that could fetch novels from a variety of sources and export them in multiple formats.

Rather than continuing to build my own tooling in parallel, I decided to **stop development** on pasteview and pasteindex and began contributing to lightnovel-crawler instead.

---

While short-lived, these projects were meaningful — they solved a real personal pain point and helped me get more comfortable working across the full stack. They also marked one of the first times I built something for myself and later chose to contribute to a broader open-source project.
