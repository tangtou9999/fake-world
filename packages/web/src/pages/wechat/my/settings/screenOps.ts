import { MYSELF_ID } from "@/faker/wechat/user";
import { EBottomNavBars, type IBottomNavbarsItemConfig, bottomNavbarsAtom } from "@/stateV2/bottomNavbars";
import { ALL_LOGIN_DEVICES, multipleDeviceLoginAtom } from "@/stateV2/multipleDeviceLogin";
import { getAllProfilesValueSnapshot, getProfileValueSnapshot, setProfileValue } from "@/stateV2/profile";
import type { IStateProfile } from "@/stateV2/profile";
import { type TStateStatusBarConfig, statusBarConfigAtom } from "@/stateV2/statusBar";
import { mainStore } from "@/stateV2/store";
import { type TStateWallet, walletAtom } from "@/stateV2/wallet";
import { parseJsonLoose } from "@/utils/gemini";

/** 点了手机底部弹层之后的一小段时间里，不要再弹出桌面那套编辑抽屉 */
let phoneSheetUntil = 0;
export const markPhoneSheet = () => {
	phoneSheetUntil = Date.now() + 900;
};
export const phoneSheetActive = () => Date.now() < phoneSheetUntil;

type Nullable<T> = T | null;

export type ProfilePatch = {
	nickname?: string;
	remark?: Nullable<string>;
	wechat?: string;
	avatarInfo?: string;
	gender?: Nullable<"male" | "female">;
	hideGender?: boolean;
	area?: Nullable<string>;
	signature?: Nullable<string>;
	description?: Nullable<string>;
	phone?: string[];
	tags?: string[];
	privacy?: IStateProfile["privacy"];
	momentsPrivacy?: IStateProfile["momentsPrivacy"];
	tickleText?: Nullable<string>;
	isStarred?: boolean;
	hideThumbnail?: boolean;
	coin?: number | null;
	ringtone?: Nullable<string>;
	momentsBackgroundInfo?: string;
	momentsBackgroundLike?: boolean;
	qrCodeImage?: Nullable<string>;
	thumbnailInfo?: string[];
};

/** 手动表单和 AI 确认后都走这里写资料 */
export const patchProfile = (id: string, patch: ProfilePatch) => {
	const cur = getProfileValueSnapshot(id);
	if (!cur) return false;
	setProfileValue(id, (pv) => {
		const next = { ...pv };
		for (const [k, v] of Object.entries(patch) as [keyof ProfilePatch, ProfilePatch[keyof ProfilePatch]][]) {
			if (v === undefined) continue;
			(next as Record<string, unknown>)[k] = v === null ? undefined : v;
		}
		return next;
	});
	return true;
};

export const patchStatusBar = (patch: Partial<TStateStatusBarConfig>) => {
	mainStore.set(statusBarConfigAtom, (v) => ({ ...v, ...patch }));
};

export const patchNavBadge = (tab: EBottomNavBars, patch: Partial<IBottomNavbarsItemConfig>) => {
	mainStore.set(bottomNavbarsAtom, (v) => ({ ...v, [tab]: { ...v[tab], ...patch } }));
};

export const patchWallet = (patch: Partial<TStateWallet>) => {
	mainStore.set(walletAtom, (v) => ({ ...v, ...patch }));
};

export const patchDevices = (patch: { visible?: boolean; devices?: (typeof ALL_LOGIN_DEVICES)[number][] }) => {
	mainStore.set(multipleDeviceLoginAtom, (v) => ({
		...v,
		...patch,
		devices: patch.devices ?? v.devices,
	}));
};

const TAB_BY_NAME: Record<string, EBottomNavBars> = {
	微信: EBottomNavBars.WECHAT,
	通讯录: EBottomNavBars.ADDRESS_BOOK,
	发现: EBottomNavBars.DISCOVER,
	我: EBottomNavBars.MY,
};

const HERE = new Set(["", "当前", "这个人", "他", "她", "对方"]);

export const resolvePerson = (target: string | undefined, currentId?: string | null) => {
	const t = (target ?? "").trim();
	if (HERE.has(t)) return currentId || undefined;
	const profiles = getAllProfilesValueSnapshot();
	const exact = profiles.find((p) => p.id === t || p.nickname === t || p.remark === t);
	if (exact) return exact.id;
	const loose = profiles.find((p) => (p.remark && (t.includes(p.remark) || p.remark.includes(t))) || (p.nickname && (t.includes(p.nickname) || p.nickname.includes(t))));
	return loose?.id;
};

export type ScreenOp =
	| {
			tool: "setProfile";
			target?: string;
			nickname?: string;
			remark?: string;
			wechat?: string;
			signature?: string;
			area?: string;
			gender?: "male" | "female" | "";
			tickle?: string;
			description?: string;
			coin?: number;
			starred?: boolean;
			ringtone?: string;
			privacy?: IStateProfile["privacy"];
			momentsPrivacy?: IStateProfile["momentsPrivacy"];
			hideGender?: boolean;
			hideThumbnail?: boolean;
	  }
	| { tool: "setStatusBar"; hide?: boolean; signal?: TStateStatusBarConfig["signalIconType"]; network?: TStateStatusBarConfig["networkIconType"]; battery?: TStateStatusBarConfig["batteryIconType"] }
	| { tool: "setNavBadge"; tab?: string; count?: number; hide?: boolean; badgeType?: "number" | "dot" }
	| { tool: "setDevices"; visible?: boolean; devices?: string[] }
	| { tool: "setCoverLike"; target?: string; like?: boolean }
	| { tool: "setWallet"; balance?: string; business?: string; miniFund?: string; miniFundYield?: string };

const personName = (id?: string) => {
	if (!id) return "未指定的人";
	const p = getProfileValueSnapshot(id);
	if (!p) return "找不到的人";
	return p.remark || p.nickname || id;
};

const arrow = (from: string, to: string) => `「${from || "空"}」→「${to || "空"}」`;

export const previewScreenOp = (op: ScreenOp, ctx: { currentId?: string | null }) => {
	if (op.tool === "setProfile" || op.tool === "setCoverLike") {
		const id = resolvePerson(op.target, ctx.currentId);
		const p = id ? getProfileValueSnapshot(id) : undefined;
		const who = personName(id);
		if (!p) return `${who}：找不到这个人，确认后也不会写入`;
		if (op.tool === "setCoverLike") return `${who}的朋友圈封面赞：${p.momentsBackgroundLike ? "已赞" : "未赞"} → ${op.like ? "赞" : "取消"}`;
		const bits: string[] = [];
		if (op.nickname !== undefined) bits.push(`名字 ${arrow(p.nickname, op.nickname)}`);
		if (op.remark !== undefined) bits.push(`备注 ${arrow(p.remark ?? "", op.remark)}`);
		if (op.wechat !== undefined) bits.push(`微信号 ${arrow(p.wechat, op.wechat)}`);
		if (op.signature !== undefined) bits.push(`签名 ${arrow(p.signature ?? "", op.signature)}`);
		if (op.area !== undefined) bits.push(`地区 ${arrow(p.area ?? "", op.area)}`);
		if (op.gender !== undefined) bits.push(`性别 ${arrow(p.gender ?? "", op.gender)}`);
		if (op.tickle !== undefined) bits.push(`拍一拍 ${arrow(p.tickleText ?? "", op.tickle)}`);
		if (op.description !== undefined) bits.push(`描述 ${arrow(p.description ?? "", op.description)}`);
		if (op.coin !== undefined) bits.push(`微信豆 ${arrow(String(p.coin ?? ""), String(op.coin))}`);
		if (op.ringtone !== undefined) bits.push(`铃声 ${arrow(p.ringtone ?? "", op.ringtone)}`);
		if (op.starred !== undefined) bits.push(`星标 ${p.isStarred ? "是" : "否"} → ${op.starred ? "是" : "否"}`);
		if (op.privacy !== undefined) bits.push(`权限 ${p.privacy} → ${op.privacy}`);
		if (op.momentsPrivacy !== undefined) bits.push(`朋友圈范围 ${p.momentsPrivacy} → ${op.momentsPrivacy}`);
		if (op.hideGender !== undefined) bits.push(`隐藏性别 → ${op.hideGender ? "是" : "否"}`);
		if (op.hideThumbnail !== undefined) bits.push(`隐藏缩略图 → ${op.hideThumbnail ? "是" : "否"}`);
		return `${who}：${bits.join("；") || "没有要改的字段"}`;
	}
	if (op.tool === "setStatusBar") {
		const c = mainStore.get(statusBarConfigAtom);
		const bits: string[] = [];
		if (op.hide !== undefined) bits.push(`隐藏 ${c.hide ? "是" : "否"} → ${op.hide ? "是" : "否"}`);
		if (op.signal !== undefined) bits.push(`信号 ${c.signalIconType} → ${op.signal}`);
		if (op.network !== undefined) bits.push(`网络 ${c.networkIconType} → ${op.network}`);
		if (op.battery !== undefined) bits.push(`电池 ${c.batteryIconType} → ${op.battery}`);
		return `状态栏：${bits.join("；") || "没有要改的字段"}`;
	}
	if (op.tool === "setNavBadge") {
		const tab = TAB_BY_NAME[op.tab ?? ""];
		if (!tab) return `底部角标：不认识的分页「${op.tab ?? ""}」`;
		const c = mainStore.get(bottomNavbarsAtom)[tab];
		const bits: string[] = [];
		if (op.count !== undefined) bits.push(`数字 ${c.badgeNumber ?? 0} → ${op.count}`);
		if (op.hide !== undefined) bits.push(`隐藏 ${c.badgeHide ? "是" : "否"} → ${op.hide ? "是" : "否"}`);
		if (op.badgeType !== undefined) bits.push(`样式 ${c.badgeType ?? "number"} → ${op.badgeType}`);
		return `「${op.tab}」角标：${bits.join("；") || "没有要改的字段"}`;
	}
	if (op.tool === "setWallet") {
		const w = mainStore.get(walletAtom);
		const bits: string[] = [];
		if (op.balance !== undefined) bits.push(`零钱 ${w.balance} → ${op.balance}`);
		if (op.business !== undefined) bits.push(`经营账户 ${w.business ?? ""} → ${op.business}`);
		if (op.miniFund !== undefined) bits.push(`零钱通 ${w.miniFund} → ${op.miniFund}`);
		if (op.miniFundYield !== undefined) bits.push(`收益率 ${w.miniFundYield ?? ""} → ${op.miniFundYield}`);
		return `钱包：${bits.join("；") || "没有要改的字段"}`;
	}
	const c = mainStore.get(multipleDeviceLoginAtom);
	const bits: string[] = [];
	if (op.visible !== undefined) bits.push(`显示 ${c.visible ? "是" : "否"} → ${op.visible ? "是" : "否"}`);
	if (op.devices !== undefined) bits.push(`设备 ${(c.devices || []).join("、") || "无"} → ${op.devices.join("、") || "无"}`);
	return `多设备登录：${bits.join("；") || "没有要改的字段"}`;
};

const emptyToNull = (v: string | undefined) => (v === undefined ? undefined : v.trim() ? v.trim() : null);

export const applyScreenOps = (ops: ScreenOp[], ctx: { currentId?: string | null }) => {
	const done: string[] = [];
	for (const op of ops) {
		if (op.tool === "setProfile") {
			const id = resolvePerson(op.target, ctx.currentId);
			if (!id || !getProfileValueSnapshot(id)) {
				done.push("没有找到要改的人");
				continue;
			}
			patchProfile(id, {
				nickname: op.nickname?.trim() || undefined,
				remark: emptyToNull(op.remark),
				wechat: op.wechat?.trim() || undefined,
				signature: emptyToNull(op.signature),
				area: emptyToNull(op.area),
				gender: op.gender === "" ? null : op.gender,
				tickleText: emptyToNull(op.tickle),
				description: emptyToNull(op.description),
				coin: op.coin === undefined ? undefined : Math.max(0, Math.round(Number(op.coin) || 0)),
				ringtone: emptyToNull(op.ringtone),
				isStarred: op.starred,
				privacy: op.privacy,
				momentsPrivacy: op.momentsPrivacy,
				hideGender: op.hideGender,
				hideThumbnail: op.hideThumbnail,
			});
			done.push(`已改 ${personName(id)}`);
			continue;
		}
		if (op.tool === "setCoverLike") {
			const id = resolvePerson(op.target, ctx.currentId) || MYSELF_ID;
			if (!getProfileValueSnapshot(id)) {
				done.push("没有找到封面所属的人");
				continue;
			}
			patchProfile(id, { momentsBackgroundLike: !!op.like });
			done.push(`已改 ${personName(id)} 的封面赞`);
			continue;
		}
		if (op.tool === "setStatusBar") {
			patchStatusBar({
				...(op.hide !== undefined ? { hide: !!op.hide } : {}),
				...(op.signal ? { signalIconType: op.signal } : {}),
				...(op.network ? { networkIconType: op.network } : {}),
				...(op.battery ? { batteryIconType: op.battery } : {}),
			});
			done.push("已改状态栏");
			continue;
		}
		if (op.tool === "setNavBadge") {
			const tab = TAB_BY_NAME[op.tab ?? ""];
			if (!tab) {
				done.push("底部角标分页无法识别");
				continue;
			}
			patchNavBadge(tab, {
				...(op.count !== undefined ? { badgeNumber: Math.max(0, Math.round(Number(op.count) || 0)) } : {}),
				...(op.hide !== undefined ? { badgeHide: !!op.hide } : {}),
				...(op.badgeType ? { badgeType: op.badgeType } : {}),
			});
			done.push(`已改「${op.tab}」角标`);
			continue;
		}
		if (op.tool === "setWallet") {
			const money = (v?: string) => (v === undefined ? undefined : Number.isNaN(Number.parseFloat(v)) ? v : Number.parseFloat(v).toFixed(2));
			patchWallet({
				...(op.balance !== undefined ? { balance: money(op.balance) } : {}),
				...(op.business !== undefined ? { business: money(op.business) } : {}),
				...(op.miniFund !== undefined ? { miniFund: money(op.miniFund) } : {}),
				...(op.miniFundYield !== undefined ? { miniFundYield: op.miniFundYield } : {}),
			});
			done.push("已改钱包");
			continue;
		}
		const devices = (op.devices ?? []).filter((d): d is (typeof ALL_LOGIN_DEVICES)[number] => (ALL_LOGIN_DEVICES as readonly string[]).includes(d));
		patchDevices({
			...(op.visible !== undefined ? { visible: !!op.visible } : {}),
			...(op.devices ? { devices } : {}),
		});
		done.push("已改多设备登录");
	}
	return { text: done.join("；") || "没有写入" };
};

export const parseScreenOps = (raw: string): { text: string; screen?: { ops: ScreenOp[] } } => {
	const m = raw.match(/```wxedit\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxedit[\s\S]*?(```|$)/g, "").trim();
	if (!m) {
		if (/```wxedit/.test(raw)) return { text: `${text}\n\n（变更数据没有输出完整，没有写入。请重新输出闭合的 wxedit 代码块。）` };
		return { text: raw };
	}
	try {
		const j = parseJsonLoose<{ ops?: ScreenOp[] }>(m[1]);
		const ops = Array.isArray(j.ops) ? j.ops.filter((o) => o && typeof o.tool === "string") : [];
		if (!ops.length) return { text: `${text}\n\n（wxedit 里没有可执行的修改。）` };
		return { text, screen: { ops } };
	} catch {
		return { text: `${text}\n\n（wxedit 格式有误，没有写入。请重新输出一次。）` };
	}
};

export const SCREEN_EDIT_RULES = `
【改资料、状态栏、角标、多设备、封面赞】用户要改某个人的名字、备注、微信号、签名、地区、性别、拍一拍、描述、微信豆、星标、来电铃声、朋友权限、朋友圈范围，或改手机状态栏、底部四个分页的角标、多设备登录、朋友圈封面是否点赞时，先用一句话说明将要改什么，再附一个 wxedit 代码块。页面会先给用户一张变更预览卡片，用户点「确认执行」后才写入。不要说已经改好了。私人 AI 和当前聊天的 AI 都用这一套。
\`\`\`wxedit
{"ops":[{"tool":"setProfile","target":"当前","nickname":"李四","remark":"小李子"}]}
\`\`\`
- 聊天窗口里说「这个人 / 他 / 对方」时 target 写「当前」。私人 AI 必须写联系人现在的名字或备注。
- tool 只能是 setProfile、setStatusBar、setNavBadge、setDevices、setCoverLike、setWallet。只写要改的字段。
- setProfile 字段：nickname、remark、wechat、signature、area、gender（male 或 female，空字符串表示清空）、tickle、description、coin、starred、ringtone、privacy（all / chatsOnly / hideMyPosts / hideFriendPosts）、momentsPrivacy（all / lastSixMonths / lastOneMonth / lastThreeDays）、hideGender、hideThumbnail。
- setStatusBar：hide，signal（single / double / none），network（wifi / 5G），battery（normal / charging / low / saving）。
- setNavBadge：tab 只能是 微信、通讯录、发现、我；count 是数字；hide；badgeType 是 number 或 dot。
- setDevices：visible；devices 数组，取值只能是 Windows、iPad、Mac、Watch、Desktop。
- setCoverLike：target，like 为 true 或 false。
- setWallet：balance 零钱、business 经营账户、miniFund 零钱通、miniFundYield 收益率，金额写数字字符串。
- 换头像、换朋友圈封面图、上传缩略图要用户在手机上点选图片，不要写进代码块。`;
