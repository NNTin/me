(async function () {
  "use strict";

  if (typeof window.d3 === "undefined") {
    return;
  }

  const timelineRoot = document.getElementById("projects-v2-timeline");
  const labelsRoot = document.getElementById("projects-v2-labels");
  if (!timelineRoot || !labelsRoot) {
    return;
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const DEFAULT_VIEW_DAYS = 183;
  const ACTIVE_WINDOW_DAYS = 120;
  const IDLE_GAP_CUTOFF_DAYS = 30;
  const IDLE_GAP_EDGE_TOLERANCE_DAYS = 5;
  const COLLAPSED_IDLE_GAP_DAYS = 1;

  function parseJsonScript(id, fallbackValue) {
    const element = document.getElementById(id);
    if (!element) {
      return fallbackValue;
    }

    try {
      return JSON.parse(element.textContent || "");
    } catch (_error) {
      return fallbackValue;
    }
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value === null || value === undefined) {
      return [];
    }
    return [value];
  }

  async function resolveTimelineData(remoteUrl, fallbackValue) {
    if (!remoteUrl || typeof fetch !== "function") {
      return fallbackValue;
    }

    try {
      const response = await fetch(remoteUrl, { cache: "no-store" });
      if (!response.ok) {
        return fallbackValue;
      }

      const remoteData = await response.json();
      if (!remoteData || typeof remoteData !== "object") {
        return fallbackValue;
      }

      if (!Array.isArray(remoteData.repos) && !remoteData.repos) {
        return fallbackValue;
      }

      return remoteData;
    } catch (_error) {
      return fallbackValue;
    }
  }

  function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function parseDate(dateValue) {
    if (!dateValue || typeof dateValue !== "string") {
      return null;
    }

    const parsed = new Date(dateValue + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return startOfDay(parsed);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * MS_PER_DAY);
  }

  function addMonths(date, months) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function startOfQuarter(date) {
    const month = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), month, 1);
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createStableColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return "hsl(" + hue + " 72% 46%)";
  }

  function toStatusDot(row) {
    if (row.isGroup && /legacy/i.test(row.label || "")) {
      return "legacy";
    }

    const today = startOfDay(new Date());
    let latestEnd = null;

    row.ranges.forEach((range) => {
      const rangeEnd = range.endDate || range.startDate;
      if (!rangeEnd) {
        return;
      }
      if (!latestEnd || rangeEnd > latestEnd) {
        latestEnd = rangeEnd;
      }
    });

    if (!latestEnd) {
      return row.isGroup ? "legacy" : "archived";
    }

    const ageInDays = Math.round((today.getTime() - latestEnd.getTime()) / MS_PER_DAY);
    if (ageInDays <= ACTIVE_WINDOW_DAYS) {
      return "active";
    }

    return row.isGroup ? "legacy" : "archived";
  }

  function markerCategory(marker) {
    const explicit = String(marker.category || "").trim();
    if (explicit) {
      return explicit;
    }

    const text = [marker.label, marker.tooltip, marker.id].filter(Boolean).join(" ").toLowerCase();
    if (/professional|career|work life|job/.test(text)) {
      return "career";
    }
    if (/ai|artificial intelligence|llm|mcp|langchain|agent/.test(text)) {
      return "tech-shift";
    }
    if (/launch|release|deploy|ship/.test(text)) {
      return "launch";
    }
    return "milestone";
  }

  function markerCategoryLabel(category) {
    if (category === "tech-shift") {
      return "Tech shift";
    }
    return String(category || "Milestone")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function assignLanes(intervals) {
    const laneNextAvailableDates = [];

    intervals.forEach((interval) => {
      let assignedLane = -1;
      const endExclusive = addDays(interval.endDate, 1);

      for (let lane = 0; lane < laneNextAvailableDates.length; lane++) {
        // Inclusive ranges overlap on the same day, so we allocate lanes
        // using an exclusive end boundary.
        if (interval.startDate >= laneNextAvailableDates[lane]) {
          assignedLane = lane;
          break;
        }
      }

      if (assignedLane === -1) {
        assignedLane = laneNextAvailableDates.length;
        laneNextAvailableDates.push(endExclusive);
      } else {
        laneNextAvailableDates[assignedLane] = endExclusive;
      }

      interval.lane = assignedLane;
      interval.rangeEndExclusive = endExclusive;
    });

    return laneNextAvailableDates.length;
  }

  const isoFormat = d3.timeFormat("%Y-%m-%d");
  const axisFormat = d3.timeFormat("%Y-%m");

  const reposDataRaw = parseJsonScript("projects-v2-data-repos", []);
  const localTimelineData = parseJsonScript("projects-v2-data-timeline", {
    generated_at: null,
    inactivity_gap_days: 3,
    repos: [],
  });
  const markerData = parseJsonScript("projects-v2-data-markers", { markers: [] });
  const groupsData = parseJsonScript("projects-v2-data-groups", { groups: [] });
  const remoteTimelineUrl = timelineRoot.getAttribute("data-timeline-url") || "";
  const timelineData = await resolveTimelineData(remoteTimelineUrl, localTimelineData);

  const reposData = Array.isArray(reposDataRaw) ? reposDataRaw : [];
  const timelineRowsRaw = toArray(timelineData.repos);
  const markersRaw = toArray(markerData.markers);
  const groupsRaw = toArray(groupsData.groups);

  const timelineByRepo = new Map();
  timelineRowsRaw.forEach((row) => {
    if (row && row.repo) {
      timelineByRepo.set(row.repo, row);
    }
  });

  const baseRows = reposData.map((repoItem) => {
    const timelineRow = timelineByRepo.get(repoItem.repo) || {};
    const timelineRangesRaw = toArray(timelineRow.ranges);
    const normalizedRanges = [];

    timelineRangesRaw.forEach((range) => {
      const startDate = parseDate(range.start);
      const endDate = parseDate(range.end || range.start);
      if (!startDate || !endDate) {
        return;
      }

      const normalizedStart = startDate <= endDate ? startDate : endDate;
      const normalizedEnd = endDate >= startDate ? endDate : startDate;

      normalizedRanges.push({
        startDate: normalizedStart,
        endDate: normalizedEnd,
        start: isoFormat(normalizedStart),
        end: isoFormat(normalizedEnd),
        commitCount: Number(range.commit_count || 0),
        activeDays: Number(range.active_days || 0),
        sourceRepo: repoItem.repo,
        color: createStableColor(repoItem.repo),
        lane: 0,
        isGroupedRange: false,
      });
    });

    normalizedRanges.sort((a, b) => a.startDate - b.startDate);

    return {
      owner: repoItem.owner,
      repo: repoItem.repo,
      label: repoItem.repo,
      isGroup: false,
      firstCommit: timelineRow.first_commit || null,
      lastCommit: timelineRow.last_commit || null,
      totalCommits: Number(timelineRow.total_commits || 0),
      totalActiveDays: Number(timelineRow.total_active_days || 0),
      ranges: normalizedRanges,
      laneCount: 1,
    };
  });

  const groupDefinitions = groupsRaw
    .filter((group) => group && group.id && toArray(group.repos).length > 0)
    .map((group) => ({
      id: group.id,
      label: group.label || group.id,
      repos: toArray(group.repos),
      position: group.position === "first" ? "first" : "append",
    }));

  const groupedRepoSet = new Set();
  const groupedRowMap = new Map();

  groupDefinitions.forEach((group) => {
    const row = {
      owner: null,
      repo: "group::" + group.id,
      label: group.label,
      isGroup: true,
      groupId: group.id,
      firstCommit: null,
      lastCommit: null,
      totalCommits: 0,
      totalActiveDays: 0,
      ranges: [],
      laneCount: 1,
      sourceRepos: [],
    };

    group.repos.forEach((repoName) => {
      const baseRow = baseRows.find((candidate) => candidate.repo === repoName);
      if (!baseRow) {
        return;
      }

      groupedRepoSet.add(repoName);
      row.sourceRepos.push(repoName);
      row.totalCommits += baseRow.totalCommits;
      row.totalActiveDays += baseRow.totalActiveDays;

      baseRow.ranges.forEach((range) => {
        row.ranges.push({
          startDate: range.startDate,
          endDate: range.endDate,
          start: range.start,
          end: range.end,
          commitCount: range.commitCount,
          activeDays: range.activeDays,
          sourceRepo: repoName,
          color: createStableColor(repoName),
          lane: 0,
          isGroupedRange: true,
        });
      });

      if (baseRow.firstCommit) {
        if (!row.firstCommit || baseRow.firstCommit < row.firstCommit) {
          row.firstCommit = baseRow.firstCommit;
        }
      }
      if (baseRow.lastCommit) {
        if (!row.lastCommit || baseRow.lastCommit > row.lastCommit) {
          row.lastCommit = baseRow.lastCommit;
        }
      }
    });

    row.ranges.sort((a, b) => a.startDate - b.startDate || a.endDate - b.endDate);
    row.laneCount = Math.max(1, assignLanes(row.ranges));

    groupedRowMap.set(group.id, row);
  });

  const rows = [];

  groupDefinitions
    .filter((group) => group.position === "first")
    .forEach((group) => {
      const row = groupedRowMap.get(group.id);
      if (row) {
        rows.push(row);
      }
    });

  baseRows.forEach((row) => {
    if (!groupedRepoSet.has(row.repo)) {
      rows.push(row);
    }
  });

  groupDefinitions
    .filter((group) => group.position !== "first")
    .forEach((group) => {
      const row = groupedRowMap.get(group.id);
      if (row) {
        rows.push(row);
      }
    });

  const groupedRepoToRowId = new Map();
  rows.forEach((row) => {
    if (!row.isGroup || !Array.isArray(row.sourceRepos)) {
      return;
    }

    row.sourceRepos.forEach((repoName) => {
      groupedRepoToRowId.set(repoName, row.repo);
    });
  });

  const rowByRepo = new Map(rows.map((row) => [row.repo, row]));

  rows.forEach((row) => {
    row.status = toStatusDot(row);
  });

  const markers = [];
  markersRaw.forEach((marker) => {
    const normalizedScope = marker.scope === "repo" ? "repo" : "global";
    const normalizedKind = marker.kind === "range" ? "range" : "point";

    const normalizedMarker = {
      id: marker.id || "",
      scope: normalizedScope,
      kind: normalizedKind,
      repo: marker.repo || "",
      label: marker.label || "",
      tooltip: marker.tooltip || "",
      tooltipHtml: marker.tooltip_html || "",
      color: marker.color || "",
      url: marker.url || "",
      date: marker.date || "",
      start: marker.start || "",
      end: marker.end || "",
      lane: 0,
      category: markerCategory(marker),
    };

    if (normalizedKind === "point") {
      normalizedMarker.dateDate = parseDate(normalizedMarker.date);
      if (!normalizedMarker.dateDate) {
        return;
      }
    } else {
      const startDate = parseDate(normalizedMarker.start);
      const endDate = parseDate(normalizedMarker.end);
      if (!startDate || !endDate) {
        return;
      }
      normalizedMarker.startDate = startDate <= endDate ? startDate : endDate;
      normalizedMarker.endDate = endDate >= startDate ? endDate : startDate;
    }

    if (normalizedScope === "repo") {
      const mappedRepo = groupedRepoToRowId.get(normalizedMarker.repo) || normalizedMarker.repo;
      normalizedMarker.repo = mappedRepo;
      if (!rowByRepo.has(mappedRepo)) {
        return;
      }
    }

    markers.push(normalizedMarker);
  });

  function calculateDomain() {
    const dates = [];

    rows.forEach((row) => {
      row.ranges.forEach((range) => {
        dates.push(range.startDate);
        dates.push(range.endDate);
      });
    });

    markers.forEach((marker) => {
      if (marker.kind === "point") {
        dates.push(marker.dateDate);
      } else {
        dates.push(marker.startDate);
        dates.push(marker.endDate);
      }
    });

    const today = startOfDay(new Date());
    let minDate = d3.min(dates);
    let maxDate = d3.max(dates);

    if (!minDate || !maxDate) {
      return {
        start: addDays(today, -DEFAULT_VIEW_DAYS),
        end: today,
      };
    }

    if (maxDate < today) {
      maxDate = today;
    }

    if (minDate.getTime() === maxDate.getTime()) {
      maxDate = addDays(maxDate, 1);
    }

    return { start: minDate, end: maxDate };
  }

  function createRowLayout(rowsList, layout) {
    const map = new Map();
    let cursor = layout.top;

    rowsList.forEach((row) => {
      const lanes = Math.max(1, row.laneCount || 1);
      const rowHeight = lanes * layout.laneHeight + Math.max(0, lanes - 1) * layout.laneGap;

      map.set(row.repo, {
        y: cursor,
        laneCount: lanes,
        rowHeight: rowHeight,
      });

      cursor += rowHeight + layout.rowGap;
    });

    return {
      rowMap: map,
      chartHeight: Math.max(0, cursor - layout.top - layout.rowGap),
    };
  }

  const domain = calculateDomain();

  const chartState = {
    zoomLevel: 1,
    minZoom: 0.25,
    maxZoom: 16,
    domainStart: domain.start,
    domainEnd: domain.end,
    xScale: null,
    layout: null,
    activeRowId: null,
    visibility: {
      ranges: true,
      repoMarkers: true,
      globalMarkers: true,
    },
    hideIdleGaps: true,
    collapsedGapCount: 0,
    firstRender: true,
  };

  const svg = d3.select(timelineRoot).append("svg").attr("class", "projects-v2__svg");

  const tooltip = document.createElement("div");
  tooltip.className = "projects-v2__tooltip";
  document.body.appendChild(tooltip);

  function positionTooltip(mouseEvent) {
    const pad = 12;
    const tooltipWidth = tooltip.offsetWidth || 260;
    const tooltipHeight = tooltip.offsetHeight || 80;

    let x = mouseEvent.pageX + pad;
    let y = mouseEvent.pageY + pad;

    if (x + tooltipWidth > window.scrollX + window.innerWidth - 8) {
      x = mouseEvent.pageX - tooltipWidth - pad;
    }
    if (y + tooltipHeight > window.scrollY + window.innerHeight - 8) {
      y = mouseEvent.pageY - tooltipHeight - pad;
    }

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function showTooltip(mouseEvent, content, isHtml) {
    if (isHtml) {
      tooltip.innerHTML = content;
    } else {
      tooltip.textContent = content;
    }
    tooltip.classList.add("show");
    positionTooltip(mouseEvent);
  }

  function moveTooltip(mouseEvent) {
    positionTooltip(mouseEvent);
  }

  function hideTooltip() {
    tooltip.classList.remove("show");
  }

  function buildRangeTooltipContent(rangeRow) {
    const title = rangeRow.isGroupedRange ? rangeRow.sourceRepo : rangeRow.repoLabel;
    const chips = [
      "<span class=\"projects-v2__tooltip-chip\">" + escapeHtml(rangeRow.start + " → " + rangeRow.end) + "</span>",
      "<span class=\"projects-v2__tooltip-chip is-muted\">" + Number(rangeRow.commitCount || 0) + " commits</span>",
      "<span class=\"projects-v2__tooltip-chip is-muted\">" + Number(rangeRow.activeDays || 0) + " active days</span>",
    ];

    const body = rangeRow.isGroupedRange
      ? "<p class=\"projects-v2__tooltip-more\">Grouped in <strong>" + escapeHtml(rangeRow.repoLabel) + "</strong>.</p>"
      : "";

    return (
      "<div class=\"projects-v2__tooltip-title\">" + escapeHtml(title) + "</div>" +
      "<div class=\"projects-v2__tooltip-chips\">" + chips.join("") + "</div>" +
      body
    );
  }

  function buildMarkerTooltipContent(marker) {
    const header = marker.label ? "<div class=\"projects-v2__tooltip-title\">" + escapeHtml(marker.label) + "</div>" : "";
    const dateText =
      marker.kind === "point"
        ? isoFormat(marker.dateDate)
        : isoFormat(marker.startDate) + " to " + isoFormat(marker.endDate);
    const scopeText = marker.scope === "global" ? "Global" : "Row: " + escapeHtml(marker.repoLabel || marker.repo);
    const categoryText = markerCategoryLabel(marker.category);
    const chips = [
      "<span class=\"projects-v2__tooltip-chip\">" + escapeHtml(dateText) + "</span>",
      "<span class=\"projects-v2__tooltip-chip is-muted\">" + escapeHtml(scopeText) + "</span>",
      "<span class=\"projects-v2__tooltip-chip is-category\">" + escapeHtml(categoryText) + "</span>",
    ];

    const description = marker.tooltip ? "<p class=\"projects-v2__tooltip-more\">" + escapeHtml(marker.tooltip) + "</p>" : "";
    const urlText = marker.url
      ? "<p class=\"projects-v2__tooltip-more\"><a href=\"" + escapeHtml(marker.url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
      escapeHtml(marker.url) +
      "</a></p>"
      : "";

    if (marker.tooltipHtml) {
      return [header, "<div class=\"projects-v2__tooltip-chips\">" + chips.join("") + "</div>", marker.tooltipHtml, urlText]
        .filter(Boolean)
        .join("");
    }

    return [header, "<div class=\"projects-v2__tooltip-chips\">" + chips.join("") + "</div>", description, urlText]
      .filter(Boolean)
      .join("");
  }

  function buildGroupLabelTooltipContent(row) {
    const sourceRepos = Array.isArray(row.sourceRepos) ? row.sourceRepos : [];
    const count = sourceRepos.length;
    const listItems = sourceRepos.map((repoName) => "<li>" + escapeHtml(repoName) + "</li>").join("");

    return [
      "<div class=\"projects-v2__tooltip-title\">" + escapeHtml(row.label || row.repo) + "</div>",
      "<div class=\"projects-v2__tooltip-chips\"><span class=\"projects-v2__tooltip-chip\">" + count + " projects</span></div>",
      "<ul style=\"margin:6px 0 0 16px; padding:0;\">" + listItems + "</ul>",
    ].join("");
  }

  function buildRepoLabelTooltipContent(row) {
    return [
      "<div class=\"projects-v2__tooltip-title\">" + escapeHtml(row.repo) + "</div>",
      "<div class=\"projects-v2__tooltip-chips\">" +
      "<span class=\"projects-v2__tooltip-chip\">" + Number(row.totalCommits || 0) + " commits</span>" +
      "<span class=\"projects-v2__tooltip-chip is-muted\">" + Number(row.totalActiveDays || 0) + " active days</span>" +
      "<span class=\"projects-v2__tooltip-chip is-status status-" + escapeHtml(row.status || "archived") + "\">" +
      escapeHtml(String(row.status || "archived").replace(/^\w/, (c) => c.toUpperCase())) +
      "</span>" +
      "</div>",
    ].join("");
  }

  function setActiveRow(rowId) {
    chartState.activeRowId = rowId || null;

    const updateNodes = function (rootElement) {
      rootElement.querySelectorAll("[data-row]").forEach((node) => {
        const nodeRow = node.getAttribute("data-row");
        const isSelected = chartState.activeRowId && nodeRow === chartState.activeRowId;
        const isDimmed = chartState.activeRowId && nodeRow !== chartState.activeRowId;

        node.classList.toggle("is-selected", Boolean(isSelected));
        node.classList.toggle("is-dimmed", Boolean(isDimmed));
      });
    };

    updateNodes(labelsRoot);
    updateNodes(timelineRoot);
  }

  function getDomainDaySpan() {
    return Math.max(1, Math.round((chartState.domainEnd.getTime() - chartState.domainStart.getTime()) / MS_PER_DAY) + 1);
  }

  function setZoomForDays(dayCount) {
    const targetDays = Math.max(1, Number(dayCount || DEFAULT_VIEW_DAYS));
    const suggestedZoom = DEFAULT_VIEW_DAYS / targetDays;
    chartState.zoomLevel = clampNumber(suggestedZoom, chartState.minZoom, chartState.maxZoom);
  }

  function scrollToRecentDays(days) {
    if (!chartState.xScale || !chartState.layout) {
      return;
    }

    const dayCount = Math.max(1, Number(days || DEFAULT_VIEW_DAYS));
    const today = startOfDay(new Date());
    const targetEnd = today < chartState.domainEnd ? today : chartState.domainEnd;
    const targetStart = addDays(targetEnd, -dayCount);
    const boundedStart = targetStart > chartState.domainStart ? targetStart : chartState.domainStart;

    const leftTarget = chartState.xScale(boundedStart) - chartState.layout.chartLeft - 8;
    const maxScroll = Math.max(0, chartState.layout.svgWidth - timelineRoot.clientWidth);
    timelineRoot.scrollLeft = clampNumber(leftTarget, 0, maxScroll);
  }

  function collectUpdateDates() {
    const timestamps = new Set();

    rows.forEach((row) => {
      row.ranges.forEach((range) => {
        if (range.startDate) {
          timestamps.add(range.startDate.getTime());
        }
        if (range.endDate) {
          timestamps.add(range.endDate.getTime());
        }
      });
    });

    markers.forEach((marker) => {
      if (marker.kind === "point" && marker.dateDate) {
        timestamps.add(marker.dateDate.getTime());
        return;
      }

      if (marker.startDate) {
        timestamps.add(marker.startDate.getTime());
      }
      if (marker.endDate) {
        timestamps.add(marker.endDate.getTime());
      }
    });

    return Array.from(timestamps)
      .sort((a, b) => a - b)
      .map((value) => new Date(value));
  }

  function createIdleCompressedProjector(startDate, endDate, updateDates, cutoffDays, collapsedGapDays) {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const collapsedScale = Math.max(0.01, Math.max(0, collapsedGapDays) / Math.max(1, cutoffDays));

    const points = [startMs];
    updateDates.forEach((date) => {
      const value = date.getTime();
      if (value > startMs && value < endMs) {
        points.push(value);
      }
    });
    points.push(endMs);
    points.sort((a, b) => a - b);

    const segments = [];
    const collapsedSegments = [];
    let virtualCursor = 0;

    function addSegment(segmentStart, segmentEnd, isCollapsed, displayRealDays) {
      if (segmentEnd <= segmentStart) {
        return;
      }

      const realDays = Math.max(1, Math.round((segmentEnd - segmentStart) / MS_PER_DAY));
      const virtualDays = isCollapsed ? Math.max(0.25, realDays * collapsedScale) : realDays;

      segments.push({
        startMs: segmentStart,
        endMs: segmentEnd,
        virtualStart: virtualCursor,
        virtualDays: virtualDays,
        realDays: realDays,
        isCollapsed: isCollapsed,
      });

      if (isCollapsed) {
        collapsedSegments.push({
          startMs: segmentStart,
          endMs: segmentEnd,
          realDays: Math.max(1, Number(displayRealDays || realDays)),
          virtualStart: virtualCursor,
          virtualEnd: virtualCursor + virtualDays,
        });
      }

      virtualCursor += virtualDays;
    }

    for (let index = 0; index < points.length - 1; index++) {
      const segmentStart = points[index];
      const segmentEnd = points[index + 1];
      if (segmentEnd <= segmentStart) {
        continue;
      }

      const idleStart = segmentStart + MS_PER_DAY;
      const idleDays = Math.max(0, Math.round((segmentEnd - idleStart) / MS_PER_DAY));
      const hasLongIdleGap = idleDays > cutoffDays;

      if (!hasLongIdleGap) {
        addSegment(segmentStart, segmentEnd, false);
        continue;
      }

      const edgeToleranceDays = Math.min(IDLE_GAP_EDGE_TOLERANCE_DAYS, Math.floor(idleDays / 2));
      const collapsedStart = idleStart + edgeToleranceDays * MS_PER_DAY;
      const collapsedEnd = segmentEnd - edgeToleranceDays * MS_PER_DAY;
      const collapsedRealDays = Math.max(0, Math.round((collapsedEnd - collapsedStart) / MS_PER_DAY));

      if (collapsedRealDays <= 0) {
        addSegment(segmentStart, segmentEnd, false);
        continue;
      }

      if (collapsedStart > segmentStart) {
        addSegment(segmentStart, collapsedStart, false);
      }

      addSegment(collapsedStart, collapsedEnd, true, collapsedRealDays);

      if (collapsedEnd < segmentEnd) {
        addSegment(collapsedEnd, segmentEnd, false);
      }
    }

    if (segments.length === 0) {
      segments.push({
        startMs: startMs,
        endMs: endMs,
        virtualStart: 0,
        virtualDays: 1,
      });
      virtualCursor = 1;
    }

    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];

    function projectDate(date) {
      const target = date.getTime();

      if (target <= firstSegment.startMs) {
        return 0;
      }
      if (target >= lastSegment.endMs) {
        return virtualCursor;
      }

      for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        if (target < segment.startMs || target > segment.endMs) {
          continue;
        }

        const segmentSpan = segment.endMs - segment.startMs;
        const ratio = segmentSpan > 0 ? (target - segment.startMs) / segmentSpan : 0;
        return segment.virtualStart + ratio * segment.virtualDays;
      }

      return virtualCursor;
    }

    function invertVirtual(value) {
      if (value <= 0) {
        return new Date(firstSegment.startMs);
      }
      if (value >= virtualCursor) {
        return new Date(lastSegment.endMs);
      }

      for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        const segmentVirtualEnd = segment.virtualStart + segment.virtualDays;
        if (value < segment.virtualStart || value > segmentVirtualEnd) {
          continue;
        }

        const ratio = segment.virtualDays > 0 ? (value - segment.virtualStart) / segment.virtualDays : 0;
        const timestamp = segment.startMs + (segment.endMs - segment.startMs) * ratio;
        return new Date(timestamp);
      }

      return new Date(lastSegment.endMs);
    }

    return {
      totalVirtualDays: Math.max(1, virtualCursor),
      projectDate: projectDate,
      invertVirtual: invertVirtual,
      collapsedSegments: collapsedSegments,
    };
  }

  function estimateGlobalPointLabelWidth(marker) {
    const text = marker.label || isoFormat(marker.dateDate);
    return Math.max(24, text.length * 6.2 + 8);
  }

  function assignHorizontalLabelLanes(items, getStartX, getWidth) {
    const laneRightEdges = [];

    items.forEach((item) => {
      const startX = getStartX(item);
      const endX = startX + getWidth(item);
      let lane = -1;

      for (let laneIndex = 0; laneIndex < laneRightEdges.length; laneIndex++) {
        if (startX > laneRightEdges[laneIndex] + 6) {
          lane = laneIndex;
          break;
        }
      }

      if (lane === -1) {
        lane = laneRightEdges.length;
        laneRightEdges.push(endX);
      } else {
        laneRightEdges[lane] = endX;
      }

      item.labelLane = lane;
    });

    return laneRightEdges.length;
  }

  function renderLabels(layout) {
    labelsRoot.innerHTML = "";
    labelsRoot.style.height = layout.svgHeight + "px";

    const header = document.createElement("div");
    header.className = "projects-v2__labels-header";
    header.style.height = layout.top + "px";
    labelsRoot.appendChild(header);

    const layer = document.createElement("div");
    layer.className = "projects-v2__labels-layer";
    layer.style.height = layout.svgHeight + "px";
    labelsRoot.appendChild(layer);

    rows.forEach((row, index) => {
      const rowLayout = layout.rowMap.get(row.repo);
      if (!rowLayout) {
        return;
      }

      const rowElement = document.createElement(row.isGroup ? "div" : "a");
      rowElement.className =
        "projects-v2__label-row" +
        (index % 2 === 1 ? " is-alt" : "") +
        (row.isGroup ? " is-group" : " projects-v2__label-link");
      rowElement.setAttribute("data-row", row.repo);
      rowElement.setAttribute("data-status", row.status || "archived");
      rowElement.style.top = rowLayout.y + "px";
      rowElement.style.height = rowLayout.rowHeight + "px";

      const statusDot = document.createElement("span");
      statusDot.className = "projects-v2__status-dot status-" + (row.status || "archived");
      statusDot.setAttribute("aria-hidden", "true");

      const textNode = document.createElement("span");
      textNode.className = "projects-v2__label-text";
      textNode.textContent = row.label;

      rowElement.appendChild(statusDot);
      rowElement.appendChild(textNode);

      if (row.isGroup) {
        rowElement.addEventListener("mouseenter", function (event) {
          setActiveRow(row.repo);
          showTooltip(event, buildGroupLabelTooltipContent(row), true);
        });
        rowElement.addEventListener("mousemove", moveTooltip);
        rowElement.addEventListener("mouseleave", function () {
          setActiveRow(null);
          hideTooltip();
        });
      } else {
        rowElement.href = "https://github.com/" + encodeURIComponent(row.owner) + "/" + encodeURIComponent(row.repo);
        rowElement.target = "_blank";
        rowElement.rel = "noopener noreferrer";

        rowElement.addEventListener("mouseenter", function (event) {
          setActiveRow(row.repo);
          showTooltip(event, buildRepoLabelTooltipContent(row), true);
        });
        rowElement.addEventListener("mousemove", moveTooltip);
        rowElement.addEventListener("mouseleave", function () {
          setActiveRow(null);
          hideTooltip();
        });
      }

      layer.appendChild(rowElement);
    });
  }

  function updateMetaText() {
    const meta = document.getElementById("projects-v2-meta");
    if (!meta) {
      return;
    }

    let generatedText = "Generated not available";
    let generatedTitle = "";
    if (timelineData.generated_at) {
      const generatedAtRaw = String(timelineData.generated_at);
      const generatedAtDate = new Date(generatedAtRaw);

      if (!Number.isNaN(generatedAtDate.getTime())) {
        const nowMs = Date.now();
        const diffMs = generatedAtDate.getTime() - nowMs;
        const absSeconds = Math.abs(diffMs) / 1000;
        let relativeValue = Math.round(diffMs / 1000);
        let relativeUnit = "second";

        if (absSeconds >= 60 && absSeconds < 3600) {
          relativeUnit = "minute";
          relativeValue = Math.round(diffMs / (60 * 1000));
        } else if (absSeconds >= 3600 && absSeconds < 86400) {
          relativeUnit = "hour";
          relativeValue = Math.round(diffMs / (60 * 60 * 1000));
        } else if (absSeconds >= 86400 && absSeconds < 2592000) {
          relativeUnit = "day";
          relativeValue = Math.round(diffMs / (24 * 60 * 60 * 1000));
        } else if (absSeconds >= 2592000 && absSeconds < 31536000) {
          relativeUnit = "month";
          relativeValue = Math.round(diffMs / (30 * 24 * 60 * 60 * 1000));
        } else if (absSeconds >= 31536000) {
          relativeUnit = "year";
          relativeValue = Math.round(diffMs / (365 * 24 * 60 * 60 * 1000));
        }

        if (typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function") {
          const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
          generatedText = "Generated " + rtf.format(relativeValue, relativeUnit);
        } else {
          const absRounded = Math.abs(relativeValue);
          const unitLabel = relativeUnit + (absRounded === 1 ? "" : "s");
          generatedText =
            "Generated " +
            (relativeValue <= 0 ? absRounded + " " + unitLabel + " ago" : "in " + absRounded + " " + unitLabel);
        }

        let exactText = generatedAtRaw;
        if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
          const localFormatter = new Intl.DateTimeFormat(undefined, {
            dateStyle: "full",
            timeStyle: "long",
          });
          exactText = generatedAtRaw + "\n" + localFormatter.format(generatedAtDate);
        }
        generatedTitle = "Generated timestamp\n" + exactText;
      } else {
        generatedText = "Generated " + generatedAtRaw;
        generatedTitle = "Generated timestamp\n" + generatedAtRaw;
      }
    }

    const rangeCount = rows.reduce((sum, row) => sum + row.ranges.length, 0);
    const gapDays = Number(timelineData.inactivity_gap_days || 30);

    const hideIdleText =
      "Hide idle >" +
      IDLE_GAP_CUTOFF_DAYS +
      "d: " +
      (chartState.hideIdleGaps ? "On" : "Off") +
      (chartState.hideIdleGaps ? " (" + chartState.collapsedGapCount + " gaps)" : "");

    const metaPrefix =
      "Rows " +
      rows.length +
      " • Ranges " +
      rangeCount +
      " • Inactivity " +
      gapDays +
      "d • Zoom " +
      chartState.zoomLevel.toFixed(2) +
      "x • " +
      hideIdleText +
      " • ";

    meta.textContent = "";
    meta.appendChild(document.createTextNode(metaPrefix));

    const generatedNode = document.createElement("span");
    generatedNode.className = "projects-v2__meta-generated";
    generatedNode.textContent = generatedText;
    if (generatedTitle) {
      generatedNode.title = generatedTitle;
    }
    meta.appendChild(generatedNode);
  }

  function getDefaultViewStartDate() {
    const today = startOfDay(new Date());
    const targetEnd = today < chartState.domainEnd ? today : chartState.domainEnd;
    const targetStart = addDays(targetEnd, -DEFAULT_VIEW_DAYS);
    return targetStart > chartState.domainStart ? targetStart : chartState.domainStart;
  }

  function scrollToLastSixMonths() {
    const startDate = getDefaultViewStartDate();
    const spanDays = Math.max(1, Math.round((chartState.domainEnd.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
    scrollToRecentDays(spanDays);
  }

  function render(options) {
    const renderOptions = options || {};
    const viewportWidth = Math.max(timelineRoot.clientWidth, 320);

    const layout = {
      chartLeft: 8,
      right: 32,
      top: 56,
      bottom: 34,
      laneHeight: 18,
      laneGap: 4,
      rowGap: 10,
    };
    const visibleChartWidth = Math.max(viewportWidth - layout.chartLeft - layout.right, 240);
    const basePixelsPerDay = visibleChartWidth / DEFAULT_VIEW_DAYS;
    const pixelPerDay = Math.max(0.2, basePixelsPerDay * chartState.zoomLevel);

    const fullDays =
      Math.max(1, Math.round((chartState.domainEnd.getTime() - chartState.domainStart.getTime()) / MS_PER_DAY)) + 1;

    let projector = null;
    let activeDays = fullDays;

    if (chartState.hideIdleGaps) {
      const updateDates = collectUpdateDates();
      projector = createIdleCompressedProjector(
        chartState.domainStart,
        chartState.domainEnd,
        updateDates,
        IDLE_GAP_CUTOFF_DAYS,
        COLLAPSED_IDLE_GAP_DAYS
      );
      activeDays = Math.max(1, Math.round(projector.totalVirtualDays) + 1);
      chartState.collapsedGapCount = Array.isArray(projector.collapsedSegments) ? projector.collapsedSegments.length : 0;
    } else {
      chartState.collapsedGapCount = 0;
    }

    const chartWidth = Math.max(visibleChartWidth, Math.ceil(activeDays * pixelPerDay));

    let xScale;
    if (chartState.hideIdleGaps && projector) {
      const compressedScale = d3
        .scaleLinear()
        .domain([0, projector.totalVirtualDays])
        .range([layout.chartLeft, layout.chartLeft + chartWidth]);

      xScale = function (date) {
        return compressedScale(projector.projectDate(date));
      };
      xScale.invert = function (pixelValue) {
        const virtualValue = compressedScale.invert(pixelValue);
        return projector.invertVirtual(virtualValue);
      };
    } else {
      xScale = d3
        .scaleTime()
        .domain([chartState.domainStart, chartState.domainEnd])
        .range([layout.chartLeft, layout.chartLeft + chartWidth]);
    }

    const globalPointMarkers = chartState.visibility.globalMarkers
      ? markers.filter((marker) => marker.scope === "global" && marker.kind === "point")
      : [];
    const sortedGlobalPointMarkers = globalPointMarkers.slice().sort((a, b) => a.dateDate - b.dateDate);
    const globalPointLabelLaneCount = assignHorizontalLabelLanes(
      sortedGlobalPointMarkers,
      function (marker) {
        const labelWidth = estimateGlobalPointLabelWidth(marker);
        return xScale(marker.dateDate) - labelWidth / 2;
      },
      estimateGlobalPointLabelWidth
    );
    const globalLabelLaneHeight = 14;
    layout.top = 56 + Math.max(0, globalPointLabelLaneCount - 2) * globalLabelLaneHeight;

    const rowLayout = createRowLayout(rows, layout);
    layout.rowMap = rowLayout.rowMap;

    const chartHeight = rowLayout.chartHeight;
    layout.chartWidth = chartWidth;
    layout.svgWidth = layout.chartLeft + chartWidth + layout.right;
    layout.svgHeight = layout.top + chartHeight + layout.bottom;
    chartState.layout = layout;

    chartState.xScale = xScale;

    svg.attr("width", layout.svgWidth).attr("height", layout.svgHeight);
    svg.selectAll("*").remove();

    renderLabels(layout);

    const rowBackground = svg.append("g").attr("class", "projects-v2__row-background-layer");
    rows.forEach((row, index) => {
      const rowMeta = layout.rowMap.get(row.repo);
      if (!rowMeta) {
        return;
      }

      if (index % 2 === 1) {
        rowBackground
          .append("rect")
          .attr("class", "projects-v2__row-alt")
          .attr("data-row", row.repo)
          .attr("x", layout.chartLeft)
          .attr("y", rowMeta.y)
          .attr("width", layout.chartWidth)
          .attr("height", rowMeta.rowHeight);
      }

      rowBackground
        .append("rect")
        .attr("class", "projects-v2__row-hover")
        .attr("data-row", row.repo)
        .attr("x", layout.chartLeft)
        .attr("y", rowMeta.y)
        .attr("width", layout.chartWidth)
        .attr("height", rowMeta.rowHeight);
    });

    if (!chartState.hideIdleGaps) {
      const topAxis = d3.axisTop(xScale).ticks(Math.max(6, Math.floor(chartWidth / 140))).tickFormat(axisFormat);
      svg
        .append("g")
        .attr("class", "projects-v2__axis")
        .attr("transform", "translate(0," + layout.top + ")")
        .call(topAxis);
    } else {
      const axisLayer = svg
        .append("g")
        .attr("class", "projects-v2__axis")
        .attr("transform", "translate(0," + layout.top + ")");

      const targetTickCount = Math.max(6, Math.floor(chartWidth / 140));
      const allMonthTicks = [];
      let monthTickCursor = startOfMonth(chartState.domainStart);
      while (monthTickCursor <= chartState.domainEnd) {
        allMonthTicks.push(new Date(monthTickCursor));
        monthTickCursor = addMonths(monthTickCursor, 1);
      }

      const tickStride = Math.max(1, Math.ceil(allMonthTicks.length / targetTickCount));
      const visibleTicks = allMonthTicks.filter((_tick, index) => index % tickStride === 0);

      axisLayer
        .append("line")
        .attr("x1", layout.chartLeft)
        .attr("x2", layout.chartLeft + layout.chartWidth)
        .attr("y1", 0)
        .attr("y2", 0);

      axisLayer
        .selectAll("line.projects-v2__axis-tick")
        .data(visibleTicks)
        .enter()
        .append("line")
        .attr("class", "projects-v2__axis-tick")
        .attr("x1", (date) => xScale(date))
        .attr("x2", (date) => xScale(date))
        .attr("y1", 0)
        .attr("y2", -6);

      axisLayer
        .selectAll("text.projects-v2__axis-tick-label")
        .data(visibleTicks)
        .enter()
        .append("text")
        .attr("class", "projects-v2__axis-tick-label")
        .attr("x", (date) => xScale(date))
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text((date) => axisFormat(date));
    }

    const chartTop = layout.top;
    const chartBottom = layout.top + chartHeight;

    if (!chartState.hideIdleGaps) {
      const quarterBands = [];
      let quarterCursor = startOfQuarter(chartState.domainStart);
      let quarterIndex = 0;
      while (quarterCursor < chartState.domainEnd) {
        const quarterEnd = addMonths(quarterCursor, 3);
        quarterBands.push({
          start: quarterCursor > chartState.domainStart ? quarterCursor : chartState.domainStart,
          end: quarterEnd < chartState.domainEnd ? quarterEnd : chartState.domainEnd,
          index: quarterIndex,
        });
        quarterCursor = quarterEnd;
        quarterIndex += 1;
      }

      svg
        .append("g")
        .attr("class", "projects-v2__time-bands")
        .selectAll("rect")
        .data(quarterBands)
        .enter()
        .append("rect")
        .attr("class", (band) => "projects-v2__quarter-band" + (band.index % 2 === 0 ? " is-even" : " is-odd"))
        .attr("x", (band) => xScale(band.start))
        .attr("y", chartTop)
        .attr("width", (band) => Math.max(1, xScale(band.end) - xScale(band.start)))
        .attr("height", chartHeight);

      const halfYearLines = [];
      let halfCursor = startOfMonth(
        new Date(chartState.domainStart.getFullYear(), chartState.domainStart.getMonth() < 6 ? 0 : 6, 1)
      );
      while (halfCursor <= chartState.domainEnd) {
        if (halfCursor >= chartState.domainStart) {
          halfYearLines.push(new Date(halfCursor));
        }
        halfCursor = addMonths(halfCursor, 6);
      }

      svg
        .append("g")
        .attr("class", "projects-v2__half-year-lines")
        .selectAll("line")
        .data(halfYearLines)
        .enter()
        .append("line")
        .attr("x1", (date) => xScale(date))
        .attr("x2", (date) => xScale(date))
        .attr("y1", chartTop)
        .attr("y2", chartBottom);
    }

    rowBackground.raise();

    if (chartState.hideIdleGaps && projector && Array.isArray(projector.collapsedSegments) && projector.collapsedSegments.length > 0) {
      const defs = svg.append("defs");
      const patternId = "projects-v2-idle-gap-hatch";
      const hatchPattern = defs
        .append("pattern")
        .attr("id", patternId)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternTransform", "rotate(45)");

      hatchPattern.append("rect").attr("width", 8).attr("height", 8).attr("fill", "rgba(100, 116, 139, 0.08)");
      hatchPattern.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 8).attr("stroke", "rgba(71, 85, 105, 0.35)").attr("stroke-width", 2);

      const collapsedGapRows = projector.collapsedSegments.map((gap) => {
        const startDate = new Date(gap.startMs);
        const endDate = new Date(gap.endMs);
        const rawStartX = xScale(startDate);
        const rawEndX = xScale(endDate);
        const left = Math.min(rawStartX, rawEndX);
        const right = Math.max(rawStartX, rawEndX);
        const width = Math.max(1, right - left);

        return {
          xStart: left,
          xEnd: right,
          xBand: left,
          width: width,
          startDate: startDate,
          endDate: endDate,
          realDays: Number(gap.realDays || 0),
        };
      });

      const idleGapLayer = svg.append("g").attr("class", "projects-v2__idle-gap-layer");

      idleGapLayer
        .selectAll("rect.projects-v2__idle-gap-band")
        .data(collapsedGapRows)
        .enter()
        .append("rect")
        .attr("class", "projects-v2__idle-gap-band")
        .attr("x", (gap) => gap.xBand)
        .attr("y", chartTop)
        .attr("width", (gap) => gap.width)
        .attr("height", chartHeight)
        .attr("fill", "url(#" + patternId + ")")
        .on("mouseenter", function (event, gap) {
          showTooltip(
            event,
            "<div class=\"projects-v2__tooltip-title\">Compressed idle period</div>" +
            "<div class=\"projects-v2__tooltip-chips\">" +
            "<span class=\"projects-v2__tooltip-chip\">" + isoFormat(gap.startDate) + " → " + isoFormat(gap.endDate) + "</span>" +
            "<span class=\"projects-v2__tooltip-chip is-muted\">" + gap.realDays + " days hidden</span>" +
            "</div>",
            true
          );
        })
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);

      idleGapLayer
        .selectAll("line.projects-v2__idle-gap-edge")
        .data(
          collapsedGapRows.flatMap((gap) => [
            { x: gap.xStart, realDays: gap.realDays },
            { x: gap.xEnd, realDays: gap.realDays },
          ])
        )
        .enter()
        .append("line")
        .attr("class", "projects-v2__idle-gap-edge")
        .attr("x1", (item) => item.x)
        .attr("x2", (item) => item.x)
        .attr("y1", chartTop)
        .attr("y2", chartBottom);

      const maxLabelCount = 6;
      const highlightedGaps = collapsedGapRows
        .slice()
        .sort((a, b) => b.realDays - a.realDays)
        .slice(0, maxLabelCount);

      idleGapLayer
        .selectAll("text.projects-v2__idle-gap-label")
        .data(highlightedGaps)
        .enter()
        .append("text")
        .attr("class", "projects-v2__idle-gap-label")
        .attr("x", (gap) => gap.xBand + gap.width / 2)
        .attr("y", chartTop + 12)
        .attr("text-anchor", "middle")
        .text((gap) => "⟪ " + gap.realDays + "d gap ⟫");
    }

    const globalRangeMarkers = chartState.visibility.globalMarkers
      ? markers.filter((marker) => marker.scope === "global" && marker.kind === "range")
      : [];
    svg
      .append("g")
      .selectAll("rect")
      .data(globalRangeMarkers)
      .enter()
      .append("rect")
      .attr("class", (marker) => "projects-v2__global-range marker-cat-" + marker.category)
      .attr("x", (marker) => xScale(marker.startDate))
      .attr("y", chartTop)
      .attr("width", (marker) => {
        const endX = xScale(addDays(marker.endDate, 1));
        return Math.max(2, endX - xScale(marker.startDate));
      })
      .attr("height", chartHeight)
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    const allRanges = [];
    rows.forEach((row) => {
      const rowMeta = layout.rowMap.get(row.repo);
      if (!rowMeta) {
        return;
      }

      row.ranges.forEach((range) => {
        const laneY = rowMeta.y + range.lane * (layout.laneHeight + layout.laneGap);
        allRanges.push({
          repoId: row.repo,
          repoLabel: row.label,
          sourceRepo: range.sourceRepo,
          startDate: range.startDate,
          endDate: range.endDate,
          start: range.start,
          end: range.end,
          commitCount: range.commitCount,
          activeDays: range.activeDays,
          lane: range.lane,
          laneY: laneY,
          laneHeight: layout.laneHeight,
          color: range.color,
          isGroupedRange: range.isGroupedRange,
          rangeEndExclusive: range.rangeEndExclusive || addDays(range.endDate, 1),
        });
      });
    });

    const visibleRanges = chartState.visibility.ranges ? allRanges : [];
    const today = startOfDay(new Date());
    svg
      .append("g")
      .attr("class", "projects-v2__range-layer")
      .selectAll("rect")
      .data(visibleRanges)
      .enter()
      .append("rect")
      .attr("class", (range) => {
        const activeNow = range.startDate <= today && range.rangeEndExclusive > today;
        return (
          "projects-v2__range" +
          (range.isGroupedRange ? " is-grouped" : "") +
          (activeNow ? " is-active-now" : "")
        );
      })
      .attr("data-row", (range) => range.repoId)
      .attr("x", (range) => xScale(range.startDate))
      .attr("y", (range) => range.laneY)
      .attr("width", (range) => {
        const endX = xScale(range.rangeEndExclusive);
        return Math.max(2, endX - xScale(range.startDate));
      })
      .attr("height", (range) => range.laneHeight)
      .attr("fill", (range) => (range.isGroupedRange ? range.color : null))
      .on("mouseenter", function (event, range) {
        setActiveRow(range.repoId);
        showTooltip(event, buildRangeTooltipContent(range), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        setActiveRow(null);
        hideTooltip();
      });

    const repoRangeMarkers = chartState.visibility.repoMarkers
      ? markers.filter((marker) => marker.scope === "repo" && marker.kind === "range")
      : [];
    svg
      .append("g")
      .selectAll("rect")
      .data(repoRangeMarkers)
      .enter()
      .append("rect")
      .attr("class", (marker) => "projects-v2__repo-range marker-cat-" + marker.category)
      .attr("data-row", (marker) => marker.repo)
      .attr("x", (marker) => xScale(marker.startDate))
      .attr("y", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        if (!rowMeta) {
          return chartTop;
        }
        return rowMeta.y + 2;
      })
      .attr("width", (marker) => {
        const endX = xScale(addDays(marker.endDate, 1));
        return Math.max(2, endX - xScale(marker.startDate));
      })
      .attr("height", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        if (!rowMeta) {
          return layout.laneHeight;
        }
        return Math.max(4, rowMeta.rowHeight - 4);
      })
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        marker.repoLabel = rowByRepo.get(marker.repo)?.label || marker.repo;
        setActiveRow(marker.repo);
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        setActiveRow(null);
        hideTooltip();
      });

    const globalPointLayer = svg.append("g");
    globalPointLayer
      .selectAll("line")
      .data(globalPointMarkers)
      .enter()
      .append("line")
      .attr("class", (marker) => "projects-v2__global-point-line marker-cat-" + marker.category)
      .attr("x1", (marker) => xScale(marker.dateDate))
      .attr("x2", (marker) => xScale(marker.dateDate))
      .attr("y1", (marker) => chartTop - 18 - Number(marker.labelLane || 0) * globalLabelLaneHeight)
      .attr("y2", chartBottom)
      .attr("stroke", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    const globalPointLabelLayer = svg.append("g").attr("class", "projects-v2__global-point-pills");
    const globalPointLabelGroups = globalPointLabelLayer
      .selectAll("g")
      .data(globalPointMarkers)
      .enter()
      .append("g")
      .attr("class", (marker) => "projects-v2__global-point-pill marker-cat-" + marker.category)
      .attr("transform", (marker) => {
        const centerX = xScale(marker.dateDate);
        const y = chartTop - 30 - Number(marker.labelLane || 0) * globalLabelLaneHeight;
        return "translate(" + centerX + "," + y + ")";
      })
      .on("mouseenter", function (event, marker) {
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    globalPointLabelGroups
      .append("text")
      .attr("class", "projects-v2__global-point-label")
      .attr("text-anchor", "middle")
      .attr("y", 0)
      .text((marker) => marker.label || isoFormat(marker.dateDate));

    globalPointLabelGroups.each(function (marker) {
      const group = d3.select(this);
      const textNode = group.select("text").node();
      const bbox = textNode ? textNode.getBBox() : { width: 20, height: 12 };
      const padX = 8;
      const padY = 4;

      group
        .insert("rect", "text")
        .attr("class", "projects-v2__global-point-pill-bg")
        .attr("x", -bbox.width / 2 - padX)
        .attr("y", -bbox.height + 2 - padY)
        .attr("width", bbox.width + padX * 2)
        .attr("height", bbox.height + padY * 2)
        .attr("rx", 999)
        .attr("ry", 999);

      group
        .append("line")
        .attr("class", "projects-v2__global-point-pill-stem")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 8)
        .attr("y2", chartTop - (chartTop - 30 - Number(marker.labelLane || 0) * globalLabelLaneHeight));
    });

    const repoPointMarkers = chartState.visibility.repoMarkers
      ? markers.filter((marker) => marker.scope === "repo" && marker.kind === "point")
      : [];
    const repoPointLayer = svg.append("g");
    repoPointLayer
      .selectAll("line")
      .data(repoPointMarkers)
      .enter()
      .append("line")
      .attr("class", (marker) => "projects-v2__repo-point-line marker-cat-" + marker.category)
      .attr("data-row", (marker) => marker.repo)
      .attr("x1", (marker) => xScale(marker.dateDate))
      .attr("x2", (marker) => xScale(marker.dateDate))
      .attr("y1", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        return rowMeta ? rowMeta.y : chartTop;
      })
      .attr("y2", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        return rowMeta ? rowMeta.y + rowMeta.rowHeight : chartTop;
      })
      .attr("stroke", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        marker.repoLabel = rowByRepo.get(marker.repo)?.label || marker.repo;
        setActiveRow(marker.repo);
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        setActiveRow(null);
        hideTooltip();
      });

    repoPointLayer
      .selectAll("circle")
      .data(repoPointMarkers)
      .enter()
      .append("circle")
      .attr("class", (marker) => "projects-v2__repo-point-dot marker-cat-" + marker.category)
      .attr("data-row", (marker) => marker.repo)
      .attr("cx", (marker) => xScale(marker.dateDate))
      .attr("cy", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        return rowMeta ? rowMeta.y + rowMeta.rowHeight / 2 : chartTop;
      })
      .attr("r", 3)
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        marker.repoLabel = rowByRepo.get(marker.repo)?.label || marker.repo;
        setActiveRow(marker.repo);
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        setActiveRow(null);
        hideTooltip();
      });

    if (today >= chartState.domainStart && today <= chartState.domainEnd) {
      const todayX = xScale(today);
      const todayLayer = svg.append("g").attr("class", "projects-v2__today-layer");
      todayLayer
        .append("line")
        .attr("class", "projects-v2__today-line")
        .attr("x1", todayX)
        .attr("x2", todayX)
        .attr("y1", chartTop)
        .attr("y2", chartBottom);

      todayLayer
        .append("text")
        .attr("class", "projects-v2__today-label")
        .attr("x", todayX + 6)
        .attr("y", chartTop + 14)
        .text("Today");
    }

    if (allRanges.length === 0) {
      svg
        .append("text")
        .attr("x", layout.chartLeft + 12)
        .attr("y", chartTop + 20)
        .attr("fill", "#6b7280")
        .attr("font-size", 12)
        .text("No activity ranges found. Run pwsh ./tools/gen_repo_timeline.ps1 to generate data.");
    }

    updateMetaText();
    setActiveRow(chartState.activeRowId);

    if (renderOptions.resetToLast6Months) {
      scrollToLastSixMonths();
      chartState.firstRender = false;
      return;
    }

    if (renderOptions.anchorDate && typeof renderOptions.anchorPixel === "number") {
      const nextScrollLeft = xScale(renderOptions.anchorDate) - renderOptions.anchorPixel;
      const maxScroll = Math.max(0, layout.svgWidth - timelineRoot.clientWidth);
      timelineRoot.scrollLeft = clampNumber(nextScrollLeft, 0, maxScroll);
    } else if (chartState.firstRender) {
      scrollToLastSixMonths();
      chartState.firstRender = false;
    }
  }

  function zoomBy(factor, anchorPixel) {
    const nextZoom = clampNumber(chartState.zoomLevel * factor, chartState.minZoom, chartState.maxZoom);
    if (Math.abs(nextZoom - chartState.zoomLevel) < 0.0001) {
      return;
    }

    const pivotPixel = typeof anchorPixel === "number" ? anchorPixel : timelineRoot.clientWidth / 2;
    const anchorDate = chartState.xScale
      ? chartState.xScale.invert(timelineRoot.scrollLeft + pivotPixel)
      : startOfDay(new Date());

    chartState.zoomLevel = nextZoom;
    render({ anchorDate: anchorDate, anchorPixel: pivotPixel });
    syncPresetButtonsWithViewport();
  }

  const controlsRoot = document.querySelector(".projects-v2__controls");

  function setActivePresetButton(presetValue) {
    if (!controlsRoot) {
      return;
    }

    const target = presetValue === null || presetValue === undefined ? "" : String(presetValue);
    controlsRoot.querySelectorAll("button[data-preset]").forEach((node) => {
      const value = String(node.getAttribute("data-preset") || "");
      node.classList.toggle("is-active", Boolean(target) && value === target);
    });
  }

  function syncPresetButtonsWithViewport() {
    if (!controlsRoot) {
      return;
    }

    const presets = [90, 183, 365];
    const zoomTolerance = 0.015;
    const matchedPreset = presets.find((days) => {
      const targetZoom = DEFAULT_VIEW_DAYS / days;
      return Math.abs(chartState.zoomLevel - targetZoom) <= zoomTolerance;
    });

    setActivePresetButton(matchedPreset || null);
  }

  if (controlsRoot) {
    const setToggleState = function (button, enabled) {
      button.classList.toggle("is-active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    };

    controlsRoot.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (button) {
        const action = button.getAttribute("data-action");
        if (action === "zoom-in") {
          zoomBy(1.2);
        } else if (action === "zoom-out") {
          zoomBy(1 / 1.2);
        } else if (action === "toggle-idle-gaps") {
          const centerPixel = timelineRoot.clientWidth / 2;
          const anchorDate = chartState.xScale
            ? chartState.xScale.invert(timelineRoot.scrollLeft + centerPixel)
            : startOfDay(new Date());

          chartState.hideIdleGaps = !chartState.hideIdleGaps;
          setToggleState(button, chartState.hideIdleGaps);
          render({ anchorDate: anchorDate, anchorPixel: centerPixel });
          syncPresetButtonsWithViewport();
        } else if (action === "reset-view") {
          chartState.zoomLevel = 1;
          chartState.visibility.ranges = true;
          chartState.visibility.repoMarkers = true;
          chartState.visibility.globalMarkers = true;
          chartState.hideIdleGaps = true;

          controlsRoot.querySelectorAll("button[data-toggle]").forEach((node) => {
            const key = String(node.getAttribute("data-toggle") || "");
            if (Object.prototype.hasOwnProperty.call(chartState.visibility, key)) {
              setToggleState(node, Boolean(chartState.visibility[key]));
            }
          });

          const idleToggle = controlsRoot.querySelector("button[data-action='toggle-idle-gaps']");
          if (idleToggle) {
            setToggleState(idleToggle, chartState.hideIdleGaps);
          }

          setActivePresetButton("183");
          render({ resetToLast6Months: true });
        }
        return;
      }

      const presetButton = event.target.closest("button[data-preset]");
      if (presetButton) {
        const preset = String(presetButton.getAttribute("data-preset") || "");
        setActivePresetButton(preset);

        if (preset === "all") {
          setZoomForDays(getDomainDaySpan());
          render({ anchorDate: chartState.domainStart, anchorPixel: chartState.layout ? chartState.layout.chartLeft : 0 });
          timelineRoot.scrollLeft = 0;
        } else {
          const days = Number(preset);
          if (days > 0) {
            setZoomForDays(days);
            render({});
            scrollToRecentDays(days);
          }
        }
        return;
      }

      const toggleButton = event.target.closest("button[data-toggle]");
      if (toggleButton) {
        const key = String(toggleButton.getAttribute("data-toggle") || "");
        if (!(key in chartState.visibility)) {
          return;
        }

        chartState.visibility[key] = !chartState.visibility[key];
        setToggleState(toggleButton, chartState.visibility[key]);
        render({});
        syncPresetButtonsWithViewport();
      }
    });

    controlsRoot.querySelectorAll("button[data-toggle]").forEach((button) => {
      const key = String(button.getAttribute("data-toggle") || "");
      const enabled = Object.prototype.hasOwnProperty.call(chartState.visibility, key) ? chartState.visibility[key] : false;
      setToggleState(button, Boolean(enabled));
    });

    const idleToggleButton = controlsRoot.querySelector("button[data-action='toggle-idle-gaps']");
    if (idleToggleButton) {
      setToggleState(idleToggleButton, chartState.hideIdleGaps);
    }

    syncPresetButtonsWithViewport();
  }

  timelineRoot.addEventListener(
    "wheel",
    function (event) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const bounds = timelineRoot.getBoundingClientRect();
        const localX = event.clientX - bounds.left;
        zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, localX);
        return;
      }

      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        timelineRoot.scrollLeft += event.deltaY;
      }
    },
    { passive: false }
  );

  const dragState = {
    active: false,
    pointerId: null,
    lastX: 0,
  };

  function endDrag(pointerId) {
    if (!dragState.active) {
      return;
    }

    if (pointerId !== undefined && pointerId !== null && pointerId !== dragState.pointerId) {
      return;
    }

    dragState.active = false;
    dragState.pointerId = null;
    timelineRoot.classList.remove("is-dragging");
  }

  timelineRoot.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "touch" && event.button !== 0) {
      return;
    }

    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.lastX = event.clientX;
    timelineRoot.classList.add("is-dragging");
    hideTooltip();

    if (typeof timelineRoot.setPointerCapture === "function") {
      try {
        timelineRoot.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore browsers that reject pointer capture for this event.
      }
    }
  });

  timelineRoot.addEventListener("pointermove", function (event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.lastX;
    timelineRoot.scrollLeft -= deltaX;
    dragState.lastX = event.clientX;
  });

  timelineRoot.addEventListener("pointerup", function (event) {
    endDrag(event.pointerId);
  });

  timelineRoot.addEventListener("pointercancel", function (event) {
    endDrag(event.pointerId);
  });

  timelineRoot.addEventListener("lostpointercapture", function (event) {
    endDrag(event.pointerId);
  });

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }

    resizeTimer = setTimeout(function () {
      const centerPixel = timelineRoot.clientWidth / 2;
      const anchorDate = chartState.xScale
        ? chartState.xScale.invert(timelineRoot.scrollLeft + centerPixel)
        : startOfDay(new Date());
      render({ anchorDate: anchorDate, anchorPixel: centerPixel });
      syncPresetButtonsWithViewport();
    }, 150);
  });

  render({ resetToLast6Months: true });
})();
