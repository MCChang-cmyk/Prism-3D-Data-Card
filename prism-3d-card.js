import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

// --- 1. 編輯器類別 (GUI Editor) ---
class Prism3DCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (this._rendered) return;
    // 建立編輯器 UI 結構
    this.innerHTML = `
      <div id="editor-container" style="display: flex; flex-direction: column; gap: 16px; color: var(--primary-text-color);">
        <div class="config-item">
          <label style="display: block; margin-bottom: 8px;">主色調 (#E13460)</label>
          <input type="color" id="color-picker" value="${this._config.color || '#E13460'}" style="width: 100%; height: 40px; border: none; cursor: pointer;">
        </div>
        
        <div class="config-item">
          <label style="display: block; margin-bottom: 8px;">顯示模式</label>
          <select id="mode-select" style="width: 100%; padding: 8px; background: var(--card-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color);">
            <option value="3d" ${this._config.mode !== '2d' ? 'selected' : ''}>3D 立體</option>
            <option value="2d" ${this._config.mode === '2d' ? 'selected' : ''}>2D 平面</option>
          </select>
        </div>

        <div class="config-item">
          <label style="display: block; margin-bottom: 8px;">實體清單 (請在 YAML 中暫時修改，GUI 整合中...)</label>
          <p style="font-size: 12px; opacity: 0.6;">目前 GUI 實體選擇器在某些 HA 版本需配合特殊 API，建議先用 YAML 修改 entities。</p>
        </div>
      </div>
    `;

    // 監聽事件
    this.querySelector('#color-picker').addEventListener('input', (ev) => this._updateConfig('color', ev.target.value));
    this.querySelector('#mode-select').addEventListener('change', (ev) => this._updateConfig('mode', ev.target.value));
    
    this._rendered = true;
  }

  _updateConfig(prop, value) {
    const event = new CustomEvent("config-changed", {
      detail: { config: { ...this._config, [prop]: value } },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

// --- 2. 主卡片類別 (Main Card) ---
class Prism3DCard extends HTMLElement {
  // 讓 HA 知道編輯器是誰
  static getConfigElement() {
    return document.createElement("prism-3d-card-editor");
  }

  // 設定預設值
  static getStubConfig() {
    return {
      mode: "3d",
      color: "#E13460",
      radius: "65%",
      entities: [
        { entity: "sun.sun", name: "範例數據", max: 100 }
      ]
    };
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
    if (this.shadowRoot && this.shadowRoot.querySelector('div')) return;
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    container.style.display = 'block';
    root.appendChild(container);

    setTimeout(() => {
      if (container) {
        this.chart = echarts.init(container);
        this._updateData();
      }
    }, 0);
    window.addEventListener('resize', () => this.chart && this.chart.resize());
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;

    const dataValues = this.config.entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });

    const indicators = this.config.entities.map(ent => ({
      name: (ent.name || ent.entity).toUpperCase(),
      max: ent.max || 100
    }));

    const is3D = this.config.mode !== '2d';
    const mainColor = this.config.color || '#E13460';

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      radar: {
        indicator: indicators,
        shape: 'polygon',
        radius: this.config.radius || '65%',
        center: ['50%', '50%'],
        axisName: { fontSize: 12, fontWeight: 'bold', color: '#cbd5e1' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: dataValues,
          symbol: is3D ? 'circle' : 'none',
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
    };

    this.chart.setOption(option);
  }

  _hexToRgba(hex, opacity) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  getCardSize() { return 4; }
}

// --- 3. 註冊組件 (按順序定義) ---
customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);

// 讓 HA 識別這是自定義卡片
window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-3d-card",
  name: "Prism 3D Data Card",
  preview: true,
  description: "A futuristic 3D radar chart card."
});