import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

const CARD_VERSION = "v1.4.0"; // 方便後續統一管理版本

console.info(
  `%c PRISM-3D-CARD %c ${CARD_VERSION} %c (dist) `,
  "color: white; background: #E13460; font-weight: 700;",
  "color: #E13460; background: white; font-weight: 700;",
  "color: #94a3b8; background: transparent;"
);


// --- 環境相容性修正 ---
let LitElement = window.LitElement;
if (!LitElement) {
  const haPanel = customElements.get("ha-panel-lovelace");
  if (haPanel) {
    LitElement = Object.getPrototypeOf(haPanel);
  } else {
    LitElement = class extends HTMLElement {
      set hass(hass) { this._hass = hass; }
      setConfig(config) { this._config = config; }
    };
  }
}
const html = LitElement.prototype.html || ((strings, ...values) => strings[0]);

// 1. 編輯器 (Prism3DCardEditor)
class Prism3DCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: { state: true } }; }
  setConfig(config) { this._config = { ...config }; }

  _labelFor(name) {
    const labels = {
      color: "圖表主色",
      mode: "顯示模式",
      chart_radius: "圖表縮放比例",
      entities: "選擇實體 (Entities)",
      rotation: "旋轉角度",
      tilt: "傾斜視角 (俯視度)",
      line_width: "稜線寬度 (0為不繪製)",
      area_opacity: "區域總透明度",
      text_size: "文字字體大小",
      text_color: "文字顯示顏色",
      text_stroke_width: "文字外框粗細",
      text_stroke_color: "文字外框顏色",
      opacity_variation: "3D 明暗差異值",
      grid_color: "網格顏色",
      grid_line_opacity: "網格線透明度",
      grid_opacity_1: "背景斑馬紋 - 淺色層",
      grid_opacity_2: "背景斑馬紋 - 深色層"
    };
    return labels[name] || name;
  }

  _schema() {
    return [
      { name: "color", selector: { text: {} } },
      { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } },
      { name: "chart_radius", selector: { number: { min: 10, max: 100, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
      { name: "entities", selector: { entity: { multiple: true } } },
      {
        type: "expandable", title: "視角與角度",
        schema: [
          { name: "rotation", selector: { number: { min: 0, max: 360, step: 1, unitOfMeasurement: "°", mode: "slider" } } },
          { name: "tilt", selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } },
        ],
      },
      {
        type: "expandable", title: "視覺精修",
        schema: [
          // 【修正】 min 改為 0
          { name: "line_width", selector: { number: { min: 0, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          { name: "text_size", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } },
          { name: "text_color", selector: { text: {} } },
          { name: "text_stroke_width", selector: { number: { min: 0, max: 10, step: 0.5, mode: "slider" } } },
          { name: "text_stroke_color", selector: { text: {} } },
          { name: "opacity_variation", selector: { number: { min: 0, max: 0.2, step: 0.01, mode: "slider" } } },
        ]
      },
      {
        type: "expandable", title: "背景網格",
        schema: [
          { name: "grid_color", selector: { text: {} } },
          { name: "grid_line_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
          { name: "grid_opacity_1", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } },
          { name: "grid_opacity_2", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } },
        ]
      }
    ];
  }

  _valueChanged(ev) {
    if (!ev.detail.value) return;
    const nextConfig = { ...ev.detail.value };
    if (nextConfig.entities) {
      nextConfig.entities = nextConfig.entities.map(ent => {
        if (typeof ent === 'string') {
          const oldEnt = (this._config.entities || []).find(e => (typeof e === 'object' ? e.entity : e) === ent);
          return typeof oldEnt === 'object' ? oldEnt : { entity: ent, name: "", max: 100 };
        }
        return ent;
      });
    }
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: nextConfig }, bubbles: true, composed: true }));
  }

  render() {
    const displayConfig = { ...this._config };
    if (displayConfig.entities) {
      displayConfig.entities = displayConfig.entities.map(ent => typeof ent === 'object' ? ent.entity : ent);
    }
    const formData = { 
      card_height: 350, line_width: 2, area_opacity: 0.4, rotation: 0, 
      opacity_variation: 0.02, tilt: 0.4, chart_radius: 65,
      text_size: 11, text_color: "#94a3b8", text_stroke_width: 2, text_stroke_color: "#000000",
      grid_opacity_1: 0.02, grid_opacity_2: 0.05,
      ...displayConfig 
    };
    return html`<ha-form .hass=${this.hass} .data=${formData} .schema=${this._schema()} .computeLabel=${(s) => this._labelFor(s.name)} @value-changed=${this._valueChanged}></ha-form>`;
  }
}

// 2. 主卡片 (Prism3DCard)
class Prism3DCard extends HTMLElement {
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", color: "#E13460", rotation: 0, tilt: 0.4, entities: [] }; }

  set hass(hass) {
    this._hass = hass;
    if (!this.chart) { this._initChart(); } else { this._updateData(); }
  }

  setConfig(config) {
    this.config = config;
    if (this._container) this._container.style.height = `${config.card_height || 350}px`;
  }

  _initChart() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    this._container = document.createElement('div');
    this._container.style.cssText = `width: 100%; height: ${this.config.card_height || 350}px;`;
    root.appendChild(this._container);

    setTimeout(() => {
      this.chart = echarts.init(this._container);
      this._updateData();
      new ResizeObserver(() => this.chart && this.chart.resize()).observe(this._container);
    }, 100);
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;

    const mainColor = this.config.color || '#E13460';
    const is3D = this.config.mode === '3d';
    const lineWidth = this.config.line_width !== undefined ? parseFloat(this.config.line_width) : 2;
    const areaOpacity = parseFloat(this.config.area_opacity) || 0.4;
    const textSize = this.config.text_size || 11;
    const textColor = this.config.text_color || '#94a3b8';
    const textStrokeWidth = this.config.text_stroke_width !== undefined ? this.config.text_stroke_width : 2;
    const textStrokeColor = this.config.text_stroke_color || '#000000';
    const gridColor = this.config.grid_color || '#ffffff';
    const gridLineOp = this.config.grid_line_opacity !== undefined ? this.config.grid_line_opacity : 0.1;
    const chartRadiusVal = parseFloat(this.config.chart_radius) || 65;
    
    const rotationDeg = parseFloat(this.config.rotation) || 0;
    const rotationRad = (rotationDeg * Math.PI) / 180;
    const tilt = parseFloat(this.config.tilt) || 0.4;
    const gOp1 = this.config.grid_opacity_1 !== undefined ? parseFloat(this.config.grid_opacity_1) : 0.02;
    const gOp2 = this.config.grid_opacity_2 !== undefined ? parseFloat(this.config.grid_opacity_2) : 0.05;

    const entities = (this.config.entities || []).map(ent => {
      return typeof ent === 'string' ? { entity: ent, max: 100 } : ent;
    }).filter(ent => ent.entity);
    const dataValues = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });
    const indicators = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return { 
        name: (ent.name || state?.attributes?.friendly_name || ent.entity.split('.')[1]).toUpperCase(), 
        max: ent.max || 100 
      };
    });

    if (is3D) {
      const count = dataValues.length;
      const w = this.chart.getWidth(), h = this.chart.getHeight();
      const cx = w / 2, cy = h / 2 + 20;
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.6;

      const getP = (val, i, offset = 0) => {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + offset + rotationRad;
        const percent = val / (indicators[i].max || 100);
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * tilt); 
        return { bx, by, x: bx, y: by - (percent * (radius * 0.8)), val: val };
      };

      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true, trigger: 'item', enterable: false, confine: true, extraCssText: 'pointer-events: none;',
          backgroundColor: 'rgba(0, 0, 0, 0.85)', borderColor: mainColor, borderWidth: 1,
          textStyle: { color: '#fff', fontSize: 12 },
          formatter: (params) => {
            let html = `<div style="padding: 5px; min-width: 120px;">`;
            indicators.forEach((ind, idx) => {
              html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span style="color:#94a3b8; margin-right:15px;">${ind.name}</span>
                  <b style="color:${mainColor}">${dataValues[idx]}</b>
                </div>`;
            });
            return html + `</div>`;
          }
        },
        xAxis: { show: false, min: 0, max: w }, yAxis: { show: false, min: 0, max: h },
        radar: { show: false },
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const gridGroup = [], faceGroup = [], lineGroup = [], textGroup = [];
            const pts = dataValues.map((v, i) => getP(v, i));
            const opVar = parseFloat(this.config.opacity_variation) || 0.02;

            const gridSteps = 5;
            for (let s = gridSteps; s >= 1; s--) {
              const stepR = radius * (s / gridSteps);
              const stepPoints = [];
              for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
                const gx = cx + Math.cos(angle) * stepR;
                const gy = cy + Math.sin(angle) * stepR * tilt;
                stepPoints.push([gx, gy]);
                if (s === gridSteps) {
                  gridGroup.push({ type: 'line', shape: { x1: cx, y1: cy, x2: gx, y2: gy }, style: { stroke: gridColor, opacity: gridLineOp, lineWidth: 1 } });
                }
              }
              gridGroup.push({ type: 'polygon', shape: { points: stepPoints }, style: { fill: this._hexToRgba(gridColor, s % 2 === 0 ? gOp2 : gOp1), stroke: gridColor, opacity: gridLineOp, lineWidth: 1 } });
            }

            for (let i = 0; i < count; i++) {
              const p1 = pts[i], p2 = pts[(i + 1) % count];
              const pMid = { x: (p1.bx + p2.bx) / 2, y: (p1.by + p2.by) / 2 };

              // 【修正】垂直虛線：僅在 lineWidth > 0 時繪製，增加層次感
              if (p1.val > 0 && lineWidth > 0) {
                lineGroup.push({
                  type: 'line', z: 5, shape: { x1: p1.bx, y1: p1.by, x2: p1.x, y2: p1.y },
                  style: { stroke: mainColor, fill: 'none', lineDash: [2, 3], lineWidth: 1, opacity: 0.3 }
                });
              }

              const opLeft = Math.min(1, Math.max(0, areaOpacity + opVar));
              const opRight = Math.min(1, Math.max(0, areaOpacity - opVar));
              if (opVar < 0.001) {
                faceGroup.push({ type: 'polygon', shape: { points: [[cx, cy], [p1.x, p1.y], [p2.x, p2.y]] }, style: { fill: this._hexToRgba(mainColor, areaOpacity), lineWidth: 0 } });
              } else {
                faceGroup.push({ type: 'polygon', shape: { points: [[cx, cy], [p1.x, p1.y], [pMid.x, pMid.y]] }, style: { fill: this._hexToRgba(mainColor, opLeft), lineWidth: 0 } });
                faceGroup.push({ type: 'polygon', shape: { points: [[cx, cy], [pMid.x, pMid.y], [p2.x, p2.y]] }, style: { fill: this._hexToRgba(mainColor, opRight), lineWidth: 0 } });
              }

              // 【修正】3D 稜線：僅在 lineWidth > 0 時繪製
              if (lineWidth > 0) {
                lineGroup.push({
                  type: 'polyline', z: 6, shape: { points: [[p1.x, p1.y], [pMid.x, pMid.y], [p2.x, p2.y]] },
                  style: { stroke: mainColor, fill: 'none', lineWidth: lineWidth, opacity: 0.9, lineJoin: 'round', lineCap: 'round', miterLimit: 2 }
                });
              }

              textGroup.push({
                type: 'text', z: 10,
                style: {
                  text: indicators[i].name, x: p1.x, y: p1.y - (textSize + 5), 
                  fill: textColor, font: `${textSize}px sans-serif`,
                  textAlign: 'center', textVerticalAlign: 'bottom', stroke: textStrokeColor, lineWidth: textStrokeWidth
                }
              });
            }
            return { type: 'group', children: [...gridGroup, ...faceGroup, ...lineGroup, ...textGroup] };
          },
          data: [0]
        }]
      }, true);
    } else {
      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true, trigger: 'item', backgroundColor: 'rgba(0, 0, 0, 0.8)', borderColor: mainColor, textStyle: { color: '#fff' }
        },
        xAxis: { show: false }, yAxis: { show: false },
        radar: {
          indicator: indicators, startAngle: 90 + rotationDeg, shape: 'polygon', radius: `${chartRadiusVal}%`, center: ['50%', '50%'],
          axisName: { fontSize: textSize, fontWeight: '500', color: textColor, stroke: textStrokeColor, lineWidth: textStrokeWidth },
          splitLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp) } },
          splitArea: { show: true, areaStyle: { color: [this._hexToRgba(gridColor, gOp2), this._hexToRgba(gridColor, gOp1)].reverse() } }
        },
        series: [{
          type: 'radar',
          data: [{
            value: dataValues, symbol: 'none',
            // 【修正】2D 稜線：寬度為 0 時設為 0，且關閉發光效果
            lineStyle: { 
              color: mainColor, 
              width: lineWidth, 
              join: 'round', 
              shadowBlur: lineWidth > 0 ? 10 : 0, 
              shadowColor: this._hexToRgba(mainColor, 0.3) 
            },
            areaStyle: { color: this._hexToRgba(mainColor, areaOpacity) }
          }]
        }]
      }, true);
    }
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