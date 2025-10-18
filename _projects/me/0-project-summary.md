---
layout: single
title: 'me'
permalink: /projects/me/
excerpt: 'me'
toc: false
categories:
  - projects
tags:
#  - projects
---

## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/me)](https://github.com/nntin/me/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/me)](https://github.com/nntin/me/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/me)](https://github.com/nntin/me/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/me)](https://github.com/nntin/me/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/me)](https://github.com/nntin/me/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/me)](https://github.com/nntin/me)
[![Top Language](https://img.shields.io/github/languages/top/nntin/me)](https://github.com/nntin/me)

**me** is the GitHub repository behind this very site. It's built with **Jekyll** using the **Minimal Mistakes** theme and hosted through GitHub Pages. Beyond being just a personal site, this repo includes some tooling that brings a bit of dynamic behavior into what is otherwise a static single-page app.

One of the more interesting features is a workflow I set up to **automatically generate custom badges**, which are then committed to the `output` branch: [see output branch](https://github.com/NNTin/me/tree/output). These badges get used directly on the site, allowing for small bits of live or personalized data — all without needing a backend.

The system uses **Cookiecutter**, a Python module for scaffolding projects, to help manage this logic cleanly and repeatably.

Over time, this site will grow to include more than just project write-ups. Each project listed under **[Featured Repos]({{ site.baseurl }}/projects/)** showcases something I'm particularly proud of.
