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
        type: "expandable", title: "視覺精修",
        schema: [
          { name: "line_width", selector: { number: { min: 1, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          { name: "text_size", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } },
        ]
      },
      {
        type: "expandable", title: "背景網格 (2D)",
        schema: [
          { name: "grid_color", selector: { text: {} } },
          { name: "grid_line_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
          { name: "grid_opacity_1", selector: { number: { min: 0, max: 0.5, step: 0.01, mode: "slider" } } },
          { name: "grid_opacity_2", selector: { number: { min: 0, max: 0.5, step: 0.01, mode: "slider" } } },
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
    const formData = { card_height: 350, line_width: 2, area_opacity: 0.4, ...this._config };
    return html`<ha-form .hass=${this.hass} .data=${formData} .schema=${this._schema()} @value-changed=${this._valueChanged}></ha-form>`;
  }
}

// 2. 主卡片 (Prism3DCard)
class Prism3DCard extends HTMLElement {
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", color: "#E13460", entities: [] }; }

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
      new ResizeObserver(() => this.chart.resize()).observe(this._container);
    }, 100);
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;

    // --- 1. 讀取並標準化所有設定 (確保 3D 存取得到) ---
    const mainColor = this.config.color || '#E13460';
    const is3D = this.config.mode === '3d';
    const lineWidth = this.config.line_width || 2;
    const areaOpacity = parseFloat(this.config.area_opacity) || 0.4;
    const textSize = this.config.text_size || 11;
    const gridColor = this.config.grid_color || '#ffffff';
    const gridLineOp = this.config.grid_line_opacity !== undefined ? this.config.grid_line_opacity : 0.1;
    const chartRadiusVal = parseFloat(this.config.chart_radius) || 65;
    const gOp1 = this.config.grid_opacity_1 !== undefined ? this.config.grid_opacity_1 : 0.02;
    const gOp2 = this.config.grid_opacity_2 !== undefined ? this.config.grid_opacity_2 : 0.05;

    // --- 2. 數據與指標預處理 (放在分流之外，確保全局可用) ---
    const entities = this.config.entities.map(ent => typeof ent === 'string' ? { entity: ent } : ent);
    const dataValues = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });
    const indicators = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      const friendlyName = state?.attributes?.friendly_name || ent.entity.split('.')[1];
      return { 
        name: (ent.name || friendlyName || "數據").toUpperCase(), 
        max: ent.max || 100 
      };
    });

    if (is3D) {
      // --- 【3D 模式渲染邏輯】 ---
      const count = dataValues.length;
      const w = this.chart.getWidth();
      const h = this.chart.getHeight();
      const cx = w / 2;
      const cy = h / 2 + 40;
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.5;

      // 內部座標計算函數
      const getP = (val, i, offset = 0) => {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + offset;
        const percent = val / (indicators[i].max || 100);
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * 0.4); 
        return { bx, by, x: bx, y: by - (percent * 100) };
      };

      this.chart.setOption({
        backgroundColor: 'transparent',
        xAxis: { show: false, min: 0, max: w },
        yAxis: { show: false, min: 0, max: h },
        radar: { show: false }, // 徹底關閉 2D radar 避免干擾
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const children = [];
            const faces = [];
            const gridLines = [];
            
            // --- A. 預先計算所有點位 ---
            const pts = dataValues.map((v, i) => getP(v, i));
            const midAngle = (Math.PI * 2 / count) * 0.5;
            const mids = dataValues.map((v, i) => getP(0, i, midAngle));

            // --- B. 繪製 3D 地面網格 ---
            const gridSteps = 5;
            for (let s = 1; s <= gridSteps; s++) {
              const stepR = radius * (s / gridSteps);
              const stepPoints = [];
              for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
                const gx = cx + Math.cos(angle) * stepR;
                const gy = cy + Math.sin(angle) * stepR * 0.4;
                stepPoints.push([gx, gy]);
                
                if (s === gridSteps) {
                  gridLines.push({
                    type: 'line',
                    shape: { x1: cx, y1: cy, x2: gx, y2: gy },
                    style: { stroke: gridColor, opacity: gridLineOp * 0.8, lineWidth: 1 }
                  });
                }
              }
              gridLines.push({
                type: 'polygon',
                shape: { points: stepPoints },
                style: { fill: 'none', stroke: gridColor, opacity: gridLineOp * 0.8, lineWidth: 1 }
              });
            }

            // --- C. 僅繪製摺紙主體 (移除所有線條) ---
            for (let i = 0; i < count; i++) {
              const p1 = pts[i];
              const pMid = mids[i];
              const p2 = pts[(i + 1) % count];

              // 純色三角面
              const fStyle = { 
                fill: this._hexToRgba(mainColor, areaOpacity), 
                lineWidth: 0 
              };
              
              // 山峰左側
              faces.push({ 
                type: 'polygon', 
                shape: { points: [[cx, cy], [p1.x, p1.y], [pMid.x, pMid.y]] }, 
                style: fStyle 
              });
              // 山峰右側
              faces.push({ 
                type: 'polygon', 
                shape: { points: [[cx, cy], [pMid.x, pMid.y], [p2.x, p2.y]] }, 
                style: fStyle 
              });

              // --- D. 標籤文字 (保持頂層) ---
              const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
              children.push({
                type: 'text',
                z: 10,
                style: {
                  text: indicators[i].name,
                  x: cx + Math.cos(angle) * (radius + 45),
                  y: cy + Math.sin(angle) * (radius * 0.4 + 30),
                  fill: '#94a3b8',
                  font: `${textSize}px sans-serif`,
                  textAlign: 'center', 
                  textVerticalAlign: 'middle'
                }
              });
            }

            return {
              type: 'group',
              children: [
                ...faces,     // 色塊
                ...gridLines, // 網格
                ...children   // 文字
              ]
            };
          },
          data: [0]
        }]
      }, true);
    } else {
      // --- 【2D 模式渲染邏輯】 ---
      this.chart.setOption({
        backgroundColor: 'transparent',
        xAxis: { show: false }, yAxis: { show: false },
        radar: {
          indicator: indicators,
          shape: 'polygon',
          radius: `${chartRadiusVal}%`,
          center: ['50%', '50%'],
          axisName: { fontSize: textSize, fontWeight: '500', color: '#94a3b8' },
          splitLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp), width: 1 } },
          axisLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp) } },
          splitArea: {
            show: true,
            areaStyle: {
              color: [
                this._hexToRgba(gridColor, 0.02), this._hexToRgba(gridColor, 0.05),
                this._hexToRgba(gridColor, 0.02), this._hexToRgba(gridColor, 0.05),
                this._hexToRgba(gridColor, 0.02)
              ].reverse()
            }
          }
        },
        series: [{
          type: 'radar',
          data: [{
            value: dataValues, symbol: 'none',
            lineStyle: { color: mainColor, width: lineWidth },
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