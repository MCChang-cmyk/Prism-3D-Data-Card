import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

const CARD_VERSION = "v1.9.4"; 

console.info(
  `%c PRISM-3D-CARD %c ${CARD_VERSION} %c (dist) `,
  "color: white; background: #E13460; font-weight: 700;",
  "color: #E13460; background: white; font-weight: 700;",
  "color: #94a3b8; background: transparent;"
);

let LitElement = window.LitElement;
if (!LitElement) {
  const haPanel = customElements.get("ha-panel-lovelace");
  if (haPanel) { LitElement = Object.getPrototypeOf(haPanel); }
  else { LitElement = class extends HTMLElement { set hass(hass) { this._hass = hass; } setConfig(config) { this._config = config; } }; }
}
const html = LitElement.prototype.html || ((strings, ...values) => strings[0]);

class Prism3DCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: { state: true }, _expandedIndex: { state: true } }; }
  constructor() { super(); this._expandedIndex = -1; }
  setConfig(config) { this._config = config; }
  
  _labelFor(name) {
    const labels = {
      title: "卡片標題", card_height: "畫布整體高度", data_mode: "數據計算模式", 
      decimal_places: "顯示小數點位數", max_height_ratio: "山峰最高突起比例", // 新增標籤
      color: "圖表主色", mode: "顯示模式", chart_radius: "圖表縮放比例 (底座)", 
      entities: "選擇實體 (Entities)", rotation: "旋轉角度", drag_direction: "拖曳旋轉方向", 
      tilt: "傾斜視角 (俯視度)", line_width: "稜線寬度", area_opacity: "區域總透明度", 
      text_size: "文字字體大小", text_color: "文字顯示顏色", text_stroke_width: "文字外框粗細", 
      text_stroke_color: "文字外框顏色", opacity_variation: "3D 明暗差異值", grid_color: "網格顏色", 
      grid_line_opacity: "網格線透明度", grid_opacity_1: "背景斑馬紋-淺", grid_opacity_2: "背景斑馬紋-深"
    };
    return labels[name] || name;
  }

  _valueChanged(ev) {
    if (!ev.detail.value) return;
    this._fireConfig({ ...this._config, ...ev.detail.value });
  }

  _addEntity(ev) {
    const value = ev.detail.value;
    const entityId = (value && value._new_entity) ? value._new_entity : null;
    if (!entityId) return;
    const newEntities = [...(this._config.entities || [])];
    if (!newEntities.some(ent => (typeof ent === 'string' ? ent : ent.entity) === entityId)) {
      newEntities.push({ entity: entityId, name: "", max: 100 });
      this._fireConfig({ entities: newEntities });
    }
  }

  _removeEntity(idx) {
    const newEntities = [...(this._config.entities || [])];
    newEntities.splice(idx, 1);
    this._fireConfig({ entities: newEntities });
    if (this._expandedIndex === idx) this._expandedIndex = -1;
  }

  _updateEntity(idx, updates) {
    const newEntities = JSON.parse(JSON.stringify(this._config.entities || []));
    newEntities[idx] = { ...newEntities[idx], ...updates };
    this._fireConfig({ entities: newEntities });
  }

  _fireConfig(updates) {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { ...this._config, ...updates } }, bubbles: true, composed: true }));
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const entities = this._config.entities || [];
    return html`
      <style>
        .entities-container { border: 1px solid var(--divider-color); border-radius: 8px; margin: 16px 0; overflow: hidden; background: var(--secondary-background-color); }
        .entity-row { border-bottom: 1px solid var(--divider-color); background: var(--card-background-color); }
        .entity-header { display: flex; align-items: center; padding: 10px 12px; cursor: pointer; min-height: 48px; }
        .entity-header:hover { background: var(--secondary-background-color); }
        .entity-info { flex: 1; display: flex; flex-direction: column; }
        .entity-title { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
        .entity-id { font-size: 11px; color: var(--secondary-text-color); }
        .entity-content { padding: 16px; background: var(--secondary-background-color); border-top: 1px solid var(--divider-color); }
        ha-icon-button { --mdc-icon-button-size: 36px; color: var(--secondary-text-color); }
        .del-btn { color: var(--error-color); }
      </style>

      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${[
          { name: "title", selector: { text: {} } },
          { name: "card_height", selector: { number: { min: 200, max: 800, step: 10, unitOfMeasurement: "px", mode: "slider" } } }, // 找回高度設定
          { name: "data_mode", selector: { select: { mode: "dropdown", options: [{ label: "絕對值", value: "absolute" }, { label: "絕對值比例", value: "absolute_prop" }, { label: "相對值比例", value: "relative_prop" }] } } },
          { name: "decimal_places", selector: { number: { min: 0, max: 5, step: 1, mode: "slider" } } },
          { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } }
        ]}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>

      <div style="margin-top: 24px; font-weight: 500; font-size: 14px; color: var(--primary-text-color);">實體清單設定</div>
      <div class="entities-container">
        ${entities.map((ent, idx) => {
          const isExpanded = this._expandedIndex === idx;
          const eid = typeof ent === 'string' ? ent : ent.entity;
          return html`
            <div class="entity-row">
              <div class="entity-header" @click=${() => this._expandedIndex = isExpanded ? -1 : idx}>
                <ha-icon icon="${isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}" style="margin-right:12px; color: var(--secondary-text-color);"></ha-icon>
                <div class="entity-info"><div class="entity-title">${ent.name || (this.hass.states[eid]?.attributes?.friendly_name || eid)}</div><div class="entity-id">${eid}</div></div>
                <ha-icon-button class="del-btn" @click=${(e) => { e.stopPropagation(); this._removeEntity(idx); }} .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}></ha-icon-button>
              </div>
              ${isExpanded ? html`<div class="entity-content"><ha-form .hass=${this.hass} .data=${{ name: ent.name || "", max: ent.max !== undefined ? ent.max : 100 }} .schema=${[{ name: "name", selector: { text: {} } },{ name: "max", selector: { number: { mode: "box", step: 0.1 } } }]} .computeLabel=${(s) => s.name === 'name' ? '顯示名稱' : '最大量程 (Max)'} @value-changed=${(e) => this._updateEntity(idx, e.detail.value)}></ha-form></div>` : ""}
            </div>`;
        })}
        <div style="padding: 16px; background: var(--secondary-background-color); border-top: 1px solid var(--divider-color);">
          <ha-form .hass=${this.hass} .data=${{ _new_entity: "" }} .schema=${[{ name: "_new_entity", selector: { entity: {} } }]} .computeLabel=${() => "選擇實體加入圖表..."} @value-changed=${this._addEntity}></ha-form>
        </div>
      </div>

      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${[
          { name: "chart_radius", selector: { number: { min: 10, max: 100, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
          { name: "max_height_ratio", selector: { number: { min: 0.1, max: 3.0, step: 0.05, mode: "slider" } } }, // 新增山峰高度控制器
          { type: "expandable", title: "視覺與配色", schema: [{ name: "color", selector: { text: {} } }, { name: "line_width", selector: { number: { min: 0, max: 10, step: 1, mode: "slider" } } }, { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } }, { name: "text_size", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } }, { name: "text_color", selector: { text: {} } }, { name: "text_stroke_width", selector: { number: { min: 0, max: 10, step: 0.5, mode: "slider" } } }, { name: "text_stroke_color", selector: { text: {} } }, { name: "opacity_variation", selector: { number: { min: 0, max: 0.2, step: 0.01, mode: "slider" } } }] },
          { type: "expandable", title: "視角與角度", schema: [{ name: "rotation", selector: { number: { min: 0, max: 360, step: 1, unitOfMeasurement: "°", mode: "slider" } } }, { name: "drag_direction", selector: { select: { mode: "dropdown", options: [{ label: "正常 (隨手勢)", value: "normal" }, { label: "反向 (隨鏡頭)", value: "reverse" }] } } }, { name: "tilt", selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } }] },
          { type: "expandable", title: "背景網格", schema: [{ name: "grid_color", selector: { text: {} } }, { name: "grid_line_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } }, { name: "grid_opacity_1", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } }, { name: "grid_opacity_2", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } }] }
        ]}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

class Prism3DCard extends HTMLElement {
  constructor() { super(); this._hoverIndex = -1; this._dragRotation = 0; this._isDragging = false; }
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", data_mode: "absolute", decimal_places: 1, max_height_ratio: 0.8, card_height: 350, color: "#E13460", rotation: 0, tilt: 0.4, entities: [], title: "數據稜鏡" }; }
  
  set hass(hass) { this._hass = hass; if (this.chart) this._updateData(); }
  setConfig(config) { this.config = config; if (!this.shadowRoot) { this._initChart(); } else { this._updateMainStyle(); this._updateTitle(); this._updateData(); } }

  _initChart() {
    const root = this.attachShadow({ mode: 'open' });
    this._mainContainer = document.createElement('div');
    this._mainContainer.style.cssText = `position: relative; width: 100%; box-sizing: border-box; overflow: hidden; cursor: grab;`;
    this._titleElement = document.createElement('div');
    this._titleElement.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; color: var(--ha-card-header-color, --primary-text-color); font-size: var(--ha-card-header-font-size, 24px); padding: 12px 16px 8px; box-sizing: border-box; text-align: left; z-index: 10; pointer-events: none;`;
    this._mainContainer.appendChild(this._titleElement);
    this._container = document.createElement('div');
    this._mainContainer.appendChild(this._container);
    root.appendChild(this._mainContainer);
    this._updateMainStyle(); this._updateTitle();

    const onStart = (e) => { if (this.config.mode !== '3d') return; this._isDragging = true; this._startX = e.pageX || (e.touches && e.touches[0].pageX); this._mainContainer.style.cursor = 'grabbing'; };
    const onMove = (e) => { if (!this._isDragging) return; const deltaX = (e.pageX || (e.touches && e.touches[0].pageX)) - this._startX; const multiplier = (this.config.drag_direction === 'reverse' ? -0.5 : 0.5); this._dragRotation = Math.max(-90, Math.min(90, deltaX * multiplier)); this._updateData(); };
    const onEnd = () => { if (!this._isDragging) return; this._isDragging = false; this._mainContainer.style.cursor = 'grab'; this._startSpringBack(); };
    this._mainContainer.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    this._mainContainer.addEventListener('touchstart', onStart, {passive: true}); window.addEventListener('touchmove', onMove, {passive: false}); window.addEventListener('touchend', onEnd);

    setTimeout(() => {
      this.chart = echarts.init(this._container);
      this.chart.on('mouseover', (p) => { if (p.dataIndex >= 0 && this._hoverIndex !== p.dataIndex) { this._hoverIndex = p.dataIndex; this._updateData(); } });
      this.chart.on('mouseout', () => { this._hoverIndex = -1; this._updateData(); });
      this._updateData();
      new ResizeObserver(() => this.chart && this.chart.resize()).observe(this._container);
    }, 100);
  }

  _startSpringBack() { const step = () => { if (Math.abs(this._dragRotation) < 0.1) { this._dragRotation = 0; this._updateData(); return; } this._dragRotation *= 0.88; this._updateData(); requestAnimationFrame(step); }; requestAnimationFrame(step); }
  _updateMainStyle() { const isTitle = this.config && this.config.title; const baseHeight = parseFloat(this.config.card_height) || 350; this._mainContainer.style.height = `${isTitle ? baseHeight + 50 : baseHeight}px`; this._container.style.cssText = `width: 100%; height: 100%; padding-top: ${isTitle ? '40px' : '0px'}; box-sizing: border-box;`; }
  _updateTitle() { if (this.config && this.config.title) { this._titleElement.innerText = this.config.title; this._titleElement.style.display = 'block'; } else { this._titleElement.style.display = 'none'; } }

  _updateData() {
    if (!this._hass || !this.chart) return;
    const mainColor = this.config.color || '#E13460';
    const is3D = this.config.mode === '3d';
    const dataMode = this.config.data_mode || 'absolute';
    const globalDecimals = this.config.decimal_places !== undefined ? this.config.decimal_places : 1;
    const maxHeightRatio = this.config.max_height_ratio !== undefined ? parseFloat(this.config.max_height_ratio) : 0.8;
    const rotationRad = ((parseFloat(this.config.rotation || 0) + this._dragRotation) * Math.PI) / 180;
    const tilt = parseFloat(this.config.tilt) || 0.4;

    const entities = (this.config.entities || []).map(ent => typeof ent === 'string' ? { entity: ent, max: 100 } : ent).filter(ent => ent.entity);
    const dataValues = entities.map(ent => {
      const stateObj = this._hass.states[ent.entity];
      const val = parseFloat(stateObj?.state) || 0;
      const precision = stateObj?.attributes?.display_precision !== undefined ? stateObj.attributes.display_precision : globalDecimals;
      return parseFloat(val.toFixed(precision));
    });

    const indicators = entities.map(ent => {
      const stateObj = this._hass.states[ent.entity];
      return { name: (ent.name || stateObj?.attributes?.friendly_name || ent.entity.split('.')[1]).toUpperCase(), max: ent.max || 100, unit: stateObj?.attributes?.unit_of_measurement || "" };
    });

    let visualPercents = [];
    if (dataMode === 'absolute') visualPercents = dataValues.map((v, i) => v / (indicators[i].max || 100));
    else if (dataMode === 'absolute_prop') { const absRatios = dataValues.map((v, i) => v / (indicators[i].max || 100)); const maxR = Math.max(...absRatios, 0.0001); visualPercents = absRatios.map(r => r / maxR); }
    else if (dataMode === 'relative_prop') { const maxV = Math.max(...dataValues, 0.0001); visualPercents = dataValues.map(v => v / maxV); }

    // --- 核心：套用最高高度控制 ---
    const getP = (vPercent, i, cx, cy, radius, rotationRad, tilt) => { 
        const count = indicators.length; 
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad; 
        const bx = cx + Math.cos(angle) * radius; 
        const by = cy + (Math.sin(angle) * radius * tilt); 
        return { bx, by, x: bx, y: by - (vPercent * (radius * maxHeightRatio)) }; // 使用 maxHeightRatio
    };

    let option = {};
    if (is3D) {
      const w = this.chart.getWidth(), h = this._container.clientHeight;
      const cx = w / 2, cy = h / 2 + 20;
      const radius = (parseFloat(this.config.chart_radius) || 65) / 100 * Math.min(w, h) * 0.6;
      option = {
        backgroundColor: 'transparent',
        tooltip: { show: !this._isDragging, trigger: 'item', enterable: false, confine: true, appendToBody: false, transitionDuration: 0, position: (pos) => [pos[0] + 20, pos[1] + 20], extraCssText: 'pointer-events: none !important; z-index: 9999; border:none !important; box-shadow:none !important;', backgroundColor: 'rgba(0, 0, 0, 0.85)', borderColor: mainColor, borderWidth: 1, textStyle: { color: '#fff', fontSize: 12 },
          formatter: (p) => { const i = p.dataIndex; if (i < 0) return ''; return `<div style="padding: 5px;"><span style="color:#94a3b8; margin-right:15px;">${indicators[i].name}</span><b style="color:${mainColor}">${dataValues[i]} ${indicators[i].unit}</b></div>`; }
        },
        xAxis: { show: false, min: 0, max: w }, yAxis: { show: false, min: 0, max: h },
        series: [{ type: 'custom', renderItem: (params, api) => {
          const i = params.dataIndex; const pts = visualPercents.map((vp, idx) => getP(vp, idx, cx, cy, radius, rotationRad, tilt));
          const gridGroup = [], faceGroup = [], lineGroup = []; const count = indicators.length;
          if (count === 0) return { type: 'group', children: [] };
          if (i === 0) { for (let s = 5; s >= 1; s--) { const stepR = radius * (s / 5), stepPts = []; for (let j = 0; j < count; j++) { const angle = (Math.PI * 2 / count) * j - Math.PI / 2 + rotationRad; const gx = cx + Math.cos(angle) * stepR, gy = cy + Math.sin(angle) * stepR * tilt; stepPts.push([gx, gy]); if (s === 5) gridGroup.push({ type: 'line', shape: { x1: cx, y1: cy, x2: gx, y2: gy }, style: { stroke: this.config.grid_color || '#fff', opacity: parseFloat(this.config.grid_line_opacity) || 0.1 }, silent: true }); }
          gridGroup.push({ type: 'polygon', z: 1, shape: { points: stepPts }, style: { fill: this._hexToRgba(this.config.grid_color || '#fff', s%2===0?parseFloat(this.config.grid_opacity_2)||0.05:parseFloat(this.config.grid_opacity_1)||0.02), stroke: this.config.grid_color || '#fff', opacity: parseFloat(this.config.grid_line_opacity) || 0.1 }, silent: true }); } }
          const pCurr = pts[i], pPrev = pts[(i - 1 + count) % count], pNext = pts[(i + 1) % count];
          const mLeft = { x: (pPrev.bx + pCurr.bx) / 2, y: (pPrev.by + pCurr.by) / 2 }, mRight = { x: (pCurr.bx + pNext.bx) / 2, y: (pCurr.by + pNext.by) / 2 };
          const isHovered = (i === this._hoverIndex), opVar = parseFloat(this.config.opacity_variation) || 0.02, areaOp = parseFloat(this.config.area_opacity) || 0.4;
          faceGroup.push({ type: 'polygon', z: 2, shape: { points: [[cx, cy], [mLeft.x, mLeft.y], [pCurr.x, pCurr.y]] }, style: { fill: this._hexToRgba(mainColor, Math.min(1, areaOp + opVar + (isHovered ? 0.3 : 0))) } });
          faceGroup.push({ type: 'polygon', z: 2, shape: { points: [[cx, cy], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] }, style: { fill: this._hexToRgba(mainColor, Math.min(1, areaOp - opVar + (isHovered ? 0.3 : 0))) } });
          const lw = parseFloat(this.config.line_width) || 0;
          if (lw > 0) { lineGroup.push({ type: 'polyline', z: 3, shape: { points: [[mLeft.x, mLeft.y], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] }, style: { stroke: mainColor, fill: 'none', lineWidth: lw, lineJoin: 'round' } }); lineGroup.push({ type: 'line', z: 1, shape: { x1: pCurr.bx, y1: pCurr.by, x2: pCurr.x, y2: pCurr.y }, style: { stroke: mainColor, lineDash: [2, 3], lineWidth: 1, opacity: isHovered ? 0.8 : 0.3 } }); }
          return { type: 'group', children: [...gridGroup, ...faceGroup, ...lineGroup] };
        }, data: dataValues.map(v => v) }, { type: 'custom', z: 10, silent: true, renderItem: (params, api) => {
          const i = params.dataIndex; const pCurr = getP(visualPercents[i], i, cx, cy, radius, rotationRad, tilt); const isHovered = (i === this._hoverIndex);
          return { type: 'text', z: 10, style: { text: indicators[i].name, x: pCurr.x, y: pCurr.y - 15, fill: isHovered ? '#fff' : (this.config.text_color || '#94a3b8'), font: `${isHovered ? 'bold ' : ''}${parseFloat(this.config.text_size)||11}px sans-serif`, textAlign: 'center', textVerticalAlign: 'bottom', stroke: this.config.text_stroke_color || '#000', lineWidth: parseFloat(this.config.text_stroke_width) || 2 } };
        }, data: dataValues.map(v => v) }]
      };
    } else {
      option = {
        backgroundColor: 'transparent',
        tooltip: { show: true, trigger: 'item', backgroundColor: 'rgba(0, 0, 0, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', textStyle: { color: '#fff' } },
        radar: { indicator: indicators.map(ind => ({ ...ind, max: 1 })), startAngle: 90 + (parseFloat(this.config.rotation) || 0), shape: 'polygon', radius: `${parseFloat(this.config.chart_radius)||65}%`, center: ['50%', this.config.title ? '60%' : '50%'], axisName: { fontSize: parseFloat(this.config.text_size)||11, color: this.config.text_color || '#94a3b8', stroke: this.config.text_stroke_color || '#000', lineWidth: parseFloat(this.config.text_stroke_width) || 2 }, splitLine: { lineStyle: { color: this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_line_opacity) || 0.1) } }, splitArea: { show: true, areaStyle: { color: [this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_opacity_2) || 0.05), this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_opacity_1) || 0.02)].reverse() } } },
        series: [{ type: 'radar', data: [{ value: visualPercents, symbol: 'none', lineStyle: { color: mainColor, width: parseFloat(this.config.line_width)||2 }, areaStyle: { color: this._hexToRgba(mainColor, parseFloat(this.config.area_opacity)||0.4) } }] }]
      };
    }
    this.chart.setOption(option, false);
  }
  _hexToRgba(hex, opacity) {
    const cleanHex = (hex || '#ffffff').replace('#', '');
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0]+cleanHex[0] : cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1]+cleanHex[1] : cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2]+cleanHex[2] : cleanHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}

if (!customElements.get("prism-3d-card-editor")) { customElements.define("prism-3d-card-editor", Prism3DCardEditor); }
if (!customElements.get("prism-3d-card")) { customElements.define("prism-3d-card", Prism3DCard); }