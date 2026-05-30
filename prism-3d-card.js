import "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js";

const CARD_VERSION = "v1.8.8"; 

console.info(
  `%c PRISM-3D-CARD %c ${CARD_VERSION} %c (dist) `,
  "color: white; background: #E13460; font-weight: 700;",
  "color: #E13460; background: white; font-weight: 700;",
  "color: #94a3b8; background: transparent;"
);

let LitElement = window.LitElement;
if (!LitElement) {
  const haPanel = customElements.get("ha-panel-lovelace");
  if (haPanel) { LitElement = Object.getPrototypeOf(haPanel); }
  else { LitElement = class extends HTMLElement { set hass(hass) { this._hass = hass; } setConfig(config) { this._config = config; } }; }
}
const html = LitElement.prototype.html || ((strings, ...values) => strings[0]);

// 1. 編輯器 (Prism3DCardEditor)
class Prism3DCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: { state: true }, _expandedIndex: { state: true } }; }
  
  constructor() {
    super();
    this._expandedIndex = -1;
  }

  setConfig(config) { this._config = config; }
  
  _labelFor(name) {
    const labels = { 
      title: "卡片標題", data_mode: "數據計算模式", mode: "顯示模式", 
      chart_radius: "圖表縮放比例", color: "圖表主色", rotation: "旋轉角度", 
      tilt: "傾斜視角", line_width: "稜線寬度", area_opacity: "區域透明度"
    };
    return labels[name] || name;
  }

  _valueChanged(ev) {
    if (!ev.detail.value) return;
    this._fireConfig({ ...this._config, ...ev.detail.value });
  }

  _removeEntity(idx) {
    const newEntities = [...(this._config.entities || [])];
    newEntities.splice(idx, 1);
    this._fireConfig({ entities: newEntities });
    if (this._expandedIndex === idx) this._expandedIndex = -1;
  }

  _updateEntity(idx, updates) {
    const newEntities = JSON.parse(JSON.stringify(this._config.entities));
    newEntities[idx] = { ...newEntities[idx], ...updates };
    this._fireConfig({ entities: newEntities });
  }

  _fireConfig(updates) {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { ...this._config, ...updates } }, bubbles: true, composed: true }));
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const entities = this._config.entities || [];

    return html`
      <style>
        .entities-container { border: 1px solid var(--divider-color); border-radius: 8px; margin: 16px 0; overflow: hidden; background: var(--secondary-background-color); }
        .entity-row { border-bottom: 1px solid var(--divider-color); background: var(--card-background-color); }
        .entity-header { display: flex; align-items: center; padding: 10px 12px; cursor: pointer; min-height: 48px; }
        .entity-header:hover { background: var(--secondary-background-color); }
        .entity-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .entity-title { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
        .entity-id { font-size: 11px; color: var(--secondary-text-color); }
        .entity-content { padding: 16px; background: var(--secondary-background-color); border-top: 1px solid var(--divider-color); }
        .add-entity-box { padding: 16px; background: var(--secondary-background-color); border-top: 1px solid var(--divider-color); }
        ha-icon-button { --mdc-icon-button-size: 36px; color: var(--secondary-text-color); }
        .del-btn { color: var(--error-color); }
      </style>

      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${[
          { name: "title", selector: { text: {} } },
          { name: "data_mode", selector: { select: { mode: "dropdown", options: [{ label: "絕對值", value: "absolute" }, { label: "絕對值比例", value: "absolute_prop" }, { label: "相對值比例", value: "relative_prop" }] } } },
          { name: "mode", selector: { select: { mode: "dropdown", options: [{ label: "3D 立體", value: "3d" }, { label: "2D 平面", value: "2d" }] } } }
        ]}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>

      <div style="margin-top: 24px; font-weight: 500; font-size: 14px; color: var(--primary-text-color);">實體列表設定</div>
      <div class="entities-container">
        
        ${entities.map((ent, idx) => {
          const isExpanded = this._expandedIndex === idx;
          const eid = typeof ent === 'string' ? ent : ent.entity;
          return html`
            <div class="entity-row">
              <div class="entity-header" @click=${() => this._expandedIndex = isExpanded ? -1 : idx}>
                <ha-icon icon="${isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}" style="margin-right:12px; color: var(--secondary-text-color);"></ha-icon>
                <div class="entity-info">
                  <div class="entity-title">${ent.name || this.hass.states[eid]?.attributes?.friendly_name || eid}</div>
                  <div class="entity-id">${eid}</div>
                </div>
                <ha-icon-button class="del-btn" @click=${(e) => { e.stopPropagation(); this._removeEntity(idx); }} .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}></ha-icon-button>
              </div>
              
              ${isExpanded ? html`
                <div class="entity-content">
                  <ha-form
                    .hass=${this.hass}
                    .data=${{ name: ent.name || "", max: ent.max !== undefined ? ent.max : 100 }}
                    .schema=${[
                      { name: "name", selector: { text: {} } },
                      { name: "max", selector: { number: { mode: "box", step: 0.1 } } }
                    ]}
                    .computeLabel=${(s) => s.name === 'name' ? '顯示名稱 (覆蓋預設)' : '圖表最高值 (Max)'}
                    @value-changed=${(e) => this._updateEntity(idx, e.detail.value)}
                  ></ha-form>
                </div>
              ` : ""}
            </div>
          `;
        })}
        
        <div class="add-entity-box">
          <ha-form
            .hass=${this.hass}
            .data=${{ _new_entity: "" }}
            .schema=${[{ name: "_new_entity", selector: { entity: {} } }]}
            .computeLabel=${() => "選擇實體加入清單..."}
            @value-changed=${(e) => {
              const newId = e.detail.value._new_entity;
              if (newId) {
                const newEntities = [...(this._config.entities || [])];
                newEntities.push({ entity: newId, name: "", max: 100 });
                this._fireConfig({ entities: newEntities });
                e.target.data = { _new_entity: "" }; // 重置選擇器
              }
            }}
          ></ha-form>
        </div>

      </div>

      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${[
          { name: "chart_radius", selector: { number: { min: 10, max: 100, step: 1, mode: "slider" } } },
          { type: "expandable", title: "視覺與視角設定", schema: [
              { name: "color", selector: { text: {} } },
              { name: "rotation", selector: { number: { min: 0, max: 360, step: 1, mode: "slider" } } }, 
              { name: "tilt", selector: { number: { min: 0.1, max: 0.9, step: 0.05, mode: "slider" } } },
              { name: "line_width", selector: { number: { min: 0, max: 10, step: 1, mode: "slider" } } },
              { name: "area_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } }
          ]}
        ]}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

// 2. 主卡片 (Prism3DCard)
class Prism3DCard extends HTMLElement {
  constructor() {
    super();
    this._hoverIndex = -1;
    this._dragRotation = 0;
    this._isDragging = false;
  }
  static getConfigElement() { return document.createElement("prism-3d-card-editor"); }
  static getStubConfig() { return { mode: "3d", data_mode: "absolute", color: "#E13460", rotation: 0, tilt: 0.4, entities: [], title: "數據稜鏡" }; }
  set hass(hass) { this._hass = hass; if (this.chart) this._updateData(); }
  setConfig(config) {
    this.config = config;
    if (!this.shadowRoot) { this._initChart(); } 
    else { this._updateMainStyle(); this._updateTitle(); this._updateData(); }
  }
  _initChart() {
    const root = this.attachShadow({ mode: 'open' });
    this._mainContainer = document.createElement('div');
    this._mainContainer.style.cssText = `position: relative; width: 100%; box-sizing: border-box; overflow: hidden; cursor: grab;`;
    this._titleElement = document.createElement('div');
    this._titleElement.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; color: var(--ha-card-header-color, --primary-text-color); font-size: var(--ha-card-header-font-size, 24px); padding: 12px 16px 8px; box-sizing: border-box; text-align: left; z-index: 10; pointer-events: none;`;
    this._mainContainer.appendChild(this._titleElement);