/** 只有构建时设了 VITE_AUTH_ENABLED=1 才启用账号系统；默认关闭，现有网站行为不变。 */
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "1";
/** 后端地址。前端和后端放同一台服务器时留空（走相对路径 /api）。 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
