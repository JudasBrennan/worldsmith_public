import {
  SCIENCE_GRAPH_EDGES,
  SCIENCE_GRAPH_NODES,
  SCIENCE_GRAPH_SECTIONS,
} from "./scienceGraphData.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";

// ── Tooltips ──
const TIP_LABEL = {
  Explore: "Toggle the exploration controls for search, filters, and graph mode.",
  "Reset focus": "Restore the default metallicity-focused trace and re-enable all graph filters.",
  Concept: "Search by concept name, tag, or short description.",
  "Hop depth":
    "Trace mode shows concepts within the selected number of links around the active concept.",
};

const GRAPH_METRICS = Object.freeze({
  marginX: 28,
  marginY: 28,
  laneWidth: 188,
  sectionWidth: 170,
  sectionLabelHeight: 34,
  sectionPadX: 10,
  sectionPadY: 12,
  nodeHeight: 50,
  rowGap: 18,
});

const VIEW_LABELS = Object.freeze({
  trace: "Path trace",
  atlas: "Atlas",
});

const EVIDENCE_LABELS = Object.freeze({
  runtime: "Runtime",
  documented: "Documented",
  curated: "Curated",
});

const KIND_LABELS = Object.freeze({
  input: "Input",
  model: "Model",
  derived: "Derived",
  classifier: "Classifier",
});

const DEFAULT_SELECTED_NODE_ID = "stellar_metallicity";
const DEFAULT_VIEW_MODE = "trace";
const DEFAULT_HOP_DEPTH = "2";
const MAX_SEARCH_RESULTS = 6;

const SECTION_BY_ID = new Map(SCIENCE_GRAPH_SECTIONS.map((section) => [section.id, section]));
const NODE_BY_ID = new Map(SCIENCE_GRAPH_NODES.map((node) => [node.id, node]));

const OUTGOING = new Map();
const INCOMING = new Map();

for (const node of SCIENCE_GRAPH_NODES) {
  OUTGOING.set(node.id, []);
  INCOMING.set(node.id, []);
}

for (const edge of SCIENCE_GRAPH_EDGES) {
  OUTGOING.get(edge.sourceId)?.push(edge);
  INCOMING.get(edge.targetId)?.push(edge);
}

const SECTION_ROW_COUNTS = new Map();

for (const section of SCIENCE_GRAPH_SECTIONS) {
  SECTION_ROW_COUNTS.set(section.id, 0);
}

for (const node of SCIENCE_GRAPH_NODES) {
  SECTION_ROW_COUNTS.set(
    node.sectionId,
    Math.max(SECTION_ROW_COUNTS.get(node.sectionId) || 0, node.row + 1),
  );
}

const SECTION_FRAMES = new Map(
  SCIENCE_GRAPH_SECTIONS.map((section) => {
    const rowCount = Math.max(1, SECTION_ROW_COUNTS.get(section.id) || 1);
    const height =
      GRAPH_METRICS.sectionLabelHeight +
      GRAPH_METRICS.sectionPadY * 2 +
      rowCount * GRAPH_METRICS.nodeHeight +
      Math.max(0, rowCount - 1) * GRAPH_METRICS.rowGap;

    return [
      section.id,
      {
        x: GRAPH_METRICS.marginX + section.lane * GRAPH_METRICS.laneWidth,
        y: section.y,
        width: GRAPH_METRICS.sectionWidth,
        height,
      },
    ];
  }),
);

const GRAPH_BOUNDS = (() => {
  let maxX = 0;
  let maxY = 0;
  for (const frame of SECTION_FRAMES.values()) {
    maxX = Math.max(maxX, frame.x + frame.width);
    maxY = Math.max(maxY, frame.y + frame.height);
  }
  return {
    width: maxX + GRAPH_METRICS.marginX,
    height: maxY + GRAPH_METRICS.marginY,
  };
})();

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function asElement(target) {
  return target && typeof target.closest === "function" ? target : null;
}

function compareNodes(a, b) {
  const sectionA = SECTION_BY_ID.get(a.sectionId);
  const sectionB = SECTION_BY_ID.get(b.sectionId);
  const laneDelta = (sectionA?.lane || 0) - (sectionB?.lane || 0);
  if (laneDelta !== 0) return laneDelta;
  const yDelta = (sectionA?.y || 0) - (sectionB?.y || 0);
  if (yDelta !== 0) return yDelta;
  const rowDelta = a.row - b.row;
  if (rowDelta !== 0) return rowDelta;
  return a.label.localeCompare(b.label);
}

function sortNodeIds(nodeIds) {
  return [...new Set(nodeIds)]
    .map((nodeId) => NODE_BY_ID.get(nodeId))
    .filter(Boolean)
    .sort(compareNodes)
    .map((node) => node.id);
}

function getSectionFrame(sectionId) {
  return SECTION_FRAMES.get(sectionId);
}

function getNodeRect(node) {
  const frame = getSectionFrame(node.sectionId);
  const x = frame.x + GRAPH_METRICS.sectionPadX;
  const y =
    frame.y +
    GRAPH_METRICS.sectionLabelHeight +
    GRAPH_METRICS.sectionPadY +
    node.row * (GRAPH_METRICS.nodeHeight + GRAPH_METRICS.rowGap);
  return {
    x,
    y,
    width: frame.width - GRAPH_METRICS.sectionPadX * 2,
    height: GRAPH_METRICS.nodeHeight,
  };
}

function scoreNode(node, query) {
  if (!query) return 0;
  const label = normalizeText(node.label);
  if (label === query) return 100;
  if (label.startsWith(query)) return 70;
  if (label.includes(query)) return 50;

  const tagHit = (node.tags || []).some((tag) => normalizeText(tag).includes(query));
  if (tagHit) return 35;

  const summary = normalizeText(node.summary);
  if (summary.includes(query)) return 20;

  return 0;
}

function getSearchResults(query, enabledSections) {
  const clean = normalizeText(query);
  if (!clean) return [];
  return SCIENCE_GRAPH_NODES.filter((node) => enabledSections.has(node.sectionId))
    .map((node) => ({ node, score: scoreNode(node, clean) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || compareNodes(a.node, b.node))
    .slice(0, MAX_SEARCH_RESULTS)
    .map((entry) => entry.node);
}

function collectTraceNodeIds(selectedNodeId, hopDepth, edges) {
  if (!selectedNodeId) return new Set();
  const maxDepth =
    hopDepth === "all" ? Number.POSITIVE_INFINITY : Math.max(1, Number(hopDepth) || 1);
  const adjacency = new Map();

  for (const edge of edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, []);
    adjacency.get(edge.sourceId).push(edge.targetId);
    adjacency.get(edge.targetId).push(edge.sourceId);
  }

  const seen = new Set([selectedNodeId]);
  const queue = [{ nodeId: selectedNodeId, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;

    for (const nextNodeId of adjacency.get(current.nodeId) || []) {
      if (seen.has(nextNodeId)) continue;
      seen.add(nextNodeId);
      queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
    }
  }

  return seen;
}

function buildGraphModel(state) {
  const allowedNodeIds = new Set(
    SCIENCE_GRAPH_NODES.filter((node) => state.enabledSections.has(node.sectionId)).map(
      (node) => node.id,
    ),
  );

  const candidateEdges = SCIENCE_GRAPH_EDGES.filter(
    (edge) =>
      state.enabledEvidence.has(edge.evidence) &&
      allowedNodeIds.has(edge.sourceId) &&
      allowedNodeIds.has(edge.targetId),
  );

  let selectedNodeId = state.selectedNodeId;
  if (!allowedNodeIds.has(selectedNodeId)) {
    selectedNodeId = allowedNodeIds.has(DEFAULT_SELECTED_NODE_ID)
      ? DEFAULT_SELECTED_NODE_ID
      : [...allowedNodeIds][0] || null;
  }

  let visibleNodeIds = allowedNodeIds;
  if (state.viewMode === "trace" && selectedNodeId) {
    visibleNodeIds = collectTraceNodeIds(selectedNodeId, state.hopDepth, candidateEdges);
  }

  const visibleNodes = SCIENCE_GRAPH_NODES.filter((node) => visibleNodeIds.has(node.id));
  const visibleEdges = candidateEdges.filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
  );

  const upstreamNodeIds = sortNodeIds(
    visibleEdges.filter((edge) => edge.targetId === selectedNodeId).map((edge) => edge.sourceId),
  );
  const downstreamNodeIds = sortNodeIds(
    visibleEdges.filter((edge) => edge.sourceId === selectedNodeId).map((edge) => edge.targetId),
  );
  const connectedNodeIds = new Set([selectedNodeId, ...upstreamNodeIds, ...downstreamNodeIds]);
  const visibleSectionIds = new Set(visibleNodes.map((node) => node.sectionId));
  const runtimeEdgeCount = visibleEdges.filter((edge) => edge.evidence === "runtime").length;
  const searchResults = getSearchResults(state.search, state.enabledSections);

  return {
    selectedNodeId,
    selectedNode: NODE_BY_ID.get(selectedNodeId) || null,
    visibleNodes,
    visibleEdges,
    visibleSectionIds,
    upstreamNodeIds,
    downstreamNodeIds,
    connectedNodeIds,
    runtimeEdgeCount,
    searchResults,
  };
}

function edgePath(edge) {
  const source = NODE_BY_ID.get(edge.sourceId);
  const target = NODE_BY_ID.get(edge.targetId);
  if (!source || !target) return "";

  const sourceRect = getNodeRect(source);
  const targetRect = getNodeRect(target);
  const sameLane =
    SECTION_BY_ID.get(source.sectionId)?.lane === SECTION_BY_ID.get(target.sectionId)?.lane;

  if (sameLane) {
    const sx = sourceRect.x + sourceRect.width * 0.7;
    const sy = sourceRect.y + sourceRect.height;
    const tx = targetRect.x + targetRect.width * 0.3;
    const ty = targetRect.y;
    const bend = Math.max(26, Math.abs(ty - sy) * 0.35);
    const controlY1 = sy + (ty >= sy ? bend : -bend);
    const controlY2 = ty - (ty >= sy ? bend : -bend);
    return `M ${sx} ${sy} C ${sx} ${controlY1}, ${tx} ${controlY2}, ${tx} ${ty}`;
  }

  const sx = sourceRect.x + sourceRect.width;
  const sy = sourceRect.y + sourceRect.height / 2;
  const tx = targetRect.x;
  const ty = targetRect.y + targetRect.height / 2;
  const bend = Math.max(40, Math.abs(tx - sx) * 0.42);
  return `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`;
}

function buildSectionFilterMarkup(enabledSections) {
  return SCIENCE_GRAPH_SECTIONS.map(
    (section) => `
      <label class="science-viz__check">
        <input
          type="checkbox"
          name="scienceVizSection"
          value="${escapeHtml(section.id)}"
          ${enabledSections.has(section.id) ? "checked" : ""}
        />
        <span>${escapeHtml(section.label)}</span>
      </label>`,
  ).join("");
}

function buildEvidenceFilterMarkup(enabledEvidence) {
  return Object.entries(EVIDENCE_LABELS)
    .map(
      ([evidence, label]) => `
      <label class="science-viz__check">
        <input
          type="checkbox"
          name="scienceVizEvidence"
          value="${escapeHtml(evidence)}"
          ${enabledEvidence.has(evidence) ? "checked" : ""}
        />
        <span>${escapeHtml(label)}</span>
      </label>`,
    )
    .join("");
}

function buildKpiMarkup(model) {
  const selectionLabel = model.selectedNode ? model.selectedNode.label : "No focus";
  return `
    <div class="kpi-wrap">
      <div class="kpi">
        <div class="kpi__label">Visible Nodes</div>
        <div class="kpi__value">${model.visibleNodes.length}</div>
        <div class="kpi__meta">${model.visibleSectionIds.size} sections in view</div>
      </div>
    </div>
    <div class="kpi-wrap">
      <div class="kpi">
        <div class="kpi__label">Visible Links</div>
        <div class="kpi__value">${model.visibleEdges.length}</div>
        <div class="kpi__meta">${model.runtimeEdgeCount} runtime-backed</div>
      </div>
    </div>
    <div class="kpi-wrap">
      <div class="kpi">
        <div class="kpi__label">Upstream</div>
        <div class="kpi__value">${model.upstreamNodeIds.length}</div>
        <div class="kpi__meta">Direct inputs to ${escapeHtml(selectionLabel)}</div>
      </div>
    </div>
    <div class="kpi-wrap">
      <div class="kpi">
        <div class="kpi__label">Downstream</div>
        <div class="kpi__value">${model.downstreamNodeIds.length}</div>
        <div class="kpi__meta">Direct outputs from ${escapeHtml(selectionLabel)}</div>
      </div>
    </div>
  `;
}

function buildSummaryText(state, model) {
  if (!model.selectedNode) {
    return "No visible concept matches the current filters.";
  }

  if (state.viewMode === "trace") {
    const hopLabel = state.hopDepth === "all" ? "full trace" : `${state.hopDepth}-hop trace`;
    return `${hopLabel} around ${model.selectedNode.label}, showing ${model.visibleNodes.length} concepts and ${model.visibleEdges.length} links.`;
  }

  return `Atlas view across ${model.visibleSectionIds.size} sections, with ${model.visibleNodes.length} concepts and ${model.visibleEdges.length} links visible.`;
}

function buildSearchResultMarkup(searchResults, selectedNodeId, query) {
  if (!normalizeText(query)) {
    return `<div class="science-viz__empty">Try "metallicity", "CMF", "surface temperature", or "tectonics".</div>`;
  }

  if (!searchResults.length) {
    return `<div class="science-viz__empty">No matching concepts in the enabled sections.</div>`;
  }

  return searchResults
    .map((node) => {
      const section = SECTION_BY_ID.get(node.sectionId);
      return `
        <button
          type="button"
          class="science-viz__result ${node.id === selectedNodeId ? "is-active" : ""}"
          data-select-node="${escapeHtml(node.id)}"
        >
          <span class="science-viz__result-title">${escapeHtml(node.label)}</span>
          <span class="science-viz__result-meta">${escapeHtml(section?.label || "")}</span>
        </button>`;
    })
    .join("");
}

function buildGraphMarkup(state, model) {
  const visibleNodeIds = new Set(model.visibleNodes.map((node) => node.id));
  const sections = SCIENCE_GRAPH_SECTIONS.filter((section) =>
    model.visibleSectionIds.has(section.id),
  );
  const sectionMarkup = sections
    .map((section) => {
      const frame = getSectionFrame(section.id);
      return `
        <g class="science-viz__section">
          <rect
            x="${frame.x}"
            y="${frame.y}"
            width="${frame.width}"
            height="${frame.height}"
            rx="18"
            ry="18"
          />
          <text x="${frame.x + 12}" y="${frame.y + 22}" class="science-viz__section-label">${escapeHtml(section.label)}</text>
        </g>`;
    })
    .join("");

  const edgeMarkup = model.visibleEdges
    .map((edge) => {
      const source = NODE_BY_ID.get(edge.sourceId);
      const target = NODE_BY_ID.get(edge.targetId);
      const direct =
        edge.sourceId === model.selectedNodeId || edge.targetId === model.selectedNodeId
          ? " is-connected"
          : "";
      const muted =
        model.selectedNodeId && state.viewMode === "atlas" && !direct ? " is-muted" : "";
      const title = `${source?.label || edge.sourceId} \u2192 ${target?.label || edge.targetId} (${EVIDENCE_LABELS[edge.evidence] || edge.evidence})`;
      return `
        <path
          class="science-viz__edge science-viz__edge--${escapeHtml(edge.evidence)}${direct}${muted}"
          d="${edgePath(edge)}"
          marker-end="url(#scienceVizArrow)"
        >
          <title>${escapeHtml(title)}</title>
        </path>`;
    })
    .join("");

  const nodeMarkup = model.visibleNodes
    .slice()
    .sort(compareNodes)
    .map((node) => {
      const rect = getNodeRect(node);
      const selected = node.id === model.selectedNodeId ? " is-selected" : "";
      const connected =
        node.id !== model.selectedNodeId && model.connectedNodeIds.has(node.id)
          ? " is-connected"
          : "";
      const muted =
        model.selectedNodeId && state.viewMode === "atlas" && !model.connectedNodeIds.has(node.id)
          ? " is-muted"
          : "";
      const section = SECTION_BY_ID.get(node.sectionId);
      const tooltip = `${node.label}: ${node.summary}`;

      return `
        <g
          class="science-viz__node science-viz__node--${escapeHtml(node.kind)}${selected}${connected}${muted}"
          transform="translate(${rect.x}, ${rect.y})"
          tabindex="0"
          role="button"
          aria-label="Select ${escapeHtml(node.label)}"
          data-node-id="${escapeHtml(node.id)}"
          data-tip="${escapeHtml(tooltip)}"
        >
          <rect width="${rect.width}" height="${rect.height}" rx="14" ry="14" />
          <text x="12" y="21" class="science-viz__node-label">${escapeHtml(node.label)}</text>
          <text x="12" y="38" class="science-viz__node-meta">${escapeHtml(
            `${KIND_LABELS[node.kind]} - ${section?.label || ""}`,
          )}</text>
        </g>`;
    })
    .join("");

  if (!visibleNodeIds.size) {
    return `<div class="science-viz__empty science-viz__empty--canvas">No concepts are visible with the current filters.</div>`;
  }

  return `
    <svg
      class="science-viz__svg"
      viewBox="0 0 ${GRAPH_BOUNDS.width} ${GRAPH_BOUNDS.height}"
      aria-label="Science dependency graph"
    >
      <defs>
        <marker
          id="scienceVizArrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
        </marker>
      </defs>
      ${sectionMarkup}
      <g class="science-viz__edges">${edgeMarkup}</g>
      <g class="science-viz__nodes">${nodeMarkup}</g>
    </svg>
    <div class="science-viz__legend" aria-label="Graph legend">
      <div class="science-viz__legend-group">
        <div class="science-viz__legend-title">Nodes</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-swatch science-viz__legend-swatch--input"></span> Input</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-swatch science-viz__legend-swatch--derived"></span> Derived</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-swatch science-viz__legend-swatch--model"></span> Model</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-swatch science-viz__legend-swatch--classifier"></span> Classifier</div>
      </div>
      <div class="science-viz__legend-group">
        <div class="science-viz__legend-title">Edges</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-line science-viz__legend-line--runtime"></span> Runtime</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-line science-viz__legend-line--documented"></span> Documented</div>
        <div class="science-viz__legend-item"><span class="science-viz__legend-line science-viz__legend-line--curated"></span> Curated</div>
      </div>
    </div>
  `;
}

function buildRelatedListMarkup(nodeIds) {
  if (!nodeIds.length) {
    return `<div class="science-viz__empty">None in the current filter.</div>`;
  }

  return nodeIds
    .map((nodeId) => {
      const node = NODE_BY_ID.get(nodeId);
      return `
        <button type="button" class="science-viz__chip" data-select-node="${escapeHtml(nodeId)}">
          ${escapeHtml(node?.label || nodeId)}
        </button>`;
    })
    .join("");
}

function buildInspectorMarkup(model) {
  const node = model.selectedNode;
  if (!node) {
    return `<div class="science-viz__empty">Choose a visible concept to inspect its dependencies.</div>`;
  }

  const section = SECTION_BY_ID.get(node.sectionId);
  const docsMarkup = (node.docs || [])
    .map(
      (doc) => `
        <a class="science-viz__link-chip" href="${escapeHtml(doc.href)}">${escapeHtml(doc.label)}</a>`,
    )
    .join("");
  const refsMarkup = (node.engineRefs || [])
    .map((ref) => `<code class="science-viz__code-chip">${escapeHtml(ref)}</code>`)
    .join("");
  const tagsMarkup = (node.tags || [])
    .map((tag) => `<span class="science-viz__tag">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <div class="science-viz__inspector">
      <div class="science-viz__inspector-head">
        <div>
          <div class="science-viz__eyebrow">${escapeHtml(section?.label || "Unknown section")}</div>
          <h3 class="science-viz__inspector-title">${escapeHtml(node.label)}</h3>
        </div>
        <div class="badge">${escapeHtml(KIND_LABELS[node.kind])}</div>
      </div>
      <p class="science-viz__summary">${escapeHtml(node.summary)}</p>
      ${node.formula ? `<div class="science-viz__formula">${escapeHtml(node.formula)}</div>` : ""}
      <div class="science-viz__inspector-grid">
        <div>
          <div class="science-viz__label">Depends On</div>
          <div class="science-viz__chip-row">${buildRelatedListMarkup(model.upstreamNodeIds)}</div>
        </div>
        <div>
          <div class="science-viz__label">Feeds Into</div>
          <div class="science-viz__chip-row">${buildRelatedListMarkup(model.downstreamNodeIds)}</div>
        </div>
      </div>
      <div class="science-viz__label">Engine Sources</div>
      <div class="science-viz__code-row">${refsMarkup || `<div class="science-viz__empty">No runtime source listed.</div>`}</div>
      <div class="science-viz__label">Reference Pages</div>
      <div class="science-viz__chip-row">${docsMarkup || `<div class="science-viz__empty">No documentation links listed.</div>`}</div>
      <div class="science-viz__label">Tags</div>
      <div class="science-viz__tag-row">${tagsMarkup || `<div class="science-viz__empty">No tags.</div>`}</div>
    </div>
  `;
}

export function initScienceVisualiserPage(mountEl) {
  const state = {
    search: "",
    selectedNodeId: DEFAULT_SELECTED_NODE_ID,
    viewMode: DEFAULT_VIEW_MODE,
    hopDepth: DEFAULT_HOP_DEPTH,
    enabledSections: new Set(SCIENCE_GRAPH_SECTIONS.map((section) => section.id)),
    enabledEvidence: new Set(Object.keys(EVIDENCE_LABELS)),
    controlsOpen: false,
  };

  const wrap = document.createElement("div");
  wrap.className = "page science-viz-page";
  wrap.innerHTML = `
    <div class="science-viz-layout">
      <div class="panel science-viz-panel">
        <div class="panel__header">
          <h1 class="panel__title">
            <span class="ws-icon icon--science-viz" aria-hidden="true"></span>
            <span>Science Visualiser</span>
          </h1>
          <div class="viz-canvas-actions science-viz__actions">
            <div class="badge" id="scienceVizHeaderBadge">Path trace</div>
            <button id="scienceVizBtnControls" type="button" class="small">
              ${tipIcon(TIP_LABEL["Explore"])} Explore &#x25BE;
            </button>
            <button id="scienceVizResetFocus" type="button" class="small">
              ${tipIcon(TIP_LABEL["Reset focus"])} Reset focus
            </button>
          </div>
        </div>
        <div class="science-viz-canvas-area">
          <div id="scienceVizControlsDropdown" class="science-viz-controls-dropdown" hidden>
            <div class="science-viz-controls-dropdown__row">
              <label class="science-viz__field science-viz__field--grow">
                <span>Concept ${tipIcon(TIP_LABEL["Concept"])}</span>
                <input
                  id="scienceVizSearch"
                  type="search"
                  placeholder="Search for CMF, habitable zone, tectonics..."
                  autocomplete="off"
                />
              </label>
            </div>
            <div class="science-viz-controls-dropdown__row">
              <div class="science-viz__dropdown-block science-viz__dropdown-block--results">
                <div class="science-viz__dropdown-label">Matches</div>
                <div id="scienceVizSearchResults" class="science-viz__results"></div>
              </div>
            </div>
            <div class="science-viz-controls-dropdown__row science-viz-controls-dropdown__row--dual">
              <div class="science-viz__dropdown-block">
                <div class="science-viz__dropdown-label">View</div>
                <div class="physics-duo-toggle science-viz__mode-toggle" id="scienceVizModeToggle">
                  <input type="radio" name="scienceVizViewMode" id="scienceVizTrace" value="trace" checked />
                  <label for="scienceVizTrace">Path trace</label>
                  <input type="radio" name="scienceVizViewMode" id="scienceVizAtlas" value="atlas" />
                  <label for="scienceVizAtlas">Atlas</label>
                  <span></span>
                </div>
              </div>
              <label class="science-viz__field science-viz__field--compact science-viz__field--select">
                <span>Hop depth ${tipIcon(TIP_LABEL["Hop depth"])}</span>
                <select id="scienceVizHopDepth">
                  <option value="1">1 hop</option>
                  <option value="2" selected>2 hops</option>
                  <option value="3">3 hops</option>
                  <option value="all">Full trace</option>
                </select>
              </label>
            </div>
            <div class="science-viz-controls-dropdown__row">
              <div class="science-viz__dropdown-block">
                <div class="science-viz__dropdown-label">Evidence</div>
                <div id="scienceVizEvidenceFilters" class="science-viz__checklist">
                  ${buildEvidenceFilterMarkup(state.enabledEvidence)}
                </div>
              </div>
            </div>
            <div class="science-viz-controls-dropdown__row">
              <div class="science-viz__dropdown-block">
                <div class="science-viz__dropdown-label">Sections</div>
                <div id="scienceVizSectionFilters" class="science-viz__checklist">
                  ${buildSectionFilterMarkup(state.enabledSections)}
                </div>
              </div>
            </div>
          </div>

          <div class="science-viz__status">
            <div>
              <p class="science-viz__lede">
                Trace how WorldSmith concepts feed into each other, from stellar metallicity and orbital layout through interiors, atmosphere, climate, tectonics, and population.
              </p>
              <p id="scienceVizSummary" class="hint science-viz__summary-line"></p>
            </div>
            <div class="badge" id="scienceVizModeBadge">Path trace</div>
          </div>

          <div id="scienceVizGraph" class="science-viz__canvas"></div>

          <div class="science-viz__details">
            <div class="science-viz__details-block">
              <div class="science-viz__details-title">Overview</div>
              <div id="scienceVizKpis" class="kpi-grid science-viz__kpis"></div>
            </div>

            <div class="science-viz__details-block science-viz__details-block--inspector">
              <div class="science-viz__details-title">Inspector</div>
              <div id="scienceVizInspector"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    controlsButton: wrap.querySelector("#scienceVizBtnControls"),
    controlsDropdown: wrap.querySelector("#scienceVizControlsDropdown"),
    headerBadge: wrap.querySelector("#scienceVizHeaderBadge"),
    modeBadge: wrap.querySelector("#scienceVizModeBadge"),
    searchInput: wrap.querySelector("#scienceVizSearch"),
    searchResults: wrap.querySelector("#scienceVizSearchResults"),
    hopDepth: wrap.querySelector("#scienceVizHopDepth"),
    summary: wrap.querySelector("#scienceVizSummary"),
    kpis: wrap.querySelector("#scienceVizKpis"),
    graph: wrap.querySelector("#scienceVizGraph"),
    inspector: wrap.querySelector("#scienceVizInspector"),
  };

  function setControlsOpen(open) {
    state.controlsOpen = !!open;
    if (refs.controlsDropdown) refs.controlsDropdown.hidden = !state.controlsOpen;
    if (refs.controlsButton) {
      refs.controlsButton.innerHTML =
        `${tipIcon(TIP_LABEL["Explore"])} Explore ` +
        (state.controlsOpen ? "&#x25B4;" : "&#x25BE;");
    }
  }

  function update() {
    const model = buildGraphModel(state);
    state.selectedNodeId = model.selectedNodeId;

    if (refs.searchInput) refs.searchInput.value = state.search;
    if (refs.headerBadge) refs.headerBadge.textContent = VIEW_LABELS[state.viewMode];
    if (refs.modeBadge) refs.modeBadge.textContent = VIEW_LABELS[state.viewMode];
    if (refs.hopDepth) refs.hopDepth.disabled = state.viewMode !== "trace";
    if (refs.summary) refs.summary.textContent = buildSummaryText(state, model);
    if (refs.searchResults) {
      refs.searchResults.innerHTML = buildSearchResultMarkup(
        model.searchResults,
        model.selectedNodeId,
        state.search,
      );
    }
    if (refs.kpis) refs.kpis.innerHTML = buildKpiMarkup(model);
    if (refs.graph) refs.graph.innerHTML = buildGraphMarkup(state, model);
    if (refs.inspector) refs.inspector.innerHTML = buildInspectorMarkup(model);
    attachTooltips(wrap);
  }

  function toggleSetValue(set, value, checked) {
    if (checked) {
      set.add(value);
      return true;
    }
    if (set.size === 1 && set.has(value)) {
      return false;
    }
    set.delete(value);
    return true;
  }

  wrap.addEventListener("input", (event) => {
    const target = asElement(event.target);
    if (!target || !target.matches("input, select")) return;

    if (target.id === "scienceVizSearch") {
      state.search = target.value;
      update();
      return;
    }

    if (target.name === "scienceVizViewMode") {
      state.viewMode = target.value;
      update();
      return;
    }

    if (target.id === "scienceVizHopDepth") {
      state.hopDepth = target.value;
      update();
      return;
    }

    if (target.name === "scienceVizSection") {
      const changed = toggleSetValue(state.enabledSections, target.value, target.checked);
      if (!changed) target.checked = true;
      update();
      return;
    }

    if (target.name === "scienceVizEvidence") {
      const changed = toggleSetValue(state.enabledEvidence, target.value, target.checked);
      if (!changed) target.checked = true;
      update();
    }
  });

  wrap.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.controlsOpen) {
      setControlsOpen(false);
      return;
    }

    if (event.target === refs.searchInput && event.key === "Enter") {
      const firstResult = getSearchResults(state.search, state.enabledSections)[0];
      if (firstResult) {
        state.selectedNodeId = firstResult.id;
        update();
      }
      return;
    }

    const nodeId = event.target?.getAttribute?.("data-node-id");
    if (!nodeId) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    state.selectedNodeId = nodeId;
    update();
  });

  wrap.addEventListener("mousedown", (event) => {
    const target = asElement(event.target);
    if (!target || !state.controlsOpen) return;
    if (target.closest("#scienceVizControlsDropdown") || target.closest("#scienceVizBtnControls"))
      return;
    setControlsOpen(false);
  });

  wrap.addEventListener("click", (event) => {
    const target = asElement(event.target);

    const controlsButton = target?.closest("#scienceVizBtnControls") || null;
    if (controlsButton) {
      setControlsOpen(!state.controlsOpen);
      return;
    }

    if (state.controlsOpen && !target?.closest("#scienceVizControlsDropdown")) {
      setControlsOpen(false);
    }

    const button = target?.closest("[data-select-node]") || null;
    if (button) {
      state.selectedNodeId = button.getAttribute("data-select-node") || DEFAULT_SELECTED_NODE_ID;
      update();
      return;
    }

    const nodeButton = target?.closest("[data-node-id]") || null;
    if (nodeButton) {
      state.selectedNodeId = nodeButton.getAttribute("data-node-id") || DEFAULT_SELECTED_NODE_ID;
      update();
      return;
    }

    const resetButton = target?.closest("#scienceVizResetFocus") || null;
    if (resetButton) {
      state.search = "";
      state.selectedNodeId = DEFAULT_SELECTED_NODE_ID;
      state.viewMode = DEFAULT_VIEW_MODE;
      state.hopDepth = DEFAULT_HOP_DEPTH;
      state.enabledSections = new Set(SCIENCE_GRAPH_SECTIONS.map((section) => section.id));
      state.enabledEvidence = new Set(Object.keys(EVIDENCE_LABELS));
      wrap.querySelector("#scienceVizTrace").checked = true;
      wrap.querySelector("#scienceVizHopDepth").value = DEFAULT_HOP_DEPTH;
      wrap.querySelectorAll('input[name="scienceVizSection"]').forEach((input) => {
        input.checked = true;
      });
      wrap.querySelectorAll('input[name="scienceVizEvidence"]').forEach((input) => {
        input.checked = true;
      });
      setControlsOpen(false);
      update();
    }
  });

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);

  setControlsOpen(false);
  update();
  attachTooltips(wrap);
}
