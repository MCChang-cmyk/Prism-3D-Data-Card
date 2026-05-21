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
    if (!this._config) return;

    const mainColor = this._config.color || '#E13460';
    const is3D = this._config.mode !== '2d';

    this.innerHTML = `
      <div id="editor-container" style="display: flex; flex-direction: column; gap: 20px; color: var(--primary-text-color); padding: 10px;">
        
        <div class="config-item">
          <label style="display: block; margin-bottom: 10px; font-weight: bold;">主色調 (Hex Code)</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="color-preview" style="width: 40px; height: 40px; border-radius: 4px; background: ${mainColor}; border: 2px solid var(--divider-color);"></div>
            <input type="text" id="color-hex-input" 
              value="${mainColor}" 
              placeholder="#E13460"
              style="flex-grow: 1; padding: 10px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font-family: monospace;">
          </div>
        </div>
        
        <div class="config-item" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">
          <label style="font-weight: bold; cursor: pointer;" for="mode-checkbox">啟動 3D 體積感</label>
          <input type="checkbox" id="mode-checkbox" ${is3D ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
        </div>

        <div class="config-item" style="border-top: 1px solid var(--divider-color); padding-top: 15px;">
          <label style="display: block; margin-bottom: 10px; font-weight: bold;">實體配置 (Entities)</label>
          <div id="entities-list" style="display: flex; flex-direction: column; gap: 10px;">
            ${(this._config.entities || []).map((ent, idx) => `
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" class="entity-input" data-index="${idx}" value="${ent.entity}" placeholder="sensor.example"
                  style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);">
                <button class="remove-ent" data-index="${idx}" style="background: none; border: none; color: #ff5252; cursor: pointer; font-size: 18px;">✕</button>
              </div>
            `).join('')}
          </div>
          <button id="add-ent" style="margin-top: 12px; width: 100%; padding: 10px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ 新增實體</button>
        </div>
      </div>
    `;

    // --- 事件綁定 ---

    // 1. 顏色輸入
    this.querySelector('#color-hex-input').addEventListener('input', (ev) => {
      const val = ev.target.value;
      if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
        this.querySelector('#color-preview').style.background = val;
        this._updateConfig('color', val);
      }
    });

    // 2. 3D 模式開關
    this.querySelector('#mode-checkbox').addEventListener('change', (ev) => {
      this._updateConfig('mode', ev.target.checked ? '3d' : '2d');
    });

    // 3. 實體內容修改
    this.querySelectorAll('.entity-input').forEach(el => {
      el.addEventListener('change', (ev) => {
        const idx = ev.target.dataset.index;
        const newEnts = [...this._config.entities];
        newEnts[idx] = { ...newEnts[idx], entity: ev.target.value };
        this._updateConfig('entities', newEnts);
      });
    });

    // 4. 新增實體
    this.querySelector('#add-ent').addEventListener('click', () => {
      const newEnts = [...(this._config.entities || []), { entity: '', name: '', max: 100 }];
      this._updateConfig('entities', newEnts);
    });

    // 5. 移除實體
    this.querySelectorAll('.remove-ent').forEach(el => {
      el.addEventListener('click', (ev) => {
        const idx = ev.target.dataset.index;
        const newEnts = this._config.entities.filter((_, i) => i != idx);
        this._updateConfig('entities', newEnts);
      });
    });
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