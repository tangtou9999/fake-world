import fs from "node:fs";
/**
 * Import assets-incoming/ (from the `assets` branch) into the web app.
 *
 * - Compresses images into packages/web/public/imported/ so GitHub Pages can serve them.
 *   Avatars are 640px. Covers, chat photos, and moment photos are about 960px.
 *   JPEG quality stays near 70, then moment quality is lowered only if needed to land near 20 MB.
 * - Writes packages/web/src/faker/wechat/imported/seed.json for the default seed data.
 *
 * Usage (from the repo root, with `sharp` resolvable):
 *   NODE_PATH=/tmp/imgtools/node_modules node scripts/import-assets.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || "sharp");

const ROOT = process.cwd();
const SOURCE = process.env.ASSETS_DIR || path.join(ROOT, "assets-incoming");
const PUBLIC_DIR = path.join(ROOT, "packages/web/public/imported");
const SEED_PATH = path.join(ROOT, "packages/web/src/faker/wechat/imported/seed.json");
const TARGET_BYTES = 20 * 1024 * 1024;

const PRIVACY = {
	所有人可见: "all",
	仅聊天: "chatsOnly",
	不让他看朋友圈: "hideMyPosts",
	不看他的朋友圈: "hideFriendPosts",
};

const MOMENTS_RANGE = {
	全部: "all",
	半年: "lastSixMonths",
	最近半年: "lastSixMonths",
	一个月: "lastOneMonth",
	最近一个月: "lastOneMonth",
	三天: "lastThreeDays",
	最近三天: "lastThreeDays",
};

const GENDER = {
	女: "female",
	男: "male",
};

const TRANSFER_STATUS = {
	待收款: "awaiting",
	待接收: "awaiting",
	已收款: "accepted",
	已接收: "accepted",
	已退还: "rejected",
	已过期: "expired",
};

const RED_PACKET_STATUS = {
	待领取: "awaiting",
	已领取: "accepted",
	已过期: "expired",
};

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function contactIds() {
	return fs
		.readdirSync(SOURCE)
		.filter((name) => /^c\d{3}$/.test(name))
		.sort();
}

function slate(text) {
	return [{ type: "paragraph", children: [{ text: text ?? "" }] }];
}

function parseTimestamp(value) {
	const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
	if (!match) throw new Error(`Bad time: ${value}`);
	const [, year, month, day, hour, minute] = match.map(Number);
	// Hours above 23 show up in the pack (24:08). Date normalizes that overflow.
	const parsed = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
	if (Number.isNaN(parsed)) throw new Error(`Bad time: ${value}`);
	return parsed;
}

function clockParts(timestamp) {
	const date = new Date(timestamp);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	return {
		dayKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
		time: `${hh}:${mm}`,
		month: date.getMonth() + 1,
		day: date.getDate(),
	};
}

function upperText(timestamp, previousTimestamp) {
	const current = clockParts(timestamp);
	if (previousTimestamp != null) {
		const previous = clockParts(previousTimestamp);
		if (current.dayKey === previous.dayKey && current.time === previous.time) return undefined;
		if (current.dayKey === previous.dayKey) return current.time;
	}
	return `${current.month}月${current.day}日 ${current.time}`;
}

function roleOf(from) {
	if (from === "me") return "mine";
	if (from === "other") return "friend";
	throw new Error(`Unknown message sender: ${from}`);
}

async function compressFile(src, dest, edge, quality) {
	await fs.promises.mkdir(path.dirname(dest), { recursive: true });
	await sharp(src)
		.rotate()
		.resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
		.jpeg({ quality, mozjpeg: true })
		.toFile(dest);
}

function relPublic(contactId, file) {
	return `imported/${contactId}/${file}`;
}

async function encodeGroup(jobs, quality) {
	const queue = jobs.slice();
	const workers = Array.from({ length: 8 }, async () => {
		while (queue.length) {
			const job = queue.shift();
			if (!job) return;
			await compressFile(job.src, job.dest, job.edge, quality ?? job.quality);
		}
	});
	await Promise.all(workers);
}

function dirSize(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) total += dirSize(full);
		else total += fs.statSync(full).size;
	}
	return total;
}

function isEmptyMe(profile, moments) {
	const nickname = (profile.nickname || "").trim();
	const wechatId = (profile.wechatId || "").trim();
	return !nickname && !wechatId && moments.length === 0;
}

async function main() {
	if (!fs.existsSync(SOURCE)) {
		throw new Error(`Missing source directory: ${SOURCE}`);
	}
	fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
	fs.mkdirSync(PUBLIC_DIR, { recursive: true });

	const ids = contactIds();
	if (ids.length !== 20) throw new Error(`Expected 20 contacts, found ${ids.length}`);

	const profilesRaw = new Map();
	const nickToId = new Map();
	for (const id of ids) {
		const profile = readJson(path.join(SOURCE, id, "profile.json"));
		profilesRaw.set(id, profile);
		if (nickToId.has(profile.nickname)) throw new Error(`Duplicate nickname ${profile.nickname}`);
		nickToId.set(profile.nickname, id);
	}

	const meProfile = readJson(path.join(SOURCE, "me/profile.json"));
	const meMoments = readJson(path.join(SOURCE, "me/moments.json"));
	if (!isEmptyMe(meProfile, meMoments)) {
		throw new Error("me/ template is no longer empty; import it explicitly before continuing");
	}

	const fixedJobs = [];
	const momentJobs = [];
	for (const id of ids) {
		const dir = path.join(SOURCE, id);
		const push = (file, edge, bucket) => {
			const src = path.join(dir, file);
			if (!fs.existsSync(src)) return;
			const job = { src, dest: path.join(PUBLIC_DIR, id, file), edge, file, id };
			bucket.push(job);
		};
		push("avatar.jpg", 640, fixedJobs);
		push("cover.jpg", 960, fixedJobs);
		for (const name of fs.readdirSync(dir)) {
			if (/^thumb\d+\.jpe?g$/i.test(name)) push(name, 640, fixedJobs);
		}
		const chatDir = path.join(dir, "chat");
		if (fs.existsSync(chatDir)) {
			for (const name of fs.readdirSync(chatDir)) {
				if (/\.jpe?g$/i.test(name)) push(path.join("chat", name), 960, fixedJobs);
			}
		}
		const momentsDir = path.join(dir, "moments");
		if (fs.existsSync(momentsDir)) {
			for (const name of fs.readdirSync(momentsDir)) {
				if (/\.jpe?g$/i.test(name)) push(path.join("moments", name), 960, momentJobs);
			}
		}
	}

	await encodeGroup(fixedJobs.map((job) => ({ ...job, quality: 70 })));
	const fixedBytes = dirSize(PUBLIC_DIR);
	let momentQuality = 70;
	for (const quality of [55, 46, 40, 34, 30, 26, 22]) {
		momentQuality = quality;
		await encodeGroup(momentJobs, quality);
		if (dirSize(PUBLIC_DIR) <= TARGET_BYTES * 1.05) break;
	}

	const profiles = ids.map((id) => {
		const raw = profilesRaw.get(id);
		const gender = GENDER[raw.gender];
		const privacy = PRIVACY[raw.friendPermission];
		const momentsPrivacy = MOMENTS_RANGE[raw.momentsRange];
		if (!gender) throw new Error(`${id} gender ${raw.gender}`);
		if (!privacy) throw new Error(`${id} friendPermission ${raw.friendPermission}`);
		if (!momentsPrivacy) throw new Error(`${id} momentsRange ${raw.momentsRange}`);
		const thumbs = fs
			.readdirSync(path.join(SOURCE, id))
			.filter((name) => /^thumb\d+\.jpe?g$/i.test(name))
			.sort();
		const profile = {
			id,
			nickname: raw.nickname,
			avatarInfo: relPublic(id, "avatar.jpg"),
			wechat: raw.wechatId,
			gender,
			privacy,
			momentsPrivacy,
			momentsBackgroundLike: false,
			thumbnailInfo: thumbs.map((name) => relPublic(id, name)),
			createdByFaker: true,
		};
		if (raw.remark) profile.remark = raw.remark;
		if (raw.region) profile.area = raw.region;
		if (raw.signature) profile.signature = raw.signature;
		if (raw.patText) profile.tickleText = raw.patText;
		if (raw.description) profile.description = raw.description;
		if (Array.isArray(raw.phones) && raw.phones.length) profile.phone = raw.phones;
		if (Array.isArray(raw.tags) && raw.tags.length) profile.tags = raw.tags;
		if (typeof raw.beans === "number") profile.coin = raw.beans;
		if (raw.starred) profile.isStarred = true;
		if (raw.hideGender) profile.hideGender = true;
		if (fs.existsSync(path.join(SOURCE, id, "cover.jpg"))) {
			profile.momentsBackgroundInfo = relPublic(id, "cover.jpg");
		}
		return profile;
	});

	const dialogues = [];
	const conversations = {};
	for (const id of ids) {
		const chat = readJson(path.join(SOURCE, id, "chat.json"));
		const conv = chat.conversation;
		const messages = chat.messages.map((message, index) => {
			const role = roleOf(message.from);
			const sendTimestamp = parseTimestamp(message.time);
			const previousTimestamp =
				index > 0 ? parseTimestamp(chat.messages[index - 1].time) : undefined;
			const base = {
				id: `${id}-m${index}`,
				role,
				sendTimestamp,
			};
			const label = upperText(sendTimestamp, previousTimestamp);
			if (label) base.upperText = label;
			switch (message.type) {
				case "text":
					return { ...base, type: "text", textContent: slate(message.text) };
				case "system":
					return { ...base, type: "centerText", simpleContent: message.text };
				case "voice":
					return {
						...base,
						type: "voice",
						duration: message.seconds,
						isRead: role === "mine",
						showStt: false,
					};
				case "image":
					return { ...base, type: "image", imageInfo: relPublic(id, message.file) };
				case "transfer":
					return {
						...base,
						type: "transfer",
						originalSender: role,
						transferStatus: TRANSFER_STATUS[message.status],
						amount: String(message.amount),
						note: message.note || undefined,
					};
				case "redpacket":
					return {
						...base,
						type: "redPacket",
						originalSender: role,
						redPacketStatus: RED_PACKET_STATUS[message.status],
						amount: String(message.amount),
						note: message.greeting || undefined,
					};
				case "card": {
					const contact = profilesRaw.get(message.contactId);
					if (!contact) throw new Error(`${id} card missing ${message.contactId}`);
					return {
						...base,
						type: "personalCard",
						avatarInfo: relPublic(message.contactId, "avatar.jpg"),
						nickname: contact.nickname,
					};
				}
				default:
					throw new Error(`${id} unknown message type ${message.type}`);
			}
		});
		for (const message of messages) {
			if (message.type === "transfer" && !message.transferStatus) {
				throw new Error(`${id} bad transfer status`);
			}
			if (message.type === "redPacket" && !message.redPacketStatus) {
				throw new Error(`${id} bad red packet status`);
			}
		}
		conversations[id] = messages;
		const unread = conv.unread;
		const item = {
			id,
			friendId: id,
			lastMessage: conv.lastMessage,
			lastMessageTime: conv.time,
			isPinned: Boolean(conv.pinned),
			isMuted: Boolean(conv.muted),
		};
		if (unread === "dot") {
			item.unreadDisplayType = "dot";
		} else if (Number(unread) > 0) {
			item.unreadDisplayType = "number";
			item.unreadMarkNumber = Number(unread);
		}
		const last = messages.at(-1);
		dialogues.push({ item, lastTimestamp: last ? last.sendTimestamp : 0 });
	}

	dialogues.sort((a, b) => {
		if (a.item.isPinned !== b.item.isPinned) return a.item.isPinned ? -1 : 1;
		return b.lastTimestamp - a.lastTimestamp;
	});
	const dialogueItems = dialogues.map(({ item }) => item);

	const requireUser = (name, where) => {
		const id = nickToId.get(name);
		if (!id) throw new Error(`Unknown user "${name}" in ${where}`);
		return id;
	};

	let adjustedComments = 0;
	const feeds = [];
	for (const id of ids) {
		const moments = readJson(path.join(SOURCE, id, "moments.json"));
		for (const moment of moments) {
			const sendTimestamp = parseTimestamp(moment.time);
			const images = moment.images ?? [];
			const content =
				images.length > 0
					? {
							type: "textWithImages",
							text: slate(moment.text),
							imagesInfo: images.map((file) => relPublic(id, file)),
						}
					: { type: "text", text: slate(moment.text) };
			const comments = (moment.comments ?? []).map((comment, index) => {
				let sendTimestampComment = parseTimestamp(comment.time);
				if (sendTimestampComment <= sendTimestamp) {
					sendTimestampComment = sendTimestamp + (index + 1) * 60 * 1000;
					adjustedComments += 1;
				}
				const item = {
					id: `${id}-${moment.id}-c${index}`,
					text: slate(comment.text),
					fromUserId: requireUser(comment.from, `${id}/${moment.id}`),
					sendTimestamp: sendTimestampComment,
				};
				if (comment.replyTo) {
					item.replyUserId = requireUser(comment.replyTo, `${id}/${moment.id}`);
				}
				return item;
			});
			const feed = {
				id: `${id}-${moment.id}`,
				userId: id,
				sendTimestamp,
				content,
				likeUserIds: (moment.likes ?? []).map((name) => requireUser(name, `${id}/${moment.id}`)),
				comments,
			};
			if (moment.location) feed.location = moment.location;
			feeds.push(feed);
		}
	}
	feeds.sort((a, b) => b.sendTimestamp - a.sendTimestamp);

	for (const feed of feeds) {
		for (const comment of feed.comments) {
			if (comment.sendTimestamp <= feed.sendTimestamp) {
				throw new Error(`Comment ${comment.id} is not after its post`);
			}
		}
	}

	fs.mkdirSync(path.dirname(SEED_PATH), { recursive: true });
	fs.writeFileSync(
		SEED_PATH,
		JSON.stringify({ profiles, dialogues: dialogueItems, conversations, feeds }),
	);

	const total = dirSize(PUBLIC_DIR);
	console.log(
		JSON.stringify(
			{
				contacts: profiles.length,
				dialogues: dialogueItems.length,
				feeds: feeds.length,
				messages: Object.values(conversations).reduce((sum, list) => sum + list.length, 0),
				adjustedComments,
				imagesMB: Number((total / 1024 / 1024).toFixed(2)),
				momentQuality,
				fixedMB: Number((fixedBytes / 1024 / 1024).toFixed(2)),
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
