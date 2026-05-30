import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

const CARD_VERSION = "v1.8.4"; 

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

// 1. 編輯器 (Prism3DCardEditor)
class Prism3DCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: { state: true } }; }
  setConfig(config) { this._config = { ...config }; }
  
  _labelFor(name) {
    const labels = { 
      title: "卡片標題", data_mode: "數據計算模式", color: "圖表主色", mode: "顯示模式", 
      chart_radius: "圖表縮放比例", entities: "實體 (必填)", rotation: "旋轉角度", 
      drag_direction: "拖曳旋轉方向", tilt: "傾斜視角", line_width: "稜線寬度", 
      area_opacity: "區域透明度", text_size: "文字大小", text_color: "文字顏色"
    };
    return labels[name] || name;
  }

  // --- 關鍵修正：實體列表 Schema ---
  _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "data_mode", selector: { select: { mode: "dropdown", options: [{ label: "絕對值", value: "absolute" }, { label: "絕對值比例", value: "absolute_prop" }, { label: "相對值比例", value: "relative_prop" }] } } },
      { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } },
      { name: "chart_radius", selector: { number: { min: 10, max: 100, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
      
      // 使用與 Glance Card 相同的實體列表編輯器，支援次級設定頁面
      {
        name: "entities",
        selector: {
          text: {
            multiple: true,
            // 這裡設定讓 HA 使用實體編輯器（包含筆圖示）
          }
        },
        // 特殊處理：當 selector 偵測到 entities 是物件陣列時，會自動嘗試調用 Row Editor
        type: "grid",
        schema: [
            {
                name: "entities",
                selector: {
                    entity: {
                        multiple: true
                    }
                }
            }
        ]
      },
      
      // 這裡動態產生每個實體的子設定（當點擊「筆」進入編輯時會用到）
      ... (this._config.entities || []).flatMap((ent, idx) => {
          const entityId = typeof ent === 'string' ? ent : ent.entity;
          return [
              { name: `ent_name_${idx}`, label: `${entityId} 顯示名稱`, selector: { text: {} } },
              { name: `ent_max_${idx}`, label: `${entityId} Max 值`, selector: { number: { mode: "box" } } }
          ];
      }),

      { type: "expandable", title: "視覺與視角設定", schema: [
          { name: "color", selector: { text: {} } },
          { name: "rotation", selector: { number: { min: 0, max: 360, step: 1, unitOfMeasurement: "°", mode: "slider" } } }, 
          { name: "tilt", selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } },
          { name: "line_width", selector: { number: { min: 0, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } }
      ]}
    ];
  }

  _valueChanged(ev) {
    if (!ev.detail.value) return;
    const value = ev.detail.value;
    const nextConfig = { ...this._config, ...value };
    
    if (value.entities) {
      const oldEntities = this._config.entities || [];
      nextConfig.entities = value.entities.map((entId) => {
        const entityId = typeof entId === 'string' ? entId : entId.entity;
        // 嘗試找回舊有的細節設定 (name/max)
        const existing = oldEntities.find(e => (typeof e === 'string' ? e : e.entity) === entityId);
        
        if (typeof existing === 'object') {
          return { ...existing };
        }
        return { entity: entityId, name: "", max: 100 };
      });
    }

    // 處理子頁面回傳的自定義數值
    if (nextConfig.entities) {
        nextConfig.entities = nextConfig.entities.map((ent, idx) => {
            const updated = { ...ent };
            if (value[`ent_name_${idx}`] !== undefined) updated.name = value[`ent_name_${idx}`];
            if (value[`ent_max_${idx}`] !== undefined) updated.max = parseFloat(value[`ent_max_${idx}`]);
            
            // 清理暫存屬性
            delete nextConfig[`ent_name_${idx}`];
            delete nextConfig[`ent_max_${idx}`];
            return updated;
        });
    }

    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: nextConfig }, bubbles: true, composed: true }));
  }

  render() {
    if (!this._config || !this.hass) return html``;

    const formData = { ...this._config };
    
    // 展平數據供 ha-form 渲染
    if (formData.entities) {
        const originalEntities = formData.entities;
        formData.entities = originalEntities.map(ent => typeof ent === 'object' ? ent.entity : ent);
        originalEntities.forEach((ent, idx) => {
            if (typeof ent === 'object') {
                formData[`ent_name_${idx}`] = ent.name || "";
                formData[`ent_max_${idx}`] = ent.max || 100;
            }
        });
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${formData}
        .schema=${this._schema()}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

// 2. 主卡片 (Prism3DCard) 
class Prism3DCard extends HTMLElement {
  constructor() {
    super();
    this._hoverIndex = -1;
    this._dragRotation = 0;
    this._isDragging = false;
  }

  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", data_mode: "absolute", color: "#E13460", rotation: 0, tilt: 0.4, entities: [], title: "數據稜鏡" }; }

  set hass(hass) { this._hass = hass; if (this.chart) this._updateData(); }

  setConfig(config) {
    this.config = config;
    if (!this.shadowRoot) { this._initChart(); } 
    else { this._updateMainStyle(); this._updateTitle(); this._updateData(); }
  }

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
    this._updateMainStyle();
    this._updateTitle();

    const onStart = (e) => {
      if (this.config.mode !== '3d') return;
      this._isDragging = true;
      this._startX = e.pageX || e.touches[0].pageX;
      this._mainContainer.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!this._isDragging) return;
      const x = e.pageX || e.touches[0].pageX;
      const deltaX = x - this._startX;
      const multiplier = this.config.drag_direction === 'reverse' ? -0.5 : 0.5;
      this._dragRotation = Math.max(-90, Math.min(90, deltaX * multiplier));
      this._updateData();
    };
    const onEnd = () => { if (!this._isDragging) return; this._isDragging = false; this._mainContainer.style.cursor = 'grab'; this._startSpringBack(); };
    this._mainContainer.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    this._mainContainer.addEventListener('touchstart', onStart, {passive: true});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onEnd);

    setTimeout(() => {
      this.chart = echarts.init(this._container);
      this.chart.on('mouseover', (p) => { if (p.dataIndex >= 0 && this._hoverIndex !== p.dataIndex) { this._hoverIndex = p.dataIndex; this._updateData(); } });
      this.chart.on('mouseout', () => { this._hoverIndex = -1; this._updateData(); });
      this._updateData();
      new ResizeObserver(() => this.chart && this.chart.resize()).observe(this._container);
    }, 100);
  }

  _startSpringBack() {
    const step = () => {
      if (Math.abs(this._dragRotation) < 0.1) { this._dragRotation = 0; this._updateData(); return; }
      this._dragRotation *= 0.88; this._updateData(); requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _updateMainStyle() {
    const isTitle = this.config && this.config.title;
    const baseHeight = this.config.card_height || 350;
    this._mainContainer.style.height = `${isTitle ? baseHeight + 50 : baseHeight}px`;
    this._container.style.cssText = `width: 100%; height: 100%; padding-top: ${isTitle ? '40px' : '0px'}; box-sizing: border-box;`;
  }

  _updateTitle() {
    if (this.config && this.config.title) { this._titleElement.innerText = this.config.title; this._titleElement.style.display = 'block'; }
    else { this._titleElement.style.display = 'none'; }
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;
    const mainColor = this.config.color || '#E13460';
    const is3D = this.config.mode === '3d';
    const dataMode = this.config.data_mode || 'absolute';
    const lineWidth = parseFloat(this.config.line_width) || 0;
    const areaOpacity = parseFloat(this.config.area_opacity) || 0.4;
    const chartRadiusVal = parseFloat(this.config.chart_radius) || 65;
    const rotationRad = ((parseFloat(this.config.rotation || 0) + this._dragRotation) * Math.PI) / 180;
    const tilt = parseFloat(this.config.tilt) || 0.4;

    const entities = (this.config.entities || []).map(ent => typeof ent === 'string' ? { entity: ent, max: 100 } : ent).filter(ent => ent.entity);
    const dataValues = entities.map(ent => { const state = this._hass.states[ent.entity]; return state ? parseFloat(state.state) || 0 : 0; });
    const indicators = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return { name: (ent.name || state?.attributes?.friendly_name || ent.entity.split('.')[1]).toUpperCase(), max: ent.max || 100 };
    });

    let visualPercents = [];
    if (dataMode === 'absolute') { visualPercents = dataValues.map((v, i) => v / (indicators[i].max || 100)); }
    else if (dataMode === 'absolute_prop') { const absRatios = dataValues.map((v, i) => v / (indicators[i].max || 100)); const maxR = Math.max(...absRatios, 0.0001); visualPercents = absRatios.map(r => r / maxR); }
    else if (dataMode === 'relative_prop') { const maxV = Math.max(...dataValues, 0.0001); visualPercents = dataValues.map(v => v / maxV); }

    const getP = (vPercent, i, cx, cy, radius, rotationRad, tilt) => {
        const count = indicators.length;
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * tilt); 
        return { bx, by, x: bx, y: by - (vPercent * (radius * 0.8)) };
    };

    let option = {};
    if (is3D) {
      const w = this.chart.getWidth(), h = this._container.clientHeight;
      const cx = w / 2, cy = h / 2 + 20;
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.6;
      option = {
        backgroundColor: 'transparent',
        tooltip: {
          show: !this._isDragging, trigger: 'item', enterable: false, confine: true, appendToBody: false, transitionDuration: 0, position: (pos) => [pos[0] + 20, pos[1] + 20], extraCssText: 'pointer-events: none !important; z-index: 9999; border:none !important; box-shadow:none !important;', backgroundColor: 'rgba(0, 0, 0, 0.85)', borderColor: mainColor, borderWidth: 1, textStyle: { color: '#fff', fontSize: 12 },
          formatter: (p) => { const i = p.dataIndex; return i >= 0 ? `<div style="padding: 5px;"><span style="color:#94a3b8; margin-right:15px;">${indicators[i].name}</span><b style="color:${mainColor}">${dataValues[i]}</b></div>` : ''; }
        },
        xAxis: { show: false, min: 0, max: w }, yAxis: { show: false, min: 0, max: h },
        series: [
          {
            type: 'custom',
            renderItem: (params, api) => {
              const i = params.dataIndex; const pts = visualPercents.map((vp, idx) => getP(vp, idx, cx, cy, radius, rotationRad, tilt));
              const gridGroup = [], faceGroup = [], lineGroup = []; const count = indicators.length;
              if (i === 0) {
                for (let s = 5; s >= 1; s--) {
                  const stepR = radius * (s / 5), stepPts = [];
                  for (let j = 0; j < count; j++) {
                    const angle = (Math.PI * 2 / count) * j - Math.PI / 2 + rotationRad;
                    const gx = cx + Math.cos(angle) * stepR, gy = cy + Math.sin(angle) * stepR * tilt;
                    stepPts.push([gx, gy]);
                    if (s === 5) gridGroup.push({ type: 'line', shape: { x1: cx, y1: cy, x2: gx, y2: gy }, style: { stroke: this.config.grid_color || '#fff', opacity: this.config.grid_line_opacity || 0.1 }, silent: true });
                  }
                  gridGroup.push({ type: 'polygon', z: 1, shape: { points: stepPts }, style: { fill: this._hexToRgba(this.config.grid_color || '#fff', s % 2 === 0 ? (this.config.grid_opacity_2 || 0.05) : (this.config.grid_opacity_1 || 0.02)), stroke: this.config.grid_color || '#fff', opacity: this.config.grid_line_opacity || 0.1 }, silent: true });
                }
              }
              const pCurr = pts[i], pPrev = pts[(i - 1 + count) % count], pNext = pts[(i + 1) % count];
              const mLeft = { x: (pPrev.bx + pCurr.bx) / 2, y: (pPrev.by + pCurr.by) / 2 }, mRight = { x: (pCurr.bx + pNext.bx) / 2, y: (pCurr.by + pNext.by) / 2 };
              const isHovered = (i === this._hoverIndex), opVar = parseFloat(this.config.opacity_variation) || 0.02;
              faceGroup.push({ type: 'polygon', z: 2, shape: { points: [[cx, cy], [mLeft.x, mLeft.y], [pCurr.x, pCurr.y]] }, style: { fill: this._hexToRgba(mainColor, Math.min(1, areaOpacity + opVar + (isHovered ? 0.3 : 0))) } });
              faceGroup.push({ type: 'polygon', z: 2, shape: { points: [[cx, cy], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] }, style: { fill: this._hexToRgba(mainColor, Math.min(1, areaOpacity - opVar + (isHovered ? 0.3 : 0))) } });
              if (lineWidth > 0) {
                lineGroup.push({ type: 'polyline', z: 3, shape: { points: [[mLeft.x, mLeft.y], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] }, style: { stroke: mainColor, fill: 'none', lineWidth: lineWidth, lineJoin: 'round' } });
                lineGroup.push({ type: 'line', z: 1, shape: { x1: pCurr.bx, y1: pCurr.by, x2: pCurr.x, y2: pCurr.y }, style: { stroke: mainColor, lineDash: [2, 3], lineWidth: 1, opacity: isHovered ? 0.8 : 0.3 } });
              }
              return { type: 'group', children: [...gridGroup, ...faceGroup, ...lineGroup] };
            },
            data: dataValues.map(v => v)
          },
          {
            type: 'custom', z: 10, silent: true,
            renderItem: (params, api) => {
              const i = params.dataIndex; const pCurr = getP(visualPercents[i], i, cx, cy, radius, rotationRad, tilt); const isHovered = (i === this._hoverIndex);
              return { type: 'text', z: 10, style: { text: indicators[i].name, x: pCurr.x, y: pCurr.y - ((this.config.text_size || 11) + 5), fill: isHovered ? '#fff' : (this.config.text_color || '#94a3b8'), font: `${isHovered ? 'bold ' : ''}${this.config.text_size || 11}px sans-serif`, textAlign: 'center', textVerticalAlign: 'bottom', stroke: this.config.text_stroke_color || '#000', lineWidth: this.config.text_stroke_width || 2 } };
            },
            data: dataValues.map(v => v)
          }
        ]
      };
    } else {
      option = {
        backgroundColor: 'transparent',
        tooltip: { show: true, trigger: 'item', backgroundColor: 'rgba(0, 0, 0, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', textStyle: { color: '#fff' } },
        radar: { indicator: indicators.map(ind => ({ ...ind, max: 1 })), startAngle: 90 + (parseFloat(this.config.rotation) || 0), shape: 'polygon', radius: `${chartRadiusVal}%`, center: ['50%', this.config.title ? '60%' : '50%'], axisName: { fontSize: this.config.text_size || 11, color: this.config.text_color || '#94a3b8', stroke: this.config.text_stroke_color || '#000', lineWidth: this.config.text_stroke_width || 2 }, splitLine: { lineStyle: { color: this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_line_opacity) || 0.1) } }, splitArea: { show: true, areaStyle: { color: [this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_opacity_2) || 0.05), this._hexToRgba(this.config.grid_color || '#fff', parseFloat(this.config.grid_opacity_1) || 0.02)].reverse() } } },
        series: [{ type: 'radar', data: [{ value: visualPercents, symbol: 'none', lineStyle: { color: mainColor, width: lineWidth }, areaStyle: { color: this._hexToRgba(mainColor, areaOpacity) } }] }]
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

customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);