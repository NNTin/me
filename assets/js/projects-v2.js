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
    const title = rangeRow.isGroupedRange
      ? "<strong>" + escapeHtml(rangeRow.sourceRepo) + "</strong>"
      : "<strong>" + escapeHtml(rangeRow.repoLabel) + "</strong>";

    const lines = [
      title,
      escapeHtml(rangeRow.start + " to " + rangeRow.end),
      "Commits: " + rangeRow.commitCount,
      "Active days: " + rangeRow.activeDays,
    ];

    if (rangeRow.isGroupedRange) {
      lines.push("<em>Grouped row: " + escapeHtml(rangeRow.repoLabel) + "</em>");
    }

    return lines.join("<br>");
  }

  function buildMarkerTooltipContent(marker) {
    const header = marker.label ? "<strong>" + escapeHtml(marker.label) + "</strong>" : "";
    const dateText =
      marker.kind === "point"
        ? isoFormat(marker.dateDate)
        : isoFormat(marker.startDate) + " to " + isoFormat(marker.endDate);
    const scopeText = marker.scope === "global" ? "Global marker" : "Row: " + escapeHtml(marker.repoLabel || marker.repo);
    const urlText = marker.url ? "<br>" + escapeHtml(marker.url) : "";

    if (marker.tooltipHtml) {
      return [header, marker.tooltipHtml, "<em>" + scopeText + " • " + dateText + "</em>", urlText]
        .filter(Boolean)
        .join("<br>");
    }

    const description = marker.tooltip ? escapeHtml(marker.tooltip) : "";
    return [header, description, "<em>" + scopeText + " • " + dateText + "</em>", urlText]
      .filter(Boolean)
      .join("<br>");
  }

  function buildGroupLabelTooltipContent(row) {
    const sourceRepos = Array.isArray(row.sourceRepos) ? row.sourceRepos : [];
    const count = sourceRepos.length;
    const listItems = sourceRepos.map((repoName) => "<li>" + escapeHtml(repoName) + "</li>").join("");

    return [
      "<strong>" + escapeHtml(row.label || row.repo) + "</strong>",
      "Projects: " + count,
      "<ul style=\"margin:6px 0 0 16px; padding:0;\">" + listItems + "</ul>",
    ].join("<br>");
  }

  function buildRepoLabelTooltipContent(row) {
    return [
      "<strong>" + escapeHtml(row.repo) + "</strong>",
      "total_commit: " + Number(row.totalCommits || 0),
      "total_active_days: " + Number(row.totalActiveDays || 0),
    ].join("<br>");
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
      rowElement.style.top = rowLayout.y + "px";
      rowElement.style.height = rowLayout.rowHeight + "px";
      rowElement.textContent = row.label;

      if (row.isGroup) {
        rowElement.addEventListener("mouseenter", function (event) {
          showTooltip(event, buildGroupLabelTooltipContent(row), true);
        });
        rowElement.addEventListener("mousemove", moveTooltip);
        rowElement.addEventListener("mouseleave", hideTooltip);
      } else {
        rowElement.href = "https://github.com/" + encodeURIComponent(row.owner) + "/" + encodeURIComponent(row.repo);
        rowElement.target = "_blank";
        rowElement.rel = "noopener noreferrer";

        rowElement.addEventListener("mouseenter", function (event) {
          showTooltip(event, buildRepoLabelTooltipContent(row), true);
        });
        rowElement.addEventListener("mousemove", moveTooltip);
        rowElement.addEventListener("mouseleave", hideTooltip);
      }

      layer.appendChild(rowElement);
    });
  }

  function updateMetaText() {
    const meta = document.getElementById("projects-v2-meta");
    if (!meta) {
      return;
    }

    const generatedText = timelineData.generated_at
      ? "Generated: " + timelineData.generated_at
      : "Generated: not available";

    const rangeCount = rows.reduce((sum, row) => sum + row.ranges.length, 0);
    const gapDays = Number(timelineData.inactivity_gap_days || 30);

    meta.textContent =
      "Rows: " +
      rows.length +
      " | Activity ranges: " +
      rangeCount +
      " | Inactivity gap: " +
      gapDays +
      " days | Zoom: " +
      chartState.zoomLevel.toFixed(2) +
      "x | " +
      generatedText;
  }

  function getDefaultViewStartDate() {
    const today = startOfDay(new Date());
    const targetEnd = today < chartState.domainEnd ? today : chartState.domainEnd;
    const targetStart = addDays(targetEnd, -DEFAULT_VIEW_DAYS);
    return targetStart > chartState.domainStart ? targetStart : chartState.domainStart;
  }

  function scrollToLastSixMonths() {
    if (!chartState.xScale || !chartState.layout) {
      return;
    }

    const startDate = getDefaultViewStartDate();
    const leftTarget = chartState.xScale(startDate) - chartState.layout.chartLeft - 8;
    const maxScroll = Math.max(0, chartState.layout.svgWidth - timelineRoot.clientWidth);
    timelineRoot.scrollLeft = clampNumber(leftTarget, 0, maxScroll);
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
    const chartWidth = Math.max(visibleChartWidth, Math.ceil(fullDays * pixelPerDay));

    const xScale = d3
      .scaleTime()
      .domain([chartState.domainStart, chartState.domainEnd])
      .range([layout.chartLeft, layout.chartLeft + chartWidth]);

    const globalPointMarkers = markers.filter((marker) => marker.scope === "global" && marker.kind === "point");
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

    const rowBackground = svg.append("g");
    rows.forEach((row, index) => {
      const rowMeta = layout.rowMap.get(row.repo);
      if (!rowMeta) {
        return;
      }

      if (index % 2 === 1) {
        rowBackground
          .append("rect")
          .attr("class", "projects-v2__row-alt")
          .attr("x", layout.chartLeft)
          .attr("y", rowMeta.y)
          .attr("width", layout.chartWidth)
          .attr("height", rowMeta.rowHeight);
      }
    });

    const topAxis = d3.axisTop(xScale).ticks(Math.max(6, Math.floor(chartWidth / 140))).tickFormat(axisFormat);
    svg
      .append("g")
      .attr("class", "projects-v2__axis")
      .attr("transform", "translate(0," + layout.top + ")")
      .call(topAxis);

    const chartTop = layout.top;
    const chartBottom = layout.top + chartHeight;

    const globalRangeMarkers = markers.filter((marker) => marker.scope === "global" && marker.kind === "range");
    svg
      .append("g")
      .selectAll("rect")
      .data(globalRangeMarkers)
      .enter()
      .append("rect")
      .attr("class", "projects-v2__global-range")
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

    svg
      .append("g")
      .selectAll("rect")
      .data(allRanges)
      .enter()
      .append("rect")
      .attr("class", (range) => "projects-v2__range" + (range.isGroupedRange ? " is-grouped" : ""))
      .attr("x", (range) => xScale(range.startDate))
      .attr("y", (range) => range.laneY)
      .attr("width", (range) => {
        const endX = xScale(range.rangeEndExclusive);
        return Math.max(2, endX - xScale(range.startDate));
      })
      .attr("height", (range) => range.laneHeight)
      .attr("fill", (range) => (range.isGroupedRange ? range.color : null))
      .on("mouseenter", function (event, range) {
        showTooltip(event, buildRangeTooltipContent(range), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    const repoRangeMarkers = markers.filter((marker) => marker.scope === "repo" && marker.kind === "range");
    svg
      .append("g")
      .selectAll("rect")
      .data(repoRangeMarkers)
      .enter()
      .append("rect")
      .attr("class", "projects-v2__repo-range")
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
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    const globalPointLayer = svg.append("g");
    globalPointLayer
      .selectAll("line")
      .data(globalPointMarkers)
      .enter()
      .append("line")
      .attr("class", "projects-v2__global-point-line")
      .attr("x1", (marker) => xScale(marker.dateDate))
      .attr("x2", (marker) => xScale(marker.dateDate))
      .attr("y1", chartTop)
      .attr("y2", chartBottom)
      .attr("stroke", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    globalPointLayer
      .selectAll("text")
      .data(globalPointMarkers)
      .enter()
      .append("text")
      .attr("class", "projects-v2__global-point-label")
      .attr("x", (marker) => xScale(marker.dateDate))
      .attr("y", (marker) => chartTop - 24 - Number(marker.labelLane || 0) * globalLabelLaneHeight)
      .attr("text-anchor", "middle")
      .text((marker) => marker.label || isoFormat(marker.dateDate));

    const repoPointMarkers = markers.filter((marker) => marker.scope === "repo" && marker.kind === "point");
    const repoPointLayer = svg.append("g");
    repoPointLayer
      .selectAll("line")
      .data(repoPointMarkers)
      .enter()
      .append("line")
      .attr("class", "projects-v2__repo-point-line")
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
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    repoPointLayer
      .selectAll("circle")
      .data(repoPointMarkers)
      .enter()
      .append("circle")
      .attr("class", "projects-v2__repo-point-dot")
      .attr("cx", (marker) => xScale(marker.dateDate))
      .attr("cy", (marker) => {
        const rowMeta = layout.rowMap.get(marker.repo);
        return rowMeta ? rowMeta.y + rowMeta.rowHeight / 2 : chartTop;
      })
      .attr("r", 3)
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        marker.repoLabel = rowByRepo.get(marker.repo)?.label || marker.repo;
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

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
  }

  const controlsRoot = document.querySelector(".projects-v2__controls");
  if (controlsRoot) {
    controlsRoot.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const action = button.getAttribute("data-action");
      if (action === "zoom-in") {
        zoomBy(1.2);
      } else if (action === "zoom-out") {
        zoomBy(1 / 1.2);
      } else if (action === "reset-view") {
        chartState.zoomLevel = 1;
        render({ resetToLast6Months: true });
      }
    });
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
    }, 150);
  });

  render({ resetToLast6Months: true });
})();
