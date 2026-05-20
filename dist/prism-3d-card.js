import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

class Prism3DCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.chart) {
      this._initChart();
    } else {
      this._updateData();
    }
  }

  setConfig(config) {
    if (!config.entities || config.entities.length < 3) {
      throw new Error("請至少設定 3 個實體以形成 3D 稜鏡效果。");
    }
    this.config = config;
  }

  _initChart() {
    this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    this.shadowRoot.appendChild(container);

    this.chart = echarts.init(container);
    this._updateData();
  }

  _updateData() {
    const dataValues = this.config.entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) : 0;
    });

    const indicators = this.config.entities.map(ent => ({
      name: ent.name || ent.entity,
      max: ent.max || 100
    }));

    const option = {
      backgroundColor: 'transparent',
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 5,
        axisName: { color: '#94a3b8' },
        splitLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        splitArea: { show: false },
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.2)' }
        }
      },
      series: [{
        type: 'radar',
        data: [{
          value: dataValues,
          name: '數據指標',
          symbol: 'none',
          areaStyle: {
            color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
              { offset: 0, color: 'rgba(94, 234, 212, 0.1)' },
              { offset: 1, color: 'rgba(94, 234, 212, 0.8)' }
            ]),
            opacity: 0.8
          },
          lineStyle: { width: 0 }
        }]
      }]
    };

    this.chart.setOption(option);
  }

  getCardSize() { return 4; }
}

customElements.define("prism-3d-card", Prism3DCard);