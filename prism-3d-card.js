import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

const CARD_VERSION = "v1.5.2"; 

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
      { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } },
      { name: "chart_radius", selector: { number: { min: 10, max: 100, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
              { name: "entities", selector: { entity: { multiple: true } } },
              {
        type: "expandable", title: "視覺與配色",
        schema: [
          { name: "color", selector: { text: {} } },
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
                type: "expandable", title: "視角與角度",
                schema: [
                  { name: "rotation", selector: { number: { min: 0, max: 360, step: 1, unitOfMeasurement: "°", mode: "slider" } } },
                  { name: "tilt", selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } },
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
      
      this.chart.on('mouseover', (params) => {
  // 只有當 index 真的改變時才觸發重繪，減少不必要的渲染負擔
  if (params.dataIndex !== undefined && this._hoverIndex !== params.dataIndex) {
    this._hoverIndex = params.dataIndex;
    this._updateData();
  }
});

      this.chart.on('mouseout', () => {
        this._hoverIndex = -1;
        this._updateData();
      });

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

    const getP = (val, i, cx, cy, radius, rotationRad, tilt, indicators) => {
        const count = indicators.length;
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
        const percent = val / (indicators[i].max || 100);
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * tilt); 
        return { bx, by, x: bx, y: by - (percent * (radius * 0.8)), val: val };
    };

    if (is3D) {
      const count = dataValues.length;
      const w = this.chart.getWidth(), h = this.chart.getHeight();
      const cx = w / 2, cy = h / 2 + 20;
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.6;

      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true,
          trigger: 'item',
          enterable: false,
          confine: true,
          transitionDuration: 0,
          // --- 修正 1：位置偏移 ---
          // 讓 Tooltip 跟隨滑鼠，但保持 20px 的安全距離，避免重疊引發閃爍
          position: function (pos, params, dom, rect, size) {
            return [pos[0] + 20, pos[1] + 20];
          },
          // --- 修正 2：CSS 強制穿透 ---
          extraCssText: 'pointer-events: none !important; z-index: 9999; border:none; box-shadow:none;',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          borderColor: mainColor,
          borderWidth: 1,
          textStyle: { color: '#fff', fontSize: 12 },
          formatter: (params) => {
            // 只顯示單一實體的數值，增加易讀性並減少計算負擔
            const i = params.dataIndex;
            if (i === undefined) return '';
            return `<div style="padding: 5px;">
                <span style="color:#94a3b8; margin-right:15px;">${indicators[i].name}</span>
                <b style="color:${mainColor}">${dataValues[i]}</b>
              </div>`;
          }
        },
        xAxis: { show: false, min: 0, max: w }, yAxis: { show: false, min: 0, max: h },
        radar: { show: false },
        series: [
          {
            type: 'custom',
            renderItem: (params, api) => {
              const i = params.dataIndex;
              const pts = dataValues.map((v, idx) => getP(v, idx, cx, cy, radius, rotationRad, tilt, indicators));
              const gridGroup = [], faceGroup = [], lineGroup = [];

              if (i === 0) {
                const gridSteps = 5;
                for (let s = gridSteps; s >= 1; s--) {
                  const stepR = radius * (s / gridSteps);
                  const stepPoints = [];
                  for (let j = 0; j < count; j++) {
                    const angle = (Math.PI * 2 / count) * j - Math.PI / 2 + rotationRad;
                    const gx = cx + Math.cos(angle) * stepR;
                    const gy = cy + Math.sin(angle) * stepR * tilt;
                    stepPoints.push([gx, gy]);
                    if (s === gridSteps) {
                      gridGroup.push({ type: 'line', shape: { x1: cx, y1: cy, x2: gx, y2: gy }, style: { stroke: gridColor, opacity: gridLineOp, lineWidth: 1 } });
                    }
                  }
                  gridGroup.push({ type: 'polygon', z: 1, shape: { points: stepPoints }, style: { fill: this._hexToRgba(gridColor, s % 2 === 0 ? gOp2 : gOp1), stroke: gridColor, opacity: gridLineOp, lineWidth: 1 } });
                }
              }

              const pCurr = pts[i], pPrev = pts[(i - 1 + count) % count], pNext = pts[(i + 1) % count];
              const mLeft = { x: (pPrev.bx + pCurr.bx) / 2, y: (pPrev.by + pCurr.by) / 2 };
              const mRight = { x: (pCurr.bx + pNext.bx) / 2, y: (pCurr.by + pNext.by) / 2 };
              
              const isHovered = (i === this._hoverIndex);
              const highlightBonus = isHovered ? 0.3 : 0;
              const opVar = parseFloat(this.config.opacity_variation) || 0.02;

              const opHigh = Math.min(1, Math.max(0, areaOpacity + opVar + highlightBonus));
              const opLow = Math.min(1, Math.max(0, areaOpacity - opVar + highlightBonus));

              faceGroup.push({
                type: 'polygon', z: 2,
                shape: { points: [[cx, cy], [mLeft.x, mLeft.y], [pCurr.x, pCurr.y]] },
                style: { fill: this._hexToRgba(mainColor, opHigh), lineWidth: 0 }
              });
              faceGroup.push({
                type: 'polygon', z: 2,
                shape: { points: [[cx, cy], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] },
                style: { fill: this._hexToRgba(mainColor, opLow), lineWidth: 0 }
              });

              if (lineWidth > 0) {
                lineGroup.push({
                  type: 'polyline', z: 3, shape: { points: [[mLeft.x, mLeft.y], [pCurr.x, pCurr.y], [mRight.x, mRight.y]] },
                  style: { stroke: mainColor, fill: 'none', lineWidth: lineWidth, opacity: 1, lineJoin: 'round', lineCap: 'round', miterLimit: 2 }
                });
                lineGroup.push({
                  type: 'line', z: 1, shape: { x1: pCurr.bx, y1: pCurr.by, x2: pCurr.x, y2: pCurr.y },
                  style: { stroke: mainColor, lineDash: [2, 3], lineWidth: 1, opacity: isHovered ? 0.8 : 0.3 }
                });
              }


              return { type: 'group', children: [...gridGroup, ...faceGroup, ...lineGroup] };
            },
            data: dataValues.map((v) => v)
          },
          {
            type: 'custom',
            z: 10,
            renderItem: (params, api) => {
              const i = params.dataIndex;
              const pts = dataValues.map((v, idx) => getP(v, idx, cx, cy, radius, rotationRad, tilt, indicators));
              const pCurr = pts[i];
              const isHovered = (i === this._hoverIndex);
              return {
                type: 'text', z: 10,
                style: {
                  text: indicators[i].name, x: pCurr.x, y: pCurr.y - (textSize + 5), 
                  fill: isHovered ? '#fff' : textColor, font: `${isHovered ? 'bold ' : ''}${textSize}px sans-serif`,
                  textAlign: 'center', textVerticalAlign: 'bottom', stroke: textStrokeColor, lineWidth: textStrokeWidth
                }
              };
            },
            data: dataValues.map((v) => v)
          }
        ]
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
            lineStyle: { color: mainColor, width: lineWidth, join: 'round', shadowBlur: lineWidth > 0 ? 10 : 0, shadowColor: this._hexToRgba(mainColor, 0.3) },
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