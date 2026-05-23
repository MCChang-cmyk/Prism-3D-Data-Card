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
        // 【核心修正】：將 val 傳回，供垂直虛線判斷
        return { bx, by, x: bx, y: by - (percent * 100), val: val };
      };

      this.chart.setOption({
        backgroundColor: 'transparent',
        xAxis: { show: false, min: 0, max: w },
        yAxis: { show: false, min: 0, max: h },
        radar: { show: false },
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const gridGroup = [];
            const faceGroup = [];
            const lineGroup = [];
            const textGroup = [];
            
            const pts = dataValues.map((v, i) => getP(v, i));
            const opVar = parseFloat(this.config.opacity_variation) || 0.02;

            // --- A. 地面網格與軸線 ---
            const gridSteps = 5;
            for (let s = 1; s <= gridSteps; s++) {
              const stepR = radius * (s / gridSteps);
              const stepPoints = [];
              for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
                const gx = cx + Math.cos(angle) * stepR;
                const gy = cy + Math.sin(angle) * stepR * tilt;
                stepPoints.push([gx, gy]);
                if (s === gridSteps) {
                  gridGroup.push({ type: 'line', shape: { x1: cx, y1: cy, x2: gx, y2: gy }, style: { stroke: gridColor, opacity: gridLineOp } });
                }
              }
              gridGroup.push({ type: 'polygon', shape: { points: stepPoints }, style: { fill: 'none', stroke: gridColor, opacity: gridLineOp } });
            }

            // --- B. 摺紙主體與垂直虛線 ---
            for (let i = 0; i < count; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % count];
              
              const pMid = { 
                x: (p1.bx + p2.bx) / 2, 
                y: (p1.by + p2.by) / 2 
              };

              // 1. 垂直定位虛線 - 現在 p1.val 抓得到了
              if (p1.val > 0) {
                lineGroup.push({
                  type: 'line',
                  z: 5,
                  shape: { x1: p1.bx, y1: p1.by, x2: p1.x, y2: p1.y },
                  style: { 
                    stroke: mainColor, 
                    fill: 'none', 
                    lineDash: [2, 3], 
                    lineWidth: 1, 
                    opacity: 0.5 
                  }
                });
              }

              // 2. 摺紙色塊 (加入純平優化)
              const opLeft = Math.min(1, Math.max(0, areaOpacity + opVar));
              const opRight = Math.min(1, Math.max(0, areaOpacity - opVar));

              if (opVar < 0.001) {
                // 如果差異值接近 0，直接畫一個大三角形 (p1 -> 中心 -> p2)
                // 這樣就不會有中間那一條重疊產生的深色線
                faceGroup.push({ 
                  type: 'polygon', 
                  shape: { points: [[cx, cy], [p1.x, p1.y], [p2.x, p2.y]] }, 
                  style: { fill: this._hexToRgba(mainColor, areaOpacity), lineWidth: 0 } 
                });
              } else {
                // 原有的摺紙邏輯 (左右分開畫，產生明暗差)
                faceGroup.push({ 
                  type: 'polygon', 
                  shape: { points: [[cx, cy], [p1.x, p1.y], [pMid.x, pMid.y]] }, 
                  style: { fill: this._hexToRgba(mainColor, opLeft), lineWidth: 0 } 
                });
                faceGroup.push({ 
                  type: 'polygon', 
                  shape: { points: [[cx, cy], [pMid.x, pMid.y], [p2.x, p2.y]] }, 
                  style: { fill: this._hexToRgba(mainColor, opRight), lineWidth: 0 } 
                });
              }

              // 3. 純稜線
              lineGroup.push({
                type: 'polyline',
                z: 6,
                shape: { points: [[p1.x, p1.y], [pMid.x, pMid.y], [p2.x, p2.y]] },
                style: {
                  stroke: mainColor,
                  fill: 'none',
                  lineWidth: lineWidth,
                  opacity: 0.9,
                  join: 'round',
                  cap: 'round'
                }
              });

              // 4. 文字標籤
              const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
              textGroup.push({
                type: 'text',
                z: 10,
                style: {
                  text: indicators[i].name,
                  // 直接使用數據點座標 (p1.x, p1.y)
                  // 並加上微小的偏移避免文字壓在線上
                  x: p1.x, 
                  y: p1.y - (textSize + 5), // 向上偏移一個字體高度
                  fill: '#94a3b8', 
                  font: `${textSize}px sans-serif`,
                  textAlign: 'center', 
                  textVerticalAlign: 'bottom', // 改為底部對齊，讓文字浮在點上方
                  // 增加一點文字陰影，確保在不同透明度色塊前都清晰
                  stroke: '#000',
                  lineWidth: 2
                }
              });
            }

            return {
              type: 'group',
              children: [...gridGroup, ...faceGroup, ...lineGroup, ...textGroup]
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