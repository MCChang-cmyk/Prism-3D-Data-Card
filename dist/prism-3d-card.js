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
    if (this.shadowRoot) return;
    
    this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = this.config.height || '350px';
    container.style.background = 'transparent';
    this.shadowRoot.appendChild(container);

    this.chart = echarts.init(container);
    this._updateData();
    
    // 監聽視窗縮放
    window.addEventListener('resize', () => this.chart.resize());
  }

  _updateData() {
    if (!this._hass || !this.config.entities) return;

    const dataValues = this.config.entities.map(ent => {
      const state = this._hass.states[ent.entity];
      return state ? parseFloat(state.state) : 0;
    });

    const indicators = this.config.entities.map(ent => ({
      name: ent.name || ent.entity,
      max: ent.max || 100,
      color: '#94a3b8'
    }));

    const option = {
      backgroundColor: 'transparent',
      tooltip: { show: true },
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        // --- 優化部分 ---
        radius: '80%',        // 增加半徑，原本預設較小
        center: ['50%', '50%'], // 確保居中
        // ----------------
        axisName: {
          fontSize: 14,       // 稍微放大文字
          fontWeight: 'bold',
          color: '#cbd5e1',
          overflow: 'break',  // 防止標籤被裁切
          formatter: (value) => value
        },
        splitLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.05)', width: 1 }
        },
        splitArea: {
          show: true,
          areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] }
        },
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      },
      series: [{
        type: 'radar',
        emphasis: { lineStyle: { width: 4 } },
        data: [{
          value: dataValues,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#5eead4' },
          areaStyle: {
            // 關鍵：模擬 3D 摺紙的漸層光澤
            color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
              { offset: 0, color: 'rgba(94, 234, 212, 0.1)' },
              { offset: 0.5, color: 'rgba(45, 212, 191, 0.4)' },
              { offset: 1, color: 'rgba(20, 184, 166, 0.9)' }
            ]),
            shadowBlur: 15,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            shadowOffsetY: 10
          },
          lineStyle: {
            color: '#5eead4',
            width: 2,
            type: 'solid'
          }
        }],
        // 啟用平滑動畫
        animationDuration: 1500,
        animationEasing: 'cubicOut'
      }]
    };

    this.chart.setOption(option);
  }

  getCardSize() { return 4; }
}

customElements.define("prism-3d-card", Prism3DCard);