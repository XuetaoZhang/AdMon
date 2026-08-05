import {
  Address,
  Capability,
  type Change,
  type InferParams,
  type MossRuntime,
  type ParamsSpec,
  PositiveDecimalString,
  Protocol,
  Receipt,
  Registry,
  transaction
} from "@themoss/core";
import { getAddress, parseUnits } from "viem";

const nativeTransferParams = {
  recipient: {
    type: Address,
    description: "The exact account permitted to receive native MON."
  },
  amountMon: {
    type: PositiveDecimalString,
    description: "The maximum native MON amount permitted by this capability."
  }
} satisfies ParamsSpec;

@Protocol({
  name: "admon-safety",
  category: "token",
  description: "Builds a bounded unsigned native-MON transfer and verifies its observed effects.",
  contracts: {}
})
export class AdMonSafetyProtocol {
  @Capability<AdMonSafetyProtocol, typeof nativeTransferParams>({
    intent: "Transfer {amountMon} native MON to {recipient}",
    verb: "transfer",
    params: nativeTransferParams,
    receipt: "nativeTransferReceipt",
    risk: ["fundOut"]
  })
  async nativeTransfer(
    { recipient, amountMon }: InferParams<typeof nativeTransferParams>,
    ctx: { account: `0x${string}` }
  ) {
    return [
      transaction(ctx.account, getAddress(recipient), {
        value: parseUnits(amountMon, 18)
      })
    ];
  }

  @Receipt()
  nativeTransferReceipt(changes: readonly Change[]) {
    if (changes.length !== 1 || changes[0]?.kind !== "nativeTransfer") {
      throw new Error("Expected exactly one native MON transfer change.");
    }
    const transfer = changes[0];
    return {
      kind: "receipt" as const,
      outcome: {
        operation: "native-transfer",
        from: transfer.from,
        to: transfer.to,
        value: transfer.value
      },
      text: "Verified one native MON transfer",
      changes: [
        {
          kind: "change" as const,
          change: transfer,
          data: { operation: "native-transfer" },
          text: "Observed the native MON transfer"
        }
      ]
    };
  }
}

export type MossSafetyPreview = {
  state: "capability-ready";
  protocol: "admon-safety";
  method: "nativeTransfer";
  summary: string;
  risk: readonly string[];
  params: {
    recipient: string;
    amountMon: string;
  };
  transaction: {
    from: string;
    to: string;
    data: string;
    value: string;
  };
  receipt: {
    state: "awaiting-execution";
    verifier: "nativeTransferReceipt";
    message: string;
  };
};

const offlineRuntime: MossRuntime = {
  rpcUrl: "offline://capability-builder",
  client: {} as MossRuntime["client"]
};

export async function buildNativeTransferPreview(input: {
  account: string;
  recipient: string;
  amountMon: string;
}): Promise<MossSafetyPreview> {
  const account = getAddress(input.account);
  const registry = new Registry(offlineRuntime).use(AdMonSafetyProtocol);
  const [stub] = registry.load([{ protocol: "admon-safety", method: "nativeTransfer" }]);
  const capability = await registry.action("admon-safety", "nativeTransfer", account, {
    recipient: input.recipient,
    amountMon: input.amountMon
  });
  if (capability.kind !== "capability") throw new Error("Moss returned no Capability.");
  const transactionNode = capability.children[0];
  if (!transactionNode || transactionNode.kind !== "transaction") {
    throw new Error("Moss Capability contains no transaction.");
  }

  return {
    state: "capability-ready",
    protocol: "admon-safety",
    method: "nativeTransfer",
    summary: stub?.intent || "Bounded native MON transfer",
    risk: stub?.risk || ["fundOut"],
    params: {
      recipient: getAddress(input.recipient),
      amountMon: input.amountMon
    },
    transaction: transactionNode.transaction,
    receipt: {
      state: "awaiting-execution",
      verifier: "nativeTransferReceipt",
      message: "Receipt verification starts only after an executed transaction supplies observed changes."
    }
  };
}
