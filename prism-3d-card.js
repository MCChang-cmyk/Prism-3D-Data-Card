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
    this.config = config;
  }

  _initChart() {
    if (this.shadowRoot && this.shadowRoot.querySelector('div')) return;
    
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    container.style.minHeight = '300px'; 
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
      const val = state ? parseFloat(state.state) : 0;
      return isNaN(val) ? 0 : val;
    });

    const indicators = this.config.entities.map(ent => ({
      name: ent.name || ent.entity,
      max: ent.max || 100
    }));

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        radius: '65%',
        center: ['50%', '50%'],
        axisName: {
          fontSize: 12,
          fontWeight: 'bold',
          color: '#cbd5e1',
          padding: [2, 2]
        },
        splitLine: {
          lineStyle: {
            color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.1)'].reverse(),
            width: 1
          }
        },
        splitArea: { show: false },
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      },
      series: [
        {
          type: 'radar',
          data: [{
            value: dataValues,
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: { color: '#5eead4' },
            lineStyle: { color: '#5eead4', width: 2 },
            areaStyle: {
              color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                { offset: 0, color: 'rgba(94, 234, 212, 0.1)' },
                { offset: 1, color: 'rgba(94, 234, 212, 0.6)' }
              ])
            }
          }],
          z: 1
        }
      ]
    };

    this.chart.setOption(option);
    
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    this._resizeTimeout = setTimeout(() => {
        if (this.chart) this.chart.resize();
    }, 300);
  }

  // 加上這段可以讓 HA 知道卡片的大致高度
  getCardSize() {
    return 4;
  }
}

customElements.define("prism-3d-card", Prism3DCard);