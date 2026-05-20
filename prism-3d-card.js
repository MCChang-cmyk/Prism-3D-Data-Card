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
    
    // 強制設定寬高，避免 ECharts 抓到 0x0
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    container.style.minHeight = '300px'; 
    container.style.display = 'block';

    root.appendChild(container);

    // 關鍵：確保在 DOM 掛載後才初始化 ECharts
    setTimeout(() => {
        this.chart = echarts.init(container);
        this._updateData();
        console.log("Chart Initialized:", this.chart); // 除錯用
    }, 0);
    
    window.addEventListener('resize', () => this.chart && this.chart.resize());
  }

  _updateData() {
    if (!this._hass || !this.config.entities) return;

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
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        radius: '75%',
        center: ['50%', '50%'],
        axisName: {
          fontSize: 13,
          fontWeight: 'bold',
          color: '#cbd5e1',
          padding: [5, 5]
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
          // 第一層：主體 3D 體積感
          type: 'radar',
          data: [{
            value: dataValues,
            name: 'Data Volume',
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { 
              color: '#5eead4',
              shadowBlur: 10,
              shadowColor: '#5eead4'
            },
            lineStyle: {
              color: '#5eead4',
              width: 2,
              cap: 'round'
            },
            areaStyle: {
              color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                { offset: 0, color: 'rgba(94, 234, 212, 0.1)' },
                { offset: 1, color: 'rgba(94, 234, 212, 0.6)' }
              ]),
              shadowBlur: 20,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              shadowOffsetY: 10
            }
          }],
          z: 1
        },
        {
          // 第二層：亮色稜線（模擬光照）
          type: 'radar',
          silent: true,
          data: [{
            value: dataValues,
            symbol: 'none',
            lineStyle: {
              width: 1.5,
              color: 'rgba(255, 255, 255, 0.4)',
              type: 'solid'
            },
            areaStyle: {
              color: 'transparent'
            }
          }],
          z: 2
        }
      ],
      animationDuration: 1200,
      animationEasing: 'exponentialOut'
    };

    this.chart.setOption(option);
  }

  getCardSize() { return 4; }
}

customElements.define("prism-3d-card", Prism3DCard);