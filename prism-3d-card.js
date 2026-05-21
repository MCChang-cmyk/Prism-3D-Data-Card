import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

// --- 1. 編輯器類別 (原生樣式優化版) ---
class Prism3DCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._config || !this._hass || this._rendered) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 16px; display: flex; flex-direction: column; gap: 20px;">
        
        <ha-textfield
          id="color-input"
          label="主色調 (Hex Code)"
          .value="${this._config.color || '#E13460'}"
          style="width: 100%;"
        ></ha-textfield>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 16px;">啟動 3D 體積感</span>
          <ha-switch
            id="mode-switch"
            .checked="${this._config.mode !== '2d'}"
          ></ha-switch>
        </div>

        <div style="border-top: 1px solid var(--divider-color); padding-top: 16px;">
          <p style="font-weight: 500; margin-bottom: 12px; font-size: 14px; opacity: 0.7;">實體配置 (建議 3-6 個)</p>
          <div id="entities-container"></div>
          
          <mwc-button id="add-entity-btn" style="width: 100%; margin-top: 8px;">
            <ha-icon icon="mdi:plus" style="margin-right: 8px;"></ha-icon>新增實體
          </mwc-button>
        </div>
      </div>
    `;

    // 重新繪製實體列表 (處理 Picker 數據綁定)
    this._renderEntities();

    // 綁定基礎事件
    this.querySelector('#color-input').addEventListener('input', (ev) => this._updateConfig('color', ev.target.value));
    this.querySelector('#mode-switch').addEventListener('change', (ev) => this._updateConfig('mode', ev.target.checked ? '3d' : '2d'));
    this.querySelector('#add-entity-btn').addEventListener('click', () => this._addEntity());

    this._rendered = true;
  }

  _renderEntities() {
    const container = this.querySelector('#entities-container');
    if (!container) return;
    container.innerHTML = '';

    (this._config.entities || []).forEach((ent, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.marginBottom = '8px';

      const picker = document.createElement('ha-entity-picker');
      picker.hass = this._hass;
      picker.value = ent.entity;
      picker.setAttribute('label', `實體 ${idx + 1}`);
      picker.style.flexGrow = '1';
      picker.addEventListener('value-changed', (ev) => this._entityChanged(idx, ev.detail.value));

      const removeBtn = document.createElement('ha-icon-button');
      removeBtn.innerHTML = '<ha-icon icon="mdi:close"></ha-icon>';
      removeBtn.style.color = 'var(--error-color)';
      removeBtn.addEventListener('click', () => this._removeEntity(idx));

      row.appendChild(picker);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  _entityChanged(index, newValue) {
    const newEnts = [...this._config.entities];
    newEnts[index] = { ...newEnts[index], entity: newValue };
    this._updateConfig('entities', newEnts);
    this._rendered = false; // 強制下次更新重繪
  }

  _addEntity() {
    const newEnts = [...(this._config.entities || []), { entity: '', name: '', max: 100 }];
    this._updateConfig('entities', newEnts);
    this._rendered = false;
  }

  _removeEntity(index) {
    const newEnts = this._config.entities.filter((_, i) => i !== index);
    this._updateConfig('entities', newEnts);
    this._rendered = false;
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
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", color: "#E13460", radius: "65%", entities: [] }; }

  set hass(hass) {
    this._hass = hass;
    if (!this.chart) { this._initChart(); } else { this._updateData(); }
  }

  setConfig(config) { this.config = config; }

  _initChart() {
    if (this.shadowRoot && this.shadowRoot.querySelector('div')) return;
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    root.appendChild(container);

    setTimeout(() => {
      if (container) {
        this.chart = echarts.init(container);
        this._updateData();
      }
    }, 0);
  }

  _updateData() {
    if (!this._hass || !this.config.entities || !this.chart) return;
    const dataValues = this.config.entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) || 0 : 0;
    });
    const indicators = this.config.entities.map(ent => ({
      name: (ent.name || ent.entity.split('.')[1] || ent.entity).toUpperCase(),
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
        axisName: { fontSize: 11, fontWeight: 'bold', color: '#cbd5e1' },
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
}

// --- 3. 註冊 ---
customElements.define("prism-3d-card-editor", Prism3DCardEditor);
customElements.define("prism-3d-card", Prism3DCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-3d-card",
  name: "Prism 3D Data Card",
  preview: true,
  description: "A futuristic 3D radar chart card."
});