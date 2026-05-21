import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

// --- 修正環境相容性 ---
let LitElement = window.LitElement;
if (!LitElement) {
  const haPanel = customElements.get("ha-panel-lovelace");
  if (haPanel) {
    LitElement = Object.getPrototypeOf(haPanel);
  } else {
    // Live Server 環境下的後備方案
    LitElement = class extends HTMLElement {
      set hass(hass) { this._hass = hass; }
      setConfig(config) { this._config = config; }
    };
  }
}
const html = LitElement.prototype.html || ((strings, ...values) => strings[0]);

// ------------------------------------------------------------------
// 1. 編輯器類別 (Editor) - 使用 ha-form 實現原生質感
// ------------------------------------------------------------------
class Prism3DCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: { state: true } };
  }

  setConfig(config) {
    // 確保 config 始終是一個物件
    this._config = { ...config };
  }

  // 定義 GUI 的表單結構 (Schema)
  _schema() {
    return [
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
      { 
        name: "entities", 
        selector: { 
          entity: { multiple: true } 
        } 
      },
    ];
  }

  _labelFor(name) {
    const labels = {
      color: "主色調 (Hex Code)",
      mode: "顯示模式",
      entities: "選擇數據實體 (可多選)",
    };
    return labels[name] || name;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    
    // 取得選取的 ID 陣列 (例如 ["sensor.t1", "sensor.t2"])
    const selectedIds = ev.detail.value.entities || [];
    
    // 將純 ID 陣列轉回圖表需要的物件陣列格式 [{entity: '...', name: '', max: 100}]
    const newEntities = selectedIds.map(id => {
      const existing = (this._config.entities || []).find(e => 
        (typeof e === 'string' ? e : e.entity) === id
      );
      // 如果原本已有配置則保留，否則建立預設值
      return typeof existing === 'object' ? existing : { entity: id, name: "", max: 100 };
    });

    // 發送設定變更事件
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...ev.detail.value, entities: newEntities } },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.hass || !this._config) return html``;

    // 關鍵：傳給 ha-form 顯示時，必須把物件陣列轉回純 ID 字串陣列
    // 這樣 GUI 才能正確顯示已選取的標籤，不會出現 [object Object]
    const formData = {
      ...this._config,
      entities: (this._config.entities || []).map(ent => 
        typeof ent === 'string' ? ent : ent.entity
      )
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

// ------------------------------------------------------------------
// 2. 主卡片類別 (Main Card) - 負責 3D 圖表渲染
// ------------------------------------------------------------------
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
      
      // 使用 ResizeObserver 確保編輯器開關時圖表能自動校準大小
      const ro = new ResizeObserver(() => {
        if (this.chart) this.chart.resize();
      });
      ro.observe(container);
    }, 100);
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;

    // 相容性處理：確保 entities 內部統一為物件格式
    const entities = this.config.entities.map(ent => 
      typeof ent === 'string' ? { entity: ent } : ent
    );

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
    const cleanHex = (hex || '#E13460').replace('#', '');
    let r = 0, g = 0, b = 0;
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

// ------------------------------------------------------------------
// 3. 註冊組件 (Registry)
// ------------------------------------------------------------------
customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-3d-card",
  name: "Prism 3D Data Card",
  preview: true,
  description: "A professional 3D radar chart with native HA form editor."
});