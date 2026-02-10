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

  const isoFormat = d3.timeFormat("%Y-%m-%d");
  const axisFormat = d3.timeFormat("%Y-%m");

  const reposDataRaw = parseJsonScript("projects-v2-data-repos", []);
  const localTimelineData = parseJsonScript("projects-v2-data-timeline", {
    generated_at: null,
    inactivity_gap_days: 30,
    repos: [],
  });
  const markerData = parseJsonScript("projects-v2-data-markers", { markers: [] });
  const remoteTimelineUrl = timelineRoot.getAttribute("data-timeline-url") || "";
  const timelineData = await resolveTimelineData(remoteTimelineUrl, localTimelineData);

  const reposData = Array.isArray(reposDataRaw) ? reposDataRaw : [];
  const timelineRowsRaw = toArray(timelineData.repos);
  const markersRaw = toArray(markerData.markers);

  const timelineByRepo = new Map();
  timelineRowsRaw.forEach((row) => {
    if (row && row.repo) {
      timelineByRepo.set(row.repo, row);
    }
  });

  const rows = reposData.map((repoItem) => {
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
      });
    });

    normalizedRanges.sort((a, b) => a.startDate - b.startDate);

    return {
      owner: repoItem.owner,
      repo: repoItem.repo,
      firstCommit: timelineRow.first_commit || null,
      lastCommit: timelineRow.last_commit || null,
      totalCommits: Number(timelineRow.total_commits || 0),
      totalActiveDays: Number(timelineRow.total_active_days || 0),
      ranges: normalizedRanges,
    };
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

    if (normalizedScope === "repo" && !rowByRepo.has(normalizedMarker.repo)) {
      return;
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
        start: addDays(today, -365),
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

  const domain = calculateDomain();

  const chartState = {
    zoomLevel: 1,
    minZoom: 0.25,
    maxZoom: 16,
    domainStart: domain.start,
    domainEnd: domain.end,
    xScale: null,
    yScale: null,
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
    const lines = [
      "<strong>" + escapeHtml(rangeRow.repo) + "</strong>",
      escapeHtml(rangeRow.start + " to " + rangeRow.end),
      "Commits: " + rangeRow.commitCount,
      "Active days: " + rangeRow.activeDays,
    ];
    return lines.join("<br>");
  }

  function buildMarkerTooltipContent(marker) {
    const header = marker.label ? "<strong>" + escapeHtml(marker.label) + "</strong>" : "";
    const dateText =
      marker.kind === "point"
        ? isoFormat(marker.dateDate)
        : isoFormat(marker.startDate) + " to " + isoFormat(marker.endDate);
    const scopeText = marker.scope === "global" ? "Global marker" : "Repo: " + escapeHtml(marker.repo);
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

  function renderLabels(layout, yScale) {
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
      const y = yScale(row.repo);
      if (typeof y !== "number") {
        return;
      }

      const rowElement = document.createElement("div");
      rowElement.className = "projects-v2__label-row" + (index % 2 === 1 ? " is-alt" : "");
      rowElement.style.top = y + "px";
      rowElement.style.height = yScale.bandwidth() + "px";
      rowElement.textContent = row.repo;
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
      "Repos: " +
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
    const targetStart = addDays(targetEnd, -365);
    return targetStart > chartState.domainStart ? targetStart : chartState.domainStart;
  }

  function scrollToLastTwelveMonths() {
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
      rowHeight: 24,
      rowGap: 10,
    };

    const chartHeight = rows.length * (layout.rowHeight + layout.rowGap);
    const visibleChartWidth = Math.max(viewportWidth - layout.chartLeft - layout.right, 240);
    const basePixelsPerDay = visibleChartWidth / 365;
    const pixelPerDay = Math.max(0.2, basePixelsPerDay * chartState.zoomLevel);

    const fullDays =
      Math.max(1, Math.round((chartState.domainEnd.getTime() - chartState.domainStart.getTime()) / MS_PER_DAY)) + 1;
    const chartWidth = Math.max(visibleChartWidth, Math.ceil(fullDays * pixelPerDay));

    layout.chartWidth = chartWidth;
    layout.svgWidth = layout.chartLeft + chartWidth + layout.right;
    layout.svgHeight = layout.top + chartHeight + layout.bottom;
    chartState.layout = layout;

    const xScale = d3
      .scaleTime()
      .domain([chartState.domainStart, chartState.domainEnd])
      .range([layout.chartLeft, layout.chartLeft + chartWidth]);

    const yScale = d3
      .scaleBand()
      .domain(rows.map((row) => row.repo))
      .range([layout.top, layout.top + chartHeight])
      .paddingInner(0.24)
      .paddingOuter(0.12);

    chartState.xScale = xScale;
    chartState.yScale = yScale;

    svg.attr("width", layout.svgWidth).attr("height", layout.svgHeight);
    svg.selectAll("*").remove();

    renderLabels(layout, yScale);

    const rowBackground = svg.append("g");
    rows.forEach((row, index) => {
      const y = yScale(row.repo);
      if (typeof y !== "number") {
        return;
      }
      if (index % 2 === 1) {
        rowBackground
          .append("rect")
          .attr("class", "projects-v2__row-alt")
          .attr("x", layout.chartLeft)
          .attr("y", y)
          .attr("width", layout.chartWidth)
          .attr("height", yScale.bandwidth());
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
      row.ranges.forEach((range) => {
        allRanges.push({
          repo: row.repo,
          startDate: range.startDate,
          endDate: range.endDate,
          start: range.start,
          end: range.end,
          commitCount: range.commitCount,
          activeDays: range.activeDays,
        });
      });
    });

    svg
      .append("g")
      .selectAll("rect")
      .data(allRanges)
      .enter()
      .append("rect")
      .attr("class", "projects-v2__range")
      .attr("x", (range) => xScale(range.startDate))
      .attr("y", (range) => yScale(range.repo))
      .attr("width", (range) => {
        const endX = xScale(addDays(range.endDate, 1));
        return Math.max(2, endX - xScale(range.startDate));
      })
      .attr("height", yScale.bandwidth())
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
        const y = yScale(marker.repo);
        return typeof y === "number" ? y + 2 : chartTop;
      })
      .attr("width", (marker) => {
        const endX = xScale(addDays(marker.endDate, 1));
        return Math.max(2, endX - xScale(marker.startDate));
      })
      .attr("height", yScale.bandwidth() - 4)
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
        showTooltip(event, buildMarkerTooltipContent(marker), true);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    const globalPointMarkers = markers.filter((marker) => marker.scope === "global" && marker.kind === "point");
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
      .attr("x", (marker) => xScale(marker.dateDate) + 4)
      .attr("y", chartTop - 10)
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
        const y = yScale(marker.repo);
        return typeof y === "number" ? y : chartTop;
      })
      .attr("y2", (marker) => {
        const y = yScale(marker.repo);
        return typeof y === "number" ? y + yScale.bandwidth() : chartTop;
      })
      .attr("stroke", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
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
        const y = yScale(marker.repo);
        return typeof y === "number" ? y + yScale.bandwidth() / 2 : chartTop;
      })
      .attr("r", 3)
      .attr("fill", (marker) => marker.color || null)
      .on("mouseenter", function (event, marker) {
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

    if (renderOptions.resetToLast12Months) {
      scrollToLastTwelveMonths();
      chartState.firstRender = false;
      return;
    }

    if (renderOptions.anchorDate && typeof renderOptions.anchorPixel === "number") {
      const nextScrollLeft = xScale(renderOptions.anchorDate) - renderOptions.anchorPixel;
      const maxScroll = Math.max(0, layout.svgWidth - timelineRoot.clientWidth);
      timelineRoot.scrollLeft = clampNumber(nextScrollLeft, 0, maxScroll);
    } else if (chartState.firstRender) {
      scrollToLastTwelveMonths();
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
        render({ resetToLast12Months: true });
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

  render({ resetToLast12Months: true });
})();
