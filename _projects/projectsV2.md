---
title: "Projects V2"
permalink: /projectsV2/
excerpt: "Interactive repository activity timeline"
---

<link
  rel="stylesheet"
  href="{{ '/assets/css/projects-v2.css' | relative_url }}"
/>

<div class="projects-v2">
  <div class="projects-v2__controls">
    <button type="button" data-action="zoom-out" aria-label="Zoom out">-</button>
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="reset-view" aria-label="Reset to last 12 months">
      Last 12 Months
    </button>
  </div>

  <p id="projects-v2-meta" class="projects-v2__meta"></p>

  <div class="projects-v2__frame">
    <div id="projects-v2-labels" class="projects-v2__labels" aria-hidden="true"></div>
    <div
      id="projects-v2-timeline"
      class="projects-v2__timeline"
      aria-label="Interactive repository timeline"
      data-timeline-url="https://raw.githubusercontent.com/NNTin/me/output/repo_timeline.json"
    ></div>
  </div>
</div>

<script id="projects-v2-data-repos" type="application/json">
{{ site.data.repos | jsonify }}
</script>
<script id="projects-v2-data-timeline" type="application/json">
{{ site.data.repo_timeline | jsonify }}
</script>
<script id="projects-v2-data-markers" type="application/json">
{{ site.data.repo_markers | jsonify }}
</script>
<script id="projects-v2-data-groups" type="application/json">
{{ site.data.projects_v2_groups | jsonify }}
</script>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="{{ '/assets/js/projects-v2.js' | relative_url }}"></script>
