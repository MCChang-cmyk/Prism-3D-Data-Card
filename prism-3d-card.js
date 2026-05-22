import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

// --- 修正環境相容性 ---
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

// 1. 編輯器類別 (Editor)
class Prism3DCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: { state: true } };
  }

  setConfig(config) {
    this._config = { ...config };
  }

  _schema() {
    return [
      // 第一組：基礎設定
      {
        type: "expandable",
        title: "基礎設定",
        schema: [
          { name: "color", selector: { text: {} } },
          {
            name: "mode",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { label: "3D 立體", value: "3d" },
                  { label: "2D 平面", value: "2d" },
                ],
              },
            },
          },
          { name: "entities", selector: { entity: { multiple: true } } },
        ],
      },
      // 第二組：視覺精修
      {
        type: "expandable",
        title: "視覺精修",
        schema: [
          { name: "line_width", selector: { number: { min: 1, max: 10, step: 1, mode: "slider" } } },
          { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
          { name: "text_size", selector: { number: { min: 8, max: 24, step: 1, mode: "slider" } } },
        ],
      },
      // 第三組：背景網格
      {
        type: "expandable",
        title: "背景網格",
        schema: [
          { name: "grid_color", selector: { text: {} } },
          { name: "grid_line_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
          { name: "grid_opacity_1", selector: { number: { min: 0, max: 0.5, step: 0.01, mode: "slider" } } },
          { name: "grid_opacity_2", selector: { number: { min: 0, max: 0.5, step: 0.01, mode: "slider" } } },
        ],
      },
      // 第四組：尺寸調整
      {
        type: "expandable",
        title: "尺寸與空間",
        schema: [
          { name: "card_height", selector: { number: { min: 200, max: 800, step: 10, unitOfMeasurement: "px", mode: "box" } } },
          { name: "chart_radius", selector: { number: { min: 20, max: 95, step: 1, unitOfMeasurement: "%", mode: "slider" } } },
        ],
      },
    ];
  }

  _labelFor(name) {
    const labels = {
      color: "主色調 (Hex)",
      mode: "顯示模式",
      entities: "選擇數據實體",
      line_width: "線條粗細",
      area_opacity: "填色透明度",
      text_size: "文字大小",
      grid_color: "網格顏色 (Hex)",
      grid_line_opacity: "網格線條透明度",
      grid_opacity_1: "區塊透明度 A",
      grid_opacity_2: "區塊透明度 B",
      card_height: "卡片總高度",
      chart_radius: "圖表占比",
    };
    return labels[name] || name;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const nextConfig = { ...ev.detail.value };
    if (nextConfig.entities && Array.isArray(nextConfig.entities)) {
      nextConfig.entities = nextConfig.entities.map(ent => 
        typeof ent === 'string' ? { entity: ent, name: "", max: 100 } : ent
      );
    }
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const formData = {
      card_height: 350,
      chart_radius: 65,
      line_width: 2,
      area_opacity: 0.4,
      text_size: 11,
      grid_color: "#ffffff",
      grid_line_opacity: 0.1,
      grid_opacity_1: 0.02,
      grid_opacity_2: 0.05,
      ...this._config,
      entities: (this._config.entities || []).map(ent => typeof ent === 'string' ? ent : ent.entity)
    };

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

// 2. 主卡片類別 (Card)
class Prism3DCard extends HTMLElement {
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", color: "#E13460", card_height: 350, chart_radius: 65, entities: [] }; }

  set hass(hass) {
    this._hass = hass;
    if (!this.chart) { this._initChart(); } else { this._updateData(); }
  }

  setConfig(config) { 
    this.config = config;
    if (this._container) {
      this._container.style.height = `${this.config.card_height || 350}px`;
    }
  }

  _initChart() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    this._container = document.createElement('div');
    this._container.style.cssText = `width: 100%; height: ${this.config.card_height || 350}px; display: block;`;
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
    const chartRadius = `${this.config.chart_radius || 65}%`;
    const gOp1 = this.config.grid_opacity_1 !== undefined ? this.config.grid_opacity_1 : 0.02;
    const gOp2 = this.config.grid_opacity_2 !== undefined ? this.config.grid_opacity_2 : 0.05;

    const entities = this.config.entities.map(ent => typeof ent === 'string' ? { entity: ent } : ent);
    const dataValues = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });

    const indicators = entities.map(ent => {
      const state = this._hass.states[ent.entity];
      const friendlyName = state?.attributes?.friendly_name || ent.entity.split('.')[1];
      return { name: (ent.name || friendlyName || "數據").toUpperCase(), max: ent.max || 100 };
    });

    this.chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      radar: {
        indicator: indicators,
        shape: 'polygon',
        radius: chartRadius,
        center: ['50%', '50%'],
        axisName: { fontSize: textSize, fontWeight: '500', color: '#94a3b8' },
        // 應用：網格線條透明度
        splitLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp), width: 1 } },
        axisLine: { lineStyle: { color: this._hexToRgba(gridColor, gridLineOp) } },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              this._hexToRgba(gridColor, gOp1),
              this._hexToRgba(gridColor, gOp2),
              this._hexToRgba(gridColor, gOp1),
              this._hexToRgba(gridColor, gOp2),
              this._hexToRgba(gridColor, gOp1)
            ].reverse()
          }
        }
      },
      series: [{
        type: 'radar',
        data: [{
          value: dataValues,
          symbol: 'none', 
          itemStyle: { color: mainColor },
          lineStyle: { color: mainColor, width: lineWidth },
          areaStyle: {
            color: is3D 
              ? new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                  { offset: 0, color: 'rgba(0,0,0,0)' },
                  { offset: 1, color: this._hexToRgba(mainColor, Math.min(1, areaOpacity + 0.2)) }
                ])
              : this._hexToRgba(mainColor, areaOpacity)
          }
        }]
      }]
    });
  }

  _hexToRgba(hex, opacity) {
    const cleanHex = (hex || '#ffffff').replace('#', '');
    let r, g, b;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}

customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);