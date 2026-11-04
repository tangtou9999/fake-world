import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export const NavBar = ({ title, right }: { title: string; right?: ReactNode }) => {
	const navigate = useNavigate();
	return (
		<div className="relative flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] px-4">
			<button type="button" aria-label="返回" className="absolute left-3 flex h-8 w-8 items-center" onClick={() => navigate(-1)}>
				<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
					<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>
			<div className="font-medium text-[17.5px]">{title}</div>
			{right && <div className="absolute right-4">{right}</div>}
		</div>
	);
};

export const Field = ({
	label,
	value,
	onChange,
	placeholder,
	inputMode,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	inputMode?: "decimal" | "text";
}) => (
	<label className="flex min-h-[54px] items-center border-black/10 border-b bg-white px-4 text-[16px]">
		<span className="w-[88px] shrink-0 text-black/90">{label}</span>
		<input
			className="min-w-0 flex-1 bg-transparent py-3 text-black/90 outline-none placeholder:text-black/30"
			value={value}
			placeholder={placeholder}
			inputMode={inputMode}
			onChange={(e) => onChange(e.target.value)}
		/>
	</label>
);

export const GreenButton = ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => (
	<button
		type="button"
		disabled={disabled}
		onClick={onClick}
		className="mx-auto mt-8 block h-[48px] w-[200px] rounded-[6px] bg-[#07C160] font-medium text-[17px] text-white disabled:opacity-40"
	>
		{children}
	</button>
);
