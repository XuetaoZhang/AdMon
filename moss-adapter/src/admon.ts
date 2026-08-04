import {
  Address,
  type AddressValue,
  type Handle,
  type InferParams,
  type ParamsSpec,
  Protocol,
  Query,
  UnsignedIntegerString
} from "@themoss/core";
import { getAddress } from "viem";
import { AdMonAbi } from "./abis/admon.js";

export const ADMON_ADDRESS: AddressValue = getAddress(
  process.env.ADMON_CONTRACT_ADDRESS || "0x2501155A34E0af59a21751045abB6A9056b7e1Ab"
);

const campaignParams = {
  campaignId: {
    type: UnsignedIntegerString,
    description: "AdMon campaign identifier to inspect without creating a transaction."
  }
} satisfies ParamsSpec;

const recoveryParams = {
  account: {
    type: Address,
    description: "Address whose exceptional payout-recovery balance is read."
  }
} satisfies ParamsSpec;

@Protocol({
  name: "admon",
  category: "rewards",
  description:
    "Read AdMon campaign and payout state without asking the user to sign reward transactions.",
  contracts: { settlement: { abi: AdMonAbi, addr: ADMON_ADDRESS } },
  labels: { Settlement: ADMON_ADDRESS }
})
export class AdMonProtocol {
  declare settlement: Handle<typeof AdMonAbi>;

  @Query({
    intent: "Inspect an AdMon campaign",
    params: campaignParams,
    tags: ["advertising", "campaign"]
  })
  async campaign(params: InferParams<typeof campaignParams>) {
    const result = await this.settlement.read.campaigns([BigInt(params.campaignId)]);
    return {
      advertiser: result[0],
      topicId: result[1].toString(),
      clickRewardWei: result[2].toString(),
      activeUntil: result[3].toString(),
      active: result[4],
      landingUrl: result[5]
    };
  }

  @Query({
    intent: "Read an exceptional AdMon payout recovery balance",
    params: recoveryParams,
    tags: ["advertising", "recovery"]
  })
  async recoveryBalance(params: InferParams<typeof recoveryParams>) {
    const amount = await this.settlement.read.pendingPayout([params.account]);
    return { account: params.account, amountWei: amount.toString(), token: "native" };
  }
}
