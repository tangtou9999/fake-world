import useScreenTopBg from "@/components/useScreenTopBg";
import { applyScanPay } from "@/stateV2/walletFlow";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, GreenButton, NavBar } from "../addFriend/Shared";

const ScanPay = () => {
	const navigate = useNavigate();
	const [merchant, setMerchant] = useState("");
	const [amount, setAmount] = useState("");
	const [product, setProduct] = useState("");
	const [acquirer, setAcquirer] = useState("财付通支付科技有限公司");
	useScreenTopBg("#EDEDED");
	const ok = merchant.trim() && /^\d{1,7}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

	const pay = () => {
		if (!ok) return;
		const id = applyScanPay({
			merchant: merchant.trim(),
			amount: Number(amount).toFixed(2),
			product: product.trim() || "扫码付款",
			acquirer: acquirer.trim() || undefined,
		});
		if (id) navigate(`/wechat/pay-service/bill/${id}`, { replace: true });
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="扫码支付" />
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mt-3 border-black/10 border-t">
					<Field label="商户名称" value={merchant} onChange={setMerchant} placeholder="例如 美宜佳" />
					<Field label="金额(元)" value={amount} onChange={setAmount} placeholder="0.00" inputMode="decimal" />
					<Field label="商品" value={product} onChange={setProduct} placeholder="可不填" />
					<Field label="收单机构" value={acquirer} onChange={setAcquirer} />
				</div>
				<div className="px-5 pt-3 text-[13px] text-black/40 leading-5">
					零钱够用时从零钱扣款，并在「零钱明细」里出现「扫二维码付款-给商户」；不够则视为银行卡支付，只出现在微信支付里。
				</div>
				<GreenButton onClick={pay} disabled={!ok}>
					确认支付
				</GreenButton>
			</div>
		</div>
	);
};

export default ScanPay;
