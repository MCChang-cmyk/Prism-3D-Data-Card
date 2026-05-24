import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

console.info("%c PRISM-3D-CARD %c v1.0.0 (dist) ", "color: white; background: #E13460; font-weight: 700;", "color: #E13460; background: white; font-weight: 700;");

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
      // --- 基礎設定直接擺在最外面 ---
      { name: "color", label: "圖表主色", selector: { text: {} } },
      { 
        name: "mode", 
        label: "顯示模式", 
        selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } 
      },
      { name: "entities", label: "選擇實體 (Entities)", selector: { entity: { multiple: true } } },

      // --- 其餘項目保持在折疊面板內 ---
      {
        type: "expandable", title: "視角與角度",
        schema: [
          { 
            name: "rotation", 
            label: "旋轉角度", 
            selector: { number: { min: 0, max: 360, step: 1, unitOfMeasurement: "°", mode: "slider" } } 
          },
          { 
            name: "tilt", 
            label: "傾斜視角 (俯視度)", 
            selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } 
          },
        ],
      },
      {
        type: "expandable", title: "視覺精修",
        schema: [
          { name: "line_width", label: "稜線寬度", selector: { number: { min: 1, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", label: "區域總透明度", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          { name: "text_size", label: "文字字體大小", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } },
          { name: "opacity_variation", label: "3D 明暗差異值", selector: { number: { min: 0, max: 0.2, step: 0.01, mode: "slider" } } },
        ]
      },
      {
        type: "expandable", title: "背景網格",
        schema: [
          { name: "grid_color", label: "網格顏色", selector: { text: {} } },
          { name: "grid_line_opacity", label: "網格線透明度", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
          { name: "chart_radius", label: "圖表縮放比例", selector: { number: { min: 10, max: 100, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
          { name: "grid_opacity_1", label: "背景斑馬紋 - 淺色層", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } },
          { name: "grid_opacity_2", label: "背景斑馬紋 - 深色層", selector: { number: { min: 0, max: 0.2, step: 0.005, mode: "slider" } } },
        ]
      }
    ];
  }

  _valueChanged(ev) {
    if (!ev.detail.value) return;
    const nextConfig = { ...ev.detail.value };
    
    if (nextConfig.entities) {
      // 確保存入 config 的永遠是物件陣列格式
      nextConfig.entities = nextConfig.entities.map(ent => {
        if (typeof ent === 'string') {
          // 檢查舊配置中是否已經有這個實體的自訂名稱或 max，有就保留
          const oldEnt = (this._config.entities || []).find(e => (typeof e === 'object' ? e.entity : e) === ent);
          return typeof oldEnt === 'object' ? oldEnt : { entity: ent, name: "", max: 100 };
        }
        return ent;
      });
    }

    this.dispatchEvent(new CustomEvent("config-changed", { 
      detail: { config: nextConfig }, 
      bubbles: true, 
      composed: true 
    }));
  }

  render() {
    // 建立一個臨時配置用於編輯器顯示
    const displayConfig = { ...this._config };
    
    // 如果 entities 是物件陣列 [{entity: '...'}], 轉回字串陣列 ['...']
    if (displayConfig.entities) {
      displayConfig.entities = displayConfig.entities.map(ent => 
        typeof ent === 'object' ? ent.entity : ent
      );
    }

    const formData = { 
      card_height: 350, 
      line_width: 2, 
      area_opacity: 0.4, 
      rotation: 0, 
      opacity_variation: 0.02, 
      tilt: 0.4, 
      chart_radius: 65,
      grid_opacity_1: 0.02,
      grid_opacity_2: 0.05,
      ...displayConfig // 使用處理過的顯示配置
    };
    
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

    // --- 2. 數據預處理 (防呆版) ---
    const entities = (this.config.entities || []).map(ent => {
      // 確保無論儲存格式如何，都能拿到 entity ID
      const entityId = typeof ent === 'string' ? ent : ent.entity;
      return typeof ent === 'string' ? { entity: ent, max: 100 } : ent;
    }).filter(ent => ent.entity); // 確保 entity 欄位存在
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
      const cx = w / 2;
      const cy = h / 2 + 20;

      // 調整 3D 半徑係數，讓 HA 顯示較大
      const radius = (chartRadiusVal / 100) * Math.min(w, h) * 0.6;

      const getP = (val, i, offset = 0) => {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + offset + rotationRad;
        const percent = val / (indicators[i].max || 100);
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + (Math.sin(angle) * radius * tilt); 
        // 高度隨半徑縮放，避免比例失調
        return { bx, by, x: bx, y: by - (percent * (radius * 0.8)), val: val };
      };

      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true,
          trigger: 'item',
          // --- 解決閃爍的關鍵配置 ---
          enterable: false,      // 滑鼠不能進入 Tooltip 浮層
          confine: true,         // 將 Tooltip 限制在畫布範圍內，避免超出卡片
          extraCssText: 'pointer-events: none;', // 強制 CSS 穿透，滑鼠點不到浮層
          
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          borderColor: mainColor,
          borderWidth: 1,
          textStyle: { color: '#fff', fontSize: 12 },
          
          formatter: (params) => {
            let html = `<div style="padding: 5px; min-width: 120px;">`;
            indicators.forEach((ind, idx) => {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span style="color:#94a3b8; margin-right:15px;">${ind.name}</span>
                  <b style="color:${mainColor}">${dataValues[idx]}</b>
                </div>`;
            });
            html += `</div>`;
            return html;
          }
        },
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

            const gridSteps = 5;
            const gOp1 = this.config.grid_opacity_1 !== undefined ? this.config.grid_opacity_1 : 0.02;
            const gOp2 = this.config.grid_opacity_2 !== undefined ? this.config.grid_opacity_2 : 0.05;

            for (let s = gridSteps; s >= 1; s--) { // 從外往內畫，確保色塊層級正確
              const stepR = radius * (s / gridSteps);
              const stepPoints = [];
              for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
                const gx = cx + Math.cos(angle) * stepR;
                const gy = cy + Math.sin(angle) * stepR * tilt;
                stepPoints.push([gx, gy]);
                
                // 放射軸線：僅在最外圈時繪製一次
                if (s === gridSteps) {
                  gridGroup.push({
                    type: 'line',
                    shape: { x1: cx, y1: cy, x2: gx, y2: gy },
                    style: { stroke: gridColor, opacity: gridLineOp, lineWidth: 1 }
                  });
                }
              }

              // 繪製斑馬紋色票 (階梯填色)
              gridGroup.push({
                type: 'polygon',
                shape: { points: stepPoints },
                style: { 
                  // 根據圈數 s 奇偶切換透明度
                  fill: this._hexToRgba(gridColor, s % 2 === 0 ? gOp2 : gOp1),
                  stroke: gridColor, 
                  opacity: gridLineOp, 
                  lineWidth: 1 
                }
              });
            }

            for (let i = 0; i < count; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % count];
              const pMid = { x: (p1.bx + p2.bx) / 2, y: (p1.by + p2.by) / 2 };

              if (p1.val > 0) {
                lineGroup.push({
                  type: 'line', z: 5,
                  shape: { x1: p1.bx, y1: p1.by, x2: p1.x, y2: p1.y },
                  style: { stroke: mainColor, fill: 'none', lineDash: [2, 3], lineWidth: 1, opacity: 0.5 }
                });
              }

              const opLeft = Math.min(1, Math.max(0, areaOpacity + opVar));
              const opRight = Math.min(1, Math.max(0, areaOpacity - opVar));

              if (opVar < 0.001) {
                faceGroup.push({ 
                  type: 'polygon', 
                  shape: { points: [[cx, cy], [p1.x, p1.y], [p2.x, p2.y]] }, 
                  style: { fill: this._hexToRgba(mainColor, areaOpacity), lineWidth: 0 } 
                });
              } else {
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

              // 3. 純稜線 (修正尖角問題)
              lineGroup.push({
                type: 'polyline',
                z: 6,
                shape: { points: [[p1.x, p1.y], [pMid.x, pMid.y], [p2.x, p2.y]] },
                style: {
                  stroke: mainColor,
                  fill: 'none',
                  lineWidth: lineWidth,
                  opacity: 0.9,
                  // --- 核心修正處 ---
                  lineJoin: 'round', // 讓轉角變圓滑，徹底消除突出尖角
                  lineCap: 'round',  // 讓線條末端也變圓滑
                  miterLimit: 2      // 即使是斜接也限制其伸長
                }
              });

              const angle = (Math.PI * 2 / count) * i - Math.PI / 2 + rotationRad;
              textGroup.push({
                type: 'text', z: 10,
                style: {
                  text: indicators[i].name,
                  x: p1.x, 
                  y: p1.y - (textSize + 5), 
                  fill: '#94a3b8', font: `${textSize}px sans-serif`,
                  textAlign: 'center', textVerticalAlign: 'bottom',
                  stroke: '#000', lineWidth: 2
                }
              });
            }

            return { type: 'group', children: [...gridGroup, ...faceGroup, ...lineGroup, ...textGroup] };
          },
          data: [0]
        }]
      }, true);
    } else {
      // --- 2D 模式 ---
      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true,
          trigger: 'item',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(0, 0, 0, 0.7)',
          textStyle: { color: '#fff' }
        },
        xAxis: { show: false }, yAxis: { show: false },
        radar: {
          indicator: indicators,
          startAngle: 90 + rotationDeg,
          shape: 'polygon', radius: `${chartRadiusVal}%`,
          center: ['50%', '50%'],
          axisName: { fontSize: textSize, fontWeight: '500', color: '#94a3b8' },
          splitLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp) } },
          splitArea: { show: true, areaStyle: { color: [this._hexToRgba(gridColor, 0.02), this._hexToRgba(gridColor, 0.05)].reverse() } }
        },
        series: [{
          type: 'radar',
          data: [{
            value: dataValues, symbol: 'none',
            lineStyle: { color: mainColor, width: lineWidth, join: 'round', shadowBlur: 10, shadowColor: this._hexToRgba(mainColor, 0.3) },
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