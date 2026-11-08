import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enUSText from "./locales/en-US.json";
import zhCNText from "./locales/zh-CN.json";
import zhTWText from "./locales/zh-TW.json";

export const ALL_LANGUAGES = [
	{ label: "简体中文", value: "zh-CN" },
	{ label: "繁體中文（臺灣）", value: "zh-TW" },
	{ label: "English", value: "en-US" },
];

export const ANTD_LANG_MAP = {
	"zh-CN": zhCN,
	"zh-TW": zhTW,
	"en-US": enUS,
};

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		supportedLngs: ["zh-CN", "zh-TW", "en-US"],
		fallbackLng: "zh-CN",
		// 翻译文件直接打包进程序，不再联网加载（联网失败会让整页显示成英文 key）
		resources: {
			"zh-CN": { translation: zhCNText },
			"zh-TW": { translation: zhTWText },
			"en-US": { translation: enUSText },
		},
	});

export function getCurrentLanguage() {
	return i18n.language || localStorage.getItem("i18nextLng") || "zh-CN";
}

export default i18n;
