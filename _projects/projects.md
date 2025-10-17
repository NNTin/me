---
title: 'Projects'
permalink: /projects/
excerpt: 'Contains some of my (public) git projects'
layout: wide
---

<div class="mermaid" id="project-gantt">
gantt
    title GitHub Project Activity Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %Y

    section Projects
    Reply-Dota-2-Reddit     :rdr, 2016-03-27, 2018-05-10
    Dota-2-Reddit-Flair-Mosaic :dfm, 2016-05-01, 2016-05-06
    Dota-2-Emoticons        :de, 2016-07-16, 2016-07-21
    Reply-LoL-Reddit        :rlr, 2016-07-24, 2017-04-02
    Cubify-Reddit           :cr, 2017-03-04, 2017-03-19
    discord-twitter-bot     :dtb, 2017-03-20, 2021-12-12
    pasteview               :pv, 2017-10-24, 2017-11-20
    pasteindex              :pi, 2017-11-10, 2017-11-15
    discord-logo            :active, dl, 2017-11-24, 2018-01-14
    discord-logo PR         :milestone, pr1, 2018-06-26, 0d
    discord-logo PR         :milestone, pr2, 2020-10-07, 0d  
    discord-logo PR         :milestone, pr3, 2021-06-20, 0d
    dev-tracker-reddit      :dtr, 2018-07-25, 2018-07-26
    tracker-reddit-discord  :trd, 2018-07-31, 2018-08-17
    twitter-backend         :tb, 2018-08-18, 2018-09-16
    discord-web-bridge      :dwb, 2018-09-20, 2019-01-11
    crosku                  :ck, 2018-11-11, 2019-01-12
    Red-kun                 :rk, 2018-11-27, 2019-10-13
    Professional Work Life  :active, ps, 2019-04-01, until today
    me                      :active, me, 2025-09-14, 2025-10-16
    d-zone PR               :milestone, dz1, 2018-11-11, 0d
    d-zone PR               :milestone, dz2, 2019-02-24, 0d
    d-zone forked           :active, milestone, dz3, 2020-09-19, 0d
    d-zone                  :active, dz, 2025-09-18, 2025-10-10
    d-back                  :active, db, 2025-09-17, 2025-10-05
    d-cogs                  :active, dc, 2025-09-20, 2025-10-05
</div>

<!-- Custom Tooltip CSS -->
<style>
.project-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  pointer-events: none;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.2s ease;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.project-tooltip.show {
  opacity: 1;
}

.project-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
}
</style>

<!-- Custom Tooltip JavaScript -->
<script>
// Project descriptions for tooltips
const projectDescriptions = {
  'rdr': 'Reddit bot that replied to Dota 2 game discussions with match statistics and player information. First open-source project which helped me develop a basic understanding how programming and hosting works',
  'dfm': 'Created a mosaic visualization of Reddit user flairs from the Dota 2 community',
  'de': 'Made animated flairs next to the username possible through CSS magic',
  'rlr': 'Similar to Reply-Dota-2-Reddit but adapted for League of Legends subreddit',
  'cr': 'After almost 4 months my Reddit bot gained 100k comment karma through shitposting cubed words',
  'dtb': 'Highest starred (350⭐+) project: Tweets were posted to Discord. Enabled Docker support, Heroku one-click deployment, wrote a docs page, added many configuration: filtering, location boxes, ...',
  'pv': 'Web application for reading pastebin snippets, learned web development a bit more',
  'pi': 'Created a REST API with documentation, authentication, database, etc. for maintaining pastebin codes',
  'dl': 'Inspired by Github Corners I created my own idea of it: Code generation, customizable colors, customizable template (normal, corner or speech bubble), animation, eyes',
  'pr1': 'PR: Contribution by srmcgann: added customizable background animation',
  'pr2': 'PR: (Hacktoberfest) Contribution by xanaDev and zurda: remove background and added linting',
  'pr3': 'PR: Contribution by srmcgann: re-added background animation, broke in 2020 due to browser breaking changes',
  'dtr': 'Reddit bot: comments by certain individuals are highlighted, e.g. game developer',
  'trd': 'Discord+Reddit bot: Reddit comments by certain individuals are posted to Discord',
  'tb': 'Quick one-click Heroku deployment of Twitter backend, mocks the authentication process away',
  'dwb': 'Communication bridge between discord bot <-> crossbar <-> custom webclient, started this project in my free time while I was a research assistent',
  'ck': 'Crossbar one-click deployment on Heroku',
  'rk': 'Part of a much bigger project: github.com/Cog-Creators/Red-DiscordBot. Red-DiscordBot is a modular Discord Bot which allows you to install custom cogs during runtime. I\'ve installed 3rd party cogs and developed my own to manage Discord communities',
  'ps': 'Transitioned from hobby programming to professional software development career. Many FOSS projects died as well as my contributions to other projects (not listed here). Recently I\'ve started open source project development again because I want to have more hands-on experience with AI.',
  'me': 'This personal website built with Jekyll and GitHub Pages',
  'dz1': 'Added Heroku one-click deployment support to d-zone project',
  'dz2': 'Implemented Docker containerization for easier deployment',
  'dz3': 'In the further future I forked the webclient part of d-zone. It is based on this version.',
  'dz': 'Major changes: commonjs -> esm, websocket URL fallback strategy, Discord OAuth2 support, CI versioned deployment, e2e testing with Playwright, Allure and Vercel deployment.',
  'db': 'Handles the backend logic of d-zone, meant to be installed as a python module, supports a wide variety of versions. Provides mock data when the callbacks are not registered',
  'dc': 'Implementation of the python module d-back and thus provides real data. d-cogs makes use of Red-DiscordBot modular design and is installed as a plugin.'
};

// Wait for Mermaid to render, then add tooltips
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    addTooltipsToGantt();
  }, 1000); // Give Mermaid time to render
});

function addTooltipsToGantt() {
  const ganttContainer = document.getElementById('project-gantt');
  if (!ganttContainer) return;

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'project-tooltip';
  document.body.appendChild(tooltip);

  // Find all rect elements in the Mermaid SVG
  const rects = ganttContainer.querySelectorAll('svg rect');
  
  rects.forEach(rect => {
    const rectId = rect.id;
    if (rectId && projectDescriptions[rectId]) {
      rect.addEventListener('mouseenter', function(e) {
        tooltip.textContent = projectDescriptions[rectId];
        tooltip.classList.add('show');
        updateTooltipPosition(e, tooltip);
      });

      rect.addEventListener('mousemove', function(e) {
        updateTooltipPosition(e, tooltip);
      });

      rect.addEventListener('mouseleave', function() {
        tooltip.classList.remove('show');
      });
    }
  });
}

function updateTooltipPosition(e, tooltip) {
  const x = e.clientX;
  const y = e.clientY;
  
  tooltip.style.left = x + 10 + 'px';
  tooltip.style.top = y - 40 + 'px';
  
  // Adjust if tooltip goes off screen
  const rect = tooltip.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    tooltip.style.left = x - rect.width - 10 + 'px';
  }
  if (rect.top < 0) {
    tooltip.style.top = y + 20 + 'px';
  }
}
</script>

<div style="text-align: right;">
  <span style="font-size: 0.6em;">Mermaid Gantt does not support same row, will move this to D3.js or AnyChart in future</span>
</div>


This website is a place to document my programming journey. Most of the projects here are older hobby projects I built before becoming a professional software engineer. They were driven by curiosity, passion, and late-night inspiration — and helped shape my path into tech.

It doesn’t cover my professional work or other tech hobbies like 3D printing, home networking, or building a media server. Nor does it include my time in RuneScape 2 or Old School RuneScape.

Since going pro, side projects have been rare — but with this site, I hope to change that and explore AI a bit more.

Fittingly, this site (and even this text) was created with the help of AI. With a deeper understanding of software now, I can focus more on project ideas and architecture. I’ve gone from just coding to shaping and building complete ideas.

{% assign exclude_repos = "dota-2-reddit-flair-mosaic,dota-2-emoticons,cubify-reddit,pasteview,pasteindex,dev-tracker-reddit,tracker-reddit-discord,twitter-backend,crosku,shell-kun,nntin.github.io,nntin,me,red-kun,reply-lol-reddit" | split: "," %}

{% assign filtered_repos = "" | split: "" %}

{% for repo in site.data.repos %}
  {% unless exclude_repos contains repo.repo %}
    {% assign filtered_repos = filtered_repos | push: repo %}
  {% endunless %}
{% endfor %}


| Repository | Commit | Activity | Info |
| ---------- | ------------ | ----------- | ------------ | ----------- | ------------ | ----------- |
{% for repo in filtered_repos %}| [{{ repo.repo }}](https://github.com/{{ repo.owner }}/{{ repo.repo }}) | <img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_first.svg"><br><img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_last.svg"> | <img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_commits.svg"><br><img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_days.svg"> | <img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_added.svg"><br><img src="https://raw.githubusercontent.com/nntin/me/output/badges/{{ repo.repo }}_removed.svg"> |
{% endfor %}
