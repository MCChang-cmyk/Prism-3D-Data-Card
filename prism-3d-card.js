import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

// 取得 Home Assistant 內建的 LitElement 基底
const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;

// ------------------------------ 編輯器部分 ------------------------------
class Prism3DCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: {} };
  }

  setConfig(config) {
    this._config = config;
  }

  // 定義 GUI 的表單結構 (Schema)
  _schema() {
    return [
      { name: "color", selector: { text: {} } }, // 主色調輸入
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
      {
        name: "entities",
        selector: {
          template: {
            // 這會生成一個可增減的實體清單，且每個實體包含 entity, name, max
            schema: [
              { name: "entity", selector: { entity: {} } },
              { name: "name", selector: { text: {} } },
              { name: "max", selector: { number: { mode: "box" } } },
            ],
          },
        },
      },
    ];
  }

  // 定義標籤顯示文字
  _labelFor(name) {
    const labels = {
      color: "主色調 (Hex Code)",
      mode: "顯示模式",
      entities: "數據實體配置",
      entity: "實體 (Entity)",
      name: "顯示名稱 (Name)",
      max: "數值上限 (Max Value)",
    };
    return labels[name] || name;
  }

  _valueChanged(ev) {
    const config = ev.detail.value;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._schema()}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

// ------------------------------ 卡片主體部分 ------------------------------
class Prism3DCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("prism-3d-card-editor");
  }

  static getStubConfig() {
    return { mode: "3d", color: "#E13460", entities: [] };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.chart) {
      this._initChart();
    } else {
      this._updateData();
    }
  }

  setConfig(config) {
    this.config = config;
  }

  _initChart() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; height: 350px; display: block;";
    root.appendChild(container);

    setTimeout(() => {
      this.chart = echarts.init(container);
      this._updateData();
      // 使用 ResizeObserver 確保圖表在編輯時不會縮小
      new ResizeObserver(() => this.chart.resize()).observe(container);
    }, 100);
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;

    const dataValues = this.config.entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });

    const indicators = this.config.entities.map(ent => ({
      name: (ent.name || ent.entity.split('.')[1] || "數據").toUpperCase(),
      max: ent.max || 100
    }));

    const is3D = this.config.mode !== '2d';
    const mainColor = this.config.color || '#E13460';

    this.chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      radar: {
        indicator: indicators,
        shape: 'polygon',
        radius: '65%',
        center: ['50%', '50%'],
        axisName: { fontSize: 10, fontWeight: 'bold', color: '#cbd5e1' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: dataValues,
          symbol: is3D ? 'circle' : 'none',
          symbolSize: 6,
          itemStyle: { color: mainColor },
          lineStyle: { color: mainColor, width: is3D ? 3 : 1 },
          areaStyle: {
            color: is3D 
              ? new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                  { offset: 0, color: 'rgba(0,0,0,0)' },
                  { offset: 1, color: this._hexToRgba(mainColor, 0.6) }
                ])
              : this._hexToRgba(mainColor, 0.3)
          }
        }]
      }]
    });
  }

  _hexToRgba(hex, opacity) {
    let r = 0, g = 0, b = 0;
    const cleanHex = hex.replace('#', '');
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

  getCardSize() { return 4; }
}

// 註冊
customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-3d-card",
  name: "Prism 3D Data Card",
  preview: true,
  description: "A futuristic 3D radar chart card using HA-Form editor."
});