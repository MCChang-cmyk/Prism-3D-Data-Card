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

    // 定義主色與模式
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
          <input type="checkbox" id="mode-checkbox" ${is3D ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
        </div>

        <div class="config-item" style="border-top: 1px solid var(--divider-color); padding-top: 15px;">
          <label style="display: block; margin-bottom: 8px; font-weight: bold;">數據配置</label>
          <p style="font-size: 13px; opacity: 0.8; line-height: 1.6;">
            目前請點擊左下角 <strong style="color: var(--primary-color);">「使用文字編輯器」</strong> 進行實體配置。
          </p>
          <pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; font-size: 12px; color: #5eead4;">
entities:
  - entity: sensor.your_sensor
    name: 名稱
    max: 100</pre>
        </div>
      </div>
    `;

    // --- 事件綁定 ---
    
    // 1. Hex 輸入監聽
    const hexInput = this.querySelector('#color-hex-input');
    hexInput.addEventListener('input', (ev) => {
        const value = ev.target.value;
        // 簡單驗證 Hex 格式
        if (/^#[0-9A-F]{6}$/i.test(value) || /^#[0-9A-F]{3}$/i.test(value)) {
            this.querySelector('#color-preview').style.background = value;
            this._updateConfig('color', value);
        }
    });

    // 2. Checkbox 監聽
    const modeCheckbox = this.querySelector('#mode-checkbox');
    modeCheckbox.addEventListener('change', (ev) => {
        this._updateConfig('mode', ev.target.checked ? '3d' : '2d');
    });
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