type Kind = "boc" | "ccb" | "cmb" | "jsb" | "jsrc" | "generic";

function bankKind(name: string): Kind {
	if (name.includes("农商")) return "jsrc";
	if (name.includes("江苏")) return "jsb";
	if (name.includes("建设")) return "ccb";
	if (name.includes("招商")) return "cmb";
	if (name.includes("中国银行") || name.includes("中行")) return "boc";
	return "generic";
}

const Boc = () => (
	<>
		<circle cx="16" cy="16" r="15" fill="#C8102E" />
		<rect
			x="9.5"
			y="9.5"
			width="13"
			height="13"
			rx="0.6"
			fill="none"
			stroke="#fff"
			strokeWidth="2.2"
		/>
	</>
);

const Ccb = () => (
	<>
		<rect width="32" height="32" rx="6" fill="#004E97" />
		<path d="M7 21.5h18" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
		<path
			d="M9 21.5v-6.2L16 9l7 6.3v6.2"
			fill="none"
			stroke="#fff"
			strokeWidth="1.6"
			strokeLinejoin="round"
		/>
		<path d="M14 21.5v-4h4v4" fill="none" stroke="#fff" strokeWidth="1.4" />
	</>
);

const Cmb = () => (
	<>
		<circle cx="16" cy="16" r="15" fill="#E60012" />
		<circle cx="16" cy="16" r="3.4" fill="#fff" />
		<circle cx="16" cy="7.6" r="2.1" fill="#fff" />
		<circle cx="16" cy="24.4" r="2.1" fill="#fff" />
		<circle cx="7.6" cy="16" r="2.1" fill="#fff" />
		<circle cx="24.4" cy="16" r="2.1" fill="#fff" />
		<circle cx="10.2" cy="10.2" r="1.7" fill="#fff" />
		<circle cx="21.8" cy="10.2" r="1.7" fill="#fff" />
		<circle cx="10.2" cy="21.8" r="1.7" fill="#fff" />
		<circle cx="21.8" cy="21.8" r="1.7" fill="#fff" />
	</>
);

const Jsb = () => (
	<>
		<rect width="32" height="32" rx="6" fill="#0033A0" />
		<path
			d="M4 21c4.2-6 8-6 12.2 0S24 27 28 21"
			fill="none"
			stroke="#FFD100"
			strokeWidth="2.3"
			strokeLinecap="round"
		/>
		<path
			d="M4 14.5c4.2-6 8-6 12.2 0S24 20.5 28 14.5"
			fill="none"
			stroke="#FFD100"
			strokeWidth="2"
			strokeLinecap="round"
		/>
	</>
);

const Jsrc = () => (
	<>
		<circle cx="16" cy="16" r="15" fill="#F5B400" />
		<path d="M16 5.5c1.8 3.2 1.8 5.4 0 8.2-1.8-2.8-1.8-5 0-8.2z" fill="#D0121A" />
		<path d="M8.2 12.2c3.4.6 5.6 2.4 7.2 6.2-3.2-.8-5.6-2.6-7.2-6.2z" fill="#D0121A" />
		<path d="M23.8 12.2c-3.4.6-5.6 2.4-7.2 6.2 3.2-.8 5.6-2.6 7.2-6.2z" fill="#D0121A" />
		<circle cx="16" cy="20.5" r="2.1" fill="#D0121A" />
	</>
);

const BankLogo = ({ name, size = 28 }: { name: string; size?: number }) => {
	const kind = bankKind(name);
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
			{kind === "boc" && <Boc />}
			{kind === "ccb" && <Ccb />}
			{kind === "cmb" && <Cmb />}
			{kind === "jsb" && <Jsb />}
			{kind === "jsrc" && <Jsrc />}
			{kind === "generic" && (
				<>
					<rect width="32" height="32" rx="6" fill="#576B95" />
					<text x="16" y="21" textAnchor="middle" fontSize="14" fill="#fff" fontFamily="sans-serif">
						{name.slice(0, 1) || "银"}
					</text>
				</>
			)}
		</svg>
	);
};

export default BankLogo;
