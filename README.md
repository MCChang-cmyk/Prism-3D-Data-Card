# Prism 3D Data Card

一個為 Home Assistant 設計的未來感 3D 稜鏡數據視覺化卡片。

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
![Version](https://img.shields.io/badge/version-v1.9.3-E13460)

## 📖 簡介

Prism 3D Data Card 是一個自定義的 Lovelace 卡片，它能將多個實體的數值轉化為精美的 3D 稜鏡或 2D 雷達圖。這款卡片特別適合用於展示環境感測器數據、或是任何需要多維度比較的數值。

## ✨ 主要功能

-   **3D 立體投影**：手動計算的 3D 投影效果，模擬具有傾斜與旋轉感的立體數據模型。
-   **雙顯示模式**：支援「3D 立體」與「2D 平面」模式切換。
-   **動態互動旋轉**：在 3D 模式下，可以直接透過滑鼠或觸控**拖曳旋轉**圖表，並帶有優雅的彈回效果。
-   **精密數據控制**：支援全域小數點位數設定，並自動繼承 Home Assistant 實體的顯示精度設定。
-   **豐富的視覺自定義**：
    -   可自定義圖表主色、文字顏色及背景網格顏色。
    -   可調整稜線寬度、區域透明度、文字大小與描邊。
    -   獨特的「3D 明暗差異」設定，增強立體層次感。
-   **動態互動**：內建 ECharts 驅動，支持 Tooltip 數據顯示。
-   **圖形化編輯器**：完整支援 Home Assistant 內建的 UI 編輯器，分類清晰，無需手動修改 YAML 即可完成所有設定。

## Preview

![Preview](images/prism-3d-preview.jpg)


## 🚀 安裝方式

### 透過 HACS (建議)

1.  開啟 **HACS** > **Frontend**。
2.  點擊右上角的三個點，選擇 **Custom repositories**。
3.  貼上本專案的 GitHub 網址，類別選擇 **Lovelace**。
4.  點擊 **Install**。

### 手動安裝

1.  下載 `prism-3d-card.js`。
2.  將檔案上傳至 Home Assistant 的 `/config/www/` 資料夾。
3.  在 HA 的「資源」設定中加入：`/local/prism-3d-card.js?v=1.9.3` (類型為 JavaScript Module)。

## ⚙️ 配置參數

| 參數 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `title` | string | `""` | 卡片標題。 |
| `mode` | string | `3d` | 顯示模式，可選 `3d` 或 `2d`。 |
| `data_mode` | string | `absolute` | 數據計算模式（詳見下方說明）。 |
| `decimal_places`| number | `1` | 全域顯示小數點位數 (0-5)。 |
| `color` | string | `#E13460` | 圖表的主色調。 |
| `entities` | list | - | 實體列表，包含 `entity`, `name`, `max`。 |
| `chart_radius` | number | `65` | 圖表縮放比例 (10-100%)。 |
| `rotation` | number | `0` | 基礎旋轉角度 (0-360)。 |
| `drag_direction`| string | `normal` | 拖曳旋轉方向，`normal` (隨手勢) 或 `reverse` (隨鏡頭)。 |
| `tilt` | number | `0.4` | 3D 模式下的傾斜視角 (0.1-0.9)。 |
| `line_width` | number | `2` | 稜線的寬度。 |
| `area_opacity` | number | `0.4` | 數據區域的總透明度。 |
| `opacity_variation` | number | `0.02` | 3D 明暗差異值，增加立體感。 |
| `text_size` | number | `11` | 標籤文字大小。 |
| `text_color` | string | `#94a3b8` | 標籤文字顏色。 |
| `grid_color` | string | `#ffffff` | 背景網格與斑馬紋顏色。 |

### 數據模式邏輯 (`data_mode`)

- **絕對值 (Absolute)**：各維度高度 = 數值 / 該維度 max (預設為 100)。
- **絕對值比例 (absolute_prop)**：先計算各維度相對於其 max 的比例，再將比例最大者映射為 100% 高度。適用於所有實體都有不同量程，但想讓圖表最飽滿的情況。
- **相對值比例 (relative_prop)**：忽略 max 設定，直接以所有實體中數值的最大值作為 100% 高度基準。

## 🛠 開發與測試

本專案附帶一個 `dev/preview.html`，提供了一個「終極修復工作台」，讓開發者可以在不安裝 Home Assistant 的情況下直接預覽與調教效果。

1.  確保 `prism-3d-card.js` 位於根目錄。
2.  使用 **Live Server** (VS Code 插件) 或直接瀏覽器開啟 `dev/preview.html`。
3.  您可以透過介面右側的控制面板動態調整參數，或是修改模擬實體的數值與名稱。

## 📝 貢獻與反饋

如果您發現任何 Bug 或有功能建議，歡迎提交 Issue 或 Pull Request！

---

*Made with ❤️ for the Home Assistant community.*
