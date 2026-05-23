import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

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

  _schema() {
    return [
      {
        type: "expandable", title: "基礎設定",
        schema: [
          { name: "color", selector: { text: {} } },
          { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } },
          { name: "entities", selector: { entity: { multiple: true } } },
        ]
      },
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
          { name: "line_width", selector: { number: { min: 1, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          { name: "text_size", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } },
          { name: "opacity_variation", selector: { number: { min: 0, max: 0.2, step: 0.01, mode: "slider" } } },
        ]
      },
      {
        type: "expandable", title: "背景網格",
        schema: [
          { name: "grid_color", selector: { text: {} } },
          { name: "grid_line_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
        ]
      }
    ];
  }

  _valueChanged(ev) {
    const nextConfig = { ...ev.detail.value };
    if (nextConfig.entities) {
      nextConfig.entities = nextConfig.entities.map(ent => typeof ent === 'string' ? { entity: ent, name: "", max: 100 } : ent);
    }
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: nextConfig }, bubbles: true, composed: true }));
  }

  render() {
    const formData = { card_height: 350, line_width: 2, area_opacity: 0.4, rotation: 0, opacity_variation: 0.02, tilt: 0.4, ...this._config };
    return html`<ha-form .hass=${this.hass} .data=${formData} .schema=${this._schema()} @value-changed=${this._valueChanged}></ha-form>`;
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

    // --- 1. 讀取設定 ---
    const mainColor = this.config.color || '#E13460';
    const is3D = this.config.mode === '3d';
    const lineWidth = this.config.line_width || 2;
    const areaOpacity = parseFloat(this.config.area_opacity) || 0.4;
    const textSize = this.config.text_size || 11;
    const gridColor = this.config.grid_color || '#ffffff';
    const gridLineOp = this.config.grid_line_opacity !== undefined ? this.config.grid_line_opacity : 0.1;
    const chartRadiusVal = parseFloat(this.config.chart_radius) || 65;
    const opVar = parseFloat(this.config.opacity_variation) || 0.02; // 預設差異值為 0.02
    
    const rotationDeg = parseFloat(this.config.rotation) || 0;
    const rotationRad = (rotationDeg * Math.PI) / 180;
    const tilt = parseFloat(this.config.tilt) || 0.4;

    // --- 2. 數據預處理 ---
    const entities = this.config.entities.map(ent => typeof ent === 'string' ? { entity: ent } : ent);
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
      const cx = w / 2, cy = h / 2 + 40;
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.5;

      const getP = (val, i, offset = 0) => {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + offset + rotationRad;
        const percent = val / (indicators[i].max || 100);
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * tilt); 
        return { bx, by, x: bx, y: by - (percent * 100) };
      };

      this.chart.setOption({
        backgroundColor: 'transparent',
        xAxis: { show: false, min: 0, max: w },
        yAxis: { show: false, min: 0, max: h },
        radar: { show: false },
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const children = [];
            const gridGroup = []; // 專門放網格
            const faceGroup = []; // 專門放摺紙面
            const textGroup = []; // 專門放文字
            
            const pts = dataValues.map((v, i) => getP(v, i));
            const opVar = parseFloat(this.config.opacity_variation) || 0.02;

            // --- A. 繪製 3D 地面網格 (確保包含旋轉與傾斜) ---
            const gridSteps = 5;
            for (let s = 1; s <= gridSteps; s++) {
              const stepR = radius * (s / gridSteps);
              const stepPoints = [];
              for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
                const gx = cx + Math.cos(angle) * stepR;
                const gy = cy + Math.sin(angle) * stepR * tilt;
                stepPoints.push([gx, gy]);
                
                // 放射軸線
                if (s === gridSteps) {
                  gridGroup.push({
                    type: 'line',
                    shape: { x1: cx, y1: cy, x2: gx, y2: gy },
                    style: { stroke: gridColor, opacity: gridLineOp, lineWidth: 1 }
                  });
                }
              }
              // 網格圈
              gridGroup.push({
                type: 'polygon',
                shape: { points: stepPoints },
                style: { fill: 'none', stroke: gridColor, opacity: gridLineOp, lineWidth: 1 }
              });
            }

            // --- B. 繪製摺紙主體 (帶有透明度差異值) ---
            for (let i = 0; i < count; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % count];
              const pMid = { x: (p1.bx + p2.bx) / 2, y: (p1.by + p2.by) / 2 };

              const opLeft = Math.min(1, Math.max(0, areaOpacity + opVar));
              const opRight = Math.min(1, Math.max(0, areaOpacity - opVar));

              // 左側面
              faceGroup.push({ 
                type: 'polygon', 
                shape: { points: [[cx, cy], [p1.x, p1.y], [pMid.x, pMid.y]] }, 
                style: { fill: this._hexToRgba(mainColor, opLeft), lineWidth: 0 } 
              });
              // 右側面
              faceGroup.push({ 
                type: 'polygon', 
                shape: { points: [[cx, cy], [pMid.x, pMid.y], [p2.x, p2.y]] }, 
                style: { fill: this._hexToRgba(mainColor, opRight), lineWidth: 0 } 
              });

              // 文字標籤
              const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
              textGroup.push({
                type: 'text', z: 10,
                style: {
                  text: indicators[i].name,
                  x: cx + Math.cos(angle) * (radius + 45),
                  y: cy + Math.sin(angle) * (radius * tilt + 25),
                  fill: '#94a3b8', font: `${textSize}px sans-serif`,
                  textAlign: 'center', textVerticalAlign: 'middle'
                }
              });
            }

            // --- C. 合併所有圖層：確保網格在最下層 ---
            return {
              type: 'group',
              children: [
                ...gridGroup, // 最底層
                ...faceGroup, // 中間層
                ...textGroup  // 最頂層
              ]
            };
          },
          data: [0]
        }]
      }, true);
    } else {
      // --- 【2D 模式：視覺精修回歸】 ---
      const indicators = entities.map(ent => ({
        name: (ent.name || this._hass.states[ent.entity]?.attributes?.friendly_name || ent.entity.split('.')[1]).toUpperCase(),
        max: ent.max || 100
      }));

      this.chart.setOption({
        backgroundColor: 'transparent',
        xAxis: { show: false }, 
        yAxis: { show: false },
        radar: {
          indicator: indicators,
          startAngle: 90 + rotationDeg,
          shape: 'polygon',
          radius: `${chartRadiusVal}%`,
          center: ['50%', '50%'],
          axisName: { 
            fontSize: textSize, 
            fontWeight: '500', 
            color: '#94a3b8',
            fontFamily: 'Roboto, sans-serif'
          },
          // 恢復階梯背景感
          splitLine: { 
            lineStyle: { color: this._hexToRgba(gridColor, gridLineOp), width: 1 } 
          },
          axisLine: { 
            lineStyle: { color: this._hexToRgba(gridColor, gridLineOp) } 
          },
          splitArea: {
            show: true,
            areaStyle: {
              color: [
                this._hexToRgba(gridColor, 0.02),
                this._hexToRgba(gridColor, 0.05),
                this._hexToRgba(gridColor, 0.02),
                this._hexToRgba(gridColor, 0.05),
                this._hexToRgba(gridColor, 0.02)
              ].reverse()
            }
          }
        },
        series: [{
          type: 'radar',
          data: [{
            value: dataValues,
            symbol: 'none', 
            // 精修線條：加入圓角交匯與微弱光暈
            lineStyle: { 
              color: mainColor, 
              width: lineWidth,
              join: 'round',    // 讓拐角圓滑
              cap: 'round',
              shadowBlur: 10,   // 增加發光感
              shadowColor: this._hexToRgba(mainColor, 0.3)
            },
            areaStyle: { 
              color: this._hexToRgba(mainColor, areaOpacity) 
            }
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