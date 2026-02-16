---
title: "Projects"
permalink: /projects/
excerpt: "Interactive repository activity timeline"
---

<link
  rel="stylesheet"
  href="{{ '/assets/css/projects-v2.css' | relative_url }}"
/>

<div class="projects-v2">
  <div class="projects-v2__controls">
    <div class="projects-v2__controls-group" role="group" aria-label="Zoom controls">
      <button type="button" data-action="zoom-out" aria-label="Zoom out">-</button>
      <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    </div>

    <span class="projects-v2__controls-sep" aria-hidden="true"></span>

    <div class="projects-v2__controls-group" role="group" aria-label="Time presets">
      <button type="button" data-preset="90" aria-label="Show last 3 months">3M</button>
      <button type="button" data-preset="183" aria-label="Show last 6 months" class="is-active">6M</button>
      <button type="button" data-preset="365" aria-label="Show last 1 year">1Y</button>
      <!-- <button type="button" data-preset="all" aria-label="Show all available history">All</button> -->
    </div>

    <span class="projects-v2__controls-sep" aria-hidden="true"></span>

    <div class="projects-v2__controls-group" role="group" aria-label="Layer toggles">
      <button type="button" data-toggle="ranges" aria-label="Toggle ranges" aria-pressed="true" class="is-active">
        Ranges
      </button>
      <button
        type="button"
        data-toggle="repoMarkers"
        aria-label="Toggle repository markers"
        aria-pressed="true"
        class="is-active"
      >
        Repo markers
      </button>
      <button
        type="button"
        data-toggle="globalMarkers"
        aria-label="Toggle global markers"
        aria-pressed="true"
        class="is-active"
      >
        Global markers
      </button>
      <button
        type="button"
        data-action="toggle-idle-gaps"
        aria-label="Hide long idle gaps over 30 days"
        aria-pressed="true"
        class="is-active"
      >
        Hide idle &gt;30d
      </button>
    </div>

    <span class="projects-v2__controls-sep" aria-hidden="true"></span>

    <div class="projects-v2__controls-group" role="group" aria-label="Reset">
      <button type="button" data-action="reset-view" aria-label="Reset to last 6 months">Reset</button>
    </div>
  </div>

  <div class="projects-v2__legend" aria-hidden="true">
    <span class="projects-v2__legend-item"><span class="projects-v2__legend-swatch range"></span>Activity range</span>
    <span class="projects-v2__legend-item"><span class="projects-v2__legend-swatch active"></span>Active now</span>
    <span class="projects-v2__legend-item"><span class="projects-v2__legend-swatch career"></span>Career</span>
    <span class="projects-v2__legend-item"><span class="projects-v2__legend-swatch tech-shift"></span>Tech shift</span>
    <span class="projects-v2__legend-item"><span class="projects-v2__legend-swatch launch"></span>Launch</span>
    <span class="projects-v2__legend-item">Striped bands = compressed idle gaps (&gt;30d)</span>
  </div>

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

<div class="projects-v2__footer">
  <p id="projects-v2-meta" class="projects-v2__meta"></p>
  <a class="projects-v2__legacy-link" href="{{ site.baseurl }}/projects_v1/">old project page</a>
</div>