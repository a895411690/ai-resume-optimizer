const FLASH_MODEL = process.env.DEEPSEEK_FLASH_MODEL || "deepseek-chat";
const PRO_MODEL = process.env.DEEPSEEK_PRO_MODEL || "deepseek-chat";

function chooseDeepSeekModel(input = {}) {
  const scene = String(input.scene || "diagnose_basic");
  const textLength = Number(input.textLength || 0);
  const jdLength = Number(input.jdLength || 0);
  const workItemCount = Number(input.workItemCount || 0);
  const userTier = String(input.userTier || "free");
  const userType = String(input.userType || "");
  const proQuotaRemaining = input.proQuotaRemaining == null ? 3 : Number(input.proQuotaRemaining);

  const proScene = /deep|jd_match|explain|module_optimize/.test(scene);
  const complexContent = textLength > 1500 || jdLength > 1200 || workItemCount >= 4;
  const seniorUser = userType === "senior";
  const paidUser = userTier === "paid" || userTier === "enterprise" || userTier === "advisor";
  const shouldUsePro = paidUser || proScene || complexContent || seniorUser;

  if (shouldUsePro && !paidUser && proQuotaRemaining <= 0) {
    return {
      tier: "flash",
      model: FLASH_MODEL,
      reason: "Pro quota exhausted; downgraded to Flash for availability.",
      downgraded: true,
    };
  }

  if (shouldUsePro) {
    return {
      tier: "pro",
      model: PRO_MODEL,
      reason: proScene ? "Deep or complex scene routed to Pro." : "Complex content or privileged user routed to Pro.",
      downgraded: false,
    };
  }

  return {
    tier: "flash",
    model: FLASH_MODEL,
    reason: "Basic lightweight scene routed to Flash.",
    downgraded: false,
  };
}

module.exports = {
  chooseDeepSeekModel,
};
