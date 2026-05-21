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
    if (!this._config || !this._hass) return;

    const mainColor = this._config.color || '#E13460';
    const is3D = this._config.mode !== '2d';

    this.innerHTML = `
      <div class="card-config" style="padding: 10px;">
        
        <ha-textfield
          label="主色調 (Hex Code)"
          .value="${mainColor}"
          .configValue="${"color"}"
          @input="${this._valueChanged}"
          style="display: block; margin-bottom: 20px; width: 100%;"
        ></ha-textfield>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <span style="font-size: 16px;">啟動 3D 體積感</span>
          <ha-switch
            .checked="${is3D}"
            .configValue="${"mode"}"
            @change="${this._switchChanged}"
          ></ha-switch>
        </div>

        <div style="border-top: 1px solid var(--divider-color); padding-top: 20px;">
          <p style="font-weight: 500; margin-bottom: 10px;">實體配置 (Entities)</p>
          
          <div id="entities">
            ${(this._config.entities || []).map((ent, idx) => `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <ha-entity-picker
                  label="選擇實體"
                  .hass="${this._hass}"
                  .value="${ent.entity}"
                  .index="${idx}"
                  @value-changed="${this._entityChanged}"
                  style="flex-grow: 1;"
                ></ha-entity-picker>
                
                <ha-icon-button
                  .index="${idx}"
                  @click="${this._removeEntity}"
                  style="color: var(--error-color);"
                >
                  <ha-icon icon="mdi:close"></ha-icon>
                </ha-icon-button>
              </div>
            `).join('')}
          </div>

          <mwc-button 
            @click="${this._addEntity}" 
            style="width: 100%; --mdc-theme-primary: var(--primary-color);"
          >
            <ha-icon icon="mdi:plus" style="margin-right: 8px;"></ha-icon>
            新增實體
          </mwc-button>
        </div>
      </div>
    `;
  }

  // 需要補上這些原生事件處理方法
  _valueChanged(ev) {
    const value = ev.target.value;
    this._updateConfig('color', value);
  }

  _switchChanged(ev) {
    this._updateConfig('mode', ev.target.checked ? '3d' : '2d');
  }

  _entityChanged(ev) {
    const idx = ev.target.index;
    const newEnts = [...this._config.entities];
    newEnts[idx] = { ...newEnts[idx], entity: ev.detail.value };
    this._updateConfig('entities', newEnts);
  }

  _addEntity() {
    const newEnts = [...(this._config.entities || []), { entity: '', name: '', max: 100 }];
    this._updateConfig('entities', newEnts);
  }

  _removeEntity(ev) {
    const idx = ev.currentTarget.index;
    const newEnts = this._config.entities.filter((_, i) => i !== idx);
    this._updateConfig('entities', newEnts);
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
  static getConfigElement() {
    return document.createElement("prism-3d-card-editor");
  }

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

// --- 3. 註冊組件 ---
customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-3d-card",
  name: "Prism 3D Data Card",
  preview: true,
  description: "A futuristic 3D radar chart card."
});