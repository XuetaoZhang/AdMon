import {
  Address,
  type AddressValue,
  Capability,
  type Change,
  type Handle,
  type Hex,
  type InferParams,
  type ParamsSpec,
  Protocol,
  Query,
  Receipt,
  type ReceiptResult
} from "@themoss/core";
import { decodeEventLog, getAddress } from "viem";
import { AdMonAbi } from "./abis/admon.js";

// Replaced with the verified Monad deployment before the public demo.
export const ADMON_ADDRESS: AddressValue = getAddress(
  process.env.ADMON_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000ad0"
);

const claimableParams = {
  account: {
    type: Address,
    description: "Address whose accrued AdMon click rewards are read."
  }
} satisfies ParamsSpec;

const claimParams = {} satisfies ParamsSpec;

type ClaimOutcome = {
  operation: "claim";
  account: AddressValue;
  amount: string;
};

@Protocol({
  name: "admon",
  category: "rewards",
  description:
    "AdMon transparent click rewards for users and agent publishers on Monad.",
  contracts: { settlement: { abi: AdMonAbi, addr: ADMON_ADDRESS } },
  labels: { Settlement: ADMON_ADDRESS }
})
export class AdMonProtocol {
  declare settlement: Handle<typeof AdMonAbi>;

  @Query({
    intent: "Read claimable AdMon click rewards",
    params: claimableParams,
    tags: ["advertising", "balance"]
  })
  async claimable(params: InferParams<typeof claimableParams>) {
    const amount = await this.settlement.read.claimable([params.account]);
    return { account: params.account, amount: amount.toString(), token: "native" };
  }

  @Capability<AdMonProtocol, typeof claimParams>({
    intent: "Claim accrued AdMon click rewards",
    verb: "claim",
    params: claimParams,
    receipt: "claimReceipt",
    // Moss currently requires at least one closed-set risk label for every write.
    // Use the conservative label because the user spends gas to call an external
    // contract, even though the verified reward flow transfers MON inward.
    risk: ["fundOut"],
    tags: ["advertising", "rewards"]
  })
  async claim() {
    return [this.settlement.claim([])];
  }

  @Receipt()
  claimReceipt(changes: readonly Change[]): ReceiptResult<ClaimOutcome> {
    let transfer: Extract<Change, { kind: "nativeTransfer" }> | undefined;
    let event: ClaimOutcome | undefined;

    const parsed = changes.map((change) => {
      if (change.kind === "nativeTransfer") {
        if (transfer) throw new Error("AdMon claim emitted multiple native transfers");
        transfer = change;
        return {
          kind: "change" as const,
          change,
          data: { operation: "nativeTransfer", value: change.value },
          text: `Native MON Transfer: ${change.value} from ${change.from} to ${change.to}`
        };
      }

      let decoded: ReturnType<typeof decodeEventLog<typeof AdMonAbi>>;
      try {
        decoded = decodeEventLog({
          abi: AdMonAbi,
          topics: change.topics as [Hex, ...Hex[]],
          data: change.data,
          strict: true
        });
      } catch {
        throw new Error("Unexpected Change: unsupported AdMon event");
      }
      if (decoded.eventName !== "RewardClaimed" || event) {
        throw new Error(`Unexpected Change: AdMon claim emitted ${decoded.eventName}`);
      }
      event = {
        operation: "claim",
        account: decoded.args.account,
        amount: decoded.args.amount.toString()
      };
      return {
        kind: "change" as const,
        change,
        data: event,
        text: `AdMon Reward Claimed: ${event.amount} native MON by ${event.account}`
      };
    });

    if (!transfer || !event) {
      throw new Error("AdMon claim Receipt requires a native transfer and RewardClaimed event");
    }
    if (
      event.amount !== transfer.value ||
      event.account.toLowerCase() !== transfer.to.toLowerCase() ||
      transfer.from.toLowerCase() !== ADMON_ADDRESS.toLowerCase()
    ) {
      throw new Error("AdMon claim Receipt transfer does not match RewardClaimed");
    }

    return {
      kind: "receipt",
      outcome: event,
      text: `AdMon Reward Claimed: ${event.amount} native MON by ${event.account}`,
      changes: parsed
    };
  }
}
