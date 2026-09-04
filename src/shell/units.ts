// 允許的單位字串（指數式）。標籤與圖表的單位必須在此清單內，plan.test.ts 會檢查。
export const UNITS_ALLOWED: readonly string[] = [
  "", "m", "s", "kg", "N", "J", "W", "Pa", "K", "°C", "°", "rad", "Hz", "mol",
  "m s⁻¹", "m s⁻²", "N kg⁻¹", "rad s⁻¹", "kg m s⁻¹", "N s", "N m", "m²", "m³", "kg m⁻³",
  "J kg⁻¹", "J kg⁻¹ °C⁻¹", "J kg⁻¹ K⁻¹", "J K⁻¹", "W m⁻²",
  "A", "V", "Ω", "Ω m", "C", "T", "Wb", "F", "H", "eV", "V m⁻¹", "N C⁻¹", "kW h",
  "Bq", "Gy", "Sv", "s⁻¹", "%", "cm", "mm", "km", "g", "min", "h",
];
export const isUnit = (u: string) => UNITS_ALLOWED.includes(u);
